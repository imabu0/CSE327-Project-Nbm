const express = require("express");
const multer = require("multer");
const FileOp = require("../models/file.model.js");
const { pool } = require("../config/db.js");
const router = express.Router(); // Create a new router instance
const fileOp = new FileOp(); // Create an instance of the FileOp class
const upload = multer({ dest: "uploads/" }); // Temporary folder for uploaded files
const protectRoute = require("../middlewares/authMiddleware.js");
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth"); // For .docx files
const { callLLM } = require("../utils/llm");



async function extractTextFromFile(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  console.log(ext);
  try {
    if (ext === ".pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      console.log("PDF data:", data.text);
      return data.text || "";
    } else if (ext === ".docx") {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || "";
    } else if (ext === ".txt") {
      return fs.readFileSync(filePath, "utf8");
    } else {
      console.warn(`Unsupported file type: ${ext} (${originalName})`);
      return "";
    }
  } catch (error) {
    console.error(`Error extracting text from ${originalName}:`, error.message);
    return "Error here";
  }
}

// Upload route
router.post("/upload", protectRoute, upload.single("file"), async (req, res) => { 
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded "});
  }
  
  try {
    const userId = req.user.id; // Extract the user_id from the request
    const fileContent = await extractTextFromFile(req.file.path, req.file.originalname);;
    const filename = req.file.originalname;
    

    
    // Correct call to upFile()
    const fileId = await fileOp.upFile(
      req.file.path,
      req.file.originalname,
      req.file.size,
      userId,
      fileContent,
    );

    if(!fileContent){
      return res.status(400).json({ error: "No content extracted from the file" });
    };

    await indexFileChunks({ userId, filename, fileContent });

    res.json({ success: true, fileId });
  } catch (error) {
    console.error("Upload Route Error:", error.message);
    console.log(req.file.path);
    res.status(500).json({ error: "Upload failed" });
  }
});

// GET API to fetch all files for a specific user
router.get("/files", protectRoute, async (req, res) => {
  try {
    const userId = req.user.id; // Extract the user_id from the request

    // Query to fetch files for the specific user
    const result = await pool.query(
      "SELECT * FROM file_info WHERE user_id = $1 ORDER BY created_at ASC",
      [userId] // Pass the user_id as a parameter
    );

    res.json(result.rows); // Send the fetched data as JSON
  } catch (error) {
    console.error("Error fetching files:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET API to download a file
router.get("/download/:fileId", protectRoute, async (req, res) => {
  const { fileId } = req.params; // Get the file ID from the URL

  if (!fileId) {
    return res.status(400).json({ error: "File ID is required." });
  }

  try {
    const userId = req.user.id; // Extract the user_id from the request
    await fileOp.downloadAndMergeChunks(fileId, res, userId); // Download and merge the file chunks
  } catch (error) {
    console.error("Download route error:", error.message);
    res.status(500).json({ error: "Download failed." });
  }
});

// DELETE API to delete a file and its chunks
router.delete("/delete/:fileId", protectRoute, async (req, res) => {
  const { fileId } = req.params; // Get the file ID from the URL

  if (!fileId) {
    return res.status(400).json({ error: "File ID is required." });
  }

  try {
    const userId = req.user.id; // Extract the user_id from the request
    await fileOp.deleteChunks(fileId, userId); // Delete the file chunks
    res.json({
      success: true,
      message: "File and chunks deleted successfully.",
    });
  } catch (error) {
    console.error("Delete route error:", error.message);
    res.status(500).json({ error: "Failed to delete file and chunks." });
  }
});

// PATCH API to edit the title of a file
router.patch("/edit/:id", async (req, res) => {
  const { id } = req.params; // Get the file ID from the URL
  const { title } = req.body; // Get the new title from the request body

  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  try {
    // Update the title in the database
    const query = "UPDATE file_info SET title = $1 WHERE id = $2 RETURNING *";
    const values = [title, id]; // Set the new title and file ID
    const result = await pool.query(query, values); // Execute the query

    // Check if any rows were updated
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "File not found" });
    }

    res
      .status(200)
      .json({ message: "Title updated successfully", file: result.rows[0] });
  } catch (error) {
    console.error("Error updating title:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET API to search for files by title
router.get("/search", async (req, res) => {
  const { searchQuery } = req.query; // Get the search query from the query parameters

  if (!searchQuery) {
    return res.status(400).json({ error: "Search query is required" });
  }

  try {
    // Search for files with titles that match the search query
    const query = "SELECT * FROM file_info WHERE title ILIKE $1";
    const values = [`%${searchQuery}%`]; // Use ILIKE for case-insensitive search
    const result = await pool.query(query, values);

    res.status(200).json({ files: result.rows });
  } catch (error) {
    console.error("Error searching files:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route to get available storage
router.get("/space", protectRoute, async (req, res) => {
  try {
    const userId = req.user.id; // Extract the user_id from the request
    const storage = await fileOp.getAvailableStorage(userId); // Get available storage from the cloud provider
    res.status(200).json(storage);
  } catch (error) {
    console.error("Error fetching available storage:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const { Pool } = require("pg");
const axios = require("axios");

const { QdrantClient } = require("@qdrant/js-client-rest");

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION_NAME = "documents";

async function getQueryEmbedding(query) {
  const res = await axios.post(
    "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
    { inputs: query },
    { headers: { Authorization: `Bearer ${HF_API_TOKEN}` } }
  );

  let vector = res.data;

  return vector;
}

async function findRelevantChunks(userId, queryEmbedding) {
  try {
    if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length !== 384) {
      throw new Error("Invalid or missing embedding vector.");
    }

    console.log("USER:", userId);

    console.log("COLLECTION_NAME:", COLLECTION_NAME, typeof COLLECTION_NAME);

    const searchPayload = {
      collection_name: COLLECTION_NAME,
      vector: queryEmbedding,
      limit: 5,
      filter: {
        must: [
          {
            key: "userId",
            match: { value: String(userId) },
          },
        ],
      },
    };

    console.log("Qdrant Search Payload:", searchPayload);


    // ✅ Fix: Pass collection_name as separate string argument
    const result = await qdrant.search(COLLECTION_NAME, searchPayload);
    // ✅ FIX: Pass second argument as empty object
    //const result = await qdrant.search(searchPayload, {});

    if (!result || !Array.isArray(result)) {
      throw new Error("Qdrant search result is invalid or empty.");
    }

    return result.map((point) => point.payload);
  } catch (err) {
    console.error("Error searching Qdrant:", err.message, err.stack);
    throw err;
  }
}



async function callLLMWithContext(contextChunks, query) {
  const systemPrompt = `You are an assistant that answers based on these file excerpts:\n\n${contextChunks} and you do not stray from it`;
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: query }
  ];

  // Send this to your Hugging Face hosted LLM or any local model
  return callLLM(messages); // use your existing function
}


const HF_API_TOKEN = process.env.HF_API_TOKEN;

async function embedText(text) {
  try {
    const response = await axios.post(
      "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
      { inputs: text },
      {
        headers: {
          Authorization: `Bearer ${HF_API_TOKEN}`,
        },
      }
    );

    let vector = response.data;

    // Handle nested array
    if (Array.isArray(vector) && Array.isArray(vector[0])) {
      vector = vector[0];
      console.log("Nested array detected, flattening:", vector);
      console.log("Raw response data:", response.data);
      console.log("Vector Length", vector.length);
    }

      
      console.log("Raw response data:", response.data);
      console.log("Vector Length", vector.length);

    if (!Array.isArray(vector) || vector.length !== 384) {
      console.error("Invalid embedding shape:", vector);
      console.log("Raw response data:", response.data);
      throw new Error("Invalid embedding shape from Hugging Face.");
    }

    return vector;
  } catch (err) {
    console.error("Embedding error:", err?.response?.data || err.message);
    return null;
  }
}



async function createCollectionIfNotExists() {
  const exists = await qdrant.getCollections().then(res =>
    res.collections.some(col => col.name === COLLECTION_NAME)
  );

  if (!exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: 384, // Hugging Face MiniLM
        distance: "Cosine",
      },
    });

    console.log(`✅ Created Qdrant collection "${COLLECTION_NAME}"`);
  }
}

const { v4: uuidv4 } = require("uuid");


async function indexFileChunks({ userId, filename, fileContent }) {
  if (!fileContent) {
    console.error("No content to index.");
    return;
  }

  createCollectionIfNotExists();
  // Split the file content into chunks of 1000 characters or less

  const chunks = fileContent.match(/(.|[\r\n]){1,1000}/g) || [];

  const points = [];

  for (const chunk of chunks) {
    const embedding = await embedText(chunk);
    if (!embedding || embedding.length !== 384) {
      console.warn("Skipping invalid embedding for chunk.");
      continue;
    }

    const pointId = uuidv4();

    points.push({
      id: pointId,
      vector: embedding,
      payload: {
        userId: String(userId), // must be string if Qdrant expects that
        filename,
        content: chunk,
      },
    });
  }

  if (points.length > 0) {
    try {
      const response = await axios.put(
        `https://a18370a2-ed73-4166-8204-cf4de1886e37.us-east4-0.gcp.cloud.qdrant.io:6333/collections/${COLLECTION_NAME}/points`,
        { points }, // Qdrant expects { points: [...] }
        {
          headers: {
            "Content-Type": "application/json",
            "api-key": process.env.QDRANT_API_KEY, // Auth for Qdrant Cloud
          },
        }
      );
      console.log(`✅ Indexed ${points.length} chunks`);
    } catch (err) {
      console.error("❌ Qdrant upsert error:", err.response?.data || err.message);
    }
  }
}

 

// Route to handle LLM queries
// This route is for querying the LLM with a specific question and context
// It uses the user's conversation history and relevant file chunks to generate a response.
router.post("/query", protectRoute, async (req, res) => {
  try {
    const { query } = req.body;
    const userId = req.user.id;

    console.log("User ID:", query);
    const queryEmbedding = await getQueryEmbedding(query);
    console.log("Query embedding:", queryEmbedding);
    const chunks = await findRelevantChunks(userId, queryEmbedding);

    const context = chunks.map(
      (c) => `File: ${c.filename}\nContent: "${c.content}"`
    ).join("\n\n");

    const answer = await callLLMWithContext(context, query);

    res.json({ result: `*LLM Answer:*\n${answer}` });
  } catch (err) {
    console.error("Query error:", err);
    res.status(500).json({ error: "LLM query failed" });
  }
});


module.exports = router;
