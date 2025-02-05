const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const PptxGenJS = require('pptxgenjs');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Serve static files from the "public" folder
app.use(express.static('public'));

// Handle file uploads
app.post('/upload', upload.single('file'), async (req, res) => {
    const filePath = req.file.path;
    const fileType = req.file.mimetype;

    if (fileType === 'application/pdf') {
        // Handle PDF file
        const pdfDoc = await PDFDocument.load(fs.readFileSync(filePath));
        const pages = pdfDoc.getPages();
        const pageCount = pages.length;
        res.json({ type: 'pdf', pageCount });
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        // Handle PPTX file
        const pptx = new PptxGenJS();
        pptx.load(fs.readFileSync(filePath));
        const slideCount = pptx.slides.length;
        res.json({ type: 'pptx', slideCount });
    } else {
        res.status(400).send('Unsupported file type');
    }
});

// Start the server
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});