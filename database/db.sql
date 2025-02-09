-- create user_info table
CREATE TABLE user_info (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(50),
    username VARCHAR(50),
    password VARCHAR(50)
);

-- dummy values for user_info table
INSERT INTO user_info (name, username, password) VALUES
('John Doe', 'johndoe', 'password123'),
('Jane Smith', 'janesmith', 'securepass456');

-- store linked buckets info
CREATE TABLE google_accounts (
  id SERIAL PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL UNIQUE,
  expiry_date BIGINT NOT NULL
);
