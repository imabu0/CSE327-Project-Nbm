import sys
import json
import os
import numpy as np
from scipy.spatial.distance import cosine
from tensorflow.keras.applications import MobileNet
from tensorflow.keras.applications.mobilenet import preprocess_input
from tensorflow.keras.preprocessing import image as keras_image

# Suppress TensorFlow warnings
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

# Load pre-trained MobileNet model
model = MobileNet(weights="imagenet", include_top=False, pooling="avg")

# Function to extract features from an image
def extract_features(image_path):
    img = keras_image.load_img(image_path, target_size=(224, 224))
    img_data = keras_image.img_to_array(img)
    img_data = np.expand_dims(img_data, axis=0)
    img_data = preprocess_input(img_data)
    features = model.predict(img_data)
    return features.flatten()

# Predefined images with their features
PREDEFINED_IMAGES = [
    {'id': 1, 'name': 'flower1.jpg', 'url': 'http://localhost:8000/media/images/flower1.jpg'},
    {'id': 2, 'name': 'flower2.jpg', 'url': 'http://localhost:8000/media/images/flower2.jpg'},
    {'id': 3, 'name': 'flower3.jpg', 'url': 'http://localhost:8000/media/images/flower3.jpg'},
    {'id': 4, 'name': 'panda1.jpg', 'url': 'http://localhost:8000/media/images/panda1.jpg'},
    {'id': 5, 'name': 'panda2.jpg', 'url': 'http://localhost:8000/media/images/panda2.jpg'},
    {'id': 6, 'name': 'rose1.jpeg', 'url': 'http://localhost:8000/media/images/rose1.jpeg'},
    {'id': 7, 'name': 'rose2.jpg', 'url': 'http://localhost:8000/media/images/rose2.jpg'},
    {'id': 8, 'name': 'rose3.jpeg', 'url': 'http://localhost:8000/media/images/rose3.jpeg'},
    {'id': 9, 'name': 'lilly1.jpg', 'url': 'http://localhost:8000/media/images/lilly1.jpg'},
    {'id': 10, 'name': 'lilly2.webp', 'url': 'http://localhost:8000/media/images/lilly2.webp'},
    {'id': 11, 'name': 'lilly3.jpg', 'url': 'http://localhost:8000/media/images/lilly3.jpg'},
    {'id': 12, 'name': 'ak2.jpg', 'url': 'http://localhost:8000/media/images/ak2.jpg'},
    {'id': 13, 'name': 'ak3.jpeg', 'url': 'http://localhost:8000/media/images/ak3.jpeg'},
]

# Precompute features for predefined images
MEDIA_ROOT = os.path.join(os.path.dirname(__file__), "media", "images")
for image_data in PREDEFINED_IMAGES:
    image_path = os.path.join(MEDIA_ROOT, image_data["name"])
    image_data["features"] = extract_features(image_path)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Invalid arguments"}))
        sys.exit(1)

    uploaded_file_path = sys.argv[1]
    query_features = extract_features(uploaded_file_path)

    similar_images = []
    for image_data in PREDEFINED_IMAGES:
        similarity = 1 - cosine(query_features, image_data["features"])
        if similarity >= 0.50:
            similar_images.append(
                {
                    "id": image_data["id"],
                    "name": image_data["name"],
                    "url": image_data["url"],
                    "similarity": float(similarity),
                }
            )

    similar_images.sort(key=lambda x: x["similarity"], reverse=True)

    # Ensure only JSON is printed
    print(json.dumps(similar_images))