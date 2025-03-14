const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios'); // For making HTTP requests
const fs = require('fs'); // For handling file uploads
const FormData = require('form-data'); // For creating multipart/form-data requests
require('dotenv').config();

// Replace with your bot token from BotFather
const token = process.env.TELEGRAM_BOT_TOKEN;

// Create a bot instance
const bot = new TelegramBot(token, { polling: true });

// In-memory storage for tokens (chatId -> token)
const userTokens = {};

// Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    'Welcome! Use the following commands:\n\n' +
      '/login username password - Log in and get a token\n' +
      '/files - Fetch your files\n' +
      '/upload - Upload a file'
  );
});

// Handle /login command
bot.onText(/\/login (.+?) (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const username = match[1]; // Extract username from the message
  const password = match[2]; // Extract password from the message

  try {
    // Make a POST request to your /api/login endpoint
    const response = await axios.post(`${process.env.API_URL}/api/login`, {
      username,
      password,
    });

    // Extract the JWT token from the response
    const { token, role, user } = response.data;

    // Store the token in memory (associated with the chat ID)
    userTokens[chatId] = token;

    // Send the token and user details back to the user
    bot.sendMessage(
      chatId,
      `Login successful!\n\nToken: ${token}\nRole: ${role}\nUser ID: ${user.id}`
    );
  } catch (error) {
    console.error('Login Error:', error.response?.data || error.message);

    // Handle specific error messages from the API
    if (error.response?.data?.error) {
      bot.sendMessage(chatId, `Login failed: ${error.response.data.error}`);
    } else {
      bot.sendMessage(chatId, 'An error occurred. Please try again later.');
    }
  }
});

// Handle /files command
bot.onText(/\/files/, async (msg) => {
  const chatId = msg.chat.id;

  // Check if the user has a token
  const token = userTokens[chatId];
  if (!token) {
    return bot.sendMessage(chatId, 'You need to log in first. Use /login username password');
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
        (file) =>
          `📄 ${file.title}.${file.fileextension} (${formatFileSize(file.size)})`
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
    const fileSize = msg.document.file_size;

    // Download the file from Telegram
    const fileStream = bot.getFileStream(fileId);
    const filePath = `./uploads/${fileName}`;

    // Save the file locally
    const writeStream = fs.createWriteStream(filePath);
    fileStream.pipe(writeStream);

    // Wait for the file to finish downloading
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Prepare the file for upload to your API
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath), fileName);

    // Make a POST request to the /upload endpoint with the token
    const response = await axios.post(`${process.env.API_URL}/file/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${token}`,
      },
    });

    // Send the upload result back to the user
    bot.sendMessage(chatId, `File uploaded successfully! File ID: ${response.data.fileId}`);

    // Delete the local file after upload
    fs.unlinkSync(filePath);
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

  // Check if the message is not a command
  if (!msg.text.startsWith('/')) {
    bot.sendMessage(chatId, 'I don’t understand that command. Use /start to begin.');
  }
});

console.log('Bot is running...');