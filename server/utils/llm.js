const axios = require("axios");



const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize with your Gemini API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function callLLM(messages) {
  try {
    // Get the Gemini Pro chat model
    const model = genAI.getGenerativeModel({ model: "gemma-3-12b-it" });

    // Start the chat session
    const chat = model.startChat({
      history: messages.slice(0, -1).map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      })),
    });

    // Send the latest message in the conversation
    const result = await chat.sendMessage(messages[messages.length - 1].content);

    const response = await result.response;
    const text = response.text();

    return text.trim();
  } catch (error) {
    console.error("Gemini LLM error:", error.message);
    return "⚠️ Gemini request failed.";
  }
}

module.exports = { callLLM };

