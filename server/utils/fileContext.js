// utils/fileContext.js
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const WEAVIATE_URL = process.env.WEAVIATE_URL;
const WEAVIATE_API_KEY = process.env.WEAVIATE_API_KEY;
const EMBEDDING_MODEL_URL = "https://api.together.xyz/v1/embeddings"; // Or OpenAI if preferred

// Generate an embedding for your content
async function getEmbedding(text) {
  const response = await axios.post(
    EMBEDDING_MODEL_URL,
    {
      model: "togethercomputer/m2-bert-80M-8k-retrieval", // Replace with your chosen model
      input: [text],
    },
    {
      headers: {
        Authorization: `Bearer YOUR_TOGETHER_API_KEY`,
      },
    }
  );
  return response.data.data[0].embedding;
}

// Store a file chunk in Weaviate
async function indexFileChunk(fileId, fileName, chunkText) {
  const vector = await getEmbedding(chunkText);
  const uuid = uuidv4();

  await axios.post(
    `${WEAVIATE_URL}/v1/objects`,
    {
      class: "FileChunk",
      id: uuid,
      properties: {
        fileId,
        fileName,
        content: chunkText,
      },
      vector,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-OpenAI-Api-Key": WEAVIATE_API_KEY,
      },
    }
  );
}

// Search for relevant file chunks based on query
async function getRelevantFileChunks(query) {
  try {
    const vector = await getEmbedding(query);

    const response = await axios.post(
      `${WEAVIATE_URL}/v1/graphql`,
      {
        query: `
        {
          Get {
            FileChunk(
              nearVector: {
                vector: [${vector.join(",")}]
                certainty: 0.7
              }
              limit: 5
            ) {
              fileName
              content
            }
          }
        }
      `,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-OpenAI-Api-Key": WEAVIATE_API_KEY,
        },
      }
    );

    const chunks = response.data.data.Get.FileChunk;
    if (!chunks.length) return "No relevant file content found.";

    return chunks
      .map((chunk) => `File: ${chunk.fileName}\nContent: ${chunk.content}`)
      .join("\n\n");
  } catch (err) {
    console.error("Error in getRelevantFileChunks:", err.response?.data || err.message);
    return "Error fetching file context.";
  }
}

module.exports = { getRelevantFileChunks, indexFileChunk };
