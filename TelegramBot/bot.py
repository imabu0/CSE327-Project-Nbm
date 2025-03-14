from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
import os

# Replace with your bot token
BOT_TOKEN = "7737845213:AAGy_oQGP4S6AzRFTjlIx-MubBYtpspiRt0"

# Command to start the bot
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Hello! Send me a keyword to search for files or images.")

# Function to handle file search
async def search_files(update: Update, context: ContextTypes.DEFAULT_TYPE):
    search_query = update.message.text
    # Replace this with your logic to search for files
    found_files = []
    for root, dirs, files in os.walk("."):  # Search in the current directory
        for file in files:
            if search_query.lower() in file.lower():
                found_files.append(os.path.join(root, file))

    if found_files:
        for file_path in found_files:
            with open(file_path, "rb") as file:
                await update.message.reply_document(document=file)
    else:
        await update.message.reply_text(f"No files found for '{search_query}'.")

# Function to handle image search
async def search_images(update: Update, context: ContextTypes.DEFAULT_TYPE):
    search_query = update.message.text
    # Replace this with your logic to search for images
    found_images = []
    for root, dirs, files in os.walk("."):  # Search in the current directory
        for file in files:
            if file.lower().endswith((".png", ".jpg", ".jpeg", ".gif")) and search_query.lower() in file.lower():
                found_images.append(os.path.join(root, file))

    if found_images:
        for image_path in found_images:
            with open(image_path, "rb") as image:
                await update.message.reply_photo(photo=image)
    else:
        await update.message.reply_text(f"No images found for '{search_query}'.")

# Main function to run the bot
def main():
    # Create the Application
    application = Application.builder().token(BOT_TOKEN).build()

    # Add handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, search_files))

    # Confirmation message
    print("Bot is running! Press Ctrl+C to stop.")

    # Start the bot
    application.run_polling()

if __name__ == "__main__":
    main()