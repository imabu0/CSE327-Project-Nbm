require("dotenv").config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");

const app = express();
const upload = multer({ dest: "uploads/" });

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
const TENANT_ID = process.env.TENANT_ID;

const getAccessToken = async () => {
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

app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        const file = req.file;
        const accessToken = await getAccessToken();

        const fileStream = fs.createReadStream(file.path);
        const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${file.originalname}:/content`;

        const response = await axios.put(uploadUrl, fileStream, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/octet-stream",
            },
        });

        fs.unlinkSync(file.path);
        res.json({ message: "File uploaded successfully", link: response.data.webUrl });
    } catch (error) {
        res.status(500).json({ error: error.response?.data || error.message });
    }
});

app.listen(5000, () => console.log("Server running on port 5000"));
