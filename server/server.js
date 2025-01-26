import express from "express";
import pkg from "pg";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import { google } from "googleapis";

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
app.use(cors());

// Define a route to register a new user
app.post("/register", async (req, res) => {
  const { name, username, password } = req.body;

  try {
    const result = await client.query(
      "INSERT INTO user_info (name, username, password) VALUES ($1, $2, $3) RETURNING *",
      [name, username, password]
    );
    res.send(result.rows[0]);
  } catch (error) {
    console.error("Error executing query", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Define a route to login a user
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await client.query(
      "SELECT * FROM user_info WHERE username = $1 AND password = $2",
      [username, password]
    );
    if (result.rows.length > 0) {
      res.send(result.rows[0]);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Error executing query", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Define a route to upload a file to Google Drive

// Define a route to list files in Google Drive

// Define a route to download a file from Google Drive

// Define a route to delete a file from Google Drive

// Define a route to upload a file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

app.post("/upload", upload.single("file"), (req, res) => {
  console.log(req.file);
  console.log(req.body);
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
