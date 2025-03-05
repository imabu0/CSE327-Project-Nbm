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

// Mock database of image hashes (replace with actual database)
const imageDatabase = [
  { id: '1', hash: 'abc123', url: 'http://localhost:3000/flower1.jpg' },
  { id: '2', hash: 'def456', url: 'http://localhost:3000/flower2.jpg' },
  { id: '3', hash: 'abc124', url: 'http://localhost:3000/flower3.jpg' },
  { id: '4', hash: 'abc124', url: 'http://localhost:3000/panda1.jpg' },
  { id: '5', hash: 'abc124', url: 'http://localhost:3000/panda2.jpg' },
];

// Route to search for similar images
app.post('/search', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    const filePath = req.file.path;

    // Generate hash for the uploaded image
    const queryHash = await generateImageHash(filePath);
    console.log('Generated hash for uploaded image:', queryHash);

    // Find similar images in the database
    const similarImages = imageDatabase.filter((image) => {
      const distance = hammingDistance(queryHash, image.hash);
      console.log(`Comparing with image ${image.id}: Hash=${image.hash}, Distance=${distance}`);
      return distance <= 2; // Allow small differences (adjust threshold as needed)
    });

    // Clean up the uploaded file
    fs.unlinkSync(filePath);

    // Return similar images
    res.status(200).json({ similarImages });
  } catch (error) {
    console.error('Error searching for similar images:', error);
    res.status(500).send('Error searching for similar images');
  }
});

// Generate a perceptual hash for the image
async function generateImageHash(filePath) {
  try {
    // Resize image to 8x8 and convert to grayscale
    const buffer = await sharp(filePath)
      .resize(8, 8)
      .grayscale()
      .raw()
      .toBuffer();

    // Calculate the average pixel value
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i];
    }
    const avg = sum / buffer.length;

    // Generate hash based on pixel values
    let hash = '';
    for (let i = 0; i < buffer.length; i++) {
      hash += buffer[i] > avg ? '1' : '0';
    }

    return hash;
  } catch (error) {
    console.error('Error generating image hash:', error);
    throw error;
  }
}

// Calculate Hamming distance between two hashes
function hammingDistance(hash1, hash2) {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }
  return distance;
}

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});