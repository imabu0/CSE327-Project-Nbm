require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const querystring = require('querystring');

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

app.get('/login', (req, res) => {
  const redirectUri = `${process.env.REDIRECT_URI}/onedrive/oauth2callback`;
  const params = querystring.stringify({
    client_id: process.env.CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'User.Read Files.ReadWrite offline_access',
    response_mode: 'query'
  });

  const authUrl = `${AUTH_URL}?${params}`;
  console.log("Generated OAuth URL:", authUrl); // Debugging
  res.redirect(authUrl);
});


app.get('/onedrive/oauth2callback', async (req, res) => {
  console.log("OAuth callback query params:", req.query); // Debugging
  
  if (!req.query.code) {
    console.error('Authorization code is missing:', req.query);
    return res.status(400).send('Authorization code missing. Please try logging in again.');
  }

  try {
    const tokenResponse = await axios.post(TOKEN_URL, querystring.stringify({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      code: req.query.code,
      redirect_uri: `${process.env.REDIRECT_URI}/onedrive/oauth2callback`,
      grant_type: 'authorization_code'
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    req.session.accessToken = tokenResponse.data.access_token;
    req.session.refreshToken = tokenResponse.data.refresh_token;
    res.redirect('/');
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    res.status(500).send(error.response?.data || 'Failed to exchange authorization code. Please try again.');
  }
});


// Refresh Access Token
async function refreshAccessToken(req) {
  try {
    if (!req.session.refreshToken) throw new Error('No refresh token available');

    const tokenResponse = await axios.post(TOKEN_URL, querystring.stringify({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      refresh_token: req.session.refreshToken,
      grant_type: 'refresh_token'
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    req.session.accessToken = tokenResponse.data.access_token;
    req.session.refreshToken = tokenResponse.data.refresh_token;
  } catch (error) {
    console.error('Error refreshing token:', error.response?.data || error.message);
  }
}

// Middleware to check authentication
async function isAuthenticated(req, res, next) {
  if (!req.session.accessToken) {
    return res.redirect('/login');
  }
  next();
}

// Upload file to OneDrive
app.post('/upload', isAuthenticated, upload.single('file'), async (req, res) => {
  try {
    await refreshAccessToken(req);
    const accessToken = req.session.accessToken;
    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname;

    await axios.put(`${GRAPH_URL}/root:/${fileName}:/content`, fileBuffer, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': req.file.mimetype }
    });

    res.send('File uploaded to OneDrive');
  } catch (error) {
    res.status(500).send(error.response?.data || error.message);
  }
});

// Download file
app.get('/download/:fileId', isAuthenticated, async (req, res) => {
  try {
    const accessToken = req.session.accessToken;
    const fileId = req.params.fileId;

    // Fetch file metadata to get the actual file name
    const metadataResponse = await axios.get(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const fileName = metadataResponse.data.name;

    // Request the file content from OneDrive
    const response = await axios.get(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'stream',
    });

    // Set headers to force download
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', response.headers['content-type']);
    res.setHeader('Content-Length', response.headers['content-length']);

    // Pipe the response stream to the client
    response.data.pipe(res);
  } catch (error) {
    console.error('Error downloading file:', error.response?.data || error.message);
    res.status(500).json(error.response?.data || { error: 'File not found or missing permissions' });
  }
});

// Delete file
app.delete('/delete/:fileId', isAuthenticated, async (req, res) => {
  try {
    const accessToken = req.session.accessToken;
    const fileId = req.params.fileId;

    await axios.delete(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    res.send(`File with ID ${fileId} deleted successfully`);
  } catch (error) {
    console.error('Error deleting file:', error.response?.data || error.message);
    res.status(500).json(error.response?.data || { error: 'File not found or missing permissions' });
  }
});

// List files
app.get('/files', isAuthenticated, async (req, res) => {
  try {
    await refreshAccessToken(req);
    const accessToken = req.session.accessToken;

    const response = await axios.get(`${GRAPH_URL}/root/children`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).send(error.response?.data || error.message);
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.send('Logged out');
  });
});

// Serve Homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
