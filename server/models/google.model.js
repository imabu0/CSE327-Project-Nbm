const Bucket = require("./bucket.model.js");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

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

  async getAvailableStorage() {
    const storedTokens = await this.loadTokens();
    let storageInfo = [];

    for (const token of storedTokens) {
      try {
        this.oauth2Client.setCredentials({
          access_token: token.access_token,
          refresh_token: token.refresh_token,
          expiry_date: token.expiry_date,
        });

        const drive = google.drive({ version: "v3", auth: this.oauth2Client });
        const response = await drive.about.get({
          fields: "storageQuota",
        });

        const used = parseInt(response.data.storageQuota.usage);
        const allocated = parseInt(response.data.storageQuota.limit);
        const available = allocated - used;

        storageInfo.push({ token, available });
      } catch (error) {
        console.error("❌ Error fetching Google Drive storage:", error.message);
      }
    }

    return storageInfo.sort((a, b) => b.available - a.available); // Sort by available space
  }

  async uploadFile(filePath, fileName, mimeType = "application/octet-stream") {
    try {
      if (!filePath || !fileName) {
        throw new Error("❌ Invalid file path or name");
      }

      if (!fs.existsSync(filePath)) {
        throw new Error(`❌ File not found: ${filePath}`);
      }

      const storedTokens = await this.loadTokens(); // ✅ Load all available tokens
      if (!storedTokens.length) {
        throw new Error("⚠️ No Google accounts available.");
      }

      let lastError = null; // Store last error for debugging

      for (const token of storedTokens) {
        try {
          console.log(
            `🔄 Trying Google Drive account with token: ${token.access_token.slice(
              0,
              10
            )}...`
          );

          // ✅ Ensure correct credentials are used
          this.oauth2Client.setCredentials({
            access_token: token.access_token,
            refresh_token: token.refresh_token,
            expiry_date: token.expiry_date,
          });

          const drive = google.drive({
            version: "v3",
            auth: this.oauth2Client,
          });

          // ✅ Check available storage for debugging
          const storage = await drive.about.get({ fields: "storageQuota" });
          console.log(
            `📦 Available Storage: ${
              storage.data.storageQuota.limit - storage.data.storageQuota.usage
            } bytes`
          );

          const fileStream = fs.createReadStream(filePath);

          // ✅ Upload file
          const response = await drive.files.create({
            requestBody: {
              name: fileName,
              parents: ["root"],
            },
            media: {
              mimeType:
                typeof mimeType === "string"
                  ? mimeType
                  : "application/octet-stream",
              body: fileStream,
            },
          });

          console.log(
            `✅ Uploaded ${fileName} to Google Drive using token ${token.access_token.slice(
              0,
              10
            )}.`
          );
          return response.data.id; // ✅ Return file ID after successful upload
        } catch (error) {
          const errorMessage = error.response?.data?.message || error.message;
          lastError = errorMessage; // Store last error for debugging

          if (
            error.response?.status === 403 &&
            errorMessage.includes("quota has been exceeded")
          ) {
            console.warn(
              `⚠️ Storage quota exceeded for token: ${token.access_token.slice(
                0,
                10
              )}. Trying next account...`
            );
            continue; // ✅ Continue to the next account instead of throwing error
          } else {
            console.error(
              "❌ Google Drive Upload Error:",
              error.response?.data || error.message
            );
          }
        }
      }

      // If all accounts failed, throw last captured error
      throw new Error(lastError || "❌ All Google Drive accounts failed.");
    } catch (error) {
      console.error(error.message);
      throw error;
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
