// const TelegramBot = require("node-telegram-bot-api");
// const axios = require("axios");
// const fs = require("fs");
// const FormData = require("form-data");
// require("dotenv").config();

// // Bot token from BotFather
// const token = process.env.TELEGRAM_BOT_TOKEN;

// // Create a bot instance
// const bot = new TelegramBot(token, { polling: true });

// // In-memory storage for tokens (chatId -> token)
// const userTokens = {};

// // Ensure the uploads directory exists
// if (!fs.existsSync("./uploads")) {
//   fs.mkdirSync("./uploads");
// }

// // Handle /start command
// bot.onText(/\/start/, (msg) => {
//   const chatId = msg.chat.id;
//   bot.sendMessage(
//     chatId,
//     "Welcome! Use the following commands:\n\n" +
//       "/login username - Request OTP for login\n" +
//       "/verify username otp - Verify your OTP\n" +
//       "/logout - Log out of your account\n" +
//       "/files - Fetch your files\n" +
//       "/upload - Upload a file\n" +
//       "/download <fileId> - Download a file\n" +
//       "/delete <fileId> - Delete a file"
//   );
// });

// // Handle /login command
// bot.onText(/\/login\s+(.+)/, async (msg, match) => {
//     const chatId = msg.chat.id;
//     const username = match[1].trim();
  
//     try {
//       const response = await axios.post(
//         `${process.env.API_URL}/api/generateOTP`,
//         {
//           username: username,
//         }
//       );
  
//       await bot.sendMessage(
//         chatId,
//         `OTP sent to ${username}\n` +
//           `Use: /verify ${username} YOUR_OTP\n`
//       );
//     } catch (error) {
//       await bot.sendMessage(
//         chatId,
//         "⚠️ Login failed. The username might not exist. Please try again with a valid username."
//       );
//     }
//   });

// // Handle /verify command
// bot.onText(/\/verify (\S+) (\S+)/, async (msg, match) => {
//   const chatId = msg.chat.id;
//   const username = match[1]; // Extract username
//   const otp = match[2]; // Extract OTP

//   try {
//     // Make a POST request to the /api/verifyOTP endpoint
//     const response = await axios.post(`${process.env.API_URL}/api/verifyOTP`, {
//       username,
//       otp,
//     });

//     const { message, token, role } = response.data;

//     userTokens[chatId] = token;

//     // Send success message to the user
//     bot.sendMessage(chatId, "Success");
//   } catch (error) {
//     console.error(
//       "OTP Verification Error:",
//       error.response?.data || error.message
//     );

//     // Handle API error response
//     const errorMsg =
//       error.response?.data?.error ||
//       "An error occurred. Please try again later.";
//     bot.sendMessage(chatId, `OTP verification failed: ${errorMsg}`);
//   }
// });

// // Handle /files command
// bot.onText(/\/files/, async (msg) => {
//   const chatId = msg.chat.id;

//   // Check if the user has a token
//   const token = userTokens[chatId];
//   if (!token) {
//     return bot.sendMessage(chatId, "You need to first /login username");
//   }

//   try {
//     // Make a GET request to the /files endpoint with the token
//     const response = await axios.get(`${process.env.API_URL}/file/files`, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//     });

//     // Extract the list of files from the response
//     const files = response.data;

//     // Format the files for display
//     if (files.length === 0) {
//       return bot.sendMessage(chatId, "No files found.");
//     }

//     const fileList = files
//       .map(
//         (file, i) =>
//           `${i + 1}. ${file.title} <${file.id}> (${formatFileSize(file.size)})`
//       )
//       .join("\n");

//     bot.sendMessage(chatId, `Your files:\n\n${fileList}`);
//   } catch (error) {
//     console.error("Files Error:", error.response?.data || error.message);

//     // Handle specific error messages from the API
//     if (error.response?.data?.error) {
//       bot.sendMessage(
//         chatId,
//         `Failed to fetch files: ${error.response.data.error}`
//       );
//     } else {
//       bot.sendMessage(chatId, "An error occurred. Please try again later.");
//     }
//   }
// });

// // Handle /upload command
// bot.onText(/\/upload/, async (msg) => {
//   const chatId = msg.chat.id;

//   // Check if the user has a token
//   const token = userTokens[chatId];
//   if (!token) {
//     return bot.sendMessage(chatId, "You need to first /login username");
//   }

//   // Ask the user to send a file
//   bot.sendMessage(chatId, "Please send a file to upload.");
// });

// // Handle file uploads
// bot.on("document", async (msg) => {
//   const chatId = msg.chat.id;

//   // Check if the user has a token
//   const token = userTokens[chatId];
//   if (!token) {
//     return bot.sendMessage(chatId, "You need to first /login username");
//   }

//   try {
//     // Get the file ID and file information
//     const fileId = msg.document.file_id;
//     const fileName = msg.document.file_name;

//     // Get the file path from Telegram
//     const fileInfo = await bot.getFile(fileId);
//     const filePath = fileInfo.file_path;

//     // Construct the download URL
//     const downloadUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;

//     // Download the file using axios
//     const response = await axios({
//       url: downloadUrl,
//       method: "GET",
//       responseType: "stream",
//     });

//     // Save the file locally
//     const filePathLocal = `./uploads/${fileName}`;
//     const writeStream = fs.createWriteStream(filePathLocal);
//     response.data.pipe(writeStream);

//     // Wait for the file to finish downloading
//     await new Promise((resolve, reject) => {
//       writeStream.on("finish", resolve);
//       writeStream.on("error", reject);
//     });

//     // Prepare the file for upload to your API
//     const formData = new FormData();
//     formData.append("file", fs.createReadStream(filePathLocal), fileName);

//     // Make a POST request to the /upload endpoint with the token
//     const uploadResponse = await axios.post(
//       `${process.env.API_URL}/file/upload`,
//       formData,
//       {
//         headers: {
//           ...formData.getHeaders(),
//           Authorization: `Bearer ${token}`,
//         },
//       }
//     );

//     // Send the upload result back to the user
//     bot.sendMessage(chatId, `File uploaded successfully!`);

//     // Delete the local file after upload
//     fs.unlinkSync(filePathLocal);
//   } catch (error) {
//     console.error("Upload Error:", error.response?.data || error.message);

//     // Handle specific error messages from the API
//     if (error.response?.data?.error) {
//       bot.sendMessage(chatId, `Upload failed: ${error.response.data.error}`);
//     } else {
//       bot.sendMessage(chatId, "An error occurred. Please try again later.");
//     }
//   }
// });

// // Handle /download command
// bot.onText(/\/download (.+)/, async (msg, match) => {
//   const chatId = msg.chat.id;
//   const fileId = match[1]; // Extract the fileId from the command

//   // Check if the user has a token
//   const token = userTokens[chatId];
//   if (!token) {
//     return bot.sendMessage(
//       chatId,
//       "You need to log in first. Use /login username password"
//     );
//   }

//   try {
//     // Make a GET request to the /download endpoint
//     const response = await axios.get(
//       `${process.env.API_URL}/file/download/${fileId}`,
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//         responseType: "stream", // Stream the file
//       }
//     );

//     // Extract the file name from the Content-Disposition header
//     const contentDisposition = response.headers["content-disposition"];
//     console.log("Content-Disposition Header:", contentDisposition);

//     let fileName = `file_${fileId}`; // Fallback file name
//     if (contentDisposition && contentDisposition.includes("filename=")) {
//       fileName = contentDisposition
//         .split("filename=")[1]
//         .split(";")[0] // Handle cases where there are additional parameters
//         .replace(/['"]/g, ""); // Remove quotes

//       // Remove ".undefined" if present
//       if (fileName.endsWith(".undefined")) {
//         fileName = fileName.replace(".undefined", "");
//       }
//     }
//     console.log("Final File Name:", fileName);

//     // Create a temporary file path
//     const tempFilePath = `./uploads/${fileName}`;

//     // Save the file locally
//     const writeStream = fs.createWriteStream(tempFilePath);
//     response.data.pipe(writeStream);

//     // Wait for the file to finish downloading
//     await new Promise((resolve, reject) => {
//       writeStream.on("finish", resolve);
//       writeStream.on("error", reject);
//     });

//     // Send the file to the user with the actual file name
//     await bot.sendDocument(chatId, tempFilePath, {}, { filename: fileName });

//     // Delete the temporary file after sending
//     fs.unlinkSync(tempFilePath);
//   } catch (error) {
//     console.error("Download Error:", error.response?.data || error.message);

//     // Handle specific error messages from the API
//     if (error.response?.data?.error) {
//       bot.sendMessage(chatId, `Download failed: ${error.response.data.error}`);
//     } else {
//       bot.sendMessage(chatId, "An error occurred. Please try again later.");
//     }
//   }
// });

// // Handle /delete command
// bot.onText(/\/delete (.+)/, async (msg, match) => {
//   const chatId = msg.chat.id;
//   const fileId = match[1]; // Extract the fileId from the command

//   // Check if the user has a token
//   const token = userTokens[chatId];
//   if (!token) {
//     return bot.sendMessage(
//       chatId,
//       "You need to log in first. Use /login username password"
//     );
//   }

//   try {
//     // Make a DELETE request to the /delete endpoint
//     const response = await axios.delete(
//       `${process.env.API_URL}/file/delete/${fileId}`,
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       }
//     );

//     // Notify the user about the successful deletion
//     bot.sendMessage(
//       chatId,
//       response.data.message || "File deleted successfully."
//     );
//   } catch (error) {
//     console.error("Delete Error:", error.response?.data || error.message);

//     // Handle specific error messages from the API
//     if (error.response?.data?.error) {
//       bot.sendMessage(chatId, `Delete failed: ${error.response.data.error}`);
//     } else {
//       bot.sendMessage(chatId, "An error occurred. Please try again later.");
//     }
//   }
// });

// // Handle /logout command
// bot.onText(/\/logout/, (msg) => {
//   const chatId = msg.chat.id;
  
//   if (userTokens[chatId]) {
//     delete userTokens[chatId];
//     bot.sendMessage(chatId, "You have been successfully logged out.");
//   } else {
//     bot.sendMessage(chatId, "You weren't logged in to begin with.");
//   }
// });

// // Helper function to format file size
// function formatFileSize(size) {
//   if (size < 1024) {
//     return `${size} B`;
//   } else if (size < 1024 * 1024) {
//     return `${(size / 1024).toFixed(2)} KB`;
//   } else {
//     return `${(size / (1024 * 1024)).toFixed(2)} MB`;
//   }
// }

// // Handle polling errors
// bot.on("polling_error", (error) => {
//   console.error("Polling Error:", error);
// });

// console.log("- Bot is Running...");

const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
require("dotenv").config();

// Bot token from BotFather
const token = process.env.TELEGRAM_BOT_TOKEN;

// Create a bot instance
const bot = new TelegramBot(token, { polling: true });

// In-memory storage for tokens (chatId -> token)
const userTokens = {};

// Ensure the uploads directory exists
if (!fs.existsSync("./uploads")) {
  fs.mkdirSync("./uploads");
}

// Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    "Welcome! Use the following commands:\n\n" +
      "/login username - Request OTP for login\n" +
      "/verify username otp - Verify your OTP\n" +
      "/logout - Log out of your account\n" +
      "/files - Fetch your files\n" +
      "/upload - Upload a file\n" +
      "/download <fileId> - Download a file\n" +
      "/delete <fileId> - Delete a file\n" + 
      "/query <query> - To ask any query from the files"
  );
});

// Handle /login command
bot.onText(/\/login\s+(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const username = match[1].trim();
  
    try {
      const response = await axios.post(
        `${process.env.API_URL}/api/generateOTP`,
        {
          username: username,
        }
      );
  
      await bot.sendMessage(
        chatId,
        `OTP sent to ${username}\n` +
          `Use: /verify ${username} YOUR_OTP\n`
      );
    } catch (error) {
      await bot.sendMessage(
        chatId,
        "⚠️ Login failed. The username might not exist. Please try again with a valid username."
      );
    }
  });

// Handle /verify command
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
    bot.sendMessage(chatId, "Success");
  } catch (error) {
    console.error(
      "OTP Verification Error:",
      error.response?.data || error.message
    );

    // Handle API error response
    const errorMsg =
      error.response?.data?.error ||
      "An error occurred. Please try again later.";
    bot.sendMessage(chatId, `OTP verification failed: ${errorMsg}`);
  }
});

// Handle /files command
bot.onText(/\/files/, async (msg) => {
  const chatId = msg.chat.id;

  // Check if the user has a token
  const token = userTokens[chatId];
  if (!token) {
    return bot.sendMessage(chatId, "You need to first /login username");
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
      return bot.sendMessage(chatId, "No files found.");
    }

    const fileList = files
      .map(
        (file, i) =>
          `${i + 1}. ${file.title} <${file.id}> (${formatFileSize(file.size)})`
      )
      .join("\n");

    bot.sendMessage(chatId, `Your files:\n\n${fileList}`);
  } catch (error) {
    console.error("Files Error:", error.response?.data || error.message);

    // Handle specific error messages from the API
    if (error.response?.data?.error) {
      bot.sendMessage(
        chatId,
        `Failed to fetch files: ${error.response.data.error}`
      );
    } else {
      bot.sendMessage(chatId, "An error occurred. Please try again later.");
    }
  }
});

// Handle /upload command
bot.onText(/\/upload/, async (msg) => {
  const chatId = msg.chat.id;

  // Check if the user has a token
  const token = userTokens[chatId];
  if (!token) {
    return bot.sendMessage(chatId, "You need to first /login username");
  }

  // Ask the user to send a file
  bot.sendMessage(chatId, "Please send a file to upload.");
});

// Handle file uploads
bot.on("document", async (msg) => {
  const chatId = msg.chat.id;

  // Check if the user has a token
  const token = userTokens[chatId];
  if (!token) {
    return bot.sendMessage(chatId, "You need to first /login username");
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
      method: "GET",
      responseType: "stream",
    });

    // Save the file locally
    const filePathLocal = `./uploads/${fileName}`;
    const writeStream = fs.createWriteStream(filePathLocal);
    response.data.pipe(writeStream);

    // Wait for the file to finish downloading
    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    // Prepare the file for upload to your API
    const formData = new FormData();
    formData.append("file", fs.createReadStream(filePathLocal), fileName);

    // Make a POST request to the /upload endpoint with the token
    const uploadResponse = await axios.post(
      `${process.env.API_URL}/file/upload`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // Send the upload result back to the user
    bot.sendMessage(chatId, `File uploaded successfully!`);

    // Delete the local file after upload
    fs.unlinkSync(filePathLocal);
  } catch (error) {
    console.error("Upload Error:", error.response?.data || error.message);

    // Handle specific error messages from the API
    if (error.response?.data?.error) {
      bot.sendMessage(chatId, `Upload failed: ${error.response.data.error}`);
    } else {
      bot.sendMessage(chatId, "An error occurred. Please try again later.");
    }
  }
});

// Handle /download command
bot.onText(/\/download (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const fileId = match[1]; // Extract the fileId from the command

  // Check if the user has a token
  const token = userTokens[chatId];
  if (!token) {
    return bot.sendMessage(
      chatId,
      "You need to log in first. Use /login username password"
    );
  }

  try {
    // Make a GET request to the /download endpoint
    const response = await axios.get(
      `${process.env.API_URL}/file/download/${fileId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: "stream", // Stream the file
      }
    );

    // Extract the file name from the Content-Disposition header
    const contentDisposition = response.headers["content-disposition"];
    console.log("Content-Disposition Header:", contentDisposition);

    let fileName = `file_${fileId}`; // Fallback file name
    if (contentDisposition && contentDisposition.includes("filename=")) {
      fileName = contentDisposition
        .split("filename=")[1]
        .split(";")[0] // Handle cases where there are additional parameters
        .replace(/['"]/g, ""); // Remove quotes

      // Remove ".undefined" if present
      if (fileName.endsWith(".undefined")) {
        fileName = fileName.replace(".undefined", "");
      }
    }
    console.log("Final File Name:", fileName);

    // Create a temporary file path
    const tempFilePath = `./uploads/${fileName}`;

    // Save the file locally
    const writeStream = fs.createWriteStream(tempFilePath);
    response.data.pipe(writeStream);

    // Wait for the file to finish downloading
    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    // Send the file to the user with the actual file name
    await bot.sendDocument(chatId, tempFilePath, {}, { filename: fileName });

    // Delete the temporary file after sending
    fs.unlinkSync(tempFilePath);
  } catch (error) {
    console.error("Download Error:", error.response?.data || error.message);

    // Handle specific error messages from the API
    if (error.response?.data?.error) {
      bot.sendMessage(chatId, `Download failed: ${error.response.data.error}`);
    } else {
      bot.sendMessage(chatId, "An error occurred. Please try again later.");
    }
  }
});

// Handle /delete command
bot.onText(/\/delete (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const fileId = match[1]; // Extract the fileId from the command

  // Check if the user has a token
  const token = userTokens[chatId];
  if (!token) {
    return bot.sendMessage(
      chatId,
      "You need to log in first. Use /login username password"
    );
  }

  try {
    // Make a DELETE request to the /delete endpoint
    const response = await axios.delete(
      `${process.env.API_URL}/file/delete/${fileId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // Notify the user about the successful deletion
    bot.sendMessage(
      chatId,
      response.data.message || "File deleted successfully."
    );
  } catch (error) {
    console.error("Delete Error:", error.response?.data || error.message);

    // Handle specific error messages from the API
    if (error.response?.data?.error) {
      bot.sendMessage(chatId, `Delete failed: ${error.response.data.error}`);
    } else {
      bot.sendMessage(chatId, "An error occurred. Please try again later.");
    }
  }
});

// Handle /logout command
bot.onText(/\/logout/, (msg) => {
  const chatId = msg.chat.id;
  
  if (userTokens[chatId]) {
    delete userTokens[chatId];
    bot.sendMessage(chatId, "You have been successfully logged out.");
  } else {
    bot.sendMessage(chatId, "You weren't logged in to begin with.");
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

//handle /query command
bot.onText(/\/query (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const query = match[1]; // Extract the query from the command

  // Check if the user has a token
  const token = userTokens[chatId];
  if (!token) {
    return bot.sendMessage(
      chatId,
      "You need to log in first. Use /login username password"
    );
  }

  try {
    const response = await axios.post(
      `${process.env.API_URL}/file/query`,
      { query, token},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // Send the query result back to the user
    bot.sendMessage(chatId, `Query result: ${response.data.result}`);
  } catch (error) {
    console.error("Query Error:", error.response?.data || error.message);

    // Handle specific error messages from the API
    if (error.response?.data?.error) {
      bot.sendMessage(chatId, `Query failed: ${error.response.data.error}`);
    } else {
      bot.sendMessage(chatId, "An error occurred. Please try again later.");
    }
  }
});


// Handle polling errors
bot.on("polling_error", (error) => {
  console.error("Polling Error:", error);
});

console.log("- Bot is Running...");