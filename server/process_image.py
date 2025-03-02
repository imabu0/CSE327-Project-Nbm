import sys
import cv2
import numpy as np
import json

def process_image(image_path):
    # Example: Load image and extract features
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("Could not load image")

    # Perform some processing (e.g., feature extraction)
    features = np.random.rand(128).tolist()  # Dummy feature vector
    return features

if __name__ == "__main__":
    try:
        image_path = sys.argv[1]
        features = process_image(image_path)
        print(json.dumps(features))  # Output the features as JSON
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)