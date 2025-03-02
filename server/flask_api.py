from flask import Flask, request, jsonify
import cv2
import numpy as np

app = Flask(__name__)

def process_image(image_path):
    # Example: Load image and extract features
    image = cv2.imread(image_path)
    # Perform some processing (e.g., feature extraction)
    features = np.random.rand(128).tolist()  # Dummy feature vector
    return features

@app.route('/process', methods=['POST'])
def process():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400

    image_file = request.files['image']
    image_path = f"uploads/{image_file.filename}"
    image_file.save(image_path)

    features = process_image(image_path)
    return jsonify({'features': features})

if __name__ == "__main__":
    app.run(port=5000)