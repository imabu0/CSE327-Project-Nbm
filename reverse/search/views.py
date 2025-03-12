import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from PIL import Image as PILImage
import numpy as np
import os
from scipy.spatial.distance import cosine
from tensorflow.keras.applications import MobileNet
from tensorflow.keras.applications.mobilenet import preprocess_input
from tensorflow.keras.preprocessing import image as keras_image  # Renamed to avoid conflict

logger = logging.getLogger(__name__)

# Load pre-trained MobileNet model
model = MobileNet(weights='imagenet', include_top=False, pooling='avg')

# Function to extract features from an image
def extract_features(image_path):
    img = keras_image.load_img(image_path, target_size=(224, 224))  # Use the renamed module
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
for image_data in PREDEFINED_IMAGES:
    image_path = os.path.join(settings.MEDIA_ROOT, 'images', image_data['name'])
    image_data['features'] = extract_features(image_path)

@csrf_exempt
def search(request):
    try:
        if request.method == 'POST' and request.FILES.get('image'):
            # Log the uploaded file
            uploaded_file = request.FILES['image']
            logger.info(f'Uploaded file: {uploaded_file.name}')

            # Save the uploaded file
            upload_path = os.path.join(settings.MEDIA_ROOT, 'uploads', uploaded_file.name)
            os.makedirs(os.path.dirname(upload_path), exist_ok=True)  # Create the uploads folder if it doesn't exist
            with open(upload_path, 'wb+') as destination:
                for chunk in uploaded_file.chunks():
                    destination.write(chunk)
            logger.info(f'File saved to: {upload_path}')

            # Extract features for the uploaded image
            query_features = extract_features(upload_path)
            logger.info(f'Extracted features for: {uploaded_file.name}')

            # Find similar images by comparing features
            similar_images = []
            for image_data in PREDEFINED_IMAGES:
                similarity = 1 - cosine(query_features, image_data['features'])  # Cosine similarity
                if similarity >= 0.50:  # Only include images with similarity >= 0.50
                    similar_images.append({
                        'id': image_data['id'],
                        'name': image_data['name'],
                        'url': image_data['url'],
                        'similarity': float(similarity)  # Convert to native Python float
                    })

            # Sort by similarity (descending)
            similar_images.sort(key=lambda x: x['similarity'], reverse=True)

            # Clean up the uploaded file
            os.remove(upload_path)
            logger.info(f'File cleaned up: {upload_path}')

            # Return similar images with similarity >= 0.70
            return JsonResponse({'similarImages': similar_images})
        return JsonResponse({'error': 'Invalid request'}, status=400)
    except Exception as e:
        logger.error(f'Error in search view: {str(e)}')
        return JsonResponse({'error': 'Internal server error'}, status=500)