const { registerUser, loginUser } = require("./models/auth.model.js");
const userRoutes = require("./routes/userRoutes.js");
const googleRoutes = require("./routes/googleRoutes.js");
const dropboxRoutes = require("./routes/dropboxRoutes.js");
const fileRoutes = require("./routes/fileRoutes.js")

// **Express Routes**
const express = require("express");
const app = express();
const cors = require("cors");
const session = require("express-session");

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

app.post("/api/register", registerUser); // **Route for Registration**
app.post("/api/login", loginUser); // **Route for Login**
app.use("/api", userRoutes); // **User Info**
app.use("/google", googleRoutes); // **Google Routes**
app.use("/dropbox", dropboxRoutes); // **Dropbox Routes**
app.use("/file", fileRoutes); // **File Routes**

// **Start Server**
const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
