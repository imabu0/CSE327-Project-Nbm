const express = require("express");
const { google } = require("googleapis");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const session = require("express-session");
require("dotenv").config();
const pg = require("pg");
const cors = require("cors");
const stream = require("stream");
const archiver = require("archiver");

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
app.use(cors({ origin: "http://localhost:5173", credentials: true }));

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
    
    // Initialize the session tokens array if it doesn't exist
    if (!req.session.tokens) {
      req.session.tokens = [];
    }

    // Add the new tokens to the session
    req.session.tokens.push(tokens);
    res.redirect("http://localhost:5173/all");
  } catch (error) {
    console.error("Error during OAuth:", error.message);
    res.status(500).send("Authentication failed.");
  }
});

// Endpoint: List files in Google Drive
app.get("/drive", async (req, res) => {
  const folderId = req.query.folderId || "root";

  if (!req.session.tokens || req.session.tokens.length === 0) {
    return res.status(401).send("No accounts linked.");
  }

  const files = [];

  for (const token of req.session.tokens) {
    oauth2Client.setCredentials(token);
    await refreshTokenIfNeeded(oauth2Client);

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    try {
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: "files(id, name, mimeType)",
      });
      files.push(...response.data.files);
    } catch (error) {
      console.error("Error listing files:", error.message);
    }
  }

  res.json(files);
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

// Upload File to Google Drive
app.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;
  const parentFolderId = req.body.folderId || "root";

  if (!file) {
    return res.status(400).send("No file uploaded.");
  }
  if (!req.session.tokens || req.session.tokens.length === 0) {
    return res.status(400).send("No accounts linked.");
  }

  const fileSize = file.size; // Size of the uploaded file
  let uploaded = false;
  console.log((fileSize / 1024 / 1024 / 1024).toFixed(2) + " GB");

  for (const token of req.session.tokens) {
    oauth2Client.setCredentials(token);
    await refreshTokenIfNeeded(oauth2Client);

    try {
      const availableStorage = await getAvailableStorage(oauth2Client);
      console.log(`Available storage for account: ${(availableStorage / 1024 / 1024 / 1024).toFixed(2)} GB`);
      const up = availableStorage - fileSize;
      console.log((up / 1024 / 1024 / 1024).toFixed(2));

      if (up > 0) {
        const drive = google.drive({ version: "v3", auth: oauth2Client });

        const fileMetadata = {
          name: file.originalname,
          parents: parentFolderId !== "root" ? [parentFolderId] : [], // If a parent folder is provided
        };
        const media = { mimeType: file.mimetype, body: fs.createReadStream(file.path) };

        // Create a writable stream to track progress
        const progressStream = new stream.PassThrough();
        let uploadedBytes = 0;

        // Track upload progress
        progressStream.on('data', (chunk) => {
          uploadedBytes += chunk.length;
          const percentCompleted = Math.round((uploadedBytes * 100) / fileSize);
          console.log(`Upload progress: ${percentCompleted}%`);
        });

        const response = await drive.files.create({
          resource: fileMetadata,
          media: {
            mimeType: file.mimetype,
            body: media.body.pipe(progressStream), // Pipe the media through the progress stream
          },
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
    }
  }

  if (!uploaded) {
    return res.status(400).send("Not enough storage available in any linked account.");
  }
});

// Chunk and upload
app.post("/chunk", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).send("No file uploaded.");
  if (!req.session.tokens || req.session.tokens.length === 0)
    return res.status(400).send("No accounts linked.");

  const fileSize = file.size;
  let startByte = 0;
  let chunkIndex = 1;
  const chunkUploads = []; // Store uploaded chunk info

  console.log(`File Size: ${(fileSize / 1024 / 1024 / 1024).toFixed(2)} GB`);

  for (const token of req.session.tokens) {
    oauth2Client.setCredentials(token);
    await refreshTokenIfNeeded(oauth2Client);

    try {
      const availableStorage = await getAvailableStorage(oauth2Client);
      console.log(`Available Storage: ${(availableStorage / 1024 / 1024 / 1024).toFixed(2)} GB`);

      if (availableStorage <= 0) continue;

      const chunkSize = Math.min(availableStorage, fileSize - startByte);
      if (chunkSize <= 0) break;

      const chunkPath = `${file.path}.part${chunkIndex}`;
      const chunkFile = fs.createWriteStream(chunkPath);
      const readStream = fs.createReadStream(file.path, { start: startByte, end: startByte + chunkSize - 1 });

      console.log(`Creating chunk ${chunkIndex} (${(chunkSize / 1024 / 1024).toFixed(2)} MB)`);

      await new Promise((resolve, reject) => {
        readStream.pipe(chunkFile);
        chunkFile.on("finish", resolve);
        chunkFile.on("error", reject);
      });

      const drive = google.drive({ version: "v3", auth: oauth2Client });
      const fileMetadata = { name: `${file.originalname}.part${chunkIndex}` };
      const media = { mimeType: file.mimetype, body: fs.createReadStream(chunkPath) };

      // Track upload progress
      const progressStream = new stream.PassThrough();
      let uploadedBytes = 0;
      progressStream.on("data", (chunk) => {
        uploadedBytes += chunk.length;
        const percentCompleted = ((uploadedBytes / chunkSize) * 100).toFixed(2);
        console.log(`Uploading Chunk ${chunkIndex}: ${percentCompleted}% completed`);
      });

      const response = await drive.files.create({
        resource: fileMetadata,
        media: {
          mimeType: media.mimeType,
          body: media.body.pipe(progressStream),
        },
        fields: "id",
      });

      console.log(`Uploaded Chunk ${chunkIndex}: File ID - ${response.data.id}`);
      chunkUploads.push({ part: chunkIndex, fileId: response.data.id });

      fs.unlinkSync(chunkPath); // Remove chunk after upload

      startByte += chunkSize;
      chunkIndex++;
      if (startByte >= fileSize) break;
    } catch (err) {
      console.error("Error uploading chunk:", err.message);
    }
  }

  fs.unlinkSync(file.path); // Remove the original uploaded file
  res.send({ message: "File uploaded in chunks successfully!", chunks: chunkUploads });
});

// Upload Folder to Google Drive
app.post("/upload-folder", upload.array("files"), async (req, res) => {
  const files = req.files;
  const parentFolderId = req.body.folderId || "root"; // Target folder
  const folderName = req.body.folderName;

  if (!files || files.length === 0) {
    return res.status(400).send("No files uploaded.");
  }
  if (!folderName) {
    return res.status(400).send("Folder name is missing.");
  }

  let createdFolderId = parentFolderId;

  try {
    oauth2Client.setCredentials(req.session.tokens[0]);
    await refreshTokenIfNeeded(oauth2Client);

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Step 1: Create a new folder in Google Drive
    const folderMetadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentFolderId !== "root" ? [parentFolderId] : [],
    };

    const folderResponse = await drive.files.create({
      resource: folderMetadata,
      fields: "id",
    });

    createdFolderId = folderResponse.data.id;
    console.log(`📂 Folder "${folderName}" created. ID: ${createdFolderId}`);
  } catch (error) {
    console.error("❌ Error creating folder:", error.message);
    return res.status(500).send("Failed to create folder.");
  }

  // Step 2: Upload all files into the created folder
  let uploadedFiles = [];

  for (const file of files) {
    let uploaded = false;

    for (const token of req.session.tokens) {
      oauth2Client.setCredentials(token);
      await refreshTokenIfNeeded(oauth2Client);

      try {
        const drive = google.drive({ version: "v3", auth: oauth2Client });

        const fileMetadata = {
          name: file.originalname,
          parents: [createdFolderId],
        };

        const media = { mimeType: file.mimetype, body: fs.createReadStream(file.path) };

        const response = await drive.files.create({
          resource: fileMetadata,
          media: media,
          fields: "id",
        });

        // Clean up the uploaded file
        fs.unlinkSync(file.path);
        uploaded = true;
        uploadedFiles.push({ fileName: file.originalname, fileId: response.data.id });

        console.log(`✅ File "${file.originalname}" uploaded.`);
        break;
      } catch (err) {
        console.error("❌ Error uploading file:", err.message);
      }
    }

    if (!uploaded) {
      return res.status(400).send(`Not enough storage to upload file: ${file.originalname}`);
    }
  }

  res.json({
    message: `Folder "${folderName}" uploaded successfully!`,
    folderId: createdFolderId,
    uploadedFiles,
  });
});

// Endpoint: Delete File from Google Drive
app.delete("/delete/:fileId", async (req, res) => {
  const fileId = req.params.fileId;

  if (!req.session.tokens || req.session.tokens.length === 0) {
    return res.status(400).send("No accounts linked.");
  }

  for (const token of req.session.tokens) {
    oauth2Client.setCredentials(token);
    await refreshTokenIfNeeded(oauth2Client);

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    try {
      await drive.files.delete({ fileId });
      return res.send(`File with ID: ${fileId} deleted successfully.`);
    } catch (err) {
      console.error("Google Drive API error while deleting:", err.response?.data || err.message);
      // Continue to the next account if there's an error
    }
  }

  // If all accounts fail
  res.status(500).send("Failed to delete file from all linked accounts.");
});

// Endpoint: Download file
app.get("/download/:fileId", async (req, res) => {
  const fileId = req.params.fileId;

  if (!req.session.tokens || req.session.tokens.length === 0) {
    return res.status(401).send("No accounts linked.");
  }

  for (const token of req.session.tokens) {
    oauth2Client.setCredentials(token);
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
      response.data.on("end", () => {
        console.log("Download completed.");
      });
      response.data.on("error", (err) => {
        console.error("Error downloading file:", err);
        // If there's an error, continue to the next account
      });

      return; // Exit the loop if the download is successful
    } catch (error) {
      console.error("Error downloading file from account:", error.message);
      // Continue to the next account if there's an error
    }
  }

  // If all accounts fail
  res.status(500).send("Failed to download file from all linked accounts.");
});

// Zip and download folder
app.get("/download-folder/:folderId", async (req, res) => {
  const folderId = req.params.folderId;

  if (!req.session.tokens || req.session.tokens.length === 0) {
    return res.status(401).send("No accounts linked.");
  }

  for (const token of req.session.tokens) {
    oauth2Client.setCredentials(token);
    await refreshTokenIfNeeded(oauth2Client);

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    try {
      const folderMetadata = await drive.files.get({ fileId: folderId, fields: "name" });
      const folderName = folderMetadata.data.name || "folder";

      const { data } = await drive.files.list({
        q: `'${folderId}' in parents`,
        fields: "files(id, name, mimeType)",
      });

      if (!data.files.length) return res.status(404).send("Folder is empty.");

      res.setHeader("Content-Disposition", `attachment; filename="${folderName}.zip"`);
      res.setHeader("Content-Type", "application/zip");

      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.pipe(res);

      for (const file of data.files) {
        const response = await drive.files.get({ fileId: file.id, alt: "media" }, { responseType: "stream" });
        archive.append(response.data, { name: file.name });
      }

      archive.finalize();
      return;
    } catch (error) {
      console.error("Error downloading folder:", error.message);
    }
  }

  res.status(500).send("Failed to download folder.");
});

// Create a folder in Google Drive
app.post("/create-folder", async (req, res) => {
  const { folderName, parentFolderId } = req.body;

  if (!folderName) {
    return res.status(400).send("Folder name is required.");
  }
  if (!req.session.tokens || req.session.tokens.length === 0) {
    return res.status(400).send("No accounts linked.");
  }

  let folderCreated = false;
  let createdFolderId = null;

  for (const token of req.session.tokens) {
    oauth2Client.setCredentials(token);
    await refreshTokenIfNeeded(oauth2Client);

    try {
      const drive = google.drive({ version: "v3", auth: oauth2Client });

      const folderMetadata = {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: parentFolderId ? [parentFolderId] : [], // If a parent folder is provided
      };

      const response = await drive.files.create({
        resource: folderMetadata,
        fields: "id",
      });

      createdFolderId = response.data.id;
      folderCreated = true;
      console.log(`Folder "${folderName}" created successfully! Folder ID: ${createdFolderId}`);
      break; // Stop after first successful folder creation
    } catch (error) {
      console.error("Error creating folder:", error.message);
    }
  }

  if (!folderCreated) {
    return res.status(400).send("Failed to create folder.");
  }

  res.json({ message: "Folder created successfully!", folderId: createdFolderId });
});

// List Linked Accounts
app.get("/accounts", (req, res) => {
  res.json(req.session.tokens || []);
});

// Serve static files (CSS, JS)
app.use(express.static(path.join(__dirname, "public")));

// Serve the homepage
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));