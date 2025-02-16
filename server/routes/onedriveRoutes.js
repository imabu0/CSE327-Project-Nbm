const express = require("express");
const OnedriveBucket = require("../models/onedrive.model.js");
const router = express.Router();

// Initialize OneDrive Bucket with required parameters
const oneDrive = new OnedriveBucket(
  process.env.ONEDRIVE_CLIENT_ID,
  process.env.ONEDRIVE_CLIENT_SECRET,
  process.env.ONEDRIVE_REDIRECT_URI
);

// **OneDrive OAuth**
router.get("/authorize", async (req, res) => {
  try {
    const authUrl = await oneDrive.getAuthUrl();
    res.redirect(authUrl);
  } catch (err) {
    console.error("Error generating authorization URL:", err.message);
    res.status(500).send("Error generating authentication URL");
  }
});

router.get("/oauth2callback", async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.status(400).send("Authentication error");

  try {
    const { accessToken, refreshToken } = await oneDrive.handleCallback(code);

    // Send tokens to the frontend
    res.json({ accessToken, refreshToken });
    redirect("http://localhost:5173/dashboard")
  } catch (err) {
    res.status(500).send("Authentication failed.");
  }
});

// **List Files from OneDrive**
router.get("/files", async (req, res) => {
  try {
    const files = await oneDrive.listFiles(req.query.accessToken); // Make sure to pass accessToken
    res.json(files);
  } catch (err) {
    console.error("Error fetching files:", err.message);
    res.status(500).send("Error fetching files");
  }
});

module.exports = router;
