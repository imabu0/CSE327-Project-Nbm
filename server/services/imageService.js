const tf = require("@tensorflow/tfjs-node");
const mobilenet = require("@tensorflow-models/mobilenet");
const sharp = require("sharp");

let model;

const loadModel = async () => {
  model = await mobilenet.load();
};

const extractImageVector = async (imagePath) => {
  const imageBuffer = await sharp(imagePath).resize(224, 224).toBuffer();
  const imageTensor = tf.node.decodeImage(imageBuffer, 3);
  const normalizedImage = imageTensor.div(tf.scalar(255)).expandDims();

  const activation = model.infer(normalizedImage, true);
  const vector = activation.arraySync()[0];

  imageTensor.dispose();
  normalizedImage.dispose();

  return vector;
};

module.exports = { loadModel, extractImageVector };