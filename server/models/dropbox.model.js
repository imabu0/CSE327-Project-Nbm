const Bucket = require("./bucket.model.js");
const axios = require("axios");
const fs = require("fs");
const { pool } = require("../config/db.js");

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

  // Method to refresh the access token
  async refreshAccessToken(token) {
    const response = await axios.post(
      "https://api.dropbox.com/oauth2/token",
      `grant_type=refresh_token&refresh_token=${token}&client_id=${this.clientId}&client_secret=${this.clientSecret}`,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    return response.data; // Return the new access token and refresh token
  }

  async getAvailableStorage(userId) {
    const storedTokens = await this.loadTokens(userId);
    if (!storedTokens.length) return []; // Always return an array

    let availableStorage = [];

    for (const token of storedTokens) {
      try {
        const response = await axios.post(
          "https://api.dropboxapi.com/2/users/get_space_usage",
          null,
          {
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );

        const { allocation, used } = response.data;
        const available = allocation.allocated - used;

        availableStorage.push({ available, token: token.access_token });
      } catch (error) {
        if (error.response && error.response.status === 401) {
          // Token expired, try to refresh
          const newTokens = await this.refreshAccessToken(token.refresh_token);
          await this.saveTokens(newTokens.access_token, newTokens.refresh_token, null);
          // Retry the request with the new access token
          const retryResponse = await axios.post(
            "https://api.dropboxapi.com/2/users/get_space_usage",
            null,
            {
              headers: {
                Authorization: `Bearer ${newTokens.access_token}`,
                "Content-Type": "application/json",
              },
            }
          );

          const { allocation, used } = retryResponse.data;
          const available = allocation.allocated - used;

          availableStorage.push({ available, token: newTokens.access_token });
        } else {
          console.error(
            "Error fetching Dropbox storage:",
            error.response?.data || error.message
          );
        }
      }
    }

    return availableStorage; // Always return an array
  }

  async listFiles(userId) {
    const storedTokens = await this.loadTokens(userId);
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
        if (error.response && error.response.status === 401) {
          const newTokens = await this.refreshAccessToken(token.refresh_token);
          await this.saveTokens(newTokens.access_token, newTokens.refresh_token, null);
          const retryResponse = await axios.post(
            "https://api.dropboxapi.com/2/files/list_folder",
            { path: "" },
            {
              headers: {
                Authorization: `Bearer ${newTokens.access_token}`,
                "Content-Type": "application/json",
              },
            }
          );
          allFiles.push(...retryResponse.data.entries);
        } else {
          console.error("Dropbox Error:", error.message);
        }
      }
    }
    return allFiles;
  }

  async uploadFile(filePath, fileName, token) {
    try {
      if (!filePath || !fileName) {
        throw new Error("Invalid file path or name");
      }

      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const fileStream = fs.createReadStream(filePath);

      // Ensure the file stream is properly read before uploading
      fileStream.on("error", (err) => {
        console.error("File stream error:", err.message);
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

      const fileId = response.data.id; // Get the file ID from the response
      console.log(`Uploaded ${fileName} to Dropbox. File ID: ${fileId}`);
      return fileId; // Return the file ID for storage in the database
    } catch (error) {
      console.error(
        "Dropbox Upload Error:",
        error.response?.data || error.message
      );
      throw new Error("Failed to upload file to Dropbox.");
    }
  }

  async downloadFile(fileId, destinationPath, userId) {
    const storedTokens = await this.loadTokens(userId);

    if (!storedTokens.length) {
      throw new Error("No Dropbox tokens available.");
    }

    let lastError = null;

    for (const token of storedTokens) {
      try {
        console.log(`Attempting to download file with ID: ${fileId}`);
        console.log(`Using token: ${token.access_token.slice(0, 10)}...`);

        const tempLinkResponse = await axios.post(
          "https://api.dropboxapi.com/2/files/get_temporary_link",
          { path: fileId },
          {
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );

        const tempLink = tempLinkResponse.data.link;
        console.log(`Retrieved temporary download link: ${tempLink}`);

        const response = await axios.get(tempLink, { responseType: "stream" });

        const writer = fs.createWriteStream(destinationPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });

        console.log(`Downloaded file ${fileId} from Dropbox.`);
        return;
      } catch (error) {
        if (error.response && error.response.status === 401) {
          const newTokens = await this.refreshAccessToken(token.refresh_token);
          await this.saveTokens(newTokens.access_token, newTokens.refresh_token, null);
          // Retry the download with the new access token
          const tempLinkResponse = await axios.post(
            "https://api.dropboxapi.com/2/files/get_temporary_link",
            { path: fileId },
            {
              headers: {
                Authorization: `Bearer ${newTokens.access_token}`,
                "Content-Type": "application/json",
              },
            }
          );

          const tempLink = tempLinkResponse.data.link;
          const response = await axios.get(tempLink, { responseType: "stream" });

          const writer = fs.createWriteStream(destinationPath);
          response.data.pipe(writer);

          await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
          });

          console.log(`Downloaded file ${fileId} from Dropbox.`);
          return;
        }
        lastError = error;
        console.error(
          "Dropbox API Error:",
          error.response?.data || error.message
        );
        console.warn(
          `File ${fileId} not found in this Dropbox account. Trying next account...`
        );
      }
    }

    throw new Error(
      `File ${fileId} not found in any Dropbox account. Last error: ${lastError?.message}`
    );
  }

  async getFilePathFromFileId(fileId, token) {
    try {
      const response = await axios.post(
        "https://api.dropboxapi.com/2/files/get_metadata",
        {
          path: fileId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const filePath = response.data.path_display;
      console.log(`Retrieved file path for file ID ${fileId}: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error(
        "Error retrieving file metadata:",
        error.response?.data || error.message
      );
      throw new Error("Failed to retrieve file metadata.");
    }
  }

  async deleteFile(fileId, userId) {
    const storedTokens = await this.loadTokens(userId);

    if (!storedTokens.length) {
      throw new Error("No Dropbox tokens available.");
    }

    let lastError = null;

    for (const token of storedTokens) {
      try {
        console.log(`Attempting to delete file with ID: ${fileId}`);
        console.log(`Using token: ${token.access_token.slice(0, 10)}...`);

        await axios.post(
          "https://api.dropboxapi.com/2/files/delete_v2",
          { path: fileId },
          {
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );

        console.log(`Deleted file ${fileId} from Dropbox.`);
        return;
      } catch (error) {
        if (error.response && error.response.status === 401) {
          const newTokens = await this.refreshAccessToken(token.refresh_token);
          await this.saveTokens(newTokens.access_token, newTokens.refresh_token, null);
          // Retry the delete with the new access token
          await axios.post(
            "https://api.dropboxapi.com/2/files/delete_v2",
            { path: fileId },
            {
              headers: {
                Authorization: `Bearer ${newTokens.access_token}`,
                "Content-Type": "application/json",
              },
            }
          );

          console.log(`Deleted file ${fileId} from Dropbox.`);
          return;
        }
        lastError = error;
        console.warn(
          `File ${fileId} not found in this Dropbox account. Trying next account...`
        );
      }
    }

    throw new Error(
      `File ${fileId} not found in any Dropbox account. Last error: ${lastError?.message}`
    );
  }

  async setUser(user_id) {
    const query = `
      UPDATE dropbox_accounts
      SET user_id = $1
      WHERE user_id IS NULL
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [user_id]);
    return rows;
  }
}

module.exports = DropboxBucket;