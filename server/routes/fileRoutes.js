const express = require("express");
const multer = require("multer");
const FileOp = require("../models/file.model.js");
const { pool } = require("../config/db.js");
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

router.patch("/edit/:id", async (req, res) => {
  const { id } = req.params; // Get the file ID from the URL
  const { title } = req.body; // Get the new title from the request body

  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  try {
    // Update the title in the database
    const query = "UPDATE file_info SET title = $1 WHERE id = $2 RETURNING *";
    const values = [title, id];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    res.status(200).json({ message: "Title updated successfully", file: result.rows[0] });
  } catch (error) {
    console.error("❌ Error updating title:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET API to search for files by title
router.get("/search", async (req, res) => {
  const { searchQuery } = req.query; // Get the search query from the query parameters

  if (!searchQuery) {
    return res.status(400).json({ error: "Search query is required" });
  }

  try {
    // Search for files with titles that match the search query
    const query = "SELECT * FROM file_info WHERE title ILIKE $1";
    const values = [`%${searchQuery}%`]; // Use ILIKE for case-insensitive search
    const result = await pool.query(query, values);

    res.status(200).json({ files: result.rows });
  } catch (error) {
    console.error("❌ Error searching files:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route to get available storage
router.get("/space", async (req, res) => {
  try {
    const storage = await fileOp.getAvailableStorage();
    res.status(200).json(storage);
  } catch (error) {
    console.error("❌ Error fetching available storage:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
