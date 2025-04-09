const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const axios = require("axios");
const { google } = require("googleapis");
const Dropbox = require("dropbox").Dropbox;
const fetch = require("node-fetch");

// Google Drive API setup
const drive = google.drive({ version: "v3", auth: process.env.GOOGLE_API_KEY });

// Dropbox setup
const dbx = new Dropbox({ accessToken: process.env.DROPBOX_API_KEY, fetch });

// Extract text from file (supporting both local files and cloud files)
async function extractText(filePath, fileSource = "local") {
  try {
    if (fileSource === "local") {
      const ext = path.extname(filePath).toLowerCase();
      if (!fs.existsSync(filePath)) {
        throw new Error("File not found");
      }

      if (ext === ".pdf") {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
      }

      if (ext === ".docx") {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
      }

      if (ext === ".txt") {
        return fs.readFileSync(filePath, "utf8");
      }

      throw new Error("Unsupported file type");
    }

    if (fileSource === "googleDrive") {
      // Download file from Google Drive using API
      const res = await drive.files.get(
        { fileId: filePath, alt: "media" },
        { responseType: "arraybuffer" }
      );
      return await extractTextFromBuffer(res.data);
    }

    if (fileSource === "dropbox") {
      // Download file from Dropbox using API
      const res = await dbx.filesDownload({ path: filePath });
      return await extractTextFromBuffer(res.fileBinary);
    }
  } catch (error) {
    console.error("Error extracting text:", error);
    throw error;
  }
}

// Extract text from buffer (for cloud files)
async function extractTextFromBuffer(buffer) {
  const ext = buffer.slice(0, 4).toString(); // Check for PDF/ DOCX header
  if (ext === "2550") {
    return await pdfParse(buffer).then((data) => data.text); // For PDF files
  } else if (buffer.slice(0, 8).toString() === "PK\x03\x04") {
    return await mammoth
      .extractRawText({ buffer: buffer })
      .then((result) => result.value); // For DOCX files
  } else {
    throw new Error("Unsupported file type");
  }
}

// Improved chunking with sentence awareness
function chunkText(text, maxWords = 200) {
  try {
    if (!text || typeof text !== "string") return [];

    const sentences = text.split(/(?<=[.!?])\s+/);
    const chunks = [];
    let currentChunk = [];

    for (const sentence of sentences) {
      const words = sentence.split(/\s+/);

      if (
        currentChunk.length + words.length > maxWords &&
        currentChunk.length > 0
      ) {
        chunks.push(currentChunk.join(" "));
        currentChunk = [];
      }

      currentChunk.push(...words);
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(" "));
    }

    return chunks;
  } catch (error) {
    console.error("Error chunking text:", error);
    return [];
  }
}

// Cosine similarity with validation
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  try {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return magA * magB > 0 ? dot / (magA * magB) : 0;
  } catch (error) {
    console.error("Error calculating cosine similarity:", error);
    return 0;
  }
}

// Enhanced OpenAI embedding with retries
async function getEmbedding(text, retries = 3) {
  if (!text || typeof text !== "string") {
    throw new Error("Invalid text input");
  }

  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.post(
        "https://api.openai.com/v1/embeddings",
        {
          input: text,
          model: "text-embedding-3-small",
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      if (!res.data?.data?.[0]?.embedding) {
        throw new Error("Invalid embedding response");
      }

      return res.data.data[0].embedding;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// Improved chunk search with batching
async function searchChunks(chunks, question) {
  try {
    if (!chunks?.length || !question) return [];

    const questionEmbedding = await getEmbedding(question);
    const scored = [];

    const batchSize = 5;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchEmbeddings = await Promise.all(
        batch.map((chunk) => getEmbedding(chunk))
      );

      batch.forEach((chunk, j) => {
        const score = cosineSimilarity(questionEmbedding, batchEmbeddings[j]);
        scored.push({ chunk, score });
      });
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((s) => s.chunk);
  } catch (error) {
    console.error("Error searching chunks:", error);
    return [];
  }
}

// Enhanced GPT prompt with better formatting
async function askGPT(contextChunks, question) {
  try {
    if (!contextChunks?.length || !question) {
      throw new Error("Missing context or question");
    }

    const prompt = `Document Context:\n${contextChunks
      .map((chunk, i) => `[Context Part ${i + 1}]:\n${chunk}`)
      .join("\n\n")}

Question: ${question}

Please answer the question based on the provided document context. If the answer isn't found in the context, respond with "I couldn't find the answer in the document." Be concise but thorough.`;

    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    return res.data.choices[0]?.message?.content || "No response from AI";
  } catch (error) {
    console.error("Error asking GPT:", error);
    return "Sorry, I encountered an error while processing your question.";
  }
}

module.exports = {
  extractText,
  chunkText,
  searchChunks,
  askGPT,
};
