const axios = require("axios");
const { ConfidentialClientApplication } = require("@azure/msal-node");
const Bucket = require("./bucket.model.js"); // Import the base class

class OnedriveBucket extends Bucket {
  constructor(clientId, clientSecret, redirectUri) {
    // Fix: Destructure and pass values from constructor
    super(clientId, clientSecret, redirectUri, "onedrive_accounts"); // Table name for OneDrive
    this.msGraphUrl = "https://graph.microsoft.com/v1.0";
    this.pca = new ConfidentialClientApplication({
      auth: {
        clientId: this.clientId,
        authority: "https://login.microsoftonline.com/consumers",
        clientSecret: this.clientSecret,
        redirectUri: this.redirectUri,
      },
    });
  }

  // 🔹 Generate Login URL for OAuth
  async getAuthUrl() {
    try {
      return await this.pca.getAuthCodeUrl({
        scopes: ["User.Read", "Files.ReadWrite"],
        redirectUri: this.redirectUri,
        prompt: "select_account",
      });
    } catch (error) {
      console.error("❌ Error generating auth URL:", error.message);
      throw error;
    }
  }

  // 🔹 Handle Callback and Save Tokens
  async handleCallback(code) {
    try {
      const tokenResponse = await this.pca.acquireTokenByCode({
        code,
        scopes: ["User.Read", "Files.ReadWrite"],
        redirectUri: this.redirectUri,
      });

      if (!tokenResponse || !tokenResponse.accessToken) {
        throw new Error("Failed to acquire access token");
      }

      const { accessToken, refreshToken, expiresOn } = tokenResponse;

      // Store tokens in DB
      await this.saveTokens(accessToken, refreshToken, expiresOn);

      return { accessToken, refreshToken }; // Ensure accessToken is returned
    } catch (error) {
      console.error("❌ Error acquiring token:", error.message);
      throw error;
    }
  }

  // 🔹 List Files from OneDrive
  async listFiles(accessToken) {
    try {
      const response = await axios.get(
        `${this.msGraphUrl}/me/drive/root/children`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      return response.data.value;
    } catch (error) {
      console.error(
        "❌ Error fetching files:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  // 🔹 Upload File to OneDrive
  async uploadFile(accessToken, fileBuffer, fileName, mimeType) {
    try {
      await axios.put(
        `${this.msGraphUrl}/me/drive/root:/${fileName}:/content`,
        fileBuffer,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": mimeType,
          },
        }
      );
      return "✅ File uploaded to OneDrive";
    } catch (error) {
      console.error("❌ Upload Error:", error.response?.data || error.message);
      throw error;
    }
  }

  // 🔹 Download File from OneDrive
  async downloadFile(accessToken, fileId) {
    try {
      const response = await axios.get(
        `${this.msGraphUrl}/me/drive/items/${fileId}/content`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          responseType: "stream",
        }
      );
      return response.data;
    } catch (error) {
      console.error(
        "❌ Download Error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  // 🔹 Delete File from OneDrive
  async deleteFile(accessToken, fileId) {
    try {
      await axios.delete(`${this.msGraphUrl}/me/drive/items/${fileId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return `✅ File ${fileId} deleted successfully`;
    } catch (error) {
      console.error("❌ Delete Error:", error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = OnedriveBucket;
