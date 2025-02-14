class Bucket {
  constructor(auth) {
    if (new.target === Bucket) {
      throw new Error("Cannot instantiate an abstract class.");
    }
    this.auth = auth;
  }

  async uploadFile(file, parentFolderId) {
    throw new Error("uploadFile method must be implemented.");
  }

  async deleteFile(fileId) {
    throw new Error("deleteFile method must be implemented.");
  }

  async downloadFile(fileId, res) {
    throw new Error("downloadFile method must be implemented.");
  }

  async getAvailableStorage() {
    throw new Error("getAvailableStorage method must be implemented.");
  }
}
