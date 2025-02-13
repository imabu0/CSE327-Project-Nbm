const Dropbox = require("dropbox").Dropbox;
const fetch = require("node-fetch"); // Required for Dropbox SDK
const fs = require("fs");
require("dotenv").config();

const dbx = new Dropbox({
  accessToken: process.env.DROPBOX_TOKEN,
  fetch,
});

/**
 * ✅ Uploads a file to Dropbox
 * @param {Buffer} fileBuffer - The file data as a buffer
 * @param {string} dropboxPath - The path where the file should be stored in Dropbox
 */
const uploadFile = async (fileBuffer, dropboxPath) => {
  try {
    const response = await dbx.filesUpload({
      path: dropboxPath,
      contents: fileBuffer, // Directly pass the buffer
      mode: { ".tag": "overwrite" }, // Overwrite if file exists
    });

    return response.result;
  } catch (error) {
    console.error("❌ Dropbox Upload Error:", error);
    throw error;
  }
};

/**
 * ✅ Lists all files in Dropbox
 */
const listFiles = async () => {
  try {
    const response = await dbx.filesListFolder({ path: "" });
    return response.result.entries;
  } catch (error) {
    console.error("❌ Dropbox List Files Error:", error);
    throw error;
  }
};

/**
 * ✅ Downloads a file from Dropbox
 * @param {string} dropboxPath - The file path in Dropbox
 */
const downloadFile = async (path) => {
  try {
    const response = await dbx.filesDownload({ path });

    // The file content is in response.fileBinary
    return response.result.fileBinary;
  } catch (error) {
    console.error("❌ Dropbox download error:", error);
    throw new Error("Failed to download file");
  }
};

/**
 * ✅ Deletes a file from Dropbox
 * @param {string} dropboxPath - The file path in Dropbox
 */
const deleteFile = async (dropboxPath) => {
  try {
    const response = await dbx.filesDeleteV2({ path: dropboxPath });
    return response.result;
  } catch (error) {
    console.error("❌ Dropbox Delete Error:", error);
    throw error;
  }
};

module.exports = { uploadFile, listFiles, downloadFile, deleteFile };
