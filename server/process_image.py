import sys
import cv2
import numpy as np
import json

def extract_features(image_path):
    try:
        # Load the image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError("Could not load image")

        # Resize the image to a fixed size (e.g., 128x128)
        resized_image = cv2.resize(image, (128, 128))

        # Convert the image to grayscale
        gray_image = cv2.cvtColor(resized_image, cv2.COLOR_BGR2GRAY)

        # Flatten the image into a feature vector
        features = gray_image.flatten().tolist()

        return features
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    try:
        image_path = sys.argv[1]
        features = extract_features(image_path)
        print(json.dumps(features))  # Output the features as JSON
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)