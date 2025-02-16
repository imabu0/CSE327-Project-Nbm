const { pool } = require("../config/db.js"); // PostgreSQL connection

// 🔹 Base Class: Bucket (Common Methods)
class Bucket {
  constructor(clientId, clientSecret, redirectUri, tableName) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.tableName = tableName;
  }

  // Save tokens to PostgreSQL
  async saveTokens(accessToken, refreshToken, expiryDate) {
    try {
      await pool.query(
        `INSERT INTO ${this.tableName} (access_token, refresh_token, expiry_date) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (refresh_token) 
         DO UPDATE SET access_token = EXCLUDED.access_token, expiry_date = EXCLUDED.expiry_date`,
        [accessToken, refreshToken, expiryDate]
      );
      console.log(`✅ Tokens saved to ${this.tableName}`);
    } catch (error) {
      console.error(
        `❌ Error saving tokens to ${this.tableName}:`,
        error.message
      );
    }
  }

  // Load tokens from PostgreSQL
  async loadTokens() {
    try {
      const res = await pool.query(`SELECT * FROM ${this.tableName}`);
      return res.rows;
    } catch (error) {
      console.error(
        `❌ Error loading tokens from ${this.tableName}:`,
        error.message
      );
      return [];
    }
  }

  listFiles() {
    throw new Error("listFiles() must be implemented in a subclass");
  }

  uploadFile(file) {
    throw new Error("uploadFile() must be implemented in a subclass");
  }

  downloadFile(fileId) {
    throw new Error("downloadFile() must be implemented in a subclass");
  }

  deleteFile(fileId) {
    throw new Error("deleteFile() must be implemented in a subclass");
  }
}

module.exports = Bucket;
