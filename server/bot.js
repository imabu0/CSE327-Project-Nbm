const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
require('dotenv').config();

// Replace with your bot token from BotFather
const token = process.env.TELEGRAM_BOT_TOKEN;

// Create a bot instance
const bot = new TelegramBot(token, { polling: true });

// In-memory storage for tokens (chatId -> token)
const userTokens = {};

// Ensure the uploads directory exists
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    'Welcome! Use the following commands:\n\n' +
      '/generate username to generate OTP for usern\n' +
      '/verify username otp to verify login' +
      '/files - Fetch your files\n' +
      '/upload - Upload a file'
  );
});

// Handle /login command
bot.onText(/\/generate\s*(.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const username = match[1]?.trim(); // Extract username correctly and remove extra spaces

  console.log("Extracted username:", username); // Debugging line

  try {
    const response = await axios.post(`${process.env.API_URL}/api/generateOTP`, {
      username,
    });

    const { otp } = response.data;

    bot.sendMessage(chatId, `OTP Generated!\n\nOTP: ${otp}`);
  } catch (error) {
    console.error('OTP Error', error.response?.data || error.message);

    if (error.response?.data?.error) {
      bot.sendMessage(chatId, `OTP failed: ${error.response.data.error}`);
    } else {
      bot.sendMessage(chatId, 'An error occurred. Please try again later.');
    }
  }
});

bot.onText(/\/verify (\S+) (\S+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const username = match[1]; // Extract username
  const otp = match[2]; // Extract OTP

  try {
    // Make a POST request to the /api/verifyOTP endpoint
    const response = await axios.post(`${process.env.API_URL}/api/verifyOTP`, {
      username,
      otp,
    });

    const { message, token, role } = response.data;

    userTokens[chatId] = token;

    // Send success message to the user
    bot.sendMessage(
      chatId,
      'Success'
    );

  } catch (error) {
    console.error("OTP Verification Error:", error.response?.data || error.message);

    // Handle API error response
    const errorMsg = error.response?.data?.error || "An error occurred. Please try again later.";
    bot.sendMessage(chatId, `❌ OTP verification failed: ${errorMsg}`);
  }
});




// Handle /files command
bot.onText(/\/files/, async (msg) => {
  const chatId = msg.chat.id;

  // Check if the user has a token
  const token = userTokens[chatId];
  if (!token) {
    return bot.sendMessage(chatId, 'You need to auth first. Use /generate username');
  }

  try {
    // Make a GET request to the /files endpoint with the token
    const response = await axios.get(`${process.env.API_URL}/file/files`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Extract the list of files from the response
    const files = response.data;

    // Format the files for display
    if (files.length === 0) {
      return bot.sendMessage(chatId, 'No files found.');
    }

    const fileList = files
      .map(
        (file, i) =>
          `${i+1}. ${file.title} (${formatFileSize(file.size)})`
      )
      .join('\n');

    bot.sendMessage(chatId, `Your files:\n\n${fileList}`);
  } catch (error) {
    console.error('Files Error:', error.response?.data || error.message);

    // Handle specific error messages from the API
    if (error.response?.data?.error) {
      bot.sendMessage(chatId, `Failed to fetch files: ${error.response.data.error}`);
    } else {
      bot.sendMessage(chatId, 'An error occurred. Please try again later.');
    }
  }
});

// Handle /upload command
bot.onText(/\/upload/, async (msg) => {
  const chatId = msg.chat.id;

  // Check if the user has a token
  const token = userTokens[chatId];
  if (!token) {
    return bot.sendMessage(chatId, 'You need to log in first. Use /login username password');
  }

  // Ask the user to send a file
  bot.sendMessage(chatId, 'Please send a file to upload.');
});

// Handle file uploads
bot.on('document', async (msg) => {
  const chatId = msg.chat.id;

  // Check if the user has a token
  const token = userTokens[chatId];
  if (!token) {
    return bot.sendMessage(chatId, 'You need to log in first. Use /login username password');
  }

  try {
    // Get the file ID and file information
    const fileId = msg.document.file_id;
    const fileName = msg.document.file_name;

    // Get the file path from Telegram
    const fileInfo = await bot.getFile(fileId);
    const filePath = fileInfo.file_path;

    // Construct the download URL
    const downloadUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;

    // Download the file using axios
    const response = await axios({
      url: downloadUrl,
      method: 'GET',
      responseType: 'stream',
    });

    // Save the file locally
    const filePathLocal = `./uploads/${fileName}`;
    const writeStream = fs.createWriteStream(filePathLocal);
    response.data.pipe(writeStream);

    // Wait for the file to finish downloading
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Prepare the file for upload to your API
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePathLocal), fileName);

    // Make a POST request to the /upload endpoint with the token
    const uploadResponse = await axios.post(`${process.env.API_URL}/file/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${token}`,
      },
    });

    // Send the upload result back to the user
    bot.sendMessage(chatId, `File uploaded successfully!`);

    // Delete the local file after upload
    fs.unlinkSync(filePathLocal);
  } catch (error) {
    console.error('Upload Error:', error.response?.data || error.message);

    // Handle specific error messages from the API
    if (error.response?.data?.error) {
      bot.sendMessage(chatId, `Upload failed: ${error.response.data.error}`);
    } else {
      bot.sendMessage(chatId, 'An error occurred. Please try again later.');
    }
  }
});

// Helper function to format file size
function formatFileSize(size) {
  if (size < 1024) {
    return `${size} B`;
  } else if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(2)} KB`;
  } else {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
}

// Handle unknown commands or messages
bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  // Check if the message has text and is not a command
  if (msg.text && !msg.text.startsWith('/')) {
    bot.sendMessage(chatId, 'I don’t understand that command. Use /start to begin.');
  }
});

// Handle polling errors
bot.on('polling_error', (error) => {
  console.error('Polling Error:', error);
});

console.log('Bot is running...');