const drive = require("../config/googleDrive.js");
const dbx = require("../config/dropbox.js");

const listDriveImages = async () => {
  const res = await drive.files.list({
    q: "mimeType contains 'image/'",
    fields: "files(id, name, webContentLink)",
  });
  return res.data.files;
};

const listDropboxImages = async () => {
  const res = await dbx.filesListFolder({ path: "" });
  return res.entries.filter(entry => entry[".tag"] === "file");
};

module.exports = { listDriveImages, listDropboxImages };