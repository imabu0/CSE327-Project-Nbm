const express = require("express");
const { google } = require("googleapis");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8000;

// Load OAuth2 client credentials
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Store tokens for linked accounts
const tokens = [];

// Middleware to serve static files (frontend)
app.use(express.static("public"));
app.use(express.json());

// Multer for file uploads
const upload = multer({ dest: "uploads/" });

// Function to refresh token if expired
async function refreshTokenIfNeeded(auth, tokenIndex) {
  try {
    if (!auth.credentials.expiry_date || auth.credentials.expiry_date <= Date.now()) {
      console.log(`Refreshing access token for account index: ${tokenIndex}`);
      const { credentials } = await auth.refreshAccessToken();
      tokens[tokenIndex] = credentials;
      auth.setCredentials(credentials);
    }
  } catch (err) {
    console.error("Failed to refresh access token:", err.message);
  }
}

// Step 1: Start OAuth Flow
app.get("/authorize", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/drive"],
  });
  res.redirect(authUrl);
});

// Step 2: Handle OAuth Callback
app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;

  try {
    const { tokens: userTokens } = await oauth2Client.getToken(code);
    tokens.push(userTokens);
    res.send("Account linked successfully! You can now upload files.");
  } catch (err) {
    console.error("Error during authentication:", err.message);
    res.status(500).send("Error during authentication.");
  }
});

// Step 3: View Files in Google Drive
app.get("/drive/:index", async (req, res) => {
    const index = parseInt(req.params.index, 10);
  
    if (!tokens[index]) {
      return res.status(400).send("Invalid account index.");
    }
  
    // Set credentials and refresh token if needed
    oauth2Client.setCredentials(tokens[index]);
    await refreshTokenIfNeeded(oauth2Client, index);
  
    const drive = google.drive({ version: "v3", auth: oauth2Client });
  
    try {
      const response = await drive.files.list({
        pageSize: 100,
        fields: "files(id, name, mimeType)",
        q: "'root' in parents or trashed=false",
      });
  
      const files = response.data.files;
      if (files.length) {
        res.json(files);
      } else {
        res.send("No files found.");
      }
    } catch (err) {
      console.error("Google Drive API error:", err.response?.data || err.message);
      res.status(500).send("Failed to retrieve files.");
    }
  });

// Step 3: Upload File to Google Drive
app.post("/upload/:index", upload.single("file"), async (req, res) => {
  const index = parseInt(req.params.index, 10);
  const file = req.file;

  if (!file) {
    return res.status(400).send("No file uploaded.");
  }
  if (!tokens[index]) {
    return res.status(400).send("Invalid account index.");
  }

  // Set credentials and refresh token if needed
  oauth2Client.setCredentials(tokens[index]);
  await refreshTokenIfNeeded(oauth2Client, index);

  const drive = google.drive({ version: "v3", auth: oauth2Client });

  try {
    const fileMetadata = { name: file.originalname };
    const media = { mimeType: file.mimetype, body: fs.createReadStream(file.path) };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id",
    });

    fs.unlinkSync(file.path); // Clean up uploaded file
    res.send(`File uploaded successfully! File ID: ${response.data.id}`);
  } catch (err) {
    console.error("Google Drive API error:", err.response?.data || err.message);
    res.status(500).send("Failed to upload file.");
  }
});

// Step 4: List Linked Accounts
app.get("/accounts", (req, res) => {
  res.json(tokens.map((token, index) => ({ index, token })));
});

// Serve the homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "Untitled-1.html"));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
