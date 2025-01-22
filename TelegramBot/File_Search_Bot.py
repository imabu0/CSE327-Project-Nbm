import os
from telegram import Update
from telegram.ext import Updater, CommandHandler, MessageHandler, Filters, CallbackContext
from PIL import Image

# Replace 'YOUR_API_TOKEN' with your actual bot API token from BotFather
API_TOKEN = '7740291794:AAFTWfcyemTfyA7RPsDaoXSvHI6aagHywAg'

# Define the directory where files are stored
FILES_DIRECTORY = './files'

# Function to start the bot
def start(update: Update, context: CallbackContext):
    update.message.reply_text(
        "Welcome! 📂 Send a word to search files by name or send an image to search for similar files."
    )

# Function to handle file search by word
def search_files(update: Update, context: CallbackContext):
    query = update.message.text.lower()
    matching_files = []

    # Search for files containing the query in their name
    for root, dirs, files in os.walk(FILES_DIRECTORY):
        for file in files:
            if query in file.lower():
                matching_files.append(os.path.join(root, file))

    if matching_files:
        update.message.reply_text(f"Found {len(matching_files)} matching file(s):")
        for file_path in matching_files:
            update.message.reply_document(document=open(file_path, 'rb'))
    else:
        update.message.reply_text("No files found matching your query. Try again.")

# Function to handle image-based search
def handle_image(update: Update, context: CallbackContext):
    photo = update.message.photo[-1].get_file()
    photo_path = 'query_image.jpg'
    photo.download(photo_path)

    query_image = Image.open(photo_path)
    matching_files = []

    # Compare the query image with images in the files directory
    for root, dirs, files in os.walk(FILES_DIRECTORY):
        for file in files:
            if file.endswith(('.jpg', '.png', '.jpeg')):
                try:
                    current_image = Image.open(os.path.join(root, file))
                    if query_image.size == current_image.size:  # Simple size comparison
                        matching_files.append(os.path.join(root, file))
                except Exception as e:
                    print(f"Error comparing images: {e}")

    if matching_files:
        update.message.reply_text(f"Found {len(matching_files)} matching image(s):")
        for file_path in matching_files:
            update.message.reply_photo(photo=open(file_path, 'rb'))
    else:
        update.message.reply_text("No matching images found.")

# Main function to run the bot
def main():
    # Set up the updater and dispatcher
    updater = Updater(API_TOKEN)
    dispatcher = updater.dispatcher

    # Add command and message handlers
    dispatcher.add_handler(CommandHandler('start', start))
    dispatcher.add_handler(MessageHandler(Filters.text & ~Filters.command, search_files))
    dispatcher.add_handler(MessageHandler(Filters.photo, handle_image))

    # Start the bot
    updater.start_polling()
    print("Bot is running... Press Ctrl+C to stop.")
    updater.idle()

# Run the bot
if __name__ == '__main__':
    main()
