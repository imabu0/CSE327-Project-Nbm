const GoogleBucket = require("../models/google.model.js");
const google = new GoogleBucket();
const { Router } = require("express");
const router = Router();

// **Google OAuth**
router.get("/authorize", (req, res) => res.redirect(google.getAuthUrl()));
router.get("/oauth2callback", async (req, res) => {
  try {
    await google.handleCallback(req.query.code);
    res.redirect("http://localhost:5173/dashboard");
  } catch (error) {
    console.error("Google OAuth Error:", error.message);
    res.status(500).send("Authentication failed.");
  }
});

// **List Files from Google Drive**
router.get("/drive", async (req, res) => {
  const files = await google.listFiles();
  res.json(files);
});

router.get("/buckets", async (req, res) => {
  try {
    // Use the model to count the number of users
    const count = await google.countBuckets();

    // Send a JSON response containing the user count
    res.json({ count });
  } catch (error) {
    // Log the error message to the console for debugging
    console.error("Error counting buckets:", error.message);

    // Send a 500 Internal Server Error response if an error occurs
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
