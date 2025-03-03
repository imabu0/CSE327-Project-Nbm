const express = require("express");
const multer = require("multer");
const { google } = require("googleapis");
const tf = require("@tensorflow/tfjs-node");
const mobilenet = require("@tensorflow-models/mobilenet");

const app = express();
const upload = multer();

// Initialize Google Drive API
const drive = google.drive({
  version: "v3",
  auth: new google.auth.GoogleAuth({
    keyFile: "path/to/your/credentials.json",
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  }),
});

// Load MobileNet model
let model;
(async () => {
  model = await mobilenet.load();
})();

// Endpoint to handle image search
app.post("/api/search", upload.single("image"), async (req, res) => {
  try {
    const uploadedImage = req.file.buffer;

    // Extract features from the uploaded image
    const uploadedImageTensor = tf.node.decodeImage(uploadedImage);
    const uploadedImageFeatures = await model.infer(uploadedImageTensor, true);

    // Fetch images from Google Drive
    const driveResponse = await drive.files.list({
      q: "mimeType contains 'image/'",
      fields: "files(id, name)",
    });

    const similarImages = [];
    for (const file of driveResponse.data.files) {
      const imageResponse = await drive.files.get(
        { fileId: file.id, alt: "media" },
        { responseType: "arraybuffer" }
      );

      const storedImageTensor = tf.node.decodeImage(
        Buffer.from(imageResponse.data)
      );
      const storedImageFeatures = await model.infer(storedImageTensor, true);

      // Compare features using cosine similarity
      const similarity = cosineSimilarity(
        uploadedImageFeatures,
        storedImageFeatures
      );

      if (similarity > 0.8) {
        // Adjust threshold as needed
        similarImages.push(`https://drive.google.com/uc?id=${file.id}`);
      }
    }

    res.json(similarImages);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Helper function to calculate cosine similarity
function cosineSimilarity(a, b) {
  const dotProduct = tf.dot(a, b).dataSync()[0];
  const normA = tf.norm(a).dataSync()[0];
  const normB = tf.norm(b).dataSync()[0];
  return dotProduct / (normA * normB);
}

app.listen(3001, () => console.log("Server running on port 3000"));