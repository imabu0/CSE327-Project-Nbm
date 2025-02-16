const Bucket = require("./bucket.model.js");
const { google } = require("googleapis");
const fs = require("fs");

class GoogleBucket extends Bucket {
  constructor() {
    // ✅ Read credentials before calling super()
    const credentials = JSON.parse(fs.readFileSync("credentials.json")).web;
    super(
      credentials.client_id,
      credentials.client_secret,
      credentials.redirect_uris[0],
      "google_accounts"
    );

    // ✅ Correct OAuth client initialization
    this.oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );
  }

  getAuthUrl() {
    return this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/drive"],
      prompt: "consent",
    });
  }

  async handleCallback(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      if (!tokens.refresh_token) {
        throw new Error(
          "❌ No refresh token received, ensure offline access is requested."
        );
      }

      // ✅ Save tokens correctly
      await this.saveTokens(
        tokens.access_token,
        tokens.refresh_token,
        tokens.expiry_date
      );

      console.log("✅ Google OAuth Tokens Saved Successfully");
    } catch (error) {
      console.error("❌ Google OAuth Callback Error:", error.message);
    }
  }

  async listFiles(folderId = "root") {
    try {
      const storedTokens = await this.loadTokens();
      if (!storedTokens.length) {
        console.warn("⚠️ No stored Google tokens found.");
        return [];
      }

      let files = [];
      for (const token of storedTokens) {
        // ✅ Properly set OAuth credentials
        this.oauth2Client.setCredentials({
          access_token: token.access_token,
          refresh_token: token.refresh_token,
          expiry_date: token.expiry_date,
        });

        const drive = google.drive({ version: "v3", auth: this.oauth2Client });

        try {
          const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: "files(id, name, mimeType)",
          });
          files.push(...response.data.files);
        } catch (error) {
          console.error("❌ Google Drive API Error:", error.message);
        }
      }
      return files;
    } catch (error) {
      console.error("❌ List Files Error:", error.message);
      return [];
    }
  }
}

module.exports = GoogleBucket;
