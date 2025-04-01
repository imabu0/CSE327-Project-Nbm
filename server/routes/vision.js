const vision = require('@google-cloud/vision');

// Initialize with API key
const client = new vision.ImageAnnotatorClient({
  apiKey: process.env.GOOGLE_VISION_API_KEY // Add this to your .env
});

async function getImageVector(imageBuffer) {
  try {
    const [result] = await client.imageProperties({
      image: { content: imageBuffer }
    });
    
    if (!result.imagePropertiesAnnotation) {
      throw new Error('No image properties detected');
    }
    
    return result.imagePropertiesAnnotation.dominantColors.colors
      .flatMap(c => [c.color.red, c.color.green, c.color.blue, c.score]);
  } catch (error) {
    console.error('Vision API Error:', error);
    throw new Error('Failed to analyze image');
  }
}

module.exports = { getImageVector };