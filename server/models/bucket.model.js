const { pool } = require("../config/db.js"); // PostgreSQL connection

// 🔹 Base Class: Bucket (Common Methods)
class Bucket {
  constructor(clientId, clientSecret, redirectUri, tableName) {
    this.clientId = clientId; // OAuth Client ID
    this.clientSecret = clientSecret; // OAuth Client Secret
    this.redirectUri = redirectUri; // OAuth Redirect URI
    this.tableName = tableName; // PostgreSQL table name for storing tokens
  }

  // Save tokens to PostgreSQL
  async saveTokens(accessToken, refreshToken, expiryDate, userId) {
    try {
      await pool.query(
        `INSERT INTO ${this.tableName} (access_token, refresh_token, expiry_date, user_id) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (refresh_token) 
         DO UPDATE SET access_token = EXCLUDED.access_token, expiry_date = EXCLUDED.expiry_date`,
        [accessToken, refreshToken, expiryDate, userId]
      );
      console.log(`Tokens saved to ${this.tableName}`);
    } catch (error) {
      console.error(`Error saving tokens to ${this.tableName}:`, error.message);
    }
  }

  // Load tokens from PostgreSQL
  async loadTokens(userId) {
    try {
      const res = await pool.query(
        `SELECT * FROM ${this.tableName} WHERE user_id = $1`,
        [userId]
      );
      return res.rows;
    } catch (error) {
      console.error(
        `Error loading tokens from ${this.tableName}:`,
        error.message
      );
      return [];
    }
  }

  async countBuckets(userId) {
    try {
      const result = await pool.query(`SELECT COUNT(*) FROM ${this.tableName} WHERE user_id = $1`, [userId]);
      return result.rows[0].count;
    } catch (error) {
      console.error("Error counting users in google_accounts:", error.message);
      throw error; // Re-throw the error to be handled by the route
    }
  }

  // Abstract method to refresh token
  refreshAccessToken(token) {
    throw new Error("refreshAccessToken() must be implemented in a subclass");
  }

  // Abstract method to get the available storage
  getAvailableStorage() {
    throw new Error("getAvailableStorage() must be implemented in a subclass");
  }

  // Abstract method to fetch files from the cloud storage
  listFiles() {
    throw new Error("listFiles() must be implemented in a subclass");
  }

  // Abstract method to upload a file to the cloud storage
  uploadFile(file) {
    throw new Error("uploadFile() must be implemented in a subclass");
  }

  // Abstract method to download a file from the cloud storage
  downloadFile(fileId) {
    throw new Error("downloadFile() must be implemented in a subclass");
  }

  // Abstract method to delete a file from the cloud storage
  deleteFile(fileId) {
    throw new Error("deleteFile() must be implemented in a subclass");
  }

  setUser(user_id) {
    throw new Error("setUser() must be implemented in a subclass");
  }
}

module.exports = Bucket;
