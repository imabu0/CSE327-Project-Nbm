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

  // Method to get available storage for each connected Dropbox account
  async getAvailableStorage() {
    const storedTokens = await this.loadTokens();
    if (!storedTokens.length) return []; // Always return an array

    let availableStorage = [];

    for (const token of storedTokens) {
      try {
        const response = await axios.post(
          "https://api.dropboxapi.com/2/users/get_space_usage",
          null, // Send null (not {})
          {
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              "Content-Type": "application/json", // Correct Content-Type
            },
          }
        );

        const { allocation, used } = response.data;
        const available = allocation.allocated - used;

        availableStorage.push({ available, token: token.access_token });
      } catch (error) {
        console.error(
          "Error fetching Dropbox storage:",
          error.response?.data || error.message
        );
      }
    }

    return availableStorage; // Always return an array
  }

  // Method to download a file from Dropbox
  async listFiles() {
    const storedTokens = await this.loadTokens();
    if (!storedTokens.length) return [];

    // Array to store all files from all Dropbox accounts
    let allFiles = [];
    for (const token of storedTokens) {
      try {
        const response = await axios.post(
          "https://api.dropboxapi.com/2/files/list_folder",
          { path: "" }, // List files in the root directory
          {
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );
        allFiles.push(...response.data.entries); // Add files to the array
      } catch (error) {
        console.error("Dropbox Error:", error.message);
      }
    }
    return allFiles;
  }

  // Method to upload a file to Dropbox
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
              path: `/${fileName}`, // Use a temporary path for upload
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

  // Method to download a file from Dropbox
  async downloadFile(fileId, destinationPath) {
    const storedTokens = await this.loadTokens();

    if (!storedTokens.length) {
      throw new Error("No Dropbox tokens available.");
    }

    let lastError = null;

    // Try each token until the file is found
    for (const token of storedTokens) {
      try {
        console.log(`Attempting to download file with ID: ${fileId}`);
        console.log(`Using token: ${token.access_token.slice(0, 10)}...`);

        // Step 1: Get a temporary download link
        const tempLinkResponse = await axios.post(
          "https://api.dropboxapi.com/2/files/get_temporary_link",
          { path: fileId }, // Use the file ID as the path
          {
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );
        
        const tempLink = tempLinkResponse.data.link; // Generate a temporary download link
        console.log(`Retrieved temporary download link: ${tempLink}`);

        // Step 2: Download the file using the temporary link
        const response = await axios.get(tempLink, { responseType: "stream" });

        const writer = fs.createWriteStream(destinationPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });

        console.log(`Downloaded file ${fileId} from Dropbox.`);
        return; // Exit the loop if the file is successfully downloaded
      } catch (error) {
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

    // If no account has the file, throw the last error
    throw new Error(
      `File ${fileId} not found in any Dropbox account. Last error: ${lastError?.message}`
    );
  }

  // Method to get the file path from a file ID
  async getFilePathFromFileId(fileId, token) {
    try {
      const response = await axios.post(
        "https://api.dropboxapi.com/2/files/get_metadata",
        {
          path: fileId, // Use the file ID as the path
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const filePath = response.data.path_display; // Get the file path
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

  // Method to delete a file from Dropbox
  async deleteFile(fileId) {
    const storedTokens = await this.loadTokens();

    if (!storedTokens.length) {
      throw new Error("No Dropbox tokens available.");
    }

    let lastError = null;

    // Try each token until the file is found and deleted
    for (const token of storedTokens) {
      try {
        console.log(`Attempting to delete file with ID: ${fileId}`);
        console.log(`Using token: ${token.access_token.slice(0, 10)}...`);

        await axios.post(
          "https://api.dropboxapi.com/2/files/delete_v2",
          { path: fileId }, // Use the file ID as the path
          {
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );

        console.log(`Deleted file ${fileId} from Dropbox.`);
        return; // Exit the loop if the file is successfully deleted
      } catch (error) {
        lastError = error;
        console.warn(
          `File ${fileId} not found in this Dropbox account. Trying next account...`
        );
      }
    }

    // If no account has the file, throw the last error
    throw new Error(
      `File ${fileId} not found in any Dropbox account. Last error: ${lastError?.message}`
    );
  }
}

module.exports = DropboxBucket;
