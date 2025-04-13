const axios = require("axios");

async function callLLM(messages) {
  const prompt = messages
    .map((m) =>
      `${m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : "System"}: ${m.content}`
    )
    .join("\n") + "\nAssistant:";

  try {
    const response = await axios.post(
      "https://api.together.xyz/v1/completions",
      {
        model: "mistralai/Mistral-7B-Instruct-v0.1", // Use valid Together model
        prompt: prompt, // Required
        max_tokens: 200,
        temperature: 0.7,
        top_p: 0.9,
        stop: ["User:", "Assistant:"], // Optional, but helpful
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`, // Make sure this exists!
          "Content-Type": "application/json",
        },
      }
    );

    const output = response.data?.choices?.[0]?.text;
    if (!output) {
      console.error("Unexpected LLM output structure:", response.data);
      return "⚠️ No output from LLM.";
    }

    return output.trim();
  } catch (error) {
    if (error.response) {
      console.error("LLM API response error:", error.response.data);
    } else {
      console.error("LLM call failed:", error.message);
    }
    return "⚠️ LLM request failed. Please try again.";
  }
}

module.exports = { callLLM };
