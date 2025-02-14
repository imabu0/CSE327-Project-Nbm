const { google } = require("googleapis");
const fs = require("fs");
const stream = require("stream");
const { pool } = require("../config/db.js"); // Import database connection from the db.js file
require("dotenv").config();

// **🔹 Load credentials.json**

const SCOPES = ["https://www.googleapis.com/auth/drive"];
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
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

// Function to get available storage for a given account
async function getAvailableStorage(auth) {
  const drive = google.drive({ version: "v3", auth });
  try {
    const response = await drive.about.get({
      fields: "storageQuota",
    });
    const { storageQuota } = response.data;
    return parseInt(storageQuota.limit) - parseInt(storageQuota.usage); // Available storage
  } catch (err) {
    console.error("Failed to get available storage:", err.message);
    throw new Error("Failed to get available storage.");
  }
}

/**
 * Uploads a file to Google Drive
 * @param {Object} auth - OAuth2 client
 * @param {Object} file - Uploaded file object
 * @param {string} parentFolderId - Folder ID where the file should be uploaded
 * @returns {Promise<string>} - Uploaded file ID
 */
async function uploadFile(auth, file, parentFolderId) {
  const drive = google.drive({ version: "v3", auth });

  const fileMetadata = {
    name: file.originalname,
    parents: parentFolderId !== "root" ? [parentFolderId] : [],
  };

  const media = {
    mimeType: file.mimetype,
    body: fs.createReadStream(file.path),
  };

  // Track upload progress
  const progressStream = new stream.PassThrough();
  let uploadedBytes = 0;
  progressStream.on("data", (chunk) => {
    uploadedBytes += chunk.length;
    const percentCompleted = Math.round((uploadedBytes * 100) / file.size);
    console.log(`Upload Progress: ${percentCompleted}%`);
  });

  const response = await drive.files.create({
    resource: fileMetadata,
    media: { mimeType: file.mimetype, body: media.body.pipe(progressStream) },
    fields: "id",
  });

  fs.unlinkSync(file.path); // Remove local file after upload
  return response.data.id;
}

/**
 * Lists files from a specified Google Drive folder.
 * Iterates through all linked accounts and fetches files from each.
 *
 * @param {Array} tokens - Array of OAuth2 tokens for linked accounts
 * @param {Object} oauth2Client - Google OAuth2 client
 * @param {Function} refreshTokenIfNeeded - Function to refresh tokens if expired
 * @param {string} folderId - ID of the folder to list files from (default: root)
 * @returns {Promise<Array>} - Returns a list of files from all linked accounts
 */
const listFiles = async (
  tokens,
  oauth2Client,
  refreshTokenIfNeeded,
  folderId = "root"
) => {
  const files = [];

  for (const token of tokens) {
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

  return files;
};

/**
 * Downloads a file from Google Drive
 * @param {Object} auth - OAuth2 client
 * @param {string} fileId - ID of the file to download
 * @returns {Promise<Object>} - File metadata and stream
 */
async function downloadFile(auth, fileId) {
  const drive = google.drive({ version: "v3", auth });

  // Get file name
  const fileMetadata = await drive.files.get({ fileId, fields: "name" });

  // Get file stream
  const response = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" }
  );

  return { fileName: fileMetadata.data.name, stream: response.data };
}

/**
 * Deletes a file from Google Drive
 * @param {Object} auth - OAuth2 client
 * @param {string} fileId - ID of the file to delete
 * @returns {Promise<void>}
 */
async function deleteFile(auth, fileId) {
  const drive = google.drive({ version: "v3", auth });
  await drive.files.delete({ fileId });
}

module.exports = {
  SCOPES,
  oauth2Client,
  refreshTokenIfNeeded,
  getAvailableStorage,
  saveTokens,
  loadTokens,
  uploadFile,
  listFiles,
  downloadFile,
  deleteFile,
};
