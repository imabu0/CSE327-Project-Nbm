const {
  registerUser,
  loginUser,
  generateOTP,
  verifyOTP,
  getUserOtp,
} = require("./models/auth.model.js");
const authRoutes = require("./routes/authRoutes.js");
const userRoutes = require("./routes/userRoutes.js");
const googleRoutes = require("./routes/googleRoutes.js");
const dropboxRoutes = require("./routes/dropboxRoutes.js");
const fileRoutes = require("./routes/fileRoutes.js");
const protectRoute = require("./middlewares/authMiddleware.js");

// **Express Routes**
const express = require("express");
const app = express();
const cors = require("cors");
const session = require("express-session");

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://10.0.2.2:8000",
      "http://192.168.204.153:8000",
    ],
    credentials: true,
  })
); // **CORS**
app.use(express.json({ limit: "1000mb" })); // Allow up to 50MB JSON payloads
app.use(express.urlencoded({ limit: "1000mb", extended: true }));
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

app.post("/api/register", registerUser); // **Route for Registration**
app.post("/api/login", loginUser); // **Route for Login**
app.post("/api/generateOTP", generateOTP); // **Route for Login**
app.post("/api/verifyOTP", verifyOTP); // **Route for Login**
app.post("/api/otp", protectRoute, getUserOtp); // **Route for OTP**
app.use("/api", userRoutes); // **User Info**
app.use("/google", googleRoutes); // **Google Routes**
app.use("/dropbox", dropboxRoutes); // **Dropbox Routes**
app.use("/file", fileRoutes); // **File Routes**

// **Start Server**
const PORT = process.env.PORT;
app.listen(PORT, () => console.log(` - Server running on port ${PORT}`)); // **Server Listening**
