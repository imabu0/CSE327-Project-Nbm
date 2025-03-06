from flask import Flask, request, jsonify
from flask_cors import CORS  # Import CORS
import os
import numpy as np
from PIL import Image

app = Flask(__name__)
# Allow requests from http://localhost:5173
CORS(app, origins=["http://localhost:5173"])

# Folder containing images
IMAGE_FOLDER = 'images'
app.config['UPLOAD_FOLDER'] = 'uploads'

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Function to compute color histogram
def compute_histogram(image_path):
    img = Image.open(image_path).resize((100, 100))  # Resize for consistency
    img = img.convert('RGB')  # Ensure image is in RGB format
    histogram = np.zeros((256, 256, 256))  # 3D histogram for RGB

    for pixel in img.getdata():
        r, g, b = pixel
        histogram[r][g][b] += 1

    return histogram.flatten()  # Flatten to 1D array

# Function to compute histogram similarity (cosine similarity)
def histogram_similarity(hist1, hist2):
    dot_product = np.dot(hist1, hist2)
    magnitude1 = np.linalg.norm(hist1)
    magnitude2 = np.linalg.norm(hist2)
    return dot_product / (magnitude1 * magnitude2)

# Initialize image database
image_database = []
for idx, filename in enumerate(os.listdir(IMAGE_FOLDER)):
    if filename.endswith(('.jpg', '.jpeg', '.png')):
        image_path = os.path.join(IMAGE_FOLDER, filename)
        histogram = compute_histogram(image_path)
        image_database.append({
            'id': idx + 1,
            'filename': filename,
            'histogram': histogram,
            'url': f'http://localhost:5000/images/{filename}'
        })

# Route to search for similar images
@app.route('/search', methods=['POST'])
def search():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No image selected'}), 400

    # Save the uploaded file
    upload_path = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
    file.save(upload_path)

    # Compute histogram for the uploaded image
    query_histogram = compute_histogram(upload_path)

    # Find similar images
    similar_images = []
    for image in image_database:
        similarity = histogram_similarity(query_histogram, image['histogram'])
        similar_images.append({
            'id': image['id'],
            'filename': image['filename'],
            'url': image['url'],
            'similarity': float(similarity)  # Convert to native Python float
        })

    # Sort by similarity (descending)
    similar_images.sort(key=lambda x: x['similarity'], reverse=True)

    # Clean up the uploaded file
    os.remove(upload_path)

    # Return top 5 similar images
    return jsonify({'similarImages': similar_images[:5]})

# Serve static images
@app.route('/images/<filename>')
def serve_image(filename):
    return app.send_static_file(os.path.join(IMAGE_FOLDER, filename))

if __name__ == '__main__':
    app.run(debug=True)