const express = require("express");
const axios = require("axios");
const fs = require("fs");
const { google } = require("googleapis");
const { pool } = require("./config/db"); // Make sure the path is correct
const dropboxV2Api = require("dropbox-v2-api"); // For Dropbox API
const app = express();
const cors = require("cors");
const session = require("express-session");
const { registerUser, loginUser } = require("./models/auth.model.js");

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

app.post("/api/register", registerUser); // **🔹 Define a route to register a new user
app.post("/api/login", loginUser); // **🔹 Define a route to login a user

// Dropbox OAuth2 configuration
const DROPBOX_OAUTH_URL = "https://www.dropbox.com/oauth2/authorize";
const CLIENT_ID = process.env.DROPBOX_CLIENT_ID;
const CLIENT_SECRET = process.env.DROPBOX_CLIENT_SECRET;
const REDIRECT_URI = process.env.DROPBOX_REDIRECT_URI; // Update with your redirect URI

const authUrl = `${DROPBOX_OAUTH_URL}?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&token_access_type=offline`;

// Google OAuth2 configuration
const credentials = JSON.parse(fs.readFileSync("credentials.json")).web;
const SCOPES = ["https://www.googleapis.com/auth/drive"];
const oauth2Client = new google.auth.OAuth2(
  credentials.client_id,
  credentials.client_secret,
  credentials.redirect_uris[0]
);

// Middleware to handle Dropbox token save
const saveDropboxTokens = async (accessToken, refreshToken, expiryDate) => {
  try {
    await pool.query(
      `INSERT INTO dropbox_accounts (access_token, refresh_token, expiry_date) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (refresh_token) 
         DO UPDATE SET access_token = EXCLUDED.access_token, expiry_date = EXCLUDED.expiry_date`,
      [accessToken, refreshToken, expiryDate]
    );
    console.log("✅ Dropbox tokens saved to PostgreSQL.");
  } catch (error) {
    console.error("❌ Error saving Dropbox tokens:", error.message);
  }
};

// Save Google Drive tokens
const saveTokens = async (tokens) => {
  try {
    await pool.query(
      "INSERT INTO google_accounts (access_token, refresh_token, expiry_date) VALUES ($1, $2, $3) ON CONFLICT (refresh_token) DO UPDATE SET access_token = EXCLUDED.access_token, expiry_date = EXCLUDED.expiry_date",
      [tokens.access_token, tokens.refresh_token, tokens.expiry_date]
    );
    console.log("✅ Google tokens saved to PostgreSQL.");
  } catch (error) {
    console.error("❌ Error saving Google tokens:", error.message);
  }
};

// Load Dropbox tokens from PostgreSQL
const loadDropboxTokens = async () => {
  try {
    const res = await pool.query("SELECT * FROM dropbox_accounts");
    return res.rows; // Return array of tokens
  } catch (error) {
    console.error("❌ Error loading Dropbox tokens:", error.message);
    return [];
  }
};

// Load Google Drive tokens from PostgreSQL
const loadTokens = async () => {
  try {
    const res = await pool.query("SELECT * FROM google_accounts");
    return res.rows;
  } catch (error) {
    console.error("❌ Error loading tokens from PostgreSQL:", error.message);
    return [];
  }
};

// Refresh Google Drive token if expired
async function refreshTokenIfNeeded(auth) {
  if (
    !auth.credentials.expiry_date ||
    auth.credentials.expiry_date <= Date.now()
  ) {
    const { credentials } = await auth.refreshAccessToken();
    auth.setCredentials(credentials);
    await saveTokens(credentials);
  }
}

// OAuth flow for Dropbox and Google Drive
app.get("/dropbox/authorize", (req, res) => {
  res.redirect(authUrl);
});

// Dropbox OAuth callback
app.get("/dropbox/oauth2callback", async (req, res) => {
  const code = req.query.code;

  try {
    const response = await axios.post(
      "https://api.dropbox.com/oauth2/token",
      `code=${code}&grant_type=authorization_code&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&redirect_uri=${REDIRECT_URI}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token } = response.data;
    await saveDropboxTokens(access_token, refresh_token);
    res.redirect("http://localhost:5173/dashboard");
  } catch (error) {
    console.error("❌ Error during Dropbox OAuth callback:", error.message);
    res.status(500).send("Authentication failed.");
  }
});

// **🔹 OAuth Authorization**
app.get("/authorize", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
  res.redirect(authUrl);
});

// Google Drive OAuth callback
app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    await saveTokens(tokens);
    res.redirect("http://localhost:5173/dashboard");
  } catch (error) {
    console.error("❌ OAuth Error:", error.message);
    res.status(500).send("Authentication failed.");
  }
});

// Dropbox API - List files from all accounts
const listDropboxFiles = (dbx) => {
  return new Promise((resolve, reject) => {
    dbx(
      {
        resource: "files/list_folder",
        parameters: { path: "" },
      },
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      }
    );
  });
};

// Google Drive API - List files from all accounts
app.get("/drive", async (req, res) => {
  const folderId = req.query.folderId || "root";
  const storedTokens = await loadTokens();

  if (!storedTokens.length) {
    return res.status(401).send("❌ No accounts linked. Please authorize.");
  }

  const files = [];

  for (const token of storedTokens) {
    oauth2Client.setCredentials(token);
    await refreshTokenIfNeeded(oauth2Client);

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    try {
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: "files(id, name, mimeType)",
      });
      files.push(...response.data.files);
    } catch (error) {
      console.error("❌ Error listing Google Drive files:", error.message);
    }
  }

  res.json(files);
});

// Dropbox files API - List files from Dropbox
app.get("/dropbox/files", async (req, res) => {
  const storedTokens = await loadDropboxTokens();

  if (!storedTokens.length) {
    return res
      .status(401)
      .send("❌ No Dropbox accounts linked. Please authorize.");
  }

  const allFiles = [];

  for (const token of storedTokens) {
    const dbx = dropboxV2Api.authenticate({ token: token.access_token });

    try {
      const response = await listDropboxFiles(dbx);
      if (response.entries) {
        allFiles.push(...response.entries);
      }
    } catch (error) {
      console.error("❌ Error listing Dropbox files:", error.message);
    }
  }

  res.json(allFiles);
});

// Count Dropbox and Google accounts linked
app.get("/accounts-count", async (req, res) => {
  try {
    const dropboxCount = await pool.query(
      "SELECT COUNT(*) FROM dropbox_accounts"
    );
    const googleCount = await pool.query(
      "SELECT COUNT(*) FROM google_accounts"
    );

    res.json({
      dropboxAccounts: dropboxCount.rows[0].count,
      googleAccounts: googleCount.rows[0].count,
    });
  } catch (error) {
    console.error("❌ Error counting accounts:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
