-- create user_info table
CREATE TABLE users (
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
