const express = require("express");
const protectRoute = require("../middlewares/authMiddleware.js");
const Chatbot = require("../models/chatbot.model.js");

const router = express.Router();
const chatbot = new Chatbot();

router.post('/chat', protectRoute, async (req, res) => {
  try {
    const { question, fileIdFilter } = req.body;
    const userId = req.user.id;

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    const response = await chatbot.chatWithDocuments(
      userId, 
      question, 
      fileIdFilter || null
    );

    res.json(response);
  } catch (error) {
    console.error('Chat endpoint error:', error);
    
    const statusCode = error.message.includes('LM Studio') ? 503 : 500;
    res.status(statusCode).json({ 
      error: error.message || "Chatbot service unavailable",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;