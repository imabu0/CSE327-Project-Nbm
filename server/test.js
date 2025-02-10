const fs = require("fs");
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { google } = require("googleapis");
require("dotenv").config();
const { pool } = require("./config/db.js");
const { registerUser, loginUser } = require("./models/auth.model.js");
const protectRoute = require("./middlewares/authMiddleware.js")
const userRoutes = require("./routes/userRoutes.js");

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

app.post("/api/register", registerUser) // **🔹 Define a route to register a new user
app.post("/api/login", loginUser) // **🔹 Define a route to login a user
app.use("/api", userRoutes)

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
  if (
    !auth.credentials.expiry_date ||
    auth.credentials.expiry_date <= Date.now()
  ) {
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
    res.redirect("http://localhost:5173/dashboard");
  } catch (error) {
    console.error("❌ OAuth Error:", error.message);
    res.status(500).send("Authentication failed.");
  }
});

// **🔹 Count buckets
app.get("/buckets", async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) FROM google_accounts");
    const count = result.rows[0].count;
    res.json({ count }); // Send response with count
  } catch (error) {
    console.error("❌ Error counting buckets:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// **🔹 Total available space endpoint**
app.get("/space", async (req, res) => {
  try {
    // Retrieve the stored tokens (linked accounts)
    const storedTokens = await loadTokens();

    // Check if no accounts are linked; if none, return an error
    if (!storedTokens.length) {
      return res.status(401).send("❌ No accounts linked. Please authorize.");
    }

    // Initialize a variable to store the total used space (in bytes)
    let totalUsed = 0;

    // Loop through each stored token (account) and fetch space details
    for (const token of storedTokens) {
      // Set credentials for the current token
      oauth2Client.setCredentials(token);

      // Refresh the token if expired (ensures valid credentials)
      await refreshTokenIfNeeded(oauth2Client);

      // Initialize Google Drive API client
      const drive = google.drive({ version: "v3", auth: oauth2Client });

      // Fetch the storage quota data from Google Drive using the `about.get` method
      const response = await drive.about.get({
        fields: "storageQuota", // Request only the storage quota fields
      });

      // Destructure the `storageQuota` data from the response
      const { storageQuota } = response.data;
      if (!storageQuota) {
        console.error("❌ No storageQuota in response.");
        continue; // Skip this account if no storageQuota data
      }

      // Add the used space for this account to the total used space
      totalUsed = totalUsed + parseInt(storageQuota.usage);
    }

    // Total used space in GB
    const usedInGB = (totalUsed / 1024 ** 3).toFixed(2);

    // Return the total used space in GB as the response
    res.json({ used: usedInGB });
  } catch (error) {
    // Handle and log any errors that may occur
    console.error("❌ Error:", error.message);
    res.status(500).send("❌ Error fetching space data.");
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
