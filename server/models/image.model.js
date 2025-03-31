const { ImageAnnotatorClient } = require('@google-cloud/vision');
const visionClient = new ImageAnnotatorClient();

// 1. Extract Visual Features from Uploaded Image
async function getImageFeatures(imageBuffer) {
  const [result] = await visionClient.imageProperties({
    image: { content: imageBuffer }
  });
  
  // Get dominant colors and their scores
  const colors = result.imagePropertiesAnnotation.dominantColors.colors;
  
  // Get other features you might want
  const [webDetection] = await visionClient.webDetection({
    image: { content: imageBuffer }
  });
  
  return {
    colors: colors.map(c => ({
      rgb: [c.color.red, c.color.green, c.color.blue],
      score: c.score
    })),
    webEntities: webDetection.webDetection?.webEntities || []
  };
}

// 2. Find Similar Images in PostgreSQL
async function findSimilarImages(features) {
  const { colors, webEntities } = features;
  
  // Build a query that matches similar color profiles
  const colorQuery = colors
    .map((c, i) => 
      `embedding->'colors'->${i}->>'score' > ${c.score * 0.8}`)
    .join(' OR ');
  
  // Search for images with similar web entities
  const entityQuery = webEntities
    .map(e => 
      `embedding->'webEntities' @> '[{"description": "${e.description}"}]'`)
    .join(' OR ');
  
  const query = `
    SELECT file_id, storage_type, thumbnail_url,
      SIMILARITY(
        embedding->'colors', 
        '${JSON.stringify(colors)}'::jsonb
      ) as score
    FROM image_embeddings
    WHERE ${colorQuery} OR ${entityQuery}
    ORDER BY score DESC
    LIMIT 10
  `;
  
  const { rows } = await pool.query(query);
  return rows;
}

module.exports = { getImageFeatures, findSimilarImages };