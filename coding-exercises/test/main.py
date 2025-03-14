import os
import logging
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from telegram import Update
from telegram.ext import Updater, CommandHandler, MessageHandler, Filters, CallbackContext

# Set up logging
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                    level=logging.INFO)
logger = logging.getLogger(__name__)

# Google Drive API Setup
SCOPES = ['https://www.googleapis.com/auth/drive.file']
creds = None

# If modifying your token.json or credentials.json, remove the file before proceeding
def authenticate_google_drive():
    global creds
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        # Save the credentials for future use
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    drive_service = build('drive', 'v3', credentials=creds)
    return drive_service

# Upload file to Google Drive
def upload_file_to_drive(file_path):
    drive_service = authenticate_google_drive()
    file_metadata = {'name': os.path.basename(file_path)}
    media = MediaFileUpload(file_path, mimetype='application/octet-stream')
    file = drive_service.files().create(body=file_metadata, media_body=media, fields='id').execute()
    return file.get('id')

# Command handler for /start
def start(update: Update, context: CallbackContext):
    update.message.reply_text('Hello! Send me a file and I will upload it to Google Drive.')

# File handler
def handle_file(update: Update, context: CallbackContext):
    file = update.message.document
    file_name = file.file_name
    file_id = file.file_id

    # Download the file to local storage
    new_file = update.message.bot.get_file(file_id)
    file_path = f'./{file_name}'
    new_file.download(file_path)

    # Upload the file to Google Drive
    try:
        file_drive_id = upload_file_to_drive(file_path)
        update.message.reply_text(f"File uploaded successfully to Google Drive with file ID: {file_drive_id}")
    except Exception as e:
        update.message.reply_text(f"An error occurred: {e}")
    finally:
        os.remove(file_path)  # Clean up the local file

# Main function to run the bot
def main():
    # Telegram Bot setup
    TOKEN = '5923299387: AAEW[wwx90ZXmeyg3t5iU3Wim_63cj8XXX0' 
    updater = Updater(TOKEN, use_context=True)
    dispatcher = updater.dispatcher

    # Add command and message handlers
    dispatcher.add_handler(CommandHandler('start', start))
    dispatcher.add_handler(MessageHandler(Filters.document, handle_file))

    # Start the bot
    updater.start_polling()
    updater.idle()

if __name__ == '__main__':
    main()
