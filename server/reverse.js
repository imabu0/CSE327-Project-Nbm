const express = require("express");
const multer = require("multer");
const axios = require("axios");
const { Pool } = require("pg");
require("dotenv").config();
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

const upload = multer({ dest: "uploads/" });

const pool = new Pool({
  user: process.env.DB_USER,
  host: "172.17.0.3",
  database: process.env.DB_NAME,
  password: "password",
  port: process.env.DB_PORT,
});

const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY;

if (!GOOGLE_VISION_API_KEY) {
  console.error("Google Vision API key is missing. Please check your .env file.");
  process.exit(1); // Exit the application if the API key is missing
}

console.log("Google Vision API Key:", GOOGLE_VISION_API_KEY);

app.post("/upload", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image file uploaded" });
  }

  try {
    const imagePath = req.file.path;
    const imageBuffer = fs.readFileSync(imagePath);
    const imageBase64 = imageBuffer.toString("base64");

    const visionResponse = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
      {
        requests: [
          {
            image: { content: imageBase64 },
            features: [
              { type: "LABEL_DETECTION" },
              { type: "IMAGE_PROPERTIES" },
            ],
          },
        ],
      }
    );

    if (!visionResponse.data.responses[0].imagePropertiesAnnotation) {
      throw new Error("Google Vision API did not return image properties");
    }

    const features =
      visionResponse.data.responses[0].imagePropertiesAnnotation.dominantColors.colors.map(
        (color) => [color.color.red, color.color.green, color.color.blue]
      );

    const vector = features.flat();

    const imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    await pool.query(
      "INSERT INTO images (name, url, vector) VALUES ($1, $2, $3)",
      [req.file.originalname, imageUrl, vector]
    );

    // Delete the uploaded file after processing
    fs.unlinkSync(imagePath);

    res.json({ message: "Image uploaded successfully", url: imageUrl });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/search", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ message: "URL parameter is required" });
    }

    const { rows } = await pool.query(
      "SELECT vector FROM images WHERE url = $1",
      [url]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Image not found" });
    }

    const queryVector = rows[0].vector;

    const { rows: allImages } = await pool.query("SELECT * FROM images");

    const similarities = allImages.map((img) => ({
      id: img.id,
      name: img.name,
      url: img.url,
      similarity: cosineSimilarity(queryVector, img.vector),
    }));

    similarities.sort((a, b) => b.similarity - a.similarity);

    res.json({ similarImages: similarities });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

function cosineSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;

  const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
  const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val ** 2, 0));
  const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val ** 2, 0));

  return magnitude1 && magnitude2 ? dotProduct / (magnitude1 * magnitude2) : 0;
}

const PORT = process.env.PORT || 8000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);