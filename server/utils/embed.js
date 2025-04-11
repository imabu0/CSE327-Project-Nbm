const axios = require("axios");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function embedQuery(text) {
  const response = await axios.post(
    "https://api.openai.com/v1/embeddings",
    {
      input: text,
      model: "text-embedding-ada-002"
    },
    {
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data.data[0].embedding;
}

module.exports = { embedQuery };
