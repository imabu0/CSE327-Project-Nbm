const axios = require("axios");
const { embedQuery } = require("./embed");

const WEAVIATE_URL = process.env.WEAVIATE_URL;
const WEAVIATE_API_KEY = process.env.WEAVIATE_API_KEY;
const WEAVIATE_CLASS = "FileChunk"; // Class name you used in Weaviate schema

async function getRelevantFileChunks(query) {
  try {
    const vector = await embedQuery(query); // Turn query into vector

    const response = await axios.post(
      `${WEAVIATE_URL}/v1/graphql`,
      {
        query: `
        {
          Get {
            ${WEAVIATE_CLASS}(
              nearVector: {
                vector: [${vector.join(",")}],
                certainty: 0.7
              },
              limit: 5
            ) {
              fileName
              content
            }
          }
        }`
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-OpenAI-Api-Key": WEAVIATE_API_KEY,
        }
      }
    );

    const chunks = response.data.data.Get[WEAVIATE_CLASS];

    if (!chunks || chunks.length === 0) {
      return "No relevant files found.";
    }

    return chunks.map(chunk => 
      `File: ${chunk.fileName}\nContent: "${chunk.content}"`
    ).join("\n\n");

  } catch (err) {
    console.error("Error in getRelevantFileChunks:", err.message);
    return "No relevant files found.";
  }
}

async function uploadFileChunks(chunks, originalName, userId) {
    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Convert text to vector (optional but needed if your schema uses vector similarity)
        const vector = await embedQuery(chunk);
  
        const mutation = `
          {
            Create {
              ${WEAVIATE_CLASS}(  // Class name must match your Weaviate schema
                vector: [${vector.join(",")}],
                properties: {
                  content: """${chunk}""",
                  fileName: "${originalName}",
                  userId: "${userId}"
                }
              ) {
                uuid
              }
            }
          }
        `;
  
        await axios.post(
          `${WEAVIATE_URL}/v1/graphql`,
          { query: mutation },
          {
            headers: {
              "Content-Type": "application/json",
              "X-OpenAI-Api-Key": WEAVIATE_API_KEY,
            }
          }
        );
      }
    } catch (err) {
      console.error("Error uploading file chunks:", err.message);
    }
  }

module.exports = { getRelevantFileChunks, uploadFileChunks };
