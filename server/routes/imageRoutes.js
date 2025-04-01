const express = require('express');
const multer = require('multer');
const { getImageVector } = require('./vision.js');
const { addImage, searchImages } = require('../config/lancedb.js');
const router = express.Router();
const upload = multer();

router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const vector = await getImageVector(req.file.buffer);
    await addImage(vector, `/uploads/${req.file.originalname}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/search', upload.single('image'), async (req, res) => {
  try {
    const vector = await getImageVector(req.file.buffer);
    const results = await searchImages(vector);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;