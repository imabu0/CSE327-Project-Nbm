require("dotenv").config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");

const app = express();
const upload = multer({ dest: "uploads/" });

// OneDrive API Credentials
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
const TENANT_ID = process.env.TENANT_ID;

// Dropbox API Credentials
const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN;

/**
 * Get Microsoft OneDrive Access Token using refresh token
 */
const getOneDriveAccessToken = async () => {
    const response = await axios.post(
        `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
        new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token: REFRESH_TOKEN,
            grant_type: "refresh_token",
            scope: "Files.ReadWrite User.Read",
        })
    );
    return response.data.access_token;
};

/**
 * Upload File to Microsoft OneDrive
 */
const uploadToOneDrive = async (filePath, fileName) => {
    try {
        const accessToken = await getOneDriveAccessToken();
        const fileStream = fs.createReadStream(filePath);
        const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${fileName}:/content`;

        const response = await axios.put(uploadUrl, fileStream, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/octet-stream",
            },
        });

        return { success: true, link: response.data.webUrl };
    } catch (error) {
        return { success: false, error: error.response?.data || error.message };
    }
};

/**
 * Upload File to Dropbox
 */
const uploadToDropbox = async (filePath, fileName) => {
    try {
        const fileContent = fs.readFileSync(filePath);
        const uploadUrl = "https://content.dropboxapi.com/2/files/upload";

        const response = await axios.post(uploadUrl, fileContent, {
            headers: {
                Authorization: `Bearer ${DROPBOX_ACCESS_TOKEN}`,
                "Content-Type": "application/octet-stream",
                "Dropbox-API-Arg": JSON.stringify({
                    path: `/${fileName}`,
                    mode: "add",
                    autorename: true,
                    mute: false,
                }),
            },
        });

        return { success: true, link: `https://www.dropbox.com/home${response.data.path_display}` };
    } catch (error) {
        return { success: false, error: error.response?.data || error.message };
    }
};

/**
 * File Upload API (User Chooses OneDrive or Dropbox)
 */
app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        const file = req.file;
        const { storage } = req.body; // User should send 'storage=onedrive' or 'storage=dropbox'

        let result;
        if (storage === "onedrive") {
            result = await uploadToOneDrive(file.path, file.originalname);
        } else if (storage === "dropbox") {
            result = await uploadToDropbox(file.path, file.originalname);
        } else {
            return res.status(400).json({ error: "Invalid storage option. Use 'onedrive' or 'dropbox'." });
        }

        fs.unlinkSync(file.path); // Delete file after upload
        if (result.success) {
            res.json({ message: "File uploaded successfully", link: result.link });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Start the Server
 */
app.listen(5000, () => console.log("🚀 Server running on port 5000"));
