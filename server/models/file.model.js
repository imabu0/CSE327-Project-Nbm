const fs = require("fs");
const GoogleBucket = require("./google.model.js");
const DropboxBucket = require("./dropbox.model.js");
const { pool } = require("../config/db.js");
const path = require("path");

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
          console.log(`📤 Uploading file to Google Drive...`);
          partId = await this.googleBucket.uploadFile(
            filePath,
            fileName,
            bucket.token
          );
        } else if (bucket.type === "dropbox") {
          console.log(`📤 Uploading file to Dropbox...`);
          partId = await this.dropboxBucket.uploadFile(
            filePath,
            fileName,
            bucket.token
          );
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
        const chunkPath = `${filePath}.part${chunkIndex}`;

        // Read the chunk from the file
        const fileStream = fs.createReadStream(filePath, {
          start: fileSize - remainingFileSize,
          end: fileSize - remainingFileSize + chunkSize - 1,
        });

        const writeStream = fs.createWriteStream(chunkPath);
        await new Promise((resolve, reject) => {
          fileStream
            .pipe(writeStream)
            .on("finish", resolve)
            .on("error", reject);
        });

        let partId;
        if (bucket.type === "google") {
          console.log(`📤 Uploading chunk ${chunkIndex} to Google Drive...`);
          partId = await this.googleBucket.uploadFile(
            chunkPath,
            `${fileName}`,
            bucket.token
          );
        } else if (bucket.type === "dropbox") {
          console.log(`📤 Uploading chunk ${chunkIndex} to Dropbox...`);
          partId = await this.dropboxBucket.uploadFile(
            chunkPath,
            `${fileName}`,
            bucket.token
          );
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

  async downloadAndMergeChunks(fileId, res) {
    const client = await pool.connect();

    try {
      // Fetch file metadata (name and extension) from the file_info table
      const fileQuery = `
        SELECT title, fileExtension 
        FROM file_info 
        WHERE id = $1;`;
      const fileRes = await client.query(fileQuery, [fileId]);

      if (!fileRes.rows.length) {
        throw new Error("File metadata not found in the database.");
      }

      const { title, fileExtension } = fileRes.rows[0];
      const fileName = `${title}.${fileExtension}`; // Original file name with extension

      // Fetch chunk IDs and their storage types from the database
      const chunkQuery = `
        SELECT chunk_id, type 
        FROM chunk_id 
        WHERE file_id = $1 
        ORDER BY id;`; // Ensure chunks are ordered correctly
      const chunkRes = await client.query(chunkQuery, [fileId]);

      if (!chunkRes.rows.length) {
        throw new Error("No chunks found for the given file ID.");
      }

      const chunks = chunkRes.rows;
      const tempDir = path.join(__dirname, "temp"); // Temporary directory for chunks
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }

      // Download each chunk
      for (let i = 0; i < chunks.length; i++) {
        const { chunk_id, type } = chunks[i];
        const chunkPath = path.join(tempDir, `chunk_${i}`);

        try {
          if (type === "google") {
            try {
              await this.googleBucket.downloadFile(chunk_id, chunkPath);
            } catch (error) {
              if (error.message === "FILE_NOT_FOUND_IN_GOOGLE_DRIVE") {
                console.warn(
                  `⚠️ Chunk ${chunk_id} not found in Google Drive. Checking Dropbox...`
                );
                await this.dropboxBucket.downloadFile(chunk_id, chunkPath);
              } else {
                throw error; // Re-throw other errors
              }
            }
          } else if (type === "dropbox") {
            await this.dropboxBucket.downloadFile(chunk_id, chunkPath);
          } else {
            throw new Error(`Unsupported storage type: ${type}`);
          }
        } catch (error) {
          console.error(
            `❌ Error downloading chunk ${chunk_id}:`,
            error.message
          );
          throw error;
        }
      }

      // Merge chunks into a single file
      const mergedFilePath = path.join(tempDir, fileName); // Use the original file name
      const writeStream = fs.createWriteStream(mergedFilePath);

      for (let i = 0; i < chunks.length; i++) {
        const chunkPath = path.join(tempDir, `chunk_${i}`);
        const readStream = fs.createReadStream(chunkPath);
        await new Promise((resolve, reject) => {
          readStream.pipe(writeStream, { end: false });
          readStream.on("end", resolve);
          readStream.on("error", reject);
        });
        fs.unlinkSync(chunkPath); // Delete the temporary chunk file
      }

      writeStream.end();

      // Serve the merged file to the user with the original file name
      res.download(mergedFilePath, fileName, (err) => {
        if (err) {
          console.error("❌ Error serving file:", err.message);
        }
        fs.unlinkSync(mergedFilePath); // Delete the merged file after serving
      });
    } catch (error) {
      console.error("❌ Download and merge error:", error.message);
      res.status(500).json({ error: "Failed to download and merge chunks." });
    } finally {
      client.release();
    }
  }

  async deleteChunks(fileId) {
    const client = await pool.connect();

    try {
      // Fetch chunk IDs and their storage types from the database
      const chunkQuery = `
        SELECT chunk_id, type 
        FROM chunk_id 
        WHERE file_id = $1;`;
      const chunkRes = await client.query(chunkQuery, [fileId]);

      if (!chunkRes.rows.length) {
        throw new Error("No chunks found for the given file ID.");
      }

      const chunks = chunkRes.rows;

      // Delete each chunk
      for (const { chunk_id, type } of chunks) {
        try {
          if (type === "google") {
            try {
              await this.googleBucket.deleteFile(chunk_id);
            } catch (error) {
              if (error.message === "FILE_NOT_FOUND_IN_GOOGLE_DRIVE") {
                console.warn(
                  `⚠️ Chunk ${chunk_id} not found in Google Drive. Checking Dropbox...`
                );
                await this.dropboxBucket.deleteFile(chunk_id);
              } else {
                throw error; // Re-throw other errors
              }
            }
          } else if (type === "dropbox") {
            await this.dropboxBucket.deleteFile(chunk_id);
          } else {
            throw new Error(`Unsupported storage type: ${type}`);
          }
        } catch (error) {
          console.error(`❌ Error deleting chunk ${chunk_id}:`, error.message);
          throw error;
        }
      }

      // Delete rows from chunk_id table
      await client.query(`DELETE FROM chunk_id WHERE file_id = $1;`, [fileId]);

      // Delete row from file_info table
      await client.query(`DELETE FROM file_info WHERE id = $1;`, [fileId]);

      console.log(`✅ All chunks and metadata for file ID ${fileId} deleted.`);
    } catch (error) {
      console.error("❌ Delete chunks error:", error.message);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = FileOp;
