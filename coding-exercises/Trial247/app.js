require('dotenv').config();
const path = require('path');
const express = require('express');
const multer = require('multer');
const session = require('express-session');
const axios = require('axios');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = 8000;

// MSAL configuration
const msalConfig = {
  auth: {
    clientId: process.env.CLIENT_ID,
    authority: 'https://login.microsoftonline.com/consumers', 
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: 'http://localhost:8000/auth/callback'
  }
};

const { ConfidentialClientApplication } = require('@azure/msal-node');
const pca = new ConfidentialClientApplication(msalConfig);

// Session setup
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false,
}));

// Middleware to check authentication
function isAuthenticated(req, res, next) {
  if (req.session.accessToken) {
    return next();
  }
  res.redirect('/login');
}

app.get('/login', async (req, res) => {
  try {
    const authUrl = await pca.getAuthCodeUrl({
      scopes: ['User.Read', 'Files.ReadWrite'],
      redirectUri: msalConfig.auth.redirectUri,
      prompt: 'select_account'
    });
    res.redirect(authUrl);

  } catch (error) {
    console.error("Auth URL Error:", error);
    res.status(500).send(error.message);
  }
});


app.get('/auth/callback', async (req, res) => {
  if (!req.query.code) {
    return res.status(400).send('Authorization code missing.');
  }

  try {
    const tokenResponse = await pca.acquireTokenByCode({
      code: req.query.code,
      scopes: ['User.Read', 'Files.ReadWrite'],
      redirectUri: msalConfig.auth.redirectUri,
      clientSecret: process.env.CLIENT_SECRET
    });

    req.session.accessToken = tokenResponse.accessToken;

    res.redirect('/');
  } catch (error) {
    console.error("Token Error:", error);
    res.status(500).send(error.message);
  }
});



// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.send('Logged out');
  });
});

// Upload file to OneDrive
app.post('/upload', isAuthenticated, upload.single('file'), async (req, res) => {
  try {
    const accessToken = req.session.accessToken;
    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname;

    await axios.put(`https://graph.microsoft.com/v1.0/me/drive/root:/${fileName}:/content`, fileBuffer, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': req.file.mimetype }
    });

    res.send('File uploaded to OneDrive');
  } catch (error) {
    res.status(500).send(error.response?.data || error.message);
  }
});

// List files
app.get('/files', isAuthenticated, async (req, res) => {
  try {
    const accessToken = req.session.accessToken;
    const response = await axios.get('https://graph.microsoft.com/v1.0/me/drive/root/children', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    res.json(response.data);
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


// Serve the homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
