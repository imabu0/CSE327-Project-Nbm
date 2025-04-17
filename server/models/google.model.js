const Bucket = require("./bucket.model.js");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const { pool } = require("../config/db.js");

class GoogleBucket extends Bucket {
  constructor() {
    // Read credentials before calling super()
    const credentials = JSON.parse(fs.readFileSync("credentials.json")).web;
    super(
      credentials.client_id,
      credentials.client_secret,
      credentials.redirect_uris[0],
      "google_accounts"
    );

    // Correct OAuth client initialization
    this.oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );

    // Initialize drive here
    this.drive = google.drive({ version: "v3", auth: this.oauth2Client });
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
          "No refresh token received, ensure offline access is requested."
        );
      }

      // Save tokens correctly
      await this.saveTokens(
        tokens.access_token,
        tokens.refresh_token,
        tokens.expiry_date
      );

      console.log("Google OAuth Tokens Saved Successfully");
      return tokens.refresh_token; // Return the access token
    } catch (error) {
      console.error("Google OAuth Callback Error:", error.message);
      throw error; // Re-throw the error to be caught by the router
    }
  }

  // NEW: Method to refresh the access token
  async refreshAccessToken(token) {
    try {
      this.oauth2Client.setCredentials({
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expiry_date: token.expiry_date,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      const newAccessToken = credentials.access_token;
      const newExpiryDate = credentials.expiry_date;

      // Update the token with the new access token and expiry date
      token.access_token = newAccessToken;
      token.expiry_date = newExpiryDate;

      // Save the updated token
      await this.saveTokens(newAccessToken, token.refresh_token, newExpiryDate);

      console.log("Refreshed access token.");
      return token;
    } catch (error) {
      console.error("Error refreshing access token:", error.message);
      throw new Error("Failed to refresh access token.");
    }
  }

  // NEW: Method to ensure the token is valid
  async ensureValidToken(token) {
    if (token.expiry_date && token.expiry_date < Date.now() + 60000) {
      // Refresh if the token expires in less than 1 minute
      console.log("Access token is about to expire. Refreshing...");
      return await this.refreshAccessToken(token);
    }
    return token;
  }

  // Method to get available storage for each connected Google Drive account
  async getAvailableStorage(userId) {
    const storedTokens = await this.loadTokens(userId);
    let storageInfo = [];

    // Use for-of loop to get available storage for each token
    for (const token of storedTokens) {
      try {
        const validToken = await this.ensureValidToken(token); // Ensure token is valid

        this.oauth2Client.setCredentials({
          access_token: validToken.access_token,
          refresh_token: validToken.refresh_token,
          expiry_date: validToken.expiry_date,
        });

        const drive = google.drive({ version: "v3", auth: this.oauth2Client }); // Correctly initialize drive
        const response = await drive.about.get({
          fields: "storageQuota",
        });

        const used = parseInt(response.data.storageQuota.usage); // Convert to number
        const allocated = parseInt(response.data.storageQuota.limit);
        const available = allocated - used; // Calculate available space

        storageInfo.push({ token, available }); // Store token and available space
      } catch (error) {
        console.error("Error fetching Google Drive storage:", error.message);
      }
    }

    return storageInfo.sort((a, b) => b.available - a.available); // Sort by available space
  }

  // Method to upload a file to Google Drive
  async uploadFile(
    filePath,
    fileName,
    mimeType = "application/octet-stream",
    userId
  ) {
    try {
      if (!filePath || !fileName) {
        throw new Error("Invalid file path or name");
      }

      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const storedTokens = await this.loadTokens(userId); // Load all available tokens
      if (!storedTokens.length) {
        throw new Error("No Google accounts available.");
      }

      let lastError = null; // Store last error for debugging

      for (const token of storedTokens) {
        try {
          const validToken = await this.ensureValidToken(token); // Ensure token is valid

          // Log the token partially for debugging
          console.log(
            `Trying Google Drive account with token: ${validToken.access_token.slice(
              0,
              10
            )}...`
          );

          // Ensure correct credentials are used
          this.oauth2Client.setCredentials({
            access_token: validToken.access_token,
            refresh_token: validToken.refresh_token,
            expiry_date: validToken.expiry_date,
          });

          const drive = google.drive({
            version: "v3",
            auth: this.oauth2Client,
          });

          // Check available storage for debugging
          const storage = await drive.about.get({ fields: "storageQuota" });
          console.log(
            `Available Storage: ${
              storage.data.storageQuota.limit - storage.data.storageQuota.usage // Calculate available storage
            } bytes`
          );

          const fileStream = fs.createReadStream(filePath);

          // Upload file
          const response = await drive.files.create({
            requestBody: {
              name: fileName,
              parents: ["root"], // Upload to the root folder
            },
            media: {
              mimeType:
                typeof mimeType === "string"
                  ? mimeType
                  : "application/octet-stream",
              body: fileStream,
            },
          });

          // Log the token partially for debugging
          console.log(
            ` - Uploaded ${fileName} to Google Drive using token ${validToken.access_token.slice(
              0,
              10
            )}.`
          );
          return response.data.id; // Return file ID after successful upload
        } catch (error) {
          const errorMessage = error.response?.data?.message || error.message;
          lastError = errorMessage; // Store last error for debugging

          if (
            error.response?.status === 403 &&
            errorMessage.includes("quota has been exceeded")
          ) {
            console.warn(
              `Storage quota exceeded for token: ${token.access_token.slice(
                0,
                10
              )}. Trying next account...`
            );
            continue; // Continue to the next account instead of throwing error
          } else {
            console.error(
              "Google Drive Upload Error:",
              error.response?.data || error.message
            );
          }
        }
      }

      // If all accounts failed, throw last captured error
      throw new Error(lastError || "All Google Drive accounts failed.");
    } catch (error) {
      console.error(error.message);
      throw error;
    }
  }

  // Method to list files in a Google Drive
  async listFiles(folderId = "root") {
    try {
      const storedTokens = await this.loadTokens(); // Load all available tokens
      if (!storedTokens.length) {
        console.warn("No stored Google tokens found.");
        return [];
      }

      let files = [];
      for (const token of storedTokens) {
        try {
          const validToken = await this.ensureValidToken(token); // Ensure token is valid

          // Properly set OAuth credentials
          this.oauth2Client.setCredentials({
            access_token: validToken.access_token,
            refresh_token: validToken.refresh_token,
            expiry_date: validToken.expiry_date,
          });

          const drive = google.drive({
            version: "v3",
            auth: this.oauth2Client,
          }); // Correctly initialize drive

          const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`, // Search for files in the folder
            fields: "files(id, name, mimeType)", // Return only necessary fields
          });
          files.push(...response.data.files); // Add files to the list
        } catch (error) {
          console.error("Google Drive API Error:", error.message);
        }
      }
      return files;
    } catch (error) {
      console.error("List Files Error:", error.message);
      return [];
    }
  }

  // Method to download a file from Google Drive
  async downloadFile(fileId, destinationPath, userId) {
    const storedTokens = await this.loadTokens(userId); // Load all available tokens

    if (!storedTokens.length) {
      throw new Error("No Google tokens available.");
    }

    let lastError = null;

    // Try each token until the file is found
    for (const token of storedTokens) {
      try {
        const validToken = await this.ensureValidToken(token); // Ensure token is valid

        // Properly set OAuth credentials
        this.oauth2Client.setCredentials({
          access_token: validToken.access_token,
          refresh_token: validToken.refresh_token,
          expiry_date: validToken.expiry_date,
        });

        console.log(`Attempting to download file with ID: ${fileId}`);
        console.log(`Using token: ${validToken.access_token.slice(0, 10)}...`); // Log token partially for debugging

        const drive = google.drive({ version: "v3", auth: this.oauth2Client }); // Correctly initialize drive

        // Verify that the file exists in this account
        await drive.files.get({ fileId, fields: "id" });
        console.log(` - File ${fileId} exists in this Google Drive account.`);

        // Download the file
        const dest = fs.createWriteStream(destinationPath); // Create a write stream
        const response = await drive.files.get(
          { fileId, alt: "media" },
          { responseType: "stream" }
        );

        // Wait for the file to finish downloading
        await new Promise((resolve, reject) => {
          response.data
            .on("end", () => {
              console.log(` - Downloaded file ${fileId} from Google Drive.`);
              resolve(); // Resolve the promise if the download is successful
            })
            .on("error", (err) => {
              console.error("Google Drive download error:", err);
              reject(err); // Reject the promise if there's an error
            })
            .pipe(dest); // Pipe the response data to the destination file
        });

        return; // Exit the loop if the file is successfully downloaded
      } catch (error) {
        lastError = error;
        console.warn(
          `File ${fileId} not found in this Google Drive account. Trying next account...`
        );
      }
    }

    // If no account has the file, throw a specific error
    throw new Error("FILE_NOT_FOUND_IN_GOOGLE_DRIVE");
  }

  // Method to delete a file from Google Drive
  async deleteFile(fileId, userId) {
    const storedTokens = await this.loadTokens(userId); // Load all available tokens

    if (!storedTokens.length) {
      throw new Error("No Google tokens available.");
    }

    let lastError = null;

    // Try each token until the file is found and deleted
    for (const token of storedTokens) {
      try {
        const validToken = await this.ensureValidToken(token); // Ensure token is valid

        // Properly set OAuth credentials
        this.oauth2Client.setCredentials({
          access_token: validToken.access_token,
          refresh_token: validToken.refresh_token,
          expiry_date: validToken.expiry_date,
        });

        console.log(`Attempting to delete file with ID: ${fileId}`);
        console.log(`Using token: ${validToken.access_token.slice(0, 10)}...`);

        const drive = google.drive({ version: "v3", auth: this.oauth2Client }); // Correctly initialize drive

        // Verify that the file exists in this account
        await drive.files.get({ fileId, fields: "id" });
        console.log(`File ${fileId} exists in this Google Drive account.`);

        // Delete the file
        await drive.files.delete({ fileId });
        console.log(`Deleted file ${fileId} from Google Drive.`);
        return; // Exit the loop if the file is successfully deleted
      } catch (error) {
        lastError = error;
        console.warn(
          `File ${fileId} not found in this Google Drive account. Trying next account...`
        );
      }
    }

    // If no account has the file, throw a specific error
    throw new Error("FILE_NOT_FOUND_IN_GOOGLE_DRIVE");
  }

  async setUser(user_id, refresh_token) {
    const query = `
      UPDATE google_accounts
      SET user_id = $1
      WHERE refresh_token = $2
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [user_id, refresh_token]);
    return rows;
  }
}

module.exports = GoogleBucket;
