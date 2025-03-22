-- Create user_info table
CREATE TABLE user_info (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL
);

-- Store linked Google account info with a foreign key to user_info
CREATE TABLE google_accounts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES user_info(id) ON DELETE CASCADE, -- Foreign key to user_info
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL UNIQUE,
  expiry_date BIGINT NOT NULL
);

-- Store linked Dropbox account info with a foreign key to user_info
CREATE TABLE dropbox_accounts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES user_info(id) ON DELETE CASCADE, -- Foreign key to user_info
  access_token VARCHAR(5000) NOT NULL,
  refresh_token VARCHAR(5000) UNIQUE NOT NULL,
  expiry_date VARCHAR(5000)
);

-- Table to store file metadata with a foreign key to user_info
CREATE TABLE file_info (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES user_info(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  fileExtension VARCHAR(50),
  size BIGINT NOT NULL,
  created_at DATE DEFAULT CURRENT_DATE
);

-- Table to store chunk IDs associated with each file
CREATE TABLE chunk_id (
    id SERIAL PRIMARY KEY,          -- Unique identifier for the chunk entry
    file_id INT REFERENCES file_info(id) ON DELETE CASCADE, -- Foreign key to file_info
    chunk_id VARCHAR(255) NOT NULL,  -- Chunk ID (e.g., from Google Drive or Dropbox)
    type VARCHAR(50) NOT NULL       -- Type of storage (e.g., "google" or "dropbox")
);

CREATE TABLE user_otps (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    otp VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user
        FOREIGN KEY (user_id)
        REFERENCES user_info(id)
        ON DELETE CASCADE,
    CONSTRAINT unique_user_otp
        UNIQUE (user_id),
    CONSTRAINT otp_length_check
        CHECK (LENGTH(otp) = 6)
);