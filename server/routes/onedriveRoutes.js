const express = require("express");
const OnedriveBucket = require("../models/onedrive.model.js"); // Import the OneDrive model
const axios = require("axios"); // Import Axios for making HTTP requests
const router = express.Router(); // Create a new router instance

// Initialize OneDrive Bucket with required parameters
const oneDrive = new OnedriveBucket(
  process.env.ONEDRIVE_CLIENT_ID, // Client ID from environment variables
  process.env.ONEDRIVE_CLIENT_SECRET, // Client secret from environment variables
  process.env.ONEDRIVE_REDIRECT_URI // Redirect URI from environment variables
);

// **OneDrive OAuth**
router.get("/authorize", async (req, res) => {
  try {
    const authUrl = await oneDrive.getAuthUrl(); // Generate the authorization URL
    res.redirect(authUrl); // Redirect the user to the authorization URL
  } catch (err) {
    console.error("Error generating authorization URL:", err.message);
    res.status(500).send("Error generating authentication URL"); // Handle errors
  }
});

// Callback route for handling OAuth2 response
router.get("/oauth2callback", async (req, res) => {
  const { code, error } = req.query; // Extract code and error from query parameters
  if (error) return res.status(400).send("Authentication error"); // Handle authentication error

  try {
    const { accessToken, refreshToken } = await oneDrive.handleCallback(code); // Handle the callback and get tokens

    // Store tokens in session (or you can store them in the database)
    req.session.accessToken = accessToken; // Store access token in session
    req.session.refreshToken = refreshToken; // Store refresh token in session

    // Redirect to the dashboard after successful login
    res.redirect("http://localhost:5173/dashboard");
  } catch (err) {
    console.error("❌ Authentication error:", err.message);
    res.status(500).send("Authentication failed."); // Handle errors
  }
});

// **List Files from OneDrive**
router.get("/files", async (req, res) => {
  try {
    // Load stored tokens from the database
    const storedTokens = await oneDrive.loadTokens(); // Ensure this method retrieves the correct tokens
    const accessToken = storedTokens.access_token; // Extract access token
    if (!accessToken) return res.status(400).json({ error: "No access token available" }); // Handle missing token

    // Make a request to the OneDrive API to list files
    const response = await axios.get(
      "https://graph.microsoft.com/v1.0/me/drive/root/children", // Endpoint to get files in the root directory
      {
        headers: {
          Authorization: `Bearer ${accessToken}`, // Set the Authorization header with the access token
        },
      }
    );

    const allFiles = response.data.value; // Files returned in 'value'
    res.json(allFiles); // Send the list of files as a JSON response
  } catch (error) {
    console.error("❌ OneDrive API Error:", error.message); // Log the error message
    res.status(500).json({ error: "Failed to retrieve files from OneDrive" }); // Handle errors
  }
});

module.exports = router; // Export the router for use in other parts of the application