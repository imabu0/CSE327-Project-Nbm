const fs = require("fs");
const GoogleBucket = require("./google.model.js");
const DropboxBucket = require("./dropbox.model.js");
const { pool } = require("../config/db.js");
const path = require("path");

class FileOp {
  constructor() {
    this.googleBucket = new GoogleBucket(); // Instantiate GoogleBucket
    this.dropboxBucket = new DropboxBucket(); // Instantiate DropboxBucket
  }

  async getAvailableStorage(userId) {
    const googleStorage = await this.googleBucket.getAvailableStorage(userId); // Get Google Drive storage
    const dropboxStorage = await this.dropboxBucket.getAvailableStorage(userId); // Get Dropbox storage

    return {
      google: Array.isArray(googleStorage) ? googleStorage : [], // Ensure it's an array
      dropbox: Array.isArray(dropboxStorage) ? dropboxStorage : [], // Ensure it's an array
    };
  }
  
  async upFile(filePath, fileName, fileSize, userId, fileContent) {
    const client = await pool.connect(); // Get a client from the pool

    try {
      const storage = await this.getAvailableStorage(userId); // Get available storage
      const allBuckets = [
        ...storage.google.map((bucket) => ({ ...bucket, type: "google" })),
        ...storage.dropbox.map((bucket) => ({ ...bucket, type: "dropbox" })),
      ];

      let remainingFileSize = fileSize;
      let uploadedParts = [];
      let chunkIndex = 1;

      // Insert file metadata into the file_info table
      const fileExtension = fileName.split(".").pop(); // Get the file extension
      const fileInsertQuery = `
        INSERT INTO file_info (title, fileExtension, size, user_id, content)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id;
      `;
      const fileRes = await client.query(fileInsertQuery, [
        fileName,
        fileExtension,
        fileSize,
        userId,
        fileContent,
      ]);
      const fileId = fileRes.rows[0].id; // Get the auto-generated file ID

      // If the file is not chunked, upload it directly
      if (fileSize <= allBuckets[0].available) {
        const bucket = allBuckets[0]; // Use the first available bucket
        let partId;

        // Upload the file to the cloud storage
        if (bucket.type === "google") {
          console.log(`Uploading file to Google Drive...`);
          partId = await this.googleBucket.uploadFile(
            filePath,
            fileName,
            bucket.token,
            userId
          );
        } else if (bucket.type === "dropbox") {
          console.log(`Uploading file to Dropbox...`);
          partId = await this.dropboxBucket.uploadFile(
            filePath,
            fileName,
            bucket.token,
            userId
          );
        }

        uploadedParts.push(partId); // Add the file ID to the array

        // Insert chunk ID and type into the chunk_id table
        const chunkInsertQuery = `
          INSERT INTO chunk_id (file_id, chunk_id, type)
          VALUES ($1, $2, $3);
        `;
        await client.query(chunkInsertQuery, [fileId, partId, bucket.type]); // Insert into the database

        console.log(" - File uploaded successfully.");
        return { message: "File uploaded successfully", fileId, uploadedParts };
      }

      // If the file is chunked, split and upload it
      while (remainingFileSize > 0) {
        const bucket = allBuckets.find((b) => b.available > 0);

        if (!bucket) {
          throw new Error("Insufficient storage in all linked accounts.");
        }

        const chunkSize = Math.min(bucket.available, remainingFileSize); // Use the available storage
        const chunkPath = `${filePath}.part${chunkIndex}`; // Temporary chunk file

        // Read the chunk from the file
        const fileStream = fs.createReadStream(filePath, {
          start: fileSize - remainingFileSize,
          end: fileSize - remainingFileSize + chunkSize - 1,
        });

        // Write the chunk to a temporary file
        const writeStream = fs.createWriteStream(chunkPath);
        await new Promise((resolve, reject) => {
          fileStream
            .pipe(writeStream) // Pipe the read stream to the write stream
            .on("finish", resolve) // Resolve the promise when writing is done
            .on("error", reject); // Reject the promise if there's an error
        });

        let partId;
        // Upload the chunk to the cloud storage
        if (bucket.type === "google") {
          console.log(` - Uploading chunk ${chunkIndex} to Google Drive...`);
          partId = await this.googleBucket.uploadFile(
            chunkPath,
            `${fileName}`,
            bucket.token,
            userId
          );
        } else if (bucket.type === "dropbox") {
          console.log(` - Uploading chunk ${chunkIndex} to Dropbox...`);
          partId = await this.dropboxBucket.uploadFile(
            chunkPath,
            `${fileName}`,
            bucket.token,
            userId
          );
        }

        uploadedParts.push(partId); // Add the chunk ID to the array

        // Insert chunk ID and type into the chunk_id table
        const chunkInsertQuery = `
          INSERT INTO chunk_id (file_id, chunk_id, type)
          VALUES ($1, $2, $3);
        `;
        await client.query(chunkInsertQuery, [fileId, partId, bucket.type]); // Insert into the database

        remainingFileSize -= chunkSize; // Reduce the remaining file size
        bucket.available -= chunkSize; // Reduce the available storage
        fs.unlinkSync(chunkPath); // Delete the temporary chunk file
        chunkIndex++;
      }

      console.log(" - All parts uploaded successfully.");
      return { message: "File uploaded in parts", fileId, uploadedParts };
    } catch (error) {
      console.error("Upload error:", error.message);
      throw new Error("Failed to upload file.");
    } finally {
      client.release(); // Release the client back to the pool
    }
  }

  // Method to download and merge chunks into a single file
  async downloadAndMergeChunks(fileId, res, userId) {
    const client = await pool.connect(); // Get a client from the pool

    try {
      // Fetch file metadata (name and extension) from the file_info table
      const fileQuery = `
        SELECT title, fileExtension 
        FROM file_info 
        WHERE id = $1;`;
      const fileRes = await client.query(fileQuery, [fileId]); // Query the database

      if (!fileRes.rows.length) {
        throw new Error("File metadata not found in the database.");
      }

      const { title, fileExtension } = fileRes.rows[0]; // Get the file metadata
      const fileName = `${title}.${fileExtension}`; // Original file name with extension

      // Fetch chunk IDs and their storage types from the database
      const chunkQuery = `
        SELECT chunk_id, type 
        FROM chunk_id 
        WHERE file_id = $1 
        ORDER BY id;`; // Ensure chunks are ordered correctly
      const chunkRes = await client.query(chunkQuery, [fileId]); // Query the database

      if (!chunkRes.rows.length) {
        throw new Error("No chunks found for the given file ID.");
      }

      const chunks = chunkRes.rows;
      const tempDir = path.join(__dirname, "temp"); // Temporary directory for chunks
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir); // Create the temporary directory if it doesn't exist
      }

      // Download each chunk
      for (let i = 0; i < chunks.length; i++) {
        const { chunk_id, type } = chunks[i]; // Get the chunk ID and storage type
        const chunkPath = path.join(tempDir, `chunk_${i}`); // Temporary chunk file

        // Download the chunk from the cloud storage
        try {
          if (type === "google") {
            try {
              await this.googleBucket.downloadFile(chunk_id, chunkPath, userId); // Download from Google Drive
            } catch (error) {
              if (error.message === "FILE_NOT_FOUND_IN_GOOGLE_DRIVE") {
                console.warn(
                  `⚠️ Chunk ${chunk_id} not found in Google Drive. Checking Dropbox...`
                );
                await this.dropboxBucket.downloadFile(chunk_id, chunkPath, userId); // If not found in the Google drive then try Dropbox
              } else {
                throw error; // Re-throw other errors
              }
            }
          } else if (type === "dropbox") {
            await this.dropboxBucket.downloadFile(chunk_id, chunkPath, userId); // Download from Dropbox
          } else {
            throw new Error(`Unsupported storage type: ${type}`);
          }
        } catch (error) {
          console.error(`Error downloading chunk ${chunk_id}:`, error.message);
          throw error;
        }
      }

      // Merge chunks into a single file
      const mergedFilePath = path.join(tempDir, fileName); // Use the original file name
      const writeStream = fs.createWriteStream(mergedFilePath); // Write stream for the merged file

      // Read each chunk and write it to the merged file
      for (let i = 0; i < chunks.length; i++) {
        const chunkPath = path.join(tempDir, `chunk_${i}`);
        const readStream = fs.createReadStream(chunkPath);
        await new Promise((resolve, reject) => {
          readStream.pipe(writeStream, { end: false }); // Pipe the read stream to the write stream
          readStream.on("end", resolve); // Resolve the promise when reading is done
          readStream.on("error", reject); // Reject the promise if there's an error
        });
        fs.unlinkSync(chunkPath); // Delete the temporary chunk file
      }

      writeStream.end(); // End the write stream

      // Serve the merged file to the user with the original file name
      res.download(mergedFilePath, fileName, (err) => {
        if (err) {
          console.error("Error serving file:", err.message);
        }
        fs.unlinkSync(mergedFilePath); // Delete the merged file after serving
      });
    } catch (error) {
      console.error("Download and merge error:", error.message);
      res.status(500).json({ error: "Failed to download and merge chunks." });
    } finally {
      client.release();
    }
  }


  async downloadAndMergeChunks2(fileId,userId) {
    const client = await pool.connect(); // Get a client from the pool

    try {
      // Fetch file metadata (name and extension) from the file_info table
      const fileQuery = `
        SELECT title, fileExtension 
        FROM file_info 
        WHERE id = $1;`;
      const fileRes = await client.query(fileQuery, [fileId]); // Query the database

      if (!fileRes.rows.length) {
        throw new Error("File metadata not found in the database.");
      }

      const { title, fileExtension } = fileRes.rows[0]; // Get the file metadata
      const fileName = `${title}.${fileExtension}`; // Original file name with extension

      // Fetch chunk IDs and their storage types from the database
      const chunkQuery = `
        SELECT chunk_id, type 
        FROM chunk_id 
        WHERE file_id = $1 
        ORDER BY id;`; // Ensure chunks are ordered correctly
      const chunkRes = await client.query(chunkQuery, [fileId]); // Query the database

      if (!chunkRes.rows.length) {
        throw new Error("No chunks found for the given file ID.");
      }

      const chunks = chunkRes.rows;
      const tempDir = path.join(__dirname, "temp"); // Temporary directory for chunks
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir); // Create the temporary directory if it doesn't exist
      }

      // Download each chunk
      for (let i = 0; i < chunks.length; i++) {
        const { chunk_id, type } = chunks[i]; // Get the chunk ID and storage type
        const chunkPath = path.join(tempDir, `chunk_${i}`); // Temporary chunk file

        // Download the chunk from the cloud storage
        try {
          if (type === "google") {
            try {
              await this.googleBucket.downloadFile(chunk_id, chunkPath, userId); // Download from Google Drive
            } catch (error) {
              if (error.message === "FILE_NOT_FOUND_IN_GOOGLE_DRIVE") {
                console.warn(
                  `⚠️ Chunk ${chunk_id} not found in Google Drive. Checking Dropbox...`
                );
                await this.dropboxBucket.downloadFile(chunk_id, chunkPath, userId); // If not found in the Google drive then try Dropbox
              } else {
                throw error; // Re-throw other errors
              }
            }
          } else if (type === "dropbox") {
            await this.dropboxBucket.downloadFile(chunk_id, chunkPath, userId); // Download from Dropbox
          } else {
            throw new Error(`Unsupported storage type: ${type}`);
          }
        } catch (error) {
          console.error(`Error downloading chunk ${chunk_id}:`, error.message);
          throw error;
        }
      }

      // Merge chunks into a single file
      const mergedFilePath = path.join(tempDir, fileName); // Use the original file name
      const writeStream = fs.createWriteStream(mergedFilePath); // Write stream for the merged file

      // Read each chunk and write it to the merged file
      for (let i = 0; i < chunks.length; i++) {
        const chunkPath = path.join(tempDir, `chunk_${i}`);
        const readStream = fs.createReadStream(chunkPath);
        await new Promise((resolve, reject) => {
          readStream.pipe(writeStream, { end: false }); // Pipe the read stream to the write stream
          readStream.on("end", resolve); // Resolve the promise when reading is done
          readStream.on("error", reject); // Reject the promise if there's an error
        });
        fs.unlinkSync(chunkPath); // Delete the temporary chunk file
      }

      writeStream.end(); // End the write stream

      const file_Name = fileName.replace(/\.undefined$/, "");
      // ✅ Wait for file save + return the path
const finalPath = await new Promise((resolve, reject) => {
  writeStream.on("finish", () => {
    const os = require("os");
    let downloadsPath = path.join(os.homedir(), "Downloads", fileName);

    // Remove trailing `.undefined` if any
    if (downloadsPath.endsWith(".undefined")) {
      downloadsPath = downloadsPath.replace(".undefined", "");
    }

    try {
      fs.renameSync(mergedFilePath, downloadsPath);
      console.log(`✅ File saved to: ${downloadsPath}`);
      resolve(downloadsPath); // ✅ return path here
    } catch (err) {
      console.error("❌ Error moving file to Downloads:", err);
      reject(err);
    }
  });

  writeStream.on("error", (err) => {
    reject(err);
  });
  });

  return finalPath; //

       
      

    } catch (error) {
      console.error("Download and merge error:", error.message);
      return "nopath";
    } finally {
      client.release();
    }
  }

  // Method to delete chunks and metadata from the database and cloud storage
  async deleteChunks(fileId, userId) {
    const client = await pool.connect(); // Get a client from the pool

    try {
      // Fetch chunk IDs and their storage types from the database
      const chunkQuery = `
        SELECT chunk_id, type 
        FROM chunk_id 
        WHERE file_id = $1;`;
      const chunkRes = await client.query(chunkQuery, [fileId]); // Query the database

      if (!chunkRes.rows.length) {
        throw new Error("No chunks found for the given file ID.");
      }

      const chunks = chunkRes.rows; // Get the chunks

      // Delete each chunk
      for (const { chunk_id, type } of chunks) {
        try {
          if (type === "google") {
            try {
              await this.googleBucket.deleteFile(chunk_id, userId); // Delete from Google Drive
            } catch (error) {
              if (error.message === "FILE_NOT_FOUND_IN_GOOGLE_DRIVE") {
                console.warn(
                  `⚠️ Chunk ${chunk_id} not found in Google Drive. Checking Dropbox...`
                );
                await this.dropboxBucket.deleteFile(chunk_id, userId); // If not found in the Google drive then try Dropbox
              } else {
                throw error; // Re-throw other errors
              }
            }
          } else if (type === "dropbox") {
            await this.dropboxBucket.deleteFile(chunk_id, userId); // Delete from Dropbox
          } else {
            throw new Error(`Unsupported storage type: ${type}`);
          }
        } catch (error) {
          console.error(`Error deleting chunk ${chunk_id, userId}:`, error.message);
          throw error;
        }
      }

      // Delete rows from chunk_id table
      await client.query(`DELETE FROM chunk_id WHERE file_id = $1;`, [fileId]);

      // Delete row from file_info table
      await client.query(`DELETE FROM file_info WHERE id = $1;`, [fileId]);

      console.log(` - All chunks and metadata for file ID ${fileId} deleted.`);
    } catch (error) {
      console.error("Delete chunks error:", error.message);
      throw error;
    } finally {
      client.release(); // Release the client back to the pool
    }
  }
}

module.exports = FileOp;
