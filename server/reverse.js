const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
app.use(cors());

// Configure file upload
const upload = multer({ dest: "uploads/" });

// API endpoint to handle image search
app.post("/search", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const uploadedFilePath = req.file.path;
    console.log(`Uploaded file: ${uploadedFilePath}`);

    // Call the Python script
    const pythonProcess = spawn("python3", ["search.py", uploadedFilePath]);

    let result = "";
    let errorOutput = "";

    pythonProcess.stdout.on("data", (data) => {
      result += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        console.error(`Python script error: ${errorOutput}`);
        return res.status(500).json({ error: "Internal server error" });
      }

      try {
        // Parse the result from the Python script
        const similarImages = JSON.parse(result);

        // Clean up the uploaded file
        fs.unlinkSync(uploadedFilePath);
        console.log(`File cleaned up: ${uploadedFilePath}`);

        // Return similar images
        res.json({ similarImages });
      } catch (error) {
        console.error(`Error parsing JSON: ${error.message}`);
        console.error(`Python script output: ${result}`);
        res.status(500).json({ error: "Internal server error" });
      }
    });
  } catch (error) {
    console.error(`Error in search endpoint: ${error.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start the server
const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
