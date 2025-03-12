const Bucket = require("./bucket.model.js");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

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
    if (!storedTokens.length) return []; // ✅ Always return an array

    let availableStorage = [];

    for (const token of storedTokens) {
      try {
        const response = await axios.post(
          "https://api.dropboxapi.com/2/users/get_space_usage",
          null, // ✅ Send null (not {})
          {
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              "Content-Type": "application/json", // ✅ Correct Content-Type
            },
          }
        );

        const { allocation, used } = response.data;
        const available = 2000000000;

        availableStorage.push({ available, token: token.access_token });
      } catch (error) {
        console.error(
          "❌ Error fetching Dropbox storage:",
          error.response?.data || error.message
        );
      }
    }

    return availableStorage; // ✅ Always return an array
  }

  async uploadFile(filePath, fileName, token) {
    try {
      if (!filePath || !fileName) {
        throw new Error("❌ Invalid file path or name");
      }

      if (!fs.existsSync(filePath)) {
        throw new Error(`❌ File not found: ${filePath}`);
      }

      const fileStream = fs.createReadStream(filePath);

      // Ensure the file stream is properly read before uploading
      fileStream.on("error", (err) => {
        console.error("❌ File stream error:", err.message);
      });

      const response = await axios.post(
        "https://content.dropboxapi.com/2/files/upload",
        fileStream,
        {
          headers: {
            Authorization: `Bearer ${token}`,
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
      return response.data.id;
    } catch (error) {
      console.error(
        "❌ Dropbox Upload Error:",
        error.response?.data || error.message
      );
      throw new Error("❌ Failed to upload file to Dropbox.");
    }
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

  async downloadFile(fileId, destination) {
    const response = await this.dbx.filesDownload({ path: fileId });
    const fileStream = fs.createWriteStream(destination);

    return new Promise((resolve, reject) => {
      fileStream.write(response.fileBinary, "binary", (err) => {
        if (err) {
          console.error("❌ Error writing file:", err);
          reject(err);
        } else {
          console.log("✅ Download complete.");
          resolve();
        }
      });
    });
  }
}

module.exports = DropboxBucket;
