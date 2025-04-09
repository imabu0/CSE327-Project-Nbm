const express = require('express');
const { google } = require('googleapis');
const Dropbox = require('dropbox').Dropbox;
const fetch = require('node-fetch');
const protectRoute = require('../middlewares/authMiddleware.js'); // Middleware for authentication
const { extractText, chunkText, searchChunks, askGPT } = require('../utils/chatHelper.js'); // Import helper functions

const router = express.Router();

// Google Drive API setup
const drive = google.drive({ version: 'v3', auth: process.env.GOOGLE_API_KEY });

// Dropbox setup
const dbx = new Dropbox({ accessToken: process.env.DROPBOX_API_KEY, fetch });

// Fetch all files from Google Drive
async function fetchGoogleDriveFiles(userId) {
  try {
    const response = await drive.files.list({
      q: `'${userId}' in owners`,
      fields: 'files(id, name, mimeType)',
    });

    return response.data.files.map(file => ({
      path: file.id,  // Google Drive file ID
      source: 'googleDrive',
    }));
  } catch (error) {
    console.error('Error fetching Google Drive files:', error);
    return [];
  }
}

// Fetch all files from Dropbox
async function fetchDropboxFiles(userId) {
  try {
    const response = await dbx.filesListFolder({ path: '' });
    return response.entries.map(file => ({
      path: file.path_display, // Dropbox file path
      source: 'dropbox',
    }));
  } catch (error) {
    console.error('Error fetching Dropbox files:', error);
    return [];
  }
}

// Chat route to ask questions from all files
router.post("/chat", protectRoute, async (req, res) => {
  const { question } = req.body;

  if (!question?.trim()) {
    return res.status(400).json({ error: "Question is required" });
  }

  try {
    // Fetch all files from Google Drive and Dropbox
    const googleFiles = await fetchGoogleDriveFiles(req.user.id);
    const dropboxFiles = await fetchDropboxFiles(req.user.id);

    const allFiles = [...googleFiles, ...dropboxFiles];
    let allChunks = [];

    // Extract text from each file and chunk it
    for (const file of allFiles) {
      const filePath = file.path;  // File path (Google Drive ID or Dropbox path)
      const fileSource = file.source;  // "googleDrive" or "dropbox"

      const rawText = await extractText(filePath, fileSource);
      const chunks = chunkText(rawText);
      allChunks = [...allChunks, ...chunks];
    }

    // Search the chunks for relevant information based on the question
    const relevantChunks = await searchChunks(allChunks, question);

    if (!relevantChunks || relevantChunks.length === 0) {
      return res.status(200).json({ answer: "Sorry, I couldn't find relevant information in the documents." });
    }

    // Ask GPT-4 to answer based on the relevant chunks
    const answer = await askGPT(relevantChunks, question);

    return res.status(200).json({ answer });
  } catch (error) {
    console.error("Error processing question:", error);
    return res.status(500).json({ error: "Something went wrong. Please try again later." });
  }
});

module.exports = router;
