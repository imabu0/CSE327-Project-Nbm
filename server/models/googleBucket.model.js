const Bucket = require("./bucket.model.js");
const { google } = require("googleapis");
const fs = require("fs");

class GoogleBucket extends Bucket {
  constructor(auth) {
    super(auth);
    this.drive = google.drive({ version: "v3", auth });
  }
}
