const fs = require("fs");
const GoogleBucket = require("./google.model.js");
const DropboxBucket = require("./dropbox.model.js");
const { pool } = require("../config/db.js");
const path = require("path")

class FileOp {
  constructor() {
    this.googleBucket = new GoogleBucket();
    this.dropboxBucket = new DropboxBucket();
  }

  async getAvailableStorage() {
    const googleStorage = await this.googleBucket.getAvailableStorage();
    const dropboxStorage = await this.dropboxBucket.getAvailableStorage();

    return {
      google: Array.isArray(googleStorage) ? googleStorage : [],
      dropbox: Array.isArray(dropboxStorage) ? dropboxStorage : [],
    };
  }

  async upFile(filePath, fileName, fileSize) {
    const client = await pool.connect(); // Get a client from the pool
  
    try {
      const storage = await this.getAvailableStorage();
      const allBuckets = [
        ...storage.google.map((bucket) => ({ ...bucket, type: "google" })),
        ...storage.dropbox.map((bucket) => ({ ...bucket, type: "dropbox" })),
      ];
  
      let remainingFileSize = fileSize;
      let uploadedParts = [];
      let chunkIndex = 1;
  
      // Insert file metadata into the file_info table
      const fileExtension = fileName.split(".").pop();
      const fileInsertQuery = `
        INSERT INTO file_info (title, fileExtension, size)
        VALUES ($1, $2, $3)
        RETURNING id;
      `;
      const fileRes = await client.query(fileInsertQuery, [
        fileName,
        fileExtension,
        fileSize,
      ]);
      const fileId = fileRes.rows[0].id; // Get the auto-generated file ID
  
      // If the file is not chunked, upload it directly
      if (fileSize <= allBuckets[0].available) {
        const bucket = allBuckets[0]; // Use the first available bucket
        let partId;
  
        if (bucket.type === "google") {
          console.log("📤 Uploading file to Google Drive...");
          partId = await this.googleBucket.uploadFile(filePath, fileName, bucket.token);
        } else if (bucket.type === "dropbox") {
          console.log("📤 Uploading file to Dropbox...");
          partId = await this.dropboxBucket.uploadFile(filePath, fileName, bucket.token);
        }
  
        uploadedParts.push(partId);
  
        // Insert chunk ID and type into the chunk_id table
        const chunkInsertQuery = `
          INSERT INTO chunk_id (file_id, chunk_id, type)
          VALUES ($1, $2, $3);
        `;
        await client.query(chunkInsertQuery, [fileId, partId, bucket.type]);
  
        console.log("✅ File uploaded successfully.");
        return { message: "File uploaded successfully", fileId, uploadedParts };
      }
  
      // If the file is chunked, split and upload it
      while (remainingFileSize > 0) {
        const bucket = allBuckets.find((b) => b.available > 0);
  
        if (!bucket) {
          throw new Error("Insufficient storage in all linked accounts.");
        }
  
        const chunkSize = Math.min(bucket.available, remainingFileSize);
        const chunkPath = "${filePath}.part${chunkIndex}";
  
        // Read the chunk from the file
        const fileStream = fs.createReadStream(filePath, {
          start: fileSize - remainingFileSize,
          end: fileSize - remainingFileSize + chunkSize - 1,
        });
  
        const writeStream = fs.createWriteStream(chunkPath);
        await new Promise((resolve, reject) => {
          fileStream.pipe(writeStream)
            .on("finish", resolve)
            .on("error", reject);
        });
  
        let partId;
        if (bucket.type === "google") {
          console.log("📤 Uploading chunk ${chunkIndex} to Google Drive...");
          partId = await this.googleBucket.uploadFile(chunkPath, "${fileName}.part${chunkIndex}", bucket.token);
        } else if (bucket.type === "dropbox") {
          console.log("📤 Uploading chunk ${chunkIndex} to Dropbox...");
          partId = await this.dropboxBucket.uploadFile(chunkPath," ${fileName}.part${chunkIndex}", bucket.token);
        }
  
        uploadedParts.push(partId);
  
        // Insert chunk ID and type into the chunk_id table
        const chunkInsertQuery = `
          INSERT INTO chunk_id (file_id, chunk_id, type)
          VALUES ($1, $2, $3);
        `;
        await client.query(chunkInsertQuery, [fileId, partId, bucket.type]);
  
        remainingFileSize -= chunkSize;
        bucket.available -= chunkSize;
        fs.unlinkSync(chunkPath); // Delete the temporary chunk file
        chunkIndex++;
      }
  
      console.log("✅ All parts uploaded successfully.");
      return { message: "File uploaded in parts", fileId, uploadedParts };
    } catch (error) {
      console.error("❌ Upload error:", error.message);
      throw new Error("Failed to upload file.");
    } finally {
      client.release(); // Release the client back to the pool
    }
  }

  async downFile(fileId, outputFilePath) {
    const client = await pool.connect(); // Get a client from the pool

    try {
      // Step 1: Retrieve chunk information from the database
      const chunkQuery = `
        SELECT chunk_id, type
        FROM chunk_id
        WHERE file_id = $1
        ORDER BY id;
      `;
      const chunkRes = await client.query(chunkQuery, [fileId]);
      console.log("Google Bucket:", this.googleBucket);

      if (chunkRes.rows.length === 0) {
        throw new Error("No chunks found for the given file ID.");
      }

      const chunks = chunkRes.rows;
      const tempDir = path.join(__dirname, "temp_chunks"); // Temporary directory to store chunks
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir); // Create the directory if it doesn't exist
      }

      // Step 2: Download each chunk
      for (let i = 0; i < chunks.length; i++) {
        const { chunk_id, type } = chunks[i];
        const chunkFilePath = path.join(tempDir, `chunk_${i + 1}`);
        
        if (type === "google") {
          console.log(`📥 Downloading chunk ${i + 1} from Google Drive...`);
          await this.googleBucket.downloadFile(chunk_id, chunkFilePath);
        } else if (type === "dropbox") {
          console.log(`📥 Downloading chunk ${i + 1} from Dropbox...`);
          await this.dropboxBucket.downloadFile(chunk_id, chunkFilePath);
        } else {
          throw new Error(`Unknown storage type: ${type}`);
        }
      }
      

      // Step 3: Merge the chunks
      console.log("🔗 Merging chunks...");
      const writeStream = fs.createWriteStream(outputFilePath);

      for (let i = 0; i < chunks.length; i++) {
        const chunkFilePath = path.join(tempDir, `chunk_${i + 1}`);
        const chunkData = fs.readFileSync(chunkFilePath);
        writeStream.write(chunkData);
        fs.unlinkSync(chunkFilePath); // Delete the chunk file after merging
      }

      writeStream.end();
      console.log(`✅ File successfully merged and saved to: ${outputFilePath}`);

      // Step 4: Clean up the temporary directory
      fs.rmdirSync(tempDir);
    } catch (error) {
      console.error("❌ Error downloading or merging chunks:", error.message);
      throw new Error("Failed to download or merge chunks.");
    } finally {
      client.release(); // Release the client back to the pool
    }
  }
}

module.exports = FileOp;
