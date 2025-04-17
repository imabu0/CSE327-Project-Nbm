const DropboxBucket = require("../models/dropbox.model.js");
const dropbox = new DropboxBucket();
const { Router } = require("express");
const router = Router();
const protectRoute = require("../middlewares/authMiddleware.js");

// **Dropbox OAuth**
router.get("/authorize", (req, res) => res.redirect(dropbox.getAuthUrl()));
router.get("/oauth2callback", async (req, res) => {
  try {
    const tokens = await dropbox.handleCallback(req.query.code);
    res.redirect(
      `http://localhost:5173/dashboard?linked=dropbox&token=${encodeURIComponent(
        tokens.refresh_token
      )}`
    );
  } catch (error) {
    console.error("Dropbox OAuth Error:", error.message);
    res.redirect("http://localhost:5173/dashboard?error=dropbox_auth_failed");
  }
});

// **List Files from Dropbox**
router.get("/files", async (req, res) => {
  const files = await dropbox.listFiles();
  res.json(files);
});

router.get("/buckets", protectRoute, async (req, res) => {
  try {
    const userId = req.user.id; // Extract the user_id from the request

    // Use the model to count the number of users
    const count = await dropbox.countBuckets(userId);

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
    const { token } = req.body;

    // Call the model method to update rows with user_id = null
    const updatedRows = await dropbox.setUser(user_id, token);

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
