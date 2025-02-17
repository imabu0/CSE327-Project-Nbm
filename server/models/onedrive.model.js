const axios = require("axios"); // Import Axios for making HTTP requests
const { ConfidentialClientApplication } = require("@azure/msal-node"); // Import MSAL for OAuth2 authentication
const Bucket = require("./bucket.model.js"); // Import the base class

class OnedriveBucket extends Bucket {
  constructor(clientId, clientSecret, redirectUri) {
    super(clientId, clientSecret, redirectUri, "onedrive_accounts"); // Initialize the base class with parameters
    this.msGraphUrl = "https://graph.microsoft.com/v1.0/me/drive"; // Base URL for Microsoft Graph API
    this.pca = new ConfidentialClientApplication({
      auth: {
        clientId: this.clientId, // Client ID for OAuth
        authority:
          "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize", // OAuth authority
        clientSecret: this.clientSecret, // Client secret for OAuth
        redirectUri: this.redirectUri, // Redirect URI for OAuth
      },
    });
  }

  // 🔹 Generate Login URL for OAuth
  async getAuthUrl() {
    try {
      return await this.pca.getAuthCodeUrl({
        scopes: ["User .Read", "Files.ReadWrite"], // Scopes for accessing user data and files
        redirectUri: this.redirectUri, // Redirect URI
        prompt: "select_account", // Prompt for account selection
      });
    } catch (error) {
      console.error("❌ Error generating auth URL:", error.message);
      throw error; // Throw error if URL generation fails
    }
  }

  // 🔹 Handle Callback and Save Tokens
  async handleCallback(code) {
    try {
      const tokenResponse = await this.pca.acquireTokenByCode({
        code, // Authorization code received from OAuth
        scopes: ["User .Read", "Files.ReadWrite"], // Scopes for accessing user data and files
        redirectUri: this.redirectUri, // Redirect URI
      });

      if (!tokenResponse || !tokenResponse.accessToken) {
        throw new Error("Failed to acquire access token"); // Throw error if access token is not received
      }

      const { accessToken, refreshToken, expiresOn } = tokenResponse; // Destructure tokens from response

      // Store tokens in DB (or session)
      await this.saveTokens(accessToken, refreshToken, expiresOn); // Save tokens for future use

      return { accessToken, refreshToken }; // Return access and refresh tokens
    } catch (error) {
      console.error("❌ Error acquiring token:", error.message);
      throw error; // Throw error if token acquisition fails
    }
  }

  // 🔹 Refresh Access Token Using Refresh Token
  async refreshAccessToken(refreshToken) {
    try {
      const tokenResponse = await this.pca.acquireTokenByRefreshToken({
        refreshToken, // Refresh token to obtain a new access token
        scopes: ["User .Read", "Files.ReadWrite"], // Scopes for accessing user data and files
      });

      if (!tokenResponse || !tokenResponse.accessToken) {
        throw new Error("Failed to refresh access token"); // Throw error if refresh fails
      }

      const {
        accessToken,
        refreshToken: newRefreshToken,
        expiresOn,
      } = tokenResponse; // Destructure tokens from response

      // ✅ Save new tokens to the database
      await this.saveTokens(accessToken, newRefreshToken, expiresOn); // Save new tokens

      return { accessToken, refreshToken: newRefreshToken }; // Return new tokens
    } catch (error) {
      console.error("❌ Token Refresh Error:", error.message);
      throw error; // Throw error if refresh fails
    }
  }

  // 🔹 List Files from OneDrive
  async listFiles(accessToken) {
    try {
      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/me/drive/root/children`, // Endpoint to list files from the root of the OneDrive
        {
          headers: {
            Authorization: `Bearer ${accessToken}`, // Set Authorization header with access token
          },
        }
      );

      return response.data.value; // Return files from response
    } catch (error) {
      console.error("❌ OneDrive Error:", error.message);
      throw error; // Throw error if API call fails
    }
  }

  // 🔹 Upload File to OneDrive
  async uploadFile(accessToken, fileBuffer, fileName, mimeType) {
    try {
      await axios.put(
        `${this.msGraphUrl}/me/drive/root:/${fileName}:/content`, // Endpoint to upload file
        fileBuffer, // The file buffer to upload
        {
          headers: {
            Authorization: `Bearer ${accessToken}`, // Set Authorization header with access token
            "Content-Type": mimeType, // Set the content type of the file
          },
        }
      );
      return "✅ File uploaded to OneDrive"; // Return success message
    } catch (error) {
      console.error("❌ Upload Error:", error.response?.data || error.message); // Log error message
      throw error; // Throw error if upload fails
    }
  }

  // 🔹 Download File from OneDrive
  async downloadFile(accessToken, fileId) {
    try {
      const response = await axios.get(
        `${this.msGraphUrl}/me/drive/items/${fileId}/content`, // Endpoint to download file by ID
        {
          headers: { Authorization: `Bearer ${accessToken}` }, // Set Authorization header with access token
          responseType: "stream", // Set response type to stream for file download
        }
      );
      return response.data; // Return the file data
    } catch (error) {
      console.error(
        "❌ Download Error:",
        error.response?.data || error.message
      ); // Log error message
      throw error; // Throw error if download fails
    }
  }

  // 🔹 Delete File from OneDrive
  async deleteFile(accessToken, fileId) {
    try {
      await axios.delete(`${this.msGraphUrl}/me/drive/items/${fileId}`, {
        // Endpoint to delete file by ID
        headers: { Authorization: `Bearer ${accessToken}` }, // Set Authorization header with access token
      });
      return `✅ File ${fileId} deleted successfully`; // Return success message
    } catch (error) {
      console.error("❌ Delete Error:", error.response?.data || error.message); // Log error message
      throw error; // Throw error if delete fails
    }
  }
}

module.exports = OnedriveBucket; // Export the OnedriveBucket class for use in other modules
