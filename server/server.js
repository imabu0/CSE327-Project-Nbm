import express from "express";
import pkg from "pg";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import { google } from "googleapis";
import path from "path";

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

// Load Google API credentials
const KEYFILEPATH = "./credentials.json";
const SCOPES = ["https://www.googleapis.com/auth/drive"];
const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});

const drive = google.drive({ version: "v3", auth });

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Save to local 'uploads' folder temporarily
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// List of folder IDs
const folderIds = [
  process.env.FOLDER_ID_1,
  process.env.FOLDER_ID_2,
  process.env.FOLDER_ID_3,
  process.env.FOLDER_ID_4,
];

// Get available size of a bucket
async function getFolderSize(folderId) {
  try {
    let totalSize = 0;
    let pageToken = null;

    do {
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`, // Files in the folder
        fields: "nextPageToken, files(id, name, size)", // Get file size
        pageToken: pageToken,
      });

      response.data.files.forEach((file) => {
        if (file.size) {
          totalSize += parseInt(file.size); // Add file size
        }
      });

      pageToken = response.data.nextPageToken;
    } while (pageToken);

    console.log(
      `Total size of folder (ID: ${folderId}): ${
        totalSize / 1024 / 1024 / 1024
      } GB`
    );
    return totalSize;
  } catch (error) {
    console.error("Error fetching folder size:", error.message);
  }
}

// Define a route to upload a file to Google Drive
async function uploadToDrive(file) {
  const fileStats = fs.statSync(file.path);
  const fileSize = fileStats.size; // File size in bytes
  console.log(`File size: ${(fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB`);

  for (let i = 0; i < folderIds.length; i++) {
    const folderSize = await getFolderSize(folderIds[i]);
    console.log(`Folder ${i + 1} size: ${(folderSize / (1024 * 1024 * 1024)).toFixed(2)} GB`);

    if (folderSize + fileSize < 15 * 1024 * 1024 * 1024) {
      const fileMetadata = {
        name: file.originalname,
        parents: [folderIds[i]], // Upload to this folder
      };

      try {
        console.log(`Uploading file to folder ${i + 1}`);

        const res = await drive.files.create({
          requestBody: fileMetadata,
          media: { mimeType: file.mimetype, body: fs.createReadStream(file.path) },
          fields: "id",
          supportsAllDrives: true, // Required for shared drives
        }, {
          onUploadProgress: (event) => {
            const progress = ((event.bytesRead / fileSize) * 100).toFixed(2);
            console.log(`Upload progress: ${progress}%`); // Log upload progress
          }
        });

        console.log(`File uploaded successfully. File ID: ${res.data.id}`);
        return res.data;
      } catch (error) {
        console.error("Error uploading file to Drive:", error.message);
        throw error;
      } finally {
        fs.unlinkSync(file.path); // Delete file from local storage after upload
      }
    }
  }

  console.log("No available space in the folders to upload the file.");
}

// Define a route to upload files to Google Drive
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).send("No file uploaded.");
    }

    const driveResponse = await uploadToDrive(file);
    res.status(200).send(`File uploaded to Drive with ID: ${driveResponse.id}`);
  } catch (error) {
    res.status(500).send("Error uploading file: " + error.message);
  }
});

// Define a route to list files in Google Drive

// Define a route to download a file from Google Drive

// Define a route to delete a file from Google Drive

//TEST TEST TEST
// Utility function to split and upload file to Google Drive
async function splitAndUploadToDrive(filePath, chunkSizeMB = 30) {
  const chunkSize = chunkSizeMB * 1024 * 1024; // Convert MB to bytes
  const fileStats = fs.statSync(filePath); // Get file info
  const totalChunks = Math.ceil(fileStats.size / chunkSize);
  const fileName = path.basename(filePath, path.extname(filePath)); // Get file name without extension
  const fileExtension = path.extname(filePath); // Get file extension

  console.log(`File size: ${fileStats.size / 1024} MB`);
  console.log(`Splitting file into ${totalChunks} chunks...`);
  const uploadedChunks = [];

  try {
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, fileStats.size);

      const chunkPath = `${fileName}_part_${i + 1}${fileExtension}`;
      const writeStream = fs.createWriteStream(chunkPath);
      const readStream = fs.createReadStream(filePath, { start, end: end - 1 });

      // Write chunk to temporary file
      await new Promise((resolve, reject) => {
        readStream.pipe(writeStream);
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      console.log(`Uploading chunk ${i + 1} of ${totalChunks}...`);

      // Upload the chunk to Google Drive
      const folderId = process.env[`FOLDER_ID_${i + 1}`]; // Dynamically access the variable

      const fileMetadata = {
        name: `${fileName}_part_${i + 1}${fileExtension}`,
        parents: [folderId], // Use the dynamically accessed folder ID
      };

      const media = {
        mimeType: "application/octet-stream",
        body: fs.createReadStream(chunkPath),
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: "id",
      });

      uploadedChunks.push({
        chunk: i + 1,
        fileId: response.data.id,
        name: fileMetadata.name,
      });

      console.log(
        `Chunk ${i + 1} uploaded successfully. File ID: ${response.data.id}`
      );

      // Clean up temporary chunk file
      fs.unlinkSync(chunkPath);
    }

    console.log("All chunks uploaded successfully.");
    return uploadedChunks;
  } catch (error) {
    console.error("Error during file upload:", error.message);
    throw error;
  }
}

// API route to upload and process file
app.post("/chunk", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path; // Path of the uploaded file
    console.log(`Received file: ${req.file.originalname}`);

    // Split and upload file to Google Drive
    const uploadedChunks = await splitAndUploadToDrive(filePath);

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.status(200).json({
      message: "File uploaded and split successfully.",
      uploadedChunks,
    });
  } catch (error) {
    console.error("Error handling file upload:", error.message);
    res.status(500).json({ error: "File upload failed." });
  }
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
