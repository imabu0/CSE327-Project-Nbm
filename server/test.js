const fs = require("fs");
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { google } = require("googleapis");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const PORT = 8081;

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

// **🔹 PostgreSQL Connection**
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// **🔹 Define a route to register a new user
app.post("/register", async (req, res) => {
  const { name, username, password } = req.body;
  try {
    const result = await client.query(
      "INSERT INTO user_info (name, username, password) VALUES ($1, $2, $3) RETURNING *",
      [name, username, password]
    );
    res.send(result.rows[0]);
  } catch (error) {
    console.error("Error executing query", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// **🔹 Define a route to login a user
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await client.query(
      "SELECT * FROM user_info WHERE username = $1 AND password = $2",
      [username, password]
    );
    if (result.rows.length > 0) {
      res.send(result.rows[0]);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Error executing query", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// **🔹 Load credentials.json**
let credentials;
try {
  credentials = JSON.parse(fs.readFileSync("credentials.json")).web;
} catch (error) {
  console.error("❌ Failed to load credentials.json:", error.message);
  process.exit(1);
}

const SCOPES = ["https://www.googleapis.com/auth/drive"];
const oauth2Client = new google.auth.OAuth2(
  credentials.client_id,
  credentials.client_secret,
  credentials.redirect_uris[0]
);

// **🔹 Save tokens to PostgreSQL**
const saveTokens = async (tokens) => {
  try {
    await pool.query(
      "INSERT INTO google_accounts (access_token, refresh_token, expiry_date) VALUES ($1, $2, $3) ON CONFLICT (refresh_token) DO UPDATE SET access_token = EXCLUDED.access_token, expiry_date = EXCLUDED.expiry_date",
      [tokens.access_token, tokens.refresh_token, tokens.expiry_date]
    );
    console.log("✅ Tokens saved to PostgreSQL.");
  } catch (error) {
    console.error("❌ Error saving tokens to PostgreSQL:", error.message);
  }
};

// **🔹 Load tokens from PostgreSQL**
const loadTokens = async () => {
  try {
    const res = await pool.query("SELECT * FROM google_accounts");
    return res.rows;
  } catch (error) {
    console.error("❌ Error loading tokens from PostgreSQL:", error.message);
    return [];
  }
};

// **🔹 Refresh Token if Expired**
async function refreshTokenIfNeeded(auth) {
  if (!auth.credentials.expiry_date || auth.credentials.expiry_date <= Date.now()) {
    const { credentials } = await auth.refreshAccessToken();
    auth.setCredentials(credentials);
    await saveTokens(credentials);
  }
}

// **🔹 OAuth Authorization**
app.get("/authorize", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
  res.redirect(authUrl);
});

// **🔹 OAuth Callback (Save Multiple Accounts)**
app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    await saveTokens(tokens);
    res.redirect("http://localhost:5173/all");
  } catch (error) {
    console.error("❌ OAuth Error:", error.message);
    res.status(500).send("Authentication failed.");
  }
});

// **🔹 List Google Drive Files (Using All Accounts)**
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
      console.error("❌ Error listing files:", error.message);
    }
  }

  res.json(files);
});

// **🔹 Start Server**
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
