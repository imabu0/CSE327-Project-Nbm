require('dotenv').config();
const express = require('express');
const cors = require('cors');
const imagesRouter = require('./routes/imageRoutes.js');

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/images', imagesRouter);

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});