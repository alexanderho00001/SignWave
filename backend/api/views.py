from django.shortcuts import render
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import json

# Hand tracking imports
import cv2
import mediapipe as mp
from rest_framework.decorators import api_view
from rest_framework.response import Response
import base64
import numpy as np

# Import the pre-trained model
from .asl_pretrained_model import ASLPretrainedModel

# Initialize MediaPipe
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(static_image_mode=False, max_num_hands=1, min_detection_confidence=0.5)

# Initialize pre-trained model for video sequences
asl_model = ASLPretrainedModel()

# Buffer to store sequences for video recognition
sequence_buffers = {}

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


def recognize_asl_letter(landmarks):
    """
    Simple ASL letter recognition based on hand landmark positions.
    Recognizes static letters: A, B, C, I, L, V, Y
    """
    if not landmarks or len(landmarks) != 21:
        return None
    
    # Get key landmark positions
    thumb_tip = landmarks[4]
    index_tip = landmarks[8]
    middle_tip = landmarks[12]
    ring_tip = landmarks[16]
    pinky_tip = landmarks[20]
    
    wrist = landmarks[0]
    index_mcp = landmarks[5]  # knuckle
    middle_mcp = landmarks[9]
    ring_mcp = landmarks[13]
    pinky_mcp = landmarks[17]
    
    # Helper function to check if finger is extended
    def is_finger_extended(tip, mcp):
        return tip['y'] < mcp['y']  # tip is above knuckle (y-axis is inverted)
    
    # Check which fingers are extended
    thumb_extended = thumb_tip['x'] > index_mcp['x'] + 0.1  # thumb out to side
    index_extended = is_finger_extended(index_tip, index_mcp)
    middle_extended = is_finger_extended(middle_tip, middle_mcp)
    ring_extended = is_finger_extended(ring_tip, ring_mcp)
    pinky_extended = is_finger_extended(pinky_tip, pinky_mcp)
    
    # Simple letter recognition logic
    # A: closed fist with thumb on side
    if not index_extended and not middle_extended and not ring_extended and not pinky_extended:
        if thumb_tip['y'] > index_mcp['y']:
            return 'A'
    
    # B: all fingers extended except thumb
    if index_extended and middle_extended and ring_extended and pinky_extended and not thumb_extended:
        return 'B'
    
    # C: curved hand shape (all fingers slightly bent)
    if not index_extended and not middle_extended and not ring_extended and not pinky_extended:
        if thumb_tip['x'] < index_mcp['x']:
            return 'C'
    
    # V: index and middle extended, others closed
    if index_extended and middle_extended and not ring_extended and not pinky_extended:
        finger_spread = abs(index_tip['x'] - middle_tip['x'])
        if finger_spread > 0.05:
            return 'V'
    
    # L: index extended, thumb out to side
    if index_extended and not middle_extended and not ring_extended and not pinky_extended and thumb_extended:
        return 'L'
    
    # Y: thumb and pinky extended
    if thumb_extended and pinky_extended and not index_extended and not middle_extended and not ring_extended:
        return 'Y'
    
    # I: only pinky extended
    if pinky_extended and not index_extended and not middle_extended and not ring_extended:
        return 'I'
    
    return None


@api_view(['POST'])
def track_hands(request):
    """
    Track hands and recognize static ASL letters (A, B, C, I, L, V, Y)
    Used for the practice page
    """
    try:
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
        recognized_letters = []
        
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
                
                # Recognize the letter
                letter = recognize_asl_letter(landmarks)
                if letter:
                    recognized_letters.append(letter)
        
        return Response({
            'hands': hand_data,
            'letters': recognized_letters
        })
    
    except Exception as e:
        import traceback
        print(f"Error in track_hands: {str(e)}")
        print(traceback.format_exc())
        return Response({'error': str(e)}, status=500)


@api_view(['POST'])
def track_video_sequence(request):
    """
    Track hands in video and recognize signs using pre-trained LSTM
    Used for the recognize page (full words like hello, thanks, iloveyou)
    """
    try:
        session_id = request.data.get('session_id', 'default')
        image_data = request.data.get('image')
        reset = request.data.get('reset', False)
        
        # Reset buffer if requested
        if reset:
            if session_id in sequence_buffers:
                sequence_buffers[session_id] = []
            return Response({'message': 'Buffer reset'})
        
        if not image_data:
            return Response({'error': 'No image data provided'}, status=400)
        
        # Initialize buffer if doesn't exist
        if session_id not in sequence_buffers:
            sequence_buffers[session_id] = []
        
        # Decode image
        img_bytes = base64.b64decode(image_data.split(',')[1])
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Process with MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands.process(rgb_frame)
        
        predicted_sign = None
        confidence = 0
        
        if results.multi_hand_landmarks:
            # Get first hand landmarks
            landmarks = []
            for landmark in results.multi_hand_landmarks[0].landmark:
                landmarks.append({
                    'x': landmark.x,
                    'y': landmark.y,
                    'z': landmark.z
                })
            
            # Add to sequence buffer
            sequence_buffers[session_id].append(landmarks)
            
            # Keep buffer at max length (30 frames)
            max_length = 30
            if len(sequence_buffers[session_id]) > max_length:
                sequence_buffers[session_id].pop(0)
            
            # Try to recognize sign if we have enough frames
            if len(sequence_buffers[session_id]) >= 20:
                predicted_sign, confidence = asl_model.predict(sequence_buffers[session_id])
            
            return Response({
                'landmarks': landmarks,
                'buffer_length': len(sequence_buffers[session_id]),
                'predicted_sign': predicted_sign,
                'confidence': round(confidence * 100, 2) if confidence else 0,
                'model_loaded': asl_model.model is not None
            })
        else:
            # No hand detected
            return Response({
                'landmarks': None,
                'buffer_length': len(sequence_buffers[session_id]),
                'predicted_sign': None,
                'confidence': 0,
                'message': 'No hand detected',
                'model_loaded': asl_model.model is not None
            })
        
    except Exception as e:
        import traceback
        print(f"Error in track_video_sequence: {str(e)}")
        print(traceback.format_exc())
        return Response({
            'error': str(e),
            'traceback': traceback.format_exc()
        }, status=500)


@api_view(['GET'])
def get_available_signs(request):
    """
    Get list of signs the model can recognize
    """
    return Response({
        'signs': asl_model.actions if asl_model.model else [],
        'model_loaded': asl_model.model is not None,
        'model_path': asl_model.model_path
    })


@api_view(['GET'])
def check_model_status(request):
    """
    Check if model is loaded properly
    """
    return Response({
        'model_loaded': asl_model.model is not None,
        'model_path': asl_model.model_path,
        'actions': asl_model.actions,
        'input_shape': str(asl_model.model.input_shape) if asl_model.model else None,
        'output_shape': str(asl_model.model.output_shape) if asl_model.model else None
    })