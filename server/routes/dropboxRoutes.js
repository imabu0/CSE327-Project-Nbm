const express = require("express");
const multer = require("multer");
const {
  uploadFile,
  listFiles,
  downloadFile,
  deleteFile,
} = require("../models/dropbox.model.js");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }); // Store file in memory

// ✅ Upload file to Dropbox
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const dropboxPath = `/${req.file.originalname}`; // File path in Dropbox
    const result = await uploadFile(req.file.buffer, dropboxPath);

    res.json({ message: "File uploaded successfully", file: result });
  } catch (error) {
    console.error("❌ File upload error:", error);
    res.status(500).json({ error: "File upload failed" });
  }
});

// ✅ List files in Dropbox
router.get("/files", async (req, res) => {
  try {
    const files = await listFiles();
    res.json(files);
  } catch (error) {
    console.error("❌ Error fetching files:", error);
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

// ✅ Download file from Dropbox
router.get("/download", async (req, res) => {
  try {
    const { path } = req.query;
    if (!path) return res.status(400).json({ error: "File path required" });

    // Call Dropbox API to download the file
    const file = await downloadFile(path);

    // Set response headers for file download
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.split("/").pop()}"`
    );
    res.setHeader("Content-Type", "application/octet-stream");

    // Send the file content as a buffer
    res.send(file);
  } catch (error) {
    console.error("❌ File download error:", error);
    res.status(500).json({ error: "Download failed" });
  }
});

// ✅ Delete file from Dropbox
router.delete("/delete", async (req, res) => {
  try {
    const { path } = req.query;
    if (!path) return res.status(400).json({ error: "File path required" });

    const result = await deleteFile(path);
    res.json({ message: "File deleted successfully", result });
  } catch (error) {
    console.error("❌ File delete error:", error);
    res.status(500).json({ error: "Delete failed" });
  }
});

module.exports = router;
