const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const sharp = require('sharp');

const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(cors());

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Generate color histograms for images in the directory
const imageFiles = ['flower1.jpg', 'flower2.jpg', 'flower3.jpg', 'panda1.jpg', 'panda2.jpg'];
const imageDatabase = [];

// Function to generate a color histogram for an image
async function generateHistogram(filePath) {
  const image = await sharp(filePath).resize(100, 100).raw().toBuffer();
  const histogram = new Array(256).fill(0);

  for (let i = 0; i < image.length; i += 3) {
    const r = image[i];
    const g = image[i + 1];
    const b = image[i + 2];
    const avg = Math.round((r + g + b) / 3);
    histogram[avg]++;
  }

  return histogram;
}

// Function to initialize the image database
async function initializeImageDatabase() {
  for (let i = 0; i < imageFiles.length; i++) {
    const filePath = path.join(__dirname, imageFiles[i]);
    const histogram = await generateHistogram(filePath);
    imageDatabase.push({ id: String(i + 1), histogram, url: `http://localhost:3000/${imageFiles[i]}` });
  }
  console.log('Image database initialized');
}

// Initialize the image database on server start
initializeImageDatabase();

// Route to search for similar images
app.post('/search', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    const filePath = req.file.path;

    // Generate histogram for the uploaded image
    const queryHistogram = await generateHistogram(filePath);

    // Find similar images in the database
    const similarImages = imageDatabase.map((image) => {
      const similarity = histogramSimilarity(queryHistogram, image.histogram);
      return { ...image, similarity };
    }).sort((a, b) => b.similarity - a.similarity) // Sort by similarity
      .slice(0, 5); // Return top 5 similar images

    // Clean up the uploaded file
    fs.unlinkSync(filePath);

    // Return similar images
    res.status(200).json({ similarImages });
  } catch (error) {
    console.error('Error searching for similar images:', error);
    res.status(500).send('Error searching for similar images');
  }
});

// Calculate similarity between two histograms
function histogramSimilarity(histogramA, histogramB) {
  let sum = 0;
  for (let i = 0; i < histogramA.length; i++) {
    sum += Math.min(histogramA[i], histogramB[i]);
  }
  return sum / Math.max(1, Math.max(...histogramA), Math.max(...histogramB));
}

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});