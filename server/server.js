import express from "express";
import pkg from "pg";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import fs from "fs";

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
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Upload Endpoint
const mergeChunks = async (fileName, totalChunks) => {
  const chunkDir = path.join(__dirname, "chunks");
  const mergedFilePath = path.join(__dirname, "merged_files");

  // Ensure the merged files directory exists
  if (!fs.existsSync(mergedFilePath)) {
    fs.mkdirSync(mergedFilePath);
  }

  const writeStream = fs.createWriteStream(path.join(mergedFilePath, fileName));
  
  for (let i = 0; i < totalChunks; i++) {
    const chunkFilePath = path.join(chunkDir, `${fileName}.part_${i}`);
    
    if (fs.existsSync(chunkFilePath)) {
      const chunkBuffer = await fs.promises.readFile(chunkFilePath);
      writeStream.write(chunkBuffer);
      fs.unlinkSync(chunkFilePath); // Delete the individual chunk file after merging
    } else {
      console.error(`Chunk file ${chunkFilePath} does not exist`);
    }
  }

  return new Promise((resolve, reject) => {
    writeStream.on("finish", () => {
      console.log("Chunks merged successfully");
      resolve();
    });
    writeStream.on("error", (err) => {
      console.error("Error writing merged file:", err);
      reject(err);
    });
    writeStream.end();
  });
};

app.post("/api/upload", upload.single("file"), async (req, res) => {
  console.log("Hit");
  const chunk = req.file.buffer;
  const chunkNumber = Number(req.body.chunkNumber); // Sent from the client
  const totalChunks = Number(req.body.totalChunks); // Sent from the client
  const fileName = req.body.originalname;

  const chunkDir = path.join(__dirname, "chunks"); // Directory to save chunks

  // Ensure the chunks directory exists
  if (!fs.existsSync(chunkDir)) {
    fs.mkdirSync(chunkDir);
  }

  const chunkFilePath = path.join(chunkDir, `${fileName}.part_${chunkNumber}`);

  try {
    await fs.promises.writeFile(chunkFilePath, chunk);
    console.log(`Chunk ${chunkNumber}/${totalChunks} saved`);

    if (chunkNumber === totalChunks - 1) {
      // If this is the last chunk, merge all chunks into a single file
      await mergeChunks(fileName, totalChunks);
      console.log("File merged successfully");
    }

    res.status(200).json({ message: "Chunk uploaded successfully" });
  } catch (error) {
    console.error("Error saving chunk:", error);
    res.status(500).json({ error: "Error saving chunk" });
  }
});

// Download Endpoint
app.get('/api/download/:fileName', async (req, res) => {
  const { fileName } = req.params;

  try {
    const chunksDir = path.join('uploads', 'chunks');
    const fileParts = fs
      .readdirSync(chunksDir)
      .filter((file) => file.startsWith(fileName))
      .map((file) => path.join(chunksDir, file))
      .sort();

    const destinationPath = path.join('downloads', fileName);
    if (!fs.existsSync('downloads')) fs.mkdirSync('downloads');

    await mergeFiles(fileParts, destinationPath);
    res.download(destinationPath, (err) => {
      if (err) console.error('Error sending file:', err);
      fs.unlinkSync(destinationPath); // Clean up the merged file after download
    });
  } catch (err) {
    console.error('Error downloading file:', err);
    res.status(500).send({ message: 'Error downloading file.' });
  }
});

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

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
