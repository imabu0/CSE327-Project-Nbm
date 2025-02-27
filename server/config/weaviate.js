const weaviate = require("weaviate-client");

const client = weaviate.client({
  scheme: "http",
  host: "localhost:8080", // Replace with your Weaviate instance URL
});

module.exports = client;