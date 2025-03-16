const express = require("express");
const {
  registerUser,
  loginUser,
  generateOTP,
  verifyOTP,
} = require("../models/auth.model.js"); // Ensure correct path

const router = express.Router();

// Auth routes
router.post("/register", registerUser); // User Registration
router.post("/login", loginUser); // User Login
router.post("/generateOTP", generateOTP); // Generate OTP for user
router.post("/verifyOTP", verifyOTP); // Verify OTP and log in user

module.exports = router;
