const { google } = require("@googleapis/drive");

const authClient = new google.auth.OAuth2({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: process.env.REDIRECT_URI,
});

authClient.setCredentials({ refresh_token: YOUR_REFRESH_TOKEN });

const drive = google.drive({ version: "v3", auth: authClient });

module.exports = drive;