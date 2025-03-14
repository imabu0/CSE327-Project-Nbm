from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
import os
import PyPDF2  # For PDF files
from PIL import Image  # For image processing

# Replace with your bot token
BOT_TOKEN = "7737845213:AAGy_oQGP4S6AzRFTjlIx-MubBYtpspiRt0"

# List of authorized users (replace with actual user IDs)
AUTHORIZED_USERS = [5745656143]  # Add your Telegram user ID here

# Function to check if a user is authorized
def is_authorized(user_id):
    return user_id in AUTHORIZED_USERS

# Command to start the bot
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id
    if not is_authorized(user_id):
        await update.message.reply_text("You are not authorized to use this bot.")
        return

    await update.message.reply_text(
        "Hello! Welcome to the File Search Bot.\n\n"
        "Here's how to use me:\n"
        "/start - Start the bot\n"
        "/help - Show help message\n"
        "Send a keyword to search for files or images.\n"
        "/search <file_type> <keyword> - Search for specific file types (e.g., /search txt hello)\n"
        "/date <YYYY-MM-DD> - Search for files modified on a specific date\n"
        "/size <>=< <size_in_bytes> - Search for files by size (e.g., /size > 1000000)\n"
        "/image <keyword> - Search for images by keyword\n"
    )

# Command to show help
async def help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id
    if not is_authorized(user_id):
        await update.message.reply_text("You are not authorized to use this bot.")
        return

    await update.message.reply_text(
        "Here's how to use the bot:\n"
        "/start - Start the bot\n"
        "/help - Show this help message\n"
        "Send a keyword to search for files or images.\n"
        "/search <file_type> <keyword> - Search for specific file types (e.g., /search txt hello)\n"
        "/date <YYYY-MM-DD> - Search for files modified on a specific date\n"
        "/size <>=< <size_in_bytes> - Search for files by size (e.g., /size > 1000000)\n"
        "/image <keyword> - Search for images by keyword\n"
    )

# Function to search inside text files
def search_in_text_file(file_path, keyword):
    with open(file_path, "r", encoding="utf-8") as file:
        content = file.read()
        return keyword.lower() in content.lower()

# Function to search inside PDF files
def search_in_pdf_file(file_path, keyword):
    with open(file_path, "rb") as file:
        reader = PyPDF2.PdfReader(file)
        for page in reader.pages:
            if keyword.lower() in page.extract_text().lower():
                return True
    return False

# Function to search for images by keyword
async def search_images(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id
    if not is_authorized(user_id):
        await update.message.reply_text("You are not authorized to use this bot.")
        return

    search_query = update.message.text
    found_images = []
    for root, dirs, files in os.walk("."):  # Search in the current directory
        for file in files:
            file_path = os.path.join(root, file)
            if file.lower().endswith((".png", ".jpg", ".jpeg", ".gif")) and search_query.lower() in file.lower():
                found_images.append(file_path)

    if found_images:
        for image_path in found_images:
            with open(image_path, "rb") as image:
                await update.message.reply_photo(photo=image)
    else:
        await update.message.reply_text(f"No images found for '{search_query}'.")

# Function to handle file search
async def search_files(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id
    if not is_authorized(user_id):
        await update.message.reply_text("You are not authorized to use this bot.")
        return

    search_query = update.message.text
    found_files = []
    for root, dirs, files in os.walk("."):  # Search in the current directory
        for file in files:
            file_path = os.path.join(root, file)
            if file.lower().endswith(".txt") and search_in_text_file(file_path, search_query):
                found_files.append(file_path)
            elif file.lower().endswith(".pdf") and search_in_pdf_file(file_path, search_query):
                found_files.append(file_path)
            elif search_query.lower() in file.lower():  # Search by file name
                found_files.append(file_path)

    if found_files:
        for file_path in found_files:
            with open(file_path, "rb") as file:
                await update.message.reply_document(document=file)
    else:
        await update.message.reply_text(f"No files found for '{search_query}'.")

# Command to search for specific file types
async def search_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id
    if not is_authorized(user_id):
        await update.message.reply_text("You are not authorized to use this bot.")
        return

    args = context.args
    if len(args) < 2:
        await update.message.reply_text("Usage: /search <file_type> <keyword>")
        return

    file_type = args[0].lower()
    keyword = " ".join(args[1:])
    found_files = []

    for root, dirs, files in os.walk("."):  # Search in the current directory
        for file in files:
            file_path = os.path.join(root, file)
            if file.lower().endswith(f".{file_type}"):
                if file_type == "txt" and search_in_text_file(file_path, keyword):
                    found_files.append(file_path)
                elif file_type == "pdf" and search_in_pdf_file(file_path, keyword):
                    found_files.append(file_path)

    if found_files:
        for file_path in found_files:
            with open(file_path, "rb") as file:
                await update.message.reply_document(document=file)
    else:
        await update.message.reply_text(f"No {file_type} files found for '{keyword}'.")

# Command to search for files by date
async def search_by_date(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id
    if not is_authorized(user_id):
        await update.message.reply_text("You are not authorized to use this bot.")
        return

    args = context.args
    if len(args) < 1:
        await update.message.reply_text("Usage: /date <YYYY-MM-DD>")
        return

    try:
        target_date = datetime.datetime.strptime(args[0], "%Y-%m-%d").date()
    except ValueError:
        await update.message.reply_text("Invalid date format. Use YYYY-MM-DD.")
        return

    found_files = []
    for root, dirs, files in os.walk("."):  # Search in the current directory
        for file in files:
            file_path = os.path.join(root, file)
            file_mod_time = datetime.datetime.fromtimestamp(os.path.getmtime(file_path)).date()
            if file_mod_time == target_date:
                found_files.append(file_path)

    if found_files:
        for file_path in found_files:
            with open(file_path, "rb") as file:
                await update.message.reply_document(document=file)
    else:
        await update.message.reply_text(f"No files found for date '{args[0]}'.")

# Command to search for files by size
async def search_by_size(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id
    if not is_authorized(user_id):
        await update.message.reply_text("You are not authorized to use this bot.")
        return

    args = context.args
    if len(args) < 2:
        await update.message.reply_text("Usage: /size <>=< <size_in_bytes>")
        return

    operator = args[0]
    try:
        target_size = int(args[1])
    except ValueError:
        await update.message.reply_text("Invalid size. Use a number.")
        return

    found_files = []
    for root, dirs, files in os.walk("."):  # Search in the current directory
        for file in files:
            file_path = os.path.join(root, file)
            file_size = os.path.getsize(file_path)
            if (operator == ">" and file_size > target_size) or \
               (operator == "<" and file_size < target_size) or \
               (operator == "=" and file_size == target_size):
                found_files.append(file_path)

    if found_files:
        for file_path in found_files:
            with open(file_path, "rb") as file:
                await update.message.reply_document(document=file)
    else:
        await update.message.reply_text(f"No files found for size {operator} {target_size} bytes.")

# Main function to run the bot
def main():
    # Create the Application
    application = Application.builder().token(BOT_TOKEN).build()

    # Add handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help))
    application.add_handler(CommandHandler("search", search_command))
    application.add_handler(CommandHandler("date", search_by_date))
    application.add_handler(CommandHandler("size", search_by_size))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, search_files))
    application.add_handler(CommandHandler("image", search_images))

    # Confirmation message
    print("Bot is running! Press Ctrl+C to stop.")

    # Start the bot
    application.run_polling()

if __name__ == "__main__":
    main()
