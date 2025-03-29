const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const { PythonShell } = require("python-shell");

const app = express();

// Middleware
app.use(
  cors({
    origin: "*", // Your frontend URL
    credentials: true,
  })
);
app.use(express.json());

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `query_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// API Endpoint
app.post("/api/search", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const options = {
      mode: "text", // Changed from 'json' to handle raw output
      pythonPath: "python3",
      scriptPath: path.join(__dirname, "scripts"),
      args: [req.file.path],
    };

    PythonShell.run("image_similarity.py", options, (err, output) => {
      // Clean up uploaded file
      fs.unlink(req.file.path, () => {});

      if (err) {
        console.error("Python error:", err);
        return res.status(500).json({ error: "Image processing failed" });
      }

      try {
        // Find the last line of output (where our JSON should be)
        const lastLine = output[output.length - 1];
        const result = JSON.parse(lastLine);

        if (!result.success) {
          throw new Error(result.error || "Unknown error");
        }

        res.json(result.results);
      } catch (parseError) {
        console.error("Output parsing failed:", parseError);
        console.error("Raw Python output:", output);
        res.status(500).json({ error: "Result parsing failed" });
      }
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start server
const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Image search endpoint: http://localhost:${PORT}/api/search`);
});
