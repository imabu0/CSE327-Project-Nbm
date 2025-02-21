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

router.get("/download/:fileId", async (req, res) => {
  const { fileId } = req.params; // Get the file ID from the URL
  try {
      // Define the path where the merged file will be saved
      const result = await pool.query("SELECT * FROM file_info WHERE id = $1", [fileId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "File not found in database" });
    }

    // Extract file information
    const { title, fileextension } = result.rows[0]; // Accessing the first row


    // Define the path where the merged file will be saved
    const outputFilePath = path.join(__dirname, "..", "downloads", `${title}`);

      // Ensure the "downloads" directory exists
      const downloadsDir = path.join(__dirname, "..", "downloads");
      if (!fs.existsSync(downloadsDir)) {
          fs.mkdirSync(downloadsDir); // Create the directory if it doesn't exist
      }

      // Call the function to download and merge chunks
      await fileOp.downFile(fileId, outputFilePath); // Ensure this function is correctly implemented

      console.log(outputFilePath);
      // Send the merged file as a response
        setTimeout(()=>{
        res.download(outputFilePath, title ,(err) => {
            if (err) {
                console.error("❌ Error sending file:", err.message);
                res.status(500).json({ error: "Failed to send the file." });
            } else {
                fs.unlinkSync(outputFilePath);
                console.log("✅ File sent and deleted successfully." , title);
            }
        });
      },1000);
  }
  catch (error) {
      console.error("❌ Download Route Error:", error.message);
      res.status(500).json({ error: error.message });
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

module.exports = router;
