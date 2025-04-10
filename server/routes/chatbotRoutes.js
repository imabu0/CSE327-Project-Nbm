const express = require("express");
const protectRoute = require("../middlewares/authMiddleware.js");
const Chatbot = require("../models/chatbot.model.js");

const router = express.Router();
const chatbot = new Chatbot();

// Timeout settings
const FILE_PROCESSING_TIMEOUT = 30000; // 30 seconds per file
const GPT_TIMEOUT = 60000; // 60 seconds for GPT response

// Helper: Timeout wrapper
function getFilesWithTimeout(fn, timeout = 10000) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("File listing timeout")), timeout)
    ),
  ]);
}

// Main route
router.post("/chat", protectRoute, async (req, res) => {
  const { question } = req.body;

  if (!question?.trim()) {
    return res.status(400).json({ error: "Question is required" });
  }

  try {
    // Step 1: Get all user files (with timeouts)
    const [googleFiles, dropboxFiles] = await Promise.all(
      [
        getFilesWithTimeout(() => chatbot.googleBucket.listFiles(req.user.id)),
        getFilesWithTimeout(() => chatbot.dropboxBucket.listFiles(req.user.id)),
      ].map(p =>
        p.catch(e => {
          console.error(`Error fetching files: ${e.message}`);
          return [];
        })
      )
    );

    const allFiles = [
      ...(googleFiles || []).map(f => ({ ...f, source: "googleDrive" })),
      ...(dropboxFiles || []).map(f => ({ ...f, source: "dropbox" })),
    ];

    if (allFiles.length === 0) {
      return res.status(200).json({
        answer:
          "No documents found in your connected accounts. Please connect Google Drive or Dropbox to ask questions about your files.",
      });
    }

    // Step 2: Extract + chunk text from all files
    let allChunks = [];
    let processedFiles = 0;

    for (const file of allFiles) {
      try {
        const rawText = await Promise.race([
          chatbot.extractText(file.id || file.path, file.source, req.user.id),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`File processing timeout for ${file.name}`)), FILE_PROCESSING_TIMEOUT)
          ),
        ]);

        if (!rawText?.trim()) {
          console.warn(`Empty content in file ${file.name}`);
          continue;
        }

        const chunks = chatbot.chunkText(rawText);
        allChunks.push(...chunks);
        processedFiles++;
      } catch (err) {
        console.error(`Error processing file ${file.name}:`, err.message);
        continue;
      }
    }

    if (processedFiles === 0) {
      return res.status(200).json({
        answer:
          "Could not extract text from any of your documents. Please check if they contain readable text.",
      });
    }

    if (allChunks.length === 0) {
      return res.status(200).json({
        answer:
          "No meaningful text chunks could be extracted from your documents.",
      });
    }

    // Step 3: Semantic search to find relevant chunks
    const relevantChunks = await Promise.race([
      chatbot.searchChunks(allChunks, question),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Chunk search timeout")), FILE_PROCESSING_TIMEOUT)
      ),
    ]);

    if (!relevantChunks?.length) {
      return res.status(200).json({
        answer: "Sorry, I couldn't find relevant information in the documents.",
      });
    }

    // Step 4: Ask GPT with relevant context
    const answer = await Promise.race([
      chatbot.askGPT(relevantChunks, question),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("GPT response timeout")), GPT_TIMEOUT)
      ),
    ]);

    return res.status(200).json({ answer });
  } catch (error) {
    console.error("Error processing question:", error.message);
    const message = error.message.includes("timeout")
      ? "The request took too long to process. Please try again with a more specific question or fewer documents."
      : "Something went wrong. Please try again later.";

    return res.status(500).json({ error: message });
  }
});

module.exports = router;
