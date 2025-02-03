const express = require("express");
const { google } = require("googleapis");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
require("dotenv").config();
const pg = require("pg");

// PostgreSQL Connection
const pool = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.connect()
  .then(() => console.log("✅ PostgreSQL Connected Successfully"))
  .catch((err) => console.error("❌ PostgreSQL Connection Failed:", err));

const app = express();
const PORT = process.env.PORT;

// Load OAuth2 client credentials
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

app.use(express.json());
app.use(express.static("public"));
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

// Multer for file uploads
const upload = multer({ dest: "uploads/" });

// Helper: Refresh token if expired
async function refreshTokenIfNeeded(auth) {
  if (!auth.credentials.expiry_date || auth.credentials.expiry_date <= Date.now()) {
    const { credentials } = await auth.refreshAccessToken();
    auth.setCredentials(credentials);
  }
}

// Function to get available storage for a given account
async function getAvailableStorage(auth) {
  const drive = google.drive({ version: "v3", auth });
  try {
    const response = await drive.about.get({
      fields: "storageQuota",
    });
    const { storageQuota } = response.data;
    return parseInt(storageQuota.limit) - parseInt(storageQuota.usage); // Available storage
  } catch (err) {
    console.error("Failed to get available storage:", err.message);
    throw new Error("Failed to get available storage.");
  }
}

// Endpoint: OAuth authorization
app.get("/authorize", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/drive"],
  });
  res.redirect(authUrl);
});

// Endpoint: OAuth callback
app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    req.session.tokens = tokens;
    res.redirect("/");
  } catch (error) {
    console.error("Error during OAuth:", error.message);
    res.status(500).send("Authentication failed.");
  }
});

// Endpoint: List files in Google Drive
app.get("/drive", async (req, res) => {
  const folderId = req.query.folderId || "root";

  if (!req.session.tokens) {
    return res.status(401).send("No account linked.");
  }

  oauth2Client.setCredentials(req.session.tokens);
  await refreshTokenIfNeeded(oauth2Client);

  const drive = google.drive({ version: "v3", auth: oauth2Client });

  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name, mimeType)",
    });
    res.json(response.data.files);
  } catch (error) {
    console.error("Error listing files:", error.message);
    res.status(500).send("Failed to retrieve files.");
  }
});

// Endpoint: Get parent folder ID
app.get("/drive/parent", async (req, res) => {
  const folderId = req.query.folderId;

  if (!req.session.tokens) {
    return res.status(401).send("No account linked.");
  }

  oauth2Client.setCredentials(req.session.tokens);
  await refreshTokenIfNeeded(oauth2Client);

  const drive = google.drive({ version: "v3", auth: oauth2Client });

  try {
    const response = await drive.files.get({
      fileId: folderId,
      fields: "parents",
    });
    res.send(response.data.parents?.[0] || "root");
  } catch (error) {
    console.error("Error fetching parent folder:", error.message);
    res.status(500).send("Unable to fetch parent folder.");
  }
});

// Step 4: Upload File to Google Drive
app.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).send("No file uploaded.");
  }
  if (!req.session.tokens || req.session.tokens.length === 0) {
    return res.status(400).send("No accounts linked.");
  }

  const fileSize = file.size; // Size of the uploaded file
  let uploaded = false;

  oauth2Client.setCredentials(req.session.tokens);
  await refreshTokenIfNeeded(oauth2Client);

    try {
      const availableStorage = await getAvailableStorage(oauth2Client);
      console.log(`Available storage for account: ${availableStorage/1024/1024/1024} GB`);

      if (availableStorage >= fileSize) {
        const drive = google.drive({ version: "v3", auth: oauth2Client });

        const fileMetadata = { name: file.originalname };
        const media = { mimeType: file.mimetype, body: fs.createReadStream(file.path) };

        const response = await drive.files.create({
          resource: fileMetadata,
          media: media,
          fields: "id",
        });

        fs.unlinkSync(file.path); // Clean up uploaded file
        uploaded = true;
        return res.send(`File uploaded successfully! File ID: ${response.data.id}`);
      } else {
        console.log(`Not enough storage in this account. Trying next account...`);
      }
    } catch (err) {
      console.error("Error during upload attempt:", err.message);
      // Log the error but continue to the next account
    }
  
  if (!uploaded) {
    return res.status(400).send("Not enough storage available in any linked account.");
  }
});

// Step 6: Delete File from Google Drive
app.delete("/delete/:fileId", async (req, res) => {
  const fileId = req.params.fileId;

  if (!req.session.tokens) {
    return res.status(400).send("No account linked.");
  }

  oauth2Client.setCredentials(req.session.tokens); // Use the first account for deletion
  await refreshTokenIfNeeded(oauth2Client);

  const drive = google.drive({ version: "v3", auth: oauth2Client });

  try {
    await drive.files.delete({ fileId });
    res.send(`File with ID: ${fileId} deleted successfully.`);
  } catch (err) {
    console.error("Google Drive API error:", err.response?.data || err.message);
    res.status(500).send("Failed to delete file.");
  }
});

// Endpoint: Download file
app.get("/download/:fileId", async (req, res) => {
  const fileId = req.params.fileId;

  if (!req.session.tokens) {
    return res.status(401).send("No account linked.");
  }

  oauth2Client.setCredentials(req.session.tokens);
  await refreshTokenIfNeeded(oauth2Client);

  const drive = google.drive({ version: "v3", auth: oauth2Client });

  try {
    const fileMetadata = await drive.files.get({ fileId, fields: "name" });
    const fileName = fileMetadata.data.name;

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", "application/octet-stream");

    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    response.data.pipe(res);
  } catch (error) {
    console.error("Error downloading file:", error.message);
    res.status(500).send("Failed to download file.");
  }
});

// Step 7: List Linked Accounts
app.get("/accounts", (req, res) => {
  res.json(req.session.tokens || []);
});

// Serve the homepage
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});