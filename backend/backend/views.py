# views.py
import cv2
import mediapipe as mp
from rest_framework.decorators import api_view
from rest_framework.response import Response
import base64
import numpy as np

mp_hands = mp.solutions.hands
hands = mp_hands.Hands(static_image_mode=False, max_num_hands=2)

@api_view(['POST'])
def track_hands(request):
    # Get base64 image from frontend
    image_data = request.data.get('image')
    
    # Decode image
    img_bytes = base64.b64decode(image_data.split(',')[1])
    nparr = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Process with MediaPipe
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = hands.process(rgb_frame)
    
    hand_data = []
    if results.multi_hand_landmarks:
        for hand_landmarks in results.multi_hand_landmarks:
            landmarks = []
            for landmark in hand_landmarks.landmark:
                landmarks.append({
                    'x': landmark.x,
                    'y': landmark.y,
                    'z': landmark.z
                })
            hand_data.append(landmarks)
    
    return Response({'hands': hand_data})