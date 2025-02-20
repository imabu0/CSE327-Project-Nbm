const express = require("express");
const multer = require("multer");
const FileOp = require("../models/file.model.js");

const router = express.Router();
const fileOp = new FileOp();
const upload = multer({ dest: "uploads/" }); // Temporary folder for uploaded files

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

module.exports = router;
