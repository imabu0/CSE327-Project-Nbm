// db.js
require("dotenv").config(); // Load environment variables from .env file
const { Pool } = require("pg"); // Import the Pool class from the pg library

// Create a new pool instance for connecting to the PostgreSQL database
const pool = new Pool({
  user: process.env.DB_USER, // Database user from environment variable
  host: process.env.DB_HOST, // Database host from environment variable
  database: process.env.DB_DATABASE, // Database name from environment variable
  password: process.env.DB_PASSWORD, // Database password from environment variable
  port: process.env.DB_PORT, // Database port from environment variable
});

// Connect to the PostgreSQL database
pool
  .connect()
  .then(() => console.log(" - PostgreSQL Connected Successfully")) // Log success message
  .catch((err) => console.error("PostgreSQL Connection Failed:", err)); // Log error message

// Export the pool instance for use in other modules
module.exports = { pool };