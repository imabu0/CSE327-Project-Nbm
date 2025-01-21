import os
from telegram import Update
from telegram.ext import Updater, CommandHandler, MessageHandler, Filters, CallbackContext

# Directory to search files (change to the desired directory)
SEARCH_DIRECTORY = "./files"  # Ensure this folder exists and contains test files

# Start command handler
def start(update: Update, context: CallbackContext):
    update.message.reply_text(
        "Hello! I'm your File Search Bot. Send me a keyword, and I'll find files matching your request."
    )

# Help command handler
def help_command(update: Update, context: CallbackContext):
    update.message.reply_text(
        "Send me a keyword, and I'll search for files containing that keyword in their names."
    )

# Search files based on user input
def search_files(update: Update, context: CallbackContext):
    query = update.message.text.strip()
    
    if not query:
        update.message.reply_text("Please provide a keyword to search.")
        return

    # Search for files in the directory
    matching_files = [
        f for f in os.listdir(SEARCH_DIRECTORY)
        if query.lower() in f.lower()
    ]

    if matching_files:
        response = "Here are the files I found:\n" + "\n".join(matching_files)
    else:
        response = "No files found matching your keyword."

    update.message.reply_text(response)

# Main function to run the bot
def main():
    # Replace 'YOUR_API_TOKEN' with your Telegram Bot API token
    API_TOKEN = "YOUR_API_TOKEN"

    # Create the Updater and pass it your bot's token
    updater = Updater(API_TOKEN, use_context=True)

    # Get the dispatcher to register handlers
    dp = updater.dispatcher

    # Register handlers
    dp.add_handler(CommandHandler("start", start))
    dp.add_handler(CommandHandler("help", help_command))
    dp.add_handler(MessageHandler(Filters.text & ~Filters.command, search_files))

    # Start the Bot
    updater.start_polling()
    updater.idle()

if __name__ == "__main__":
    main()
