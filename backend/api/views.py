from django.shortcuts import render

# Create your views here.
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import json

import cv2
import mediapipe as mp
from rest_framework.decorators import api_view
from rest_framework.response import Response
import base64
import numpy as np

@csrf_exempt  # for dev only; better to configure proper CSRF later
def register_api(request):
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        return JsonResponse({'detail': 'Invalid JSON'}, status=400)

    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        return JsonResponse({'detail': 'Missing fields'}, status=400)

    if User.objects.filter(username=username).exists():
        return JsonResponse({'detail': 'Username already taken'}, status=400)

    user = User.objects.create_user(username=username, email=email, password=password)
    return JsonResponse({'id': user.id, 'username': user.username, 'email': user.email}, status=201)

# Initialize MediaPipe
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(static_image_mode=False, max_num_hands=2)

@csrf_exempt
def register_api(request):
    if request.method != 'POST':
        return JsonResponse({'detail': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        return JsonResponse({'detail': 'Invalid JSON'}, status=400)

    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        return JsonResponse({'detail': 'Missing fields'}, status=400)

    if User.objects.filter(username=username).exists():
        return JsonResponse({'detail': 'Username already taken'}, status=400)

    user = User.objects.create_user(username=username, email=email, password=password)
    return JsonResponse({'id': user.id, 'username': user.username, 'email': user.email}, status=201)


# Add this new view for hand tracking
@api_view(['POST'])
def track_hands(request):
    try:
        # Get base64 image from frontend
        image_data = request.data.get('image')
        
        if not image_data:
            return Response({'error': 'No image data provided'}, status=400)
        
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
    
    except Exception as e:
        return Response({'error': str(e)}, status=500)