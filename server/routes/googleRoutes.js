const GoogleBucket = require("../models/google.model.js");
const googleDrive = new GoogleBucket();
const { Router } = require("express");
const router = Router();

// **Google OAuth**
router.get("/authorize", (req, res) => res.redirect(googleDrive.getAuthUrl()));
router.get("/oauth2callback", async (req, res) => {
  try {
    await googleDrive.handleCallback(req.query.code);
    res.redirect("http://localhost:5173/dashboard");
  } catch (error) {
    console.error("❌ Google OAuth Error:", error.message);
    res.status(500).send("Authentication failed.");
  }
});

// **List Files from Google Drive**
router.get("/drive", async (req, res) => {
  const files = await googleDrive.listFiles();
  res.json(files);
});

module.exports = router;
