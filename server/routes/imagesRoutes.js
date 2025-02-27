const express = require("express");
const multer = require("multer");
const { uploadImage, searchImage } = require("../controllers/imageController.js");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/upload", upload.single("image"), uploadImage);
router.post("/search", upload.single("image"), searchImage);

module.exports = router;