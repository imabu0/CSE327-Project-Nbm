const upload = require('multer')();
const { getImageFeatures, findSimilarImages } = require('../models/image.model.js');
const router = require('express').Router();

router.post('/vision-search', upload.single('image'), async (req, res) => {
  try {
    const features = await getImageFeatures(req.file.buffer);
    const results = await findSimilarImages(features);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});