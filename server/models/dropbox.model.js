const Bucket = require("./bucket.model.js");
const axios = require("axios");

class DropboxBucket extends Bucket {
  constructor() {
    super(
      process.env.DROPBOX_CLIENT_ID,
      process.env.DROPBOX_CLIENT_SECRET,
      process.env.DROPBOX_REDIRECT_URI,
      "dropbox_accounts"
    );
  }

  getAuthUrl() {
    return `https://www.dropbox.com/oauth2/authorize?client_id=${this.clientId}&response_type=code&redirect_uri=${this.redirectUri}&token_access_type=offline`;
  }

  async handleCallback(code) {
    const response = await axios.post(
      "https://api.dropbox.com/oauth2/token",
      `code=${code}&grant_type=authorization_code&client_id=${this.clientId}&client_secret=${this.clientSecret}&redirect_uri=${this.redirectUri}`,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    await this.saveTokens(
      response.data.access_token,
      response.data.refresh_token,
      null
    );
  }

  async listFiles() {
    const storedTokens = await this.loadTokens();
    if (!storedTokens.length) return [];

    let allFiles = [];
    for (const token of storedTokens) {
      try {
        const response = await axios.post(
          "https://api.dropboxapi.com/2/files/list_folder",
          { path: "" },
          {
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );
        allFiles.push(...response.data.entries);
      } catch (error) {
        console.error("❌ Dropbox Error:", error.message);
      }
    }
    return allFiles;
  }
}

module.exports = DropboxBucket;
