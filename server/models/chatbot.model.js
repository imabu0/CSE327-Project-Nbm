const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const GoogleBucket = require("./google.model.js");
const DropboxBucket = require("./dropbox.model.js");

class Chatbot {
  constructor() {
    this.googleBucket = new GoogleBucket();
    this.dropboxBucket = new DropboxBucket();
    this.tempDir = path.join(__dirname, "temp");

    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async cleanTempFiles() {
    try {
      const files = await fs.promises.readdir(this.tempDir);
      await Promise.all(
        files.map((file) =>
          fs.promises.unlink(path.join(this.tempDir, file)).catch(() => {})
        )
      );
    } catch (error) {
      console.error("Error cleaning temp files:", error);
    }
  }

  async extractText(filePath, fileSource = "local", userId = 6) {
    try {
      switch (fileSource) {
        case "local":
          return await this.extractTextFromFile(filePath);

        case "googleDrive": {
          if (!userId)
            throw new Error("User ID is required for Google Drive files");

          const fileContent = await this.googleBucket.downloadFile(
            filePath,
            null,
            userId
          );

          if (
            !fileContent ||
            (Buffer.isBuffer(fileContent) && fileContent.length === 0)
          ) {
            throw new Error("Received empty content from Google Drive");
          }

          return typeof fileContent === "string"
            ? fileContent
            : await this.extractTextFromBuffer(fileContent);
        }

        case "dropbox": {
          if (!userId) throw new Error("User ID is required for Dropbox files");

          const fileContent = await this.dropboxBucket.downloadFile(
            filePath,
            userId
          );

          if (
            !fileContent ||
            (Buffer.isBuffer(fileContent) && fileContent.length === 0)
          ) {
            throw new Error("Received empty content from Dropbox");
          }

          return typeof fileContent === "string"
            ? fileContent
            : await this.extractTextFromBuffer(fileContent);
        }

        default:
          throw new Error(`Unsupported file source: ${fileSource}`);
      }
    } catch (error) {
      console.error(`Error extracting text from ${fileSource}:`, error);
      throw new Error(`Failed to extract text: ${error.message}`);
    }
  }

  async extractTextFromBufferWithRetry(buffer, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.extractTextFromBuffer(buffer);
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  async extractTextFromBuffer(buffer) {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error("Invalid buffer provided");
    }

    if (this.isPDFBuffer(buffer)) {
      try {
        const data = await pdfParse(buffer);
        return data.text || "";
      } catch (error) {
        console.error("Error parsing PDF buffer:", error);
        throw new Error("Failed to parse PDF: " + error.message);
      }
    }

    if (this.isDOCXBuffer(buffer)) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        return result.value || "";
      } catch (error) {
        console.error("Error parsing DOCX buffer:", error);
        throw new Error("Failed to parse DOCX: " + error.message);
      }
    }

    // Fallback to plain text
    try {
      return buffer.toString("utf8");
    } catch (error) {
      console.error("Error converting buffer to text:", error);
      throw new Error("Unsupported file type");
    }
  }

  isPDFBuffer(buffer) {
    return buffer.length > 4 && buffer.slice(0, 4).toString("ascii") === "%PDF";
  }

  isDOCXBuffer(buffer) {
    return (
      buffer.length > 4 && buffer.slice(0, 4).toString("hex") === "504b0304"
    );
  }

  async extractTextFromFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found at path: ${filePath}`);
      }

      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        throw new Error("File is empty");
      }

      const ext = path.extname(filePath).toLowerCase();

      if (ext === ".pdf") {
        const dataBuffer = fs.readFileSync(filePath);
        return await this.extractTextFromBuffer(dataBuffer);
      }

      if (ext === ".docx") {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value || "";
      }

      if (ext === ".txt") {
        return fs.readFileSync(filePath, "utf8");
      }

      throw new Error(`Unsupported file type: ${ext}`);
    } catch (error) {
      console.error(`Error extracting text from file ${filePath}:`, error);
      throw new Error(`Failed to extract text: ${error.message}`);
    }
  }

  chunkText(text, maxWords = 200) {
    try {
      if (!text || typeof text !== "string") return [];

      const sentences = text.split(/(?<=[.!?])\s+/);
      const chunks = [];
      let currentChunk = [];
      let currentWordCount = 0;

      for (const sentence of sentences) {
        const wordCount = sentence.split(/\s+/).length;

        if (
          currentWordCount + wordCount > maxWords &&
          currentChunk.length > 0
        ) {
          chunks.push(currentChunk.join(" "));
          currentChunk = [];
          currentWordCount = 0;
        }

        currentChunk.push(sentence);
        currentWordCount += wordCount;
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

  cosineSimilarity(a, b) {
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

  async getEmbedding(text, retries = 3) {
    if (!text || typeof text !== "string") {
      throw new Error("Invalid text input");
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    for (let i = 0; i < retries; i++) {
      try {
        const res = await axios.post(
          "https://api.openai.com/v1/embeddings",
          { input: text, model: "text-embedding-3-small" },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            timeout: 10000,
          }
        );

        return res.data?.data?.[0]?.embedding;
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  async searchChunks(chunks, question, topN = 3) {
    // Validate inputs
    if (!Array.isArray(chunks)) {
      throw new Error("Chunks must be an array");
    }
    if (!chunks.length) return [];
    if (typeof question !== "string" || !question.trim()) {
      throw new Error("Question must be a non-empty string");
    }

    // Embedding cache to avoid duplicate API calls
    const embeddingCache = new Map();

    // Get question embedding with retry
    const questionEmbedding = await this.getEmbeddingWithRetry(question);
    if (!questionEmbedding?.length) {
      throw new Error("Failed to get question embedding");
    }

    const scoredChunks = [];
    const batchSize = 3; // Reduced batch size to avoid rate limits
    const delayBetweenBatches = 200; // 200ms between batches

    try {
      for (let i = 0; i < chunks.length; i += batchSize) {
        // Rate limiting delay
        if (i > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, delayBetweenBatches)
          );
        }

        const batch = chunks.slice(i, i + batchSize);

        // Process batch with individual error handling
        const batchResults = await Promise.all(
          batch.map(async (chunk, index) => {
            try {
              if (typeof chunk !== "string" || !chunk.trim()) {
                return { chunk, score: 0, error: "Invalid chunk content" };
              }

              // Check cache first
              const cacheKey = chunk.substring(0, 100);
              let embedding;

              if (embeddingCache.has(cacheKey)) {
                embedding = embeddingCache.get(cacheKey);
              } else {
                embedding = await this.getEmbeddingWithRetry(chunk);
                embeddingCache.set(cacheKey, embedding);
              }

              if (!embedding) {
                return { chunk, score: 0, error: "Failed to get embedding" };
              }

              const score = this.cosineSimilarity(questionEmbedding, embedding);
              return { chunk, score };
            } catch (error) {
              console.error(
                `Error processing chunk ${i + index}:`,
                error.message
              );
              return { chunk, score: 0, error: error.message };
            }
          })
        );

        scoredChunks.push(...batchResults);
      }

      // Filter and sort results
      const validChunks = scoredChunks.filter((item) => item.score > 0);
      if (!validChunks.length) {
        console.warn("No valid chunks with positive similarity score found");
        return [];
      }

      return validChunks
        .sort((a, b) => b.score - a.score)
        .slice(0, topN)
        .map((item) => item.chunk);
    } catch (error) {
      console.error("Error in searchChunks:", error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  // Helper function with exponential backoff
  async getEmbeddingWithRetry(text, maxRetries = 3) {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        return await this.getEmbedding(text);
      } catch (error) {
        if (error.response?.status !== 429 || retries >= maxRetries)
          throw error;
        const delay = Math.pow(2, retries) * 1000;
        console.log(`Rate limited - retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        retries++;
      }
    }
    throw new Error("Max retries reached for embedding");
  }

  async askGPT(contextChunks, question) {
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
}

module.exports = Chatbot;
