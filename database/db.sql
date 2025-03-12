-- create user_info table
CREATE TABLE user_info (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  password varchar(255) NOT NULL,
  role varchar(255) NOT NULL
);

-- store linked google account info
CREATE TABLE google_accounts (
  id SERIAL PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL UNIQUE,
  expiry_date BIGINT NOT NULL
);

-- store linked dropbox account info
CREATE TABLE dropbox_accounts (
  id SERIAL PRIMARY KEY,               -- Unique identifier for each record
  access_token VARCHAR(5000) NOT NULL,  -- Column to store the access token
  refresh_token VARCHAR(5000) UNIQUE NOT NULL, -- Column to store the refresh token, must be unique
	expiry_date VARCHAR(5000)
);

-- Table to store file metadata
CREATE TABLE file_info (
    id SERIAL PRIMARY KEY,          -- Unique identifier for the file
    title VARCHAR(255) NOT NULL,    -- Name of the file (e.g., "my_document")
    fileExtension VARCHAR(50),      -- File extension (e.g., "pdf", "jpg")
    size BIGINT NOT NULL,           -- Size of the file in bytes
    created_at DATE DEFAULT CURRENT_DATE -- Store only the date (year, month, day)
);

-- Table to store chunk IDs associated with each file
CREATE TABLE chunk_id (
    id SERIAL PRIMARY KEY,          -- Unique identifier for the chunk entry
    file_id INT REFERENCES file_info(id) ON DELETE CASCADE, -- Foreign key to file_info
    chunk_id VARCHAR(255) NOT NULL,  -- Chunk ID (e.g., from Google Drive or Dropbox)
    type VARCHAR(50) NOT NULL       -- Type of storage (e.g., "google" or "dropbox")
);
