const fs = require("fs");
const GoogleBucket = require("./google.model.js");
const DropboxBucket = require("./dropbox.model.js");

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
    try {
        const storage = await this.getAvailableStorage();

        // Combine all available storage from Google Drive and Dropbox
        const allBuckets = [
            ...storage.google.map(bucket => ({ ...bucket, type: 'google' })),
            ...storage.dropbox.map(bucket => ({ ...bucket, type: 'dropbox' }))
        ];

        // Sort buckets by available storage (descending order)
        allBuckets.sort((a, b) => b.available - a.available);

        let remainingFileSize = fileSize;
        let uploadedParts = [];
        let chunkIndex = 1;

        while (remainingFileSize > 0) {
            // Find the first bucket with enough space for the remaining file
            const bucket = allBuckets.find(b => b.available > 0);

            if (!bucket) {
                throw new Error("Insufficient storage in all linked accounts.");
            }

            // Determine the chunk size based on the bucket's available storage
            const chunkSize = Math.min(bucket.available, remainingFileSize);

            // Create a chunk of the file
            const chunkPath = `${filePath}.part${chunkIndex}`;
            const chunkBuffer = Buffer.alloc(chunkSize);
            const fileStream = fs.createReadStream(filePath, {
                start: fileSize - remainingFileSize,
                end: fileSize - remainingFileSize + chunkSize - 1
            });

            await new Promise((resolve, reject) => {
                fileStream.on('data', (chunk) => {
                    chunkBuffer.fill(chunk);
                });
                fileStream.on('end', resolve);
                fileStream.on('error', reject);
            });

            fs.writeFileSync(chunkPath, chunkBuffer);

            // Upload the chunk to the appropriate bucket
            if (bucket.type === 'google') {
                console.log(`📤 Uploading chunk ${chunkIndex} to Google Drive...`);
                const partId = await this.googleBucket.uploadFile(
                    chunkPath,
                    `${fileName}.part${chunkIndex}`,
                    bucket.token
                );
                uploadedParts.push(partId);
            } else if (bucket.type === 'dropbox') {
                console.log(`📤 Uploading chunk ${chunkIndex} to Dropbox...`);
                const partId = await this.dropboxBucket.uploadFile(
                    chunkPath,
                    `${fileName}.part${chunkIndex}`,
                    bucket.token
                );
                uploadedParts.push(partId);
            }

            // Update the remaining file size and bucket's available storage
            remainingFileSize -= chunkSize;
            bucket.available -= chunkSize;

            // Clean up the chunk file
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
