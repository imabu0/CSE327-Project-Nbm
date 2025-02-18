const express = require("express");
const multer = require("multer");
const GoogleBucket = require("../models/google.model.js");

const router = express.Router();
const googleDrive = new GoogleBucket();
const upload = multer({ dest: "uploads/" }); // Temporary folder for uploaded files

// Upload route
router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const fileId = await googleDrive.uploadFile(req.file);
    res.json({ success: true, fileId });
  } catch (error) {
    console.error("❌ Upload Route Error:", error.message);
    res.status(500).json({ error: "Upload failed" });
  }
});

module.exports = router;
