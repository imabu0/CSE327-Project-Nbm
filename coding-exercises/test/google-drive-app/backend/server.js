const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Google Drive API Backend is Running!");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const weaviate = require('weaviate-ts-client');
const fs = require('fs');
require('dotenv').config(); // If you use .env for config

// Initialize client
const client = weaviate.client({
  scheme: 'https',
  host: process.env.WEAVIATE_HOST, // e.g. "yourinstance.weaviate.network"
  apiKey: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY), // optional, if needed
});

// ✅ Check connection
async function checkWeaviateConnection() {
  try {
    const res = await client.misc.liveChecker().do();
    if (res.status === 'OK') {
      console.log('✅ Weaviate is connected.');
    } else {
      console.log('⚠️ Weaviate returned:', res);
    }
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
  }
}

// ✅ Upload function
async function uploadFileToWeaviate(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    const response = await client.data
      .creator()
      .withClassName('Document') // Ensure this class exists in Weaviate schema
      .withProperties({
        name: filePath,
        content: fileContent,
      })
      .do();

    console.log('✅ File uploaded:', response);
  } catch (err) {
    console.error('❌ Upload failed:', err.message);
  }
}

// --- Run the tests ---
(async () => {
  await checkWeaviateConnection();
  await uploadFileToWeaviate('./sample.txt'); // Replace with your file path
})();
