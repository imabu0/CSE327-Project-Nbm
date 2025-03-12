const { pool } = require("../config/db.js"); // Import database connection from the db.js file
const protectRoute = require("../middlewares/authMiddleware.js"); // Import middleware for protecting routes
const express = require("express"); // Import the express library
const router = express.Router(); // Create a new router instance

// Route to fetch user name
router.get("/user", protectRoute, async (req, res) => {
  try {
    const userId = req.user.id; // Extract user ID from the decoded JWT stored in req.user

    // Check if userId is present; if not, return a 400 Bad Request response
    if (!userId) {
      return res.status(400).json({ error: "User  ID not found in token" });
    }

    // Query to get the user's name from the database using the user ID
    const result = await pool.query(
      "SELECT name FROM user_info WHERE id = $1", // SQL query to select the name
      [userId] // Parameterized query to prevent SQL injection
    );

    // Check if any rows were returned; if not, return a 404 Not Found response
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User  not found" });
    }

    // Send a JSON response containing the user's name
    res.json({ name: result.rows[0].name }); // Send the user's name as a response
  } catch (error) {
    // Log the error message to the console for debugging purposes
    console.error("Error fetching name:", error.message);
    // Send a 500 Internal Server Error response if an error occurs
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route to get the count of users
router.get("/users", async (req, res) => {
  try {
    // Execute a SQL query to count the number of users in the user_info table
    const result = await pool.query("SELECT COUNT(*) FROM user_info");

    // Extract the count from the result set
    const count = result.rows[0].count;

    // Send a JSON response containing the user count
    res.json({ count }); // Send response with count
  } catch (error) {
    // Log the error message to the console for debugging
    console.error("Error counting users:", error.message);

    // Send a 500 Internal Server Error response if an error occurs
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router; // Export the router for use in other parts of the application
