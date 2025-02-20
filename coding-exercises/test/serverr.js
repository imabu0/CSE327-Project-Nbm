require("dotenv").config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");

const app = express();
const upload = multer({ dest: "uploads/" });

const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN;

const uploadToDropbox = async (filePath, fileName) => {
    const fileStream = fs.createReadStream(filePath);
    
    const dropboxUploadUrl = "https://content.dropboxapi.com/2/files/upload";
    
    try {
        const response = await axios.post(dropboxUploadUrl, fileStream, {
            headers: {
                "Authorization": `Bearer ${DROPBOX_ACCESS_TOKEN}`,
                "Dropbox-API-Arg": JSON.stringify({
                    path: `/${fileName}`,
                    mode: "add",
                    autorename: true,
                    mute: false
                }),
                "Content-Type": "application/octet-stream"
            }
        });
        
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.error_summary || error.message);
    }
};

app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        const file = req.file;
        const dropboxResponse = await uploadToDropbox(file.path, file.originalname);
        
        fs.unlinkSync(file.path); // Delete temporary file after upload
        
        res.json({ message: "File uploaded successfully", dropboxResponse });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(5000, () => console.log("Server running on port 5000"));
