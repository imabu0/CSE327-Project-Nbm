const express = require("express");
const multer = require("multer");
const FileOp = require("../models/file.model.js");
const { pool } = require("../config/db.js");
const router = express.Router();
const fileOp = new FileOp();
const upload = multer({ dest: "uploads/" }); // Temporary folder for uploaded files
const fs = require("fs")
const path = require("path")

// Upload route
router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    // ✅ Correct call to upFile()
    const fileId = await fileOp.upFile(
      req.file.path,
      req.file.originalname,
      req.file.size
    );
    res.json({ success: true, fileId });
  } catch (error) {
    console.error("❌ Upload Route Error:", error.message);
    res.status(500).json({ error: "Upload failed" });
  }
});

router.get("/files", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM file_info ORDER BY created_at DESC");
    res.json(result.rows); // Send the fetched data as JSON
  } catch (error) {
    console.error("❌ Error fetching files:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/download/:fileId", async (req, res) => {
  const { fileId } = req.params;

  if (!fileId) {
    return res.status(400).json({ error: "File ID is required." });
  }

  try {
    await fileOp.downloadAndMergeChunks(fileId, res);
  } catch (error) {
    console.error("❌ Download route error:", error.message);
    res.status(500).json({ error: "Download failed." });
  }
});

router.delete("/delete/:fileId", async (req, res) => {
  const { fileId } = req.params;

  if (!fileId) {
    return res.status(400).json({ error: "File ID is required." });
  }

  try {
    await fileOp.deleteChunks(fileId);
    res.json({ success: true, message: "File and chunks deleted successfully." });
  } catch (error) {
    console.error("❌ Delete route error:", error.message);
    res.status(500).json({ error: "Failed to delete file and chunks." });
  }
});

module.exports = router;
