require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

const app = express();
const port = 8000;

const DROPBOX_CLIENT_ID = process.env.DROPBOX_CLIENT_ID;
const DROPBOX_CLIENT_SECRET = process.env.DROPBOX_CLIENT_SECRET;
const DROPBOX_REDIRECT_URI = process.env.DROPBOX_REDIRECT_URI;
let tokens = [];

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ dest: "uploads/" });

// Get Dropbox OAuth URL
app.get("/auth/dropbox", (req, res) => {
  const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${DROPBOX_CLIENT_ID}&response_type=code&redirect_uri=${DROPBOX_REDIRECT_URI}&token_access_type=offline`;
  res.json({ url: authUrl });
});

// Handle Dropbox OAuth callback
app.get("/dropbox/oauth2callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  try {
    const response = await axios.post(
      "https://api.dropbox.com/oauth2/token",
      `code=${code}&grant_type=authorization_code&client_id=${DROPBOX_CLIENT_ID}&client_secret=${DROPBOX_CLIENT_SECRET}&redirect_uri=${DROPBOX_REDIRECT_URI}`,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    tokens.push(response.data.access_token);
    console.log("✅ Dropbox authentication successful!");

    res.redirect("/");
  } catch (error) {
    console.error(
      "❌ Authentication Error:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Authentication failed" });
  }
});

// List files from Dropbox
// List files from Dropbox, including file ID
app.get("/dropbox/files", async (req, res) => {
    try {
        if (!tokens.length) return res.json([]);

        let allFiles = [];
        for (const token of tokens) {
            try {
                const response = await axios.post(
                    "https://api.dropboxapi.com/2/files/list_folder",
                    { path: "" },
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                        },
                    }
                );
                // Extract the file id and name from the response and push it to the array
                const files = response.data.entries.map(f => ({
                    id: f.id,  // File ID for download and delete
                    name: f.name
                }));
                allFiles.push(...files);
            } catch (error) {
                console.error("❌ Dropbox Error:", error.message);
            }
        }
        res.json(allFiles);
    } catch (error) {
        console.error("❌ Fetch Files Error:", error.message);
        res.status(500).json({ error: "Failed to fetch files" });
    }
});

// Download file from Dropbox using file ID
app.get("/dropbox/download", async (req, res) => {
    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ error: "File ID is required" });
    }

    try {
        if (!tokens.length) return res.status(401).json({ error: "Unauthorized" });

        const response = await axios.post(
            "https://content.dropboxapi.com/2/files/download",
            {},
            {
                headers: {
                    Authorization: `Bearer ${tokens[0]}`,
                    "Dropbox-API-Arg": JSON.stringify({ path: `id:${id}` }),  // Use file ID here
                },
            }
        );

        res.setHeader("Content-Type", response.headers["content-type"]);
        res.setHeader("Content-Disposition", `attachment; filename=${id}`);  // Send file ID as filename
        res.send(response.data);
    } catch (error) {
        console.error("❌ Download Error:", error.message);
        res.status(500).json({ error: "Failed to download file" });
    }
});

// Delete file from Dropbox using file ID
// Delete file from Dropbox using file path
app.delete("/dropbox/delete", async (req, res) => {
    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ error: "File ID is required" });
    }

    try {
        if (!tokens.length) return res.status(401).json({ error: "Unauthorized" });

        console.log(`Deleting file with ID: ${id}`);

        // List files to get the correct path for deletion
        const response = await axios.post(
            "https://api.dropboxapi.com/2/files/get_metadata",
            { path: `id:${id}` }, // Use file ID to get the metadata
            {
                headers: {
                    Authorization: `Bearer ${tokens[0]}`,
                    "Content-Type": "application/json",
                },
            }
        );

        // Get the file's path
        const filePath = response.data.path_display;
        console.log(`File path to delete: ${filePath}`);

        // Delete the file using its path
        const deleteResponse = await axios.post(
            "https://api.dropboxapi.com/2/files/delete_v2",
            { path: filePath },  // Use the correct path from metadata
            {
                headers: {
                    Authorization: `Bearer ${tokens[0]}`,
                    "Content-Type": "application/json",
                },
            }
        );

        if (deleteResponse.status === 200) {
            console.log("File deleted successfully.");
            return res.json({ success: true });
        } else {
            console.error("Error deleting file:", deleteResponse.data);
            return res.status(500).json({ error: "Failed to delete file" });
        }
    } catch (error) {
        console.error("❌ Delete Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to delete file" });
    }
});




// Upload file to Dropbox
app.post("/dropbox/upload", upload.single("file"), async (req, res) => {
  if (!tokens.length) return res.status(401).json({ error: "Unauthorized" });
  const file = req.file;

  try {
    const fileData = fs.readFileSync(file.path);
    const response = await axios.post(
      "https://content.dropboxapi.com/2/files/upload",
      fileData,
      {
        headers: {
          Authorization: `Bearer ${tokens[0]}`,
          "Dropbox-API-Arg": JSON.stringify({
            path: `/${file.originalname}`,
            mode: "add",
            autorename: true,
            mute: false,
          }),
          "Content-Type": "application/octet-stream",
        },
      }
    );

    fs.unlinkSync(file.path);
    res.json({ success: true, file: response.data });
  } catch (error) {
    console.error("❌ Upload Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Upload failed" });
  }
});

// Serve the homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () =>
  console.log(`🚀 Server running at http://localhost:${port}`)
);
