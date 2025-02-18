const GoogleBucket = require("./google.model.js");
const DropboxBucket = require("./dropbox.model.js");

class FileOp {
  constructor() {
    this.googleBucket = new GoogleBucket();
    this.dropboxBucket = new DropboxBucket();
  }

  // ✅ Get available storage for all accounts
  async getAvailableStorage() {
    const googleStorage = await this.googleBucket.getAvailableStorage();
    const dropboxStorage = await this.dropboxBucket.getAvailableStorage();

    return {
      google: googleStorage,
      dropbox: dropboxStorage,
    };
  }

  // ✅ Upload file dynamically based on storage availability
  async uploadFile(filePath, fileName, fileSize) {
    try {
      const storage = await this.getAvailableStorage();
      
      // 1️⃣ Try Google Drive first
      for (const google of storage.google) {
        if (google.available > fileSize) {
          console.log(`✅ Uploading ${fileName} to Google Drive...`);
          return await this.googleBucket.uploadFile(filePath, fileName, google.token);
        }
      }

      console.log("⚠️ Google Drive is full. Trying Dropbox...");

      // 2️⃣ If Google Drive is full, try Dropbox
      for (const dropbox of storage.dropbox) {
        if (dropbox.available > fileSize) {
          console.log(`✅ Uploading ${fileName} to Dropbox...`);
          return await this.dropboxBucket.uploadFile(filePath, fileName, dropbox.token);
        }
      }

      console.log("⚠️ All accounts are full. Splitting file into chunks...");

      // 3️⃣ If all accounts are full, split into chunks
      const chunkSize = 50 * 1024 * 1024;
      const fileStream = fs.createReadStream(filePath, { highWaterMark: chunkSize });
      let uploadedParts = [];
      let chunkIndex = 1;

      for await (const chunk of fileStream) {
        const chunkPath = `${filePath}.part${chunkIndex}`;
        fs.writeFileSync(chunkPath, chunk);

        // Find a Dropbox bucket with enough space for this chunk
        let uploaded = false;
        for (const dropbox of storage.dropbox) {
          if (dropbox.available > chunk.length) {
            console.log(`📤 Uploading chunk ${chunkIndex} to Dropbox...`);
            const partId = await this.dropboxBucket.uploadFile(chunkPath, `${fileName}.part${chunkIndex}`, dropbox.token);
            uploadedParts.push(partId);
            uploaded = true;
            break;
          }
        }

        if (!uploaded) {
          console.error("❌ No space left in any account for this chunk.");
          throw new Error("Insufficient storage in all linked accounts.");
        }

        fs.unlinkSync(chunkPath);
        chunkIndex++;
      }

      console.log("✅ All parts uploaded successfully.");
      return { message: "File uploaded in parts", uploadedParts };
    } catch (error) {
      console.error("❌ Upload error:", error.message);
      throw new Error("Failed to upload file.");
    }
  }
}

module.exports = FileOp;
