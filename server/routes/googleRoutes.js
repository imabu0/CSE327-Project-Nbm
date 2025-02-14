const express = require("express");
const multer = require("multer");
const { google } = require("googleapis");
const {
  SCOPES,
  oauth2Client,
  refreshTokenIfNeeded,
  getAvailableStorage,
  saveTokens,
  loadTokens,
  uploadFile,
  listFiles,
  downloadFile,
  deleteFile,
} = require("../models/google.model.js");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// **🔹 OAuth Authorization**
router.get("/authorize", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
  res.redirect(authUrl);
});

// **🔹 OAuth Callback (Save Multiple Accounts)**
router.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    await saveTokens(tokens);
    res.redirect("http://localhost:5173/dashboard");
  } catch (error) {
    console.error("❌ OAuth Error:", error.message);
    res.status(500).send("Authentication failed.");
  }
});

/**
 * 📌 Upload File to Google Drive
 */
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const parentFolderId = req.body.folderId || "root";

    if (!file) return res.status(400).json({ error: "No file uploaded." });
    if (!req.session.tokens || req.session.tokens.length === 0)
      return res.status(400).json({ error: "No accounts linked." });

    for (const token of req.session.tokens) {
      oauth2Client.setCredentials(token);
      await refreshTokenIfNeeded(oauth2Client);

      try {
        const availableStorage = await getAvailableStorage(oauth2Client);
        if (availableStorage > file.size) {
          const uploadedFileId = await uploadFile(
            oauth2Client,
            file,
            parentFolderId
          );
          return res.json({ success: true, fileId: uploadedFileId });
        }
      } catch (error) {
        console.error("Storage error:", error.message);
      }
    }

    return res.status(400).json({ error: "Not enough storage." });
  } catch (error) {
    console.error("Upload Error:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * 📌 List Files in Google Drive
 */
router.get("/drive", async (req, res) => {
    try {
      const folderId = req.query.folderId || "root";
      const storedTokens = await loadTokens(); // <-- Ensure this works
  
      if (!storedTokens.length) {
        return res.status(401).send("❌ No accounts linked. Please authorize.");
      }
  
      const files = await listFiles(storedTokens, oauth2Client, refreshTokenIfNeeded, folderId);
  
      res.json(files);
    } catch (error) {
      console.error("❌ Error fetching files:", error.message);
      res.status(500).send("Internal Server Error");
    }
  });

/**
 * 📌 Download File from Google Drive
 */
router.get("/download/:fileId", async (req, res) => {
  const fileId = req.params.fileId;

  if (!req.session.tokens || req.session.tokens.length === 0)
    return res.status(401).send("No accounts linked.");

  for (const token of req.session.tokens) {
    oauth2Client.setCredentials(token);
    await refreshTokenIfNeeded(oauth2Client);

    try {
      const { fileName, stream } = await downloadFile(oauth2Client, fileId);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );
      res.setHeader("Content-Type", "application/octet-stream");
      stream.pipe(res);
      return;
    } catch (error) {
      console.error("Error downloading file:", error.message);
    }
  }

  res.status(500).send("Failed to download file.");
});

/**
 * 📌 Delete File from Google Drive
 */
router.delete("/delete/:fileId", async (req, res) => {
  const fileId = req.params.fileId;

  if (!req.session.tokens || req.session.tokens.length === 0)
    return res.status(400).send("No accounts linked.");

  for (const token of req.session.tokens) {
    oauth2Client.setCredentials(token);
    await refreshTokenIfNeeded(oauth2Client);

    try {
      await deleteFile(oauth2Client, fileId);
      return res.send(`File with ID: ${fileId} deleted successfully.`);
    } catch (error) {
      console.error("Delete error:", error.message);
    }
  }

  res.status(500).send("Failed to delete file.");
});

module.exports = router;
