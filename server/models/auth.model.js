const { pool } = require("../config/db.js")
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt"); // Import bcrypt for password hashing

const SECRET_KEY = process.env.JWT_SECRET;

// Register User
const registerUser  = async (req, res) => {
  try {
    const { name, username, password, role } = req.body;

    // Validate input fields
    if (!name || !username || !password || !role) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Hash the password before storing it
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the new user into the database
    const newUser  = await pool.query(
      "INSERT INTO user_info (name, username, password, role) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, username, hashedPassword, role]
    );

    // Generate JWT token
    const token = jwt.sign({ id: newUser .rows[0].id, username }, SECRET_KEY, {
      expiresIn: "1h", // Token expires in 1 hour
    });

    // Respond with success message and token
    res.status(201).json({
      message: "User  registered successfully",
      token,
      user: newUser .rows[0],
    });
  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Login User
const loginUser  = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input fields
    if (!username || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Retrieve user from the database
    const user = await pool.query("SELECT * FROM user_info WHERE username = $1", [
      username,
    ]);

    // Check if user exists
    if (user.rows.length === 0) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Compare provided password with the hashed password in the database
    const isMatch = await bcrypt.compare(password, user.rows[0].password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const { id, role } = user.rows[0];

    // Generate JWT token including role
    const token = jwt.sign({ id, username, role }, SECRET_KEY, {
      expiresIn: "12h", // Token expires in 12 hour
    });

    // Respond with success message and token
    res.status(200).json({
      message: "Login successful",
      token,
      role,
      user: user.rows[0],
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Export the functions for use in other modules
module.exports = { registerUser , loginUser  };