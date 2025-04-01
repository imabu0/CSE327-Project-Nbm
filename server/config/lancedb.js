const lancedb = require('vectordb');
const path = require('path');
const db = lancedb.connect(path.join(__dirname, '../../lancedb_data'));

let table;

async function initDB() {
  try {
    table = await db.createTable('images', [{
      id: 'init',
      vector: Array(128).fill(0.1), // Dummy data
      url: 'init.jpg'
    }]);
  } catch {
    table = await db.openTable('images');
  }
  return table;
}

async function searchImages(vector) {
  if (!table) await initDB();
  return table.search(vector).limit(5).execute();
}

async function addImage(vector, url) {
  if (!table) await initDB();
  await table.add([{
    id: Date.now().toString(),
    vector,
    url
  }]);
}

module.exports = { searchImages, addImage };