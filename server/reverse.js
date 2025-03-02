const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process'); // Import exec
const cors = require('cors');

const app = express();
const port = 3001;
app.use(cors());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// In-memory storage for image metadata (replace with a database in production)
let imageMetadata = [];

// Endpoint to handle image uploads
app.post('/upload', upload.single('image'), (req, res) => {
  const filePath = req.file.path;

  // Call the Python script to extract features
  const pythonProcess = exec(`python3 process_image.py ${filePath}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing Python script: ${error.message}`);
      return res.status(500).send('Error processing image');
    }
    if (stderr) {
      console.error(`Python script stderr: ${stderr}`);
      return res.status(500).send('Error processing image');
    }

    // Parse the output (e.g., feature vector)
    const features = JSON.parse(stdout);
    console.log('Extracted features:', features);

    // Save image metadata
    imageMetadata.push({
      id: Date.now(), // Unique ID for the image
      filePath: filePath,
      features: features,
    });

    res.send('Image uploaded and processed');
  });
});

// Endpoint to handle image search
app.post('/search', upload.single('image'), (req, res) => {
  const filePath = req.file.path;
  console.log('Search file path:', filePath);

  // Call the Python script to extract features from the search image
  const pythonProcess = exec(`python3 process_image.py ${filePath}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing Python script: ${error.message}`);
      return res.status(500).send('Error processing image');
    }
    if (stderr) {
      console.error(`Python script stderr: ${stderr}`);
      return res.status(500).send('Error processing image');
    }

    console.log('Python script output:', stdout);

    try {
      const searchFeatures = JSON.parse(stdout);
      console.log('Search features:', searchFeatures);

      // Perform similarity search
      const results = imageMetadata.map(image => {
        const similarity = cosineSimilarity(searchFeatures, image.features); // Replace with your similarity metric
        return {
          id: image.id,
          filePath: image.filePath,
          similarity: similarity,
        };
      });

      // Sort results by similarity (descending order)
      results.sort((a, b) => b.similarity - a.similarity);

      // Return top 5 matching images
      const topResults = results.slice(0, 5).map(result => ({
        id: result.id,
        imageUrl: `http://localhost:3001/${result.filePath}`, // Serve images statically
        similarity: result.similarity,
      }));

      res.json(topResults);
    } catch (parseError) {
      console.error('Error parsing Python script output:', parseError);
      res.status(500).send('Error parsing features');
    }
  });
});

// Serve uploaded images statically
app.use('/uploads', express.static('uploads'));

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

// Helper function to calculate cosine similarity
function cosineSimilarity(vectorA, vectorB) {
  const dotProduct = vectorA.reduce((sum, a, i) => sum + a * vectorB[i], 0);
  const magnitudeA = Math.sqrt(vectorA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vectorB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}