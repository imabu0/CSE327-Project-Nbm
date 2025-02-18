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

  async getAvailableStorage() {
    const storedTokens = await this.loadTokens();
    if (!storedTokens.length) return 0;

    for (const token of storedTokens) {
      try {
        const response = await axios.post(
          "https://api.dropboxapi.com/2/users/get_space_usage",
          {},
          { headers: { Authorization: `Bearer ${token.access_token}` } }
        );

        const { allocation, used } = response.data;
        const available = allocation.allocated - used;
        return available;
      } catch (error) {
        console.error("❌ Error fetching Dropbox storage:", error.message);
        return 0;
      }
    }
  }

  async uploadFile(file) {
    const storedTokens = await this.loadTokens();
    if (!storedTokens.length) {
      throw new Error("❌ No Dropbox accounts linked.");
    }

    for (const token of storedTokens) {
      try {
        // Read file from temp storage
        const filePath = file.path;
        const fileStream = fs.createReadStream(filePath);
        const fileName = path.basename(filePath);

        // 📢 Upload to Dropbox using "content-upload" API
        const response = await axios.post(
          "https://content.dropboxapi.com/2/files/upload",
          fileStream,
          {
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              "Dropbox-API-Arg": JSON.stringify({
                path: `/${fileName}`,
                mode: "add",
                autorename: true,
                mute: false,
              }),
              "Content-Type": "application/octet-stream",
            },
          }
        );

        console.log(`✅ Uploaded ${fileName} to Dropbox`);
        return response.data.id; // Return file ID
      } catch (error) {
        console.error("❌ Dropbox Upload Error:", error.message);
      }
    }

    throw new Error("❌ Failed to upload file to Dropbox.");
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
