import os
import sys
import json
import numpy as np
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.preprocessing import image
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from scipy.spatial.distance import cosine
import warnings

# Suppress all warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
warnings.filterwarnings('ignore')

# Redirect stdout to stderr to avoid progress messages in output
sys.stdout = sys.stderr

# Load model (pre-download weights first)
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'mobilenet.h5')

if os.path.exists(MODEL_PATH):
    from tensorflow.keras.models import load_model
    model = load_model(MODEL_PATH)
else:
    model = MobileNetV2(weights='imagenet', include_top=False, pooling='avg')
    model.save(MODEL_PATH)

def extract_features(img_path):
    img = image.load_img(img_path, target_size=(224, 224))
    x = image.img_to_array(img)
    x = np.expand_dims(x, axis=0)
    x = preprocess_input(x)
    return model.predict(x).flatten()

def main():
    try:
        # Configure paths
        IMAGE_DIR = os.path.abspath(os.path.join(
            os.path.dirname(__file__), 
            '..', 
            'public', 
            'similarity_images'
        ))
        
        if not os.path.exists(IMAGE_DIR):
            raise FileNotFoundError(f"Image directory not found: {IMAGE_DIR}")
        
        # Load or create features
        features_file = os.path.join(IMAGE_DIR, 'features.json')
        
        if os.path.exists(features_file):
            with open(features_file) as f:
                precomputed = json.load(f)
        else:
            precomputed = {}
            for img_file in os.listdir(IMAGE_DIR):
                if img_file.lower().endswith(('.png', '.jpg', '.jpeg')):
                    try:
                        img_path = os.path.join(IMAGE_DIR, img_file)
                        precomputed[img_file] = {
                            'path': f'/similarity_images/{img_file}',
                            'features': extract_features(img_path).tolist()
                        }
                    except Exception as e:
                        print(f"Error processing {img_file}: {e}", file=sys.stderr)
            
            with open(features_file, 'w') as f:
                json.dump(precomputed, f)
        
        # Process query
        query_path = sys.argv[1]
        query_features = extract_features(query_path)
        
        results = []
        for name, data in precomputed.items():
            similarity = 1 - cosine(query_features, np.array(data['features']))
            if similarity > 0.5:
                results.append({
                    'image': data['path'],
                    'score': float(similarity),
                    'name': name
                })
        
        print(json.dumps({
            'success': True,
            'results': sorted(results, key=lambda x: x['score'], reverse=True)
        }))
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()