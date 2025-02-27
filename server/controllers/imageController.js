const { addImage, searchImages } = require("../models/image.model.js");
const { extractImageVector } = require("../services/imageService.js");

const uploadImage = async (req, res) => {
  const { filename, path } = req.file;
  const vector = await extractImageVector(path);

  const imageData = { filename, filepath: path, vector };
  await addImage(imageData);

  res.json({ success: true, message: "Image uploaded successfully" });
};

const searchImage = async (req, res) => {
  const { path } = req.file;
  const vector = await extractImageVector(path);

  const result = await searchImages(vector);
  res.json(result.data.Get.Image);
};

module.exports = { uploadImage, searchImage };