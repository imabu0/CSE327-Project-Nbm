const { pool } = require("../config/db.js");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt"); // Import bcrypt for password hashing

const SECRET_KEY = process.env.JWT_SECRET;

// Register User
const registerUser = async (req, res) => {
  try {
    const { name, username, password, role } = req.body;

    // Validate input fields
    if (!name || !username || !password || !role) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Hash the password before storing it
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the new user into the database
    const newUser = await pool.query(
      "INSERT INTO user_info (name, username, password, role) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, username, hashedPassword, role]
    );

    // Generate JWT token
    const token = jwt.sign({ id: newUser.rows[0].id, username }, SECRET_KEY, {
      expiresIn: "1h", // Token expires in 1 hour
    });

    // Respond with success message and token
    res.status(201).json({
      message: "User  registered successfully",
      token,
      user: newUser.rows[0],
    });
  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Login User
const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input fields
    if (!username || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Retrieve user from the database
    const user = await pool.query(
      "SELECT * FROM user_info WHERE username = $1",
      [username]
    );

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

const generateOTP = async (req, res) => {
  try {
    const { username } = req.body;

    // Validate input
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    console.log(username + " Hello");
    // Check if user exists
    const user = await pool.query(
      "SELECT * FROM user_info WHERE username = $1",
      [username]
    );
    if (user.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set OTP expiration to 1 minute from now
    const expiresAt = new Date(Date.now() + 1 * 60 * 1000);

    // Store OTP in database
    await pool.query(
      "INSERT INTO user_otps (user_id, otp, expires_at) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET otp = $2, expires_at = $3",
      [user.rows[0].id, otp, expiresAt]
    );

    // In a real application, you would send this OTP via Telegram bot here
    res.status(200).json({
      message: "OTP generated successfully",
      otp: otp, // Remove in production
      expiresAt: expiresAt,
    });
  } catch (error) {
    console.error("OTP Generation Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { username, otp } = req.body;

    // Validate input
    if (!username || !otp) {
      return res.status(400).json({ error: "Username and OTP are required" });
    }

    // Get user
    const user = await pool.query(
      "SELECT * FROM user_info WHERE username = $1",
      [username]
    );
    if (user.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check OTP
    const otpRecord = await pool.query(
      "SELECT * FROM user_otps WHERE user_id = $1 AND otp = $2",
      [user.rows[0].id, otp]
    );

    if (otpRecord.rows.length === 0) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Check if OTP is expired
    if (new Date() > new Date(otpRecord.rows[0].expires_at)) {
      return res.status(400).json({ error: "OTP has expired" });
    }

    const { id, role } = user.rows[0];

    // Generate JWT token
    const token = jwt.sign({ id, username, role }, SECRET_KEY, {
      expiresIn: "12h",
    });

    // Delete the OTP after successful verification
    await pool.query("DELETE FROM user_otps WHERE user_id = $1", [
      user.rows[0].id,
    ]);

    // Respond with success message and token (similar to login response)
    res.status(200).json({
      message: "OTP verified successfully",
      token,
      role,
      user: user.rows[0],
    });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getUserOtp = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming authentication middleware attaches user ID to req

    // Fetch the OTP for the given user
    const otpRecord = await pool.query(
      "SELECT otp, expires_at FROM user_otps WHERE user_id = $1",
      [userId]
    );

    if (otpRecord.rows.length === 0) {
      return res.status(404).json({ error: "No OTP found for this user" });
    }

    res.status(200).json({
      message: "OTP retrieved successfully",
      otp: otpRecord.rows[0].otp,
      expiresAt: otpRecord.rows[0].expires_at,
    });
  } catch (error) {
    console.error("Get OTP Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Export the functions for use in other modules
module.exports = { registerUser, loginUser, generateOTP, verifyOTP, getUserOtp };
