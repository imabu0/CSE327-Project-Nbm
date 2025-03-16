const GoogleBucket = require("../models/google.model.js");
const google = new GoogleBucket();
const { Router } = require("express");
const router = Router();
const protectRoute = require("../middlewares/authMiddleware.js");

// **Google OAuth**
router.get("/authorize", (req, res) => res.redirect(google.getAuthUrl()));
router.get("/oauth2callback", async (req, res) => {
  try {
    await google.handleCallback(req.query.code);
    res.redirect("http://localhost:5173/dashboard?linked=google"); // Add success query parameter
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

router.get("/buckets", protectRoute, async (req, res) => {
  try {
    const userId = req.user.id; // Extract the user_id from the request

    // Use the model to count the number of users
    const count = await google.countBuckets(userId);

    // Send a JSON response containing the user count
    res.json({ count });
  } catch (error) {
    // Log the error message to the console for debugging
    console.error("Error counting buckets:", error.message);

    // Send a 500 Internal Server Error response if an error occurs
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/set", protectRoute, async (req, res) => {
  try {
    const user_id = req.user.id; // Extract user_id from the JWT

    // Call the model method to update rows with user_id = null
    const updatedRows = await google.setUser(user_id);

    res.status(200).json({
      message: "Updated rows successfully",
      updatedRows,
    });
  } catch (error) {
    console.error("Error updating:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
