const fs = require("fs");
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { google } = require("googleapis");
require("dotenv").config();
const { pool } = require("./config/db.js");
const { registerUser, loginUser } = require("./models/auth.model.js");
const protectRoute = require("./middlewares/authMiddleware.js");
const userRoutes = require("./routes/userRoutes.js");
const dropboxRoutes = require("./routes/dropboxRoutes.js");
const googleRoutes = require("./routes/googleRoutes.js");

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

// Save Dropbox tokens to PostgreSQL
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

const DROPBOX_OAUTH_URL = "https://www.dropbox.com/oauth2/authorize";
const CLIENT_ID = process.env.DROPBOX_CLIENT_ID;
const CLIENT_SECRET = process.env.DROPBOX_CLIENT_SECRET;
const REDIRECT_URI = process.env.DROPBOX_REDIRECT_URI; // Update with your redirect URI

// Generate the OAuth URL
const authUrl = `${DROPBOX_OAUTH_URL}?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}&token_access_type=offline`;

app.get("/dropbox/authorize", (req, res) => {
  res.redirect(authUrl);
});

const axios = require("axios");

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

    // Save the tokens to PostgreSQL
    await saveDropboxTokens(access_token, refresh_token);

    res.redirect("http://localhost:5173/dashboard"); // Redirect to your dashboard or wherever
  } catch (error) {
    console.error("❌ Error during OAuth callback:", error.message);
    res.status(500).send("Authentication failed.");
  }
});

const dropboxV2Api = require("dropbox-v2-api"); // A popular Node.js library for interacting with Dropbox API

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

app.get("/dropbox/files", async (req, res) => {
  const storedTokens = await loadDropboxTokens();

  if (!storedTokens.length) {
    return res.status(401).send("❌ No accounts linked. Please authorize.");
  }

  const allFiles = [];

  for (const token of storedTokens) {
    const dbx = dropboxV2Api.authenticate({ token: token.access_token });

    try {
      const response = await listDropboxFiles(dbx);

      if (!response.entries) {
        console.error("❌ Unexpected response from Dropbox API:", response);
        continue;
      }

      allFiles.push(...response.entries);
    } catch (error) {
      console.error("❌ Error listing files:", error.message);
    }
  }

  res.json(allFiles);
});

app.get("/dropbox/space", async (req, res) => {
  const storedTokens = await loadDropboxTokens();

  if (!storedTokens.length) {
    return res.status(401).send("❌ No accounts linked. Please authorize.");
  }

  let totalUsed = 0;

  for (const token of storedTokens) {
    const dbx = dropboxV2Api.authenticate({
      token: token.access_token,
    });

    try {
      const response = await dbx({
        resource: "users/get_space_usage",
      });

      totalUsed += response.used; // Add used space for this account
    } catch (error) {
      console.error("❌ Error fetching space usage:", error.message);
    }
  }

  // Return the total space used (in GB)
  const totalUsedGB = (totalUsed / 1024 / 1024 / 1024).toFixed(2);
  res.json({ used: totalUsedGB });
});

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

const refreshDropboxToken = async (refresh_token) => {
  try {
    const response = await axios.post(
      "https://api.dropbox.com/oauth2/token",
      `grant_type=refresh_token&refresh_token=${refresh_token}&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error("❌ Error refreshing Dropbox token:", error.message);
    throw error;
  }
};

// **🔹 Start Server**
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
