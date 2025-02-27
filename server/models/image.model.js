const client = require("../config/weaviate");

const createSchema = async () => {
  const schema = {
    class: "Image",
    description: "A class to store image data",
    properties: [
      {
        name: "filename",
        dataType: ["string"],
        description: "Name of the image file",
      },
      {
        name: "filepath",
        dataType: ["string"],
        description: "Path to the image file in Google Drive/Dropbox",
      },
      {
        name: "vector",
        dataType: ["number[]"],
        description: "Vector representation of the image",
      },
    ],
  };

  await client.schema.classCreator().withClass(schema).do();
};

const addImage = async (imageData) => {
  return client.data.creator()
    .withClassName("Image")
    .withProperties(imageData)
    .do();
};

const searchImages = async (vector, limit = 5) => {
  return client.graphql.get()
    .withClassName("Image")
    .withFields("filename filepath")
    .withNearVector({ vector })
    .withLimit(limit)
    .do();
};

module.exports = { createSchema, addImage, searchImages };