import express from "express";
import pkg from "pg";
import dotenv from "dotenv";

// Load the environment variables
dotenv.config();

const { Client } = pkg; // Destructure Client from the imported module

// Create a new client instance
const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Connect to the PostgreSQL database
async function connectToDatabase() {
  try {
    await client.connect();
    console.log("Connected to the PostgreSQL database");
  } catch (error) {
    console.error("Error connecting to the PostgreSQL database", error);
    process.exit(1); // Exit the process if the database connection fails
  }
}

// Call the function to connect to the database
connectToDatabase();

const app = express();

// Middleware to parse JSON requests
app.use(express.json());

// Define a simple route
app.get("/", (req, res) => {
  res.send("Hello");
});

// Define a route to get all the users
app.get("/users", async (req, res) => {
  try {
    const result = await client.query("SELECT * FROM user_info");
    res.send(result.rows);
  } catch (error) {
    console.error("Error executing query", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
