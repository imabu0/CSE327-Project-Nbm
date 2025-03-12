require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const querystring = require('querystring');
const fs = require('fs');
const stream = require('stream');
const util = require('util');
const pipeline = util.promisify(stream.pipeline);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = 8000;

app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false,
}));

const AUTH_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const GRAPH_URL = "https://graph.microsoft.com/v1.0/me/drive";

// Store tokens for multiple accounts
let userAccounts = {}; 

app.get('/login', (req, res) => {
  const redirectUri = `${process.env.REDIRECT_URI}/onedrive/oauth2callback`;
  
  const params = querystring.stringify({
    client_id: process.env.CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'User.Read Files.ReadWrite offline_access',
    response_mode: 'query',
    prompt: 'select_account'  // This forces Microsoft to show the account selection screen
  });

  res.redirect(`${AUTH_URL}?${params}`);
});

app.get('/onedrive/oauth2callback', async (req, res) => {
  if (!req.query.code) return res.status(400).send('Authorization code missing.');

  try {
    const tokenResponse = await axios.post(TOKEN_URL, querystring.stringify({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      code: req.query.code,
      redirect_uri: `${process.env.REDIRECT_URI}/onedrive/oauth2callback`,
      grant_type: 'authorization_code'
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    const accessToken = tokenResponse.data.access_token;
    const refreshToken = tokenResponse.data.refresh_token;

    // Get User Info (to distinguish accounts)
    const userInfo = await axios.get("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const userId = userInfo.data.id;

    // Ensure we don't overwrite existing users
    if (!userAccounts[userId]) {
      userAccounts[userId] = { accessToken, refreshToken };
    } else {
      console.log(`Account ${userId} is already linked.`);
    }

    console.log(`Linked account: ${userId}`);
    res.redirect('/');
  } catch (error) {
    console.error('Failed to exchange authorization code:', error.response?.data || error.message);
    res.status(500).send('Failed to exchange authorization code.');
  }
});


async function refreshAccessToken(userId) {
  try {
    if (!userAccounts[userId]?.refreshToken) return;
    const tokenResponse = await axios.post(TOKEN_URL, querystring.stringify({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      refresh_token: userAccounts[userId].refreshToken,
      grant_type: 'refresh_token'
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    userAccounts[userId].accessToken = tokenResponse.data.access_token;
    userAccounts[userId].refreshToken = tokenResponse.data.refresh_token;
  } catch (error) {
    console.error('Error refreshing token:', error.response?.data || error.message);
  }
}

app.get('/files', async (req, res) => {
  try {
    let fileMap = {};

    for (const userId in userAccounts) {
      await refreshAccessToken(userId);
      const accessToken = userAccounts[userId].accessToken;

      const response = await axios.get(`${GRAPH_URL}/root/children`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      // Process chunked files
      response.data.value.forEach(file => {
        const match = file.name.match(/(.*)\.part(\d+)$/);
        if (match) {
          const originalName = match[1];
          const chunkIndex = parseInt(match[2]);

          if (!fileMap[originalName]) {
            fileMap[originalName] = {
              name: originalName,
              chunks: [],
              totalChunks: 0
            };
          }

          fileMap[originalName].chunks.push({ userId, fileId: file.id, chunkIndex });
          fileMap[originalName].totalChunks++;
        }
      });
    }

    // Format response: Show whole files, not chunks
    const formattedFiles = Object.values(fileMap).map(file => ({
      name: file.name,
      totalChunks: file.totalChunks
    }));

    res.json(formattedFiles);
  } catch (error) {
    console.error('Error fetching files:', error.response?.data || error.message);
    res.status(500).send(error.response?.data || error.message);
  }
});


app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname;
    const fileSize = fileBuffer.byteLength;
    const userIds = Object.keys(userAccounts);

    if (userIds.length === 0) {
      return res.status(400).send("No OneDrive accounts linked.");
    }

    const chunkSize = Math.ceil(fileSize / userIds.length);
    let chunkIndex = 0, start = 0;
    let fileChunks = [];

    while (start < fileSize) {
      const userId = userIds[chunkIndex % userIds.length];
      await refreshAccessToken(userId);
      const accessToken = userAccounts[userId].accessToken;

      // Calculate chunk range
      let end = Math.min(start + chunkSize, fileSize); // Ensure we include the last byte

      // Step 1: Create an upload session
      const uploadSessionRes = await axios.post(
        `${GRAPH_URL}/root:/${encodeURIComponent(fileName)}.part${chunkIndex}:/createUploadSession`,
        {},
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const uploadUrl = uploadSessionRes.data.uploadUrl;
      console.log(`Upload session created for chunk ${chunkIndex} (User: ${userId})`);

      // Step 2: Upload the chunk
      const chunk = fileBuffer.slice(start, end); // Ensure it includes the last byte
      const contentRange = `bytes ${start}-${end - 1}/${fileSize}`; // Adjusted

      console.log(`Uploading chunk ${chunkIndex}: ${contentRange} (User: ${userId})`);

      await axios.put(uploadUrl, chunk, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Length': chunk.byteLength,
          'Content-Range': contentRange
        }
      });

      fileChunks.push({ userId, chunkIndex, fileName: `${fileName}.part${chunkIndex}`, fileSize: chunk.byteLength });

      start = end; // Move to the next chunk
      chunkIndex++;
    }

    res.json({ message: 'File distributed across accounts.', fileChunks });
  } catch (error) {
    console.error('Error during chunked upload:', error.response?.data || error.message);
    res.status(500).send(error.response?.data || error.message);
  }
});




// Delete file from a specific OneDrive account
app.delete('/delete/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    let chunksToDelete = [];

    for (const userId in userAccounts) {
      await refreshAccessToken(userId);
      const accessToken = userAccounts[userId].accessToken;

      const response = await axios.get(`${GRAPH_URL}/root/children`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      // Find all chunks for this file
      response.data.value.forEach(file => {
        if (file.name.startsWith(fileName + '.part')) {
          chunksToDelete.push({ userId, fileId: file.id });
        }
      });
    }

    // Delete all chunks
    for (const chunk of chunksToDelete) {
      await refreshAccessToken(chunk.userId);
      const accessToken = userAccounts[chunk.userId].accessToken;

      await axios.delete(`${GRAPH_URL}/items/${chunk.fileId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
    }

    res.send(`Deleted file "${fileName}" and its chunks.`);
  } catch (error) {
    console.error('Error deleting file:', error.response?.data || error.message);
    res.status(500).send(error.response?.data || error.message);
  }
});



app.get('/download/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    let chunkFiles = [];

    // Find all chunks across accounts
    for (const userId in userAccounts) {
      await refreshAccessToken(userId);
      const accessToken = userAccounts[userId].accessToken;

      const response = await axios.get(`${GRAPH_URL}/root/children`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      // Filter out relevant chunks
      response.data.value.forEach(file => {
        if (file.name.startsWith(fileName + '.part')) {
          chunkFiles.push({ userId, fileId: file.id, chunkIndex: parseInt(file.name.split('.part')[1]) });
        }
      });
    }

    // Sort chunks in correct order
    chunkFiles.sort((a, b) => a.chunkIndex - b.chunkIndex);

    if (chunkFiles.length === 0) {
      return res.status(404).send('File not found.');
    }

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // Stream the merged file to the response
    const passThrough = new stream.PassThrough();
    passThrough.pipe(res);

    for (const chunk of chunkFiles) {
      await refreshAccessToken(chunk.userId);
      const accessToken = userAccounts[chunk.userId].accessToken;

      console.log(`Downloading chunk ${chunk.chunkIndex} from User ${chunk.userId}`);

      const chunkResponse = await axios.get(`${GRAPH_URL}/items/${chunk.fileId}/content`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'stream'
      });

      await pipeline(chunkResponse.data, passThrough);
    }

    passThrough.end();
  } catch (error) {
    console.error('Error during file download:', error.response?.data || error.message);
    res.status(500).send(error.response?.data || error.message);
  }
});


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
