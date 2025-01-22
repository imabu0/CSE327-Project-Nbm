const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

// Initialize Express App
const app = express();

// Middleware to Parse Form Data
app.use(bodyParser.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/userDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define User Schema
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  dateOfBirth: Date,
});

// Create User Model
const User = mongoose.model('User', userSchema);

// Serve HTML Form
app.get('/', (req, res) => {
  res.send(`
    <h1>User Form</h1>
    <form action="/submit" method="POST">
      <label for="name">Name:</label>
      <input type="text" id="name" name="name" required><br><br>
      <label for="email">Email:</label>
      <input type="email" id="email" name="email" required><br><br>
      <label for="dob">Date of Birth:</label>
      <input type="date" id="dob" name="dateOfBirth" required><br><br>
      <button type="submit">Submit</button>
    </form>
  `);
});

// Handle Form Submission
app.post('/submit', async (req, res) => {
  try {
    const { name, email, dateOfBirth } = req.body;

    // Create and Save New User
    const newUser = new User({ name, email, dateOfBirth });
    await newUser.save();

    res.send(`<h1>Thank you, ${name}! Your data has been saved.</h1>`);
  } catch (error) {
    res.status(500).send('An error occurred while saving your data.');
  }
});

// Start Server
app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
