from django.shortcuts import render, get_object_or_404
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login
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
import math

# Import the pre-trained model
from .asl_pretrained_model import ASLPretrainedModel

# Import progress models (if they exist)
try:
    from progress.models import Lesson, UserProgress
    HAS_PROGRESS = True
except ImportError:
    HAS_PROGRESS = False

# Initialize MediaPipe
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(static_image_mode=False, max_num_hands=2, min_detection_confidence=0.5)

# Initialize pre-trained model for video sequences
asl_model = ASLPretrainedModel()

# Buffer to store sequences for video recognition
sequence_buffers = {}

def get_distance(p1, p2):
    """Calculate 2D Euclidean distance between two landmark points"""
    return math.hypot(p1['x'] - p2['x'], p1['y'] - p2['y'])

def normalize_hand_rotation(landmarks):
    """
    Rotates all landmarks so the palm is "upright" (wrist-to-MCP vector points up).
    This makes logic for horizontal signs (G, H) possible.
    """
    wrist = landmarks[0]
    middle_mcp = landmarks[9]

    # 1. Calculate the palm vector
    palm_vec_x = middle_mcp['x'] - wrist['x']
    palm_vec_y = middle_mcp['y'] - wrist['y']
    
    # 2. Calculate the angle of this vector
    # We want to rotate it to match the "up" vector (0, -1)
    current_angle = math.atan2(palm_vec_y, palm_vec_x)
    target_angle = -math.pi / 2  # Angle for (0, -1)
    
    rotation_angle = target_angle - current_angle
    cos_theta = math.cos(rotation_angle)
    sin_theta = math.sin(rotation_angle)
    
    # 3. Apply the rotation to all landmarks, pivoting around the wrist
    origin_x, origin_y = wrist['x'], wrist['y']
    rotated_landmarks = []
    
    for lm in landmarks:
        # Translate point to origin
        translated_x = lm['x'] - origin_x
        translated_y = lm['y'] - origin_y
        
        # Rotate point
        rotated_x = translated_x * cos_theta - translated_y * sin_theta
        rotated_y = translated_x * sin_theta + translated_y * cos_theta
        
        # Translate point back
        new_x = rotated_x + origin_x
        new_y = rotated_y + origin_y
        
        rotated_landmarks.append({'x': new_x, 'y': new_y, 'z': lm['z']})
        
    return rotated_landmarks

# ---------- Authentication APIs ----------

@csrf_exempt
def register_api(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)

    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    if not username or not email or not password:
        return JsonResponse({"detail": "Missing fields"}, status=400)

    if User.objects.filter(username=username).exists():
        return JsonResponse({"detail": "Username already taken"}, status=400)

    user = User.objects.create_user(username=username, email=email, password=password)
    return JsonResponse(
        {"id": user.id, "username": user.username, "email": user.email},
        status=201,
    )


@csrf_exempt
def login_api(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)

    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return JsonResponse({"detail": "Missing credentials"}, status=400)

    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({"detail": "Invalid username or password"}, status=400)

    # create session cookie
    login(request, user)
    return JsonResponse({"detail": "Logged in", "username": user.username})


# ---------- ASL Recognition Functions ----------

def recognize_asl_letter(landmarks):
    """
    Improved ASL letter recognition with rotation normalization.
    Recognizes: A, B, C, D, E, F, G, H, I, L, V, Y
    """
    if not landmarks or len(landmarks) != 21:
        print(f"❌ Invalid landmarks: got {len(landmarks) if landmarks else 0} landmarks")
        return None
    
    # --- NEW: NORMALIZE HAND ROTATION ---
    try:
        rotated_landmarks = normalize_hand_rotation(landmarks)
    except Exception as e:
        print(f"Error during rotation: {e}")
        rotated_landmarks = landmarks # Fallback if rotation fails
    # ---

    # Get key landmark positions from the *rotated* list
    thumb_tip = rotated_landmarks[4]
    index_tip = rotated_landmarks[8]
    middle_tip = rotated_landmarks[12]
    ring_tip = rotated_landmarks[16]
    pinky_tip = rotated_landmarks[20]
    
    index_mcp = rotated_landmarks[5]
    middle_mcp = rotated_landmarks[9]
    ring_mcp = rotated_landmarks[13]
    pinky_mcp = rotated_landmarks[17]

    index_pip = rotated_landmarks[6]
    middle_pip = rotated_landmarks[10]
    ring_pip = rotated_landmarks[14]
    pinky_pip = rotated_landmarks[18]
    
    # --- HELPERS (now use rotated landmarks) ---
    
    def is_finger_up(tip, mcp):
        # Y-axis is inverted, so "up" is a smaller Y value
        return tip['y'] < mcp['y']

    def is_finger_curved(tip, pip):
        # Tip is "lower" (higher Y) than the middle knuckle
        return tip['y'] > pip['y']

    # --- NEW HELPER: For G and H ---
    def is_finger_sideways(tip, mcp):
        # Checks if finger is pointing horizontally
        # After normalization, Ys should be "level", Xs should be "apart"
        is_level = abs(tip['y'] - mcp['y']) < 0.04 # 0.04 is a threshold
        is_out = abs(tip['x'] - mcp['x']) > 0.05 
        return is_level and is_out
    
    # Check "up" states
    thumb_extended_sideways = thumb_tip['x'] > index_mcp['x'] + 0.06
    index_up = is_finger_up(index_tip, index_mcp)
    middle_up = is_finger_up(middle_tip, middle_mcp)
    ring_up = is_finger_up(ring_tip, ring_mcp)
    pinky_up = is_finger_up(pinky_tip, pinky_mcp)
    
    # Check "curve" states
    index_curved = is_finger_curved(index_tip, index_pip)
    middle_curved = is_finger_curved(middle_tip, middle_pip)
    ring_curved = is_finger_curved(ring_tip, ring_pip)
    pinky_curved = is_finger_curved(pinky_tip, pinky_pip)
    
    # --- NEW: Check "sideways" states ---
    index_sideways = is_finger_sideways(index_tip, index_mcp)
    middle_sideways = is_finger_sideways(middle_tip, middle_mcp)

    # Debug output
    print(f"🖐️ Up - T:{thumb_extended_sideways} I:{index_up} M:{middle_up} R:{ring_up} P:{pinky_up}")
    print(f"    Side - I:{index_sideways} M:{middle_sideways}")
    
    # --- Letter recognition logic (Order is CRITICAL) ---

    # V: index and middle up
    if index_up and middle_up and not ring_up and not pinky_up:
        print("✅ Recognized: V")
        return 'V'
    
    # L: index up, thumb out
    if index_up and not middle_up and not ring_up and not pinky_up and thumb_extended_sideways:
        print("✅ Recognized: L")
        return 'L'
    
    # Y: thumb and pinky up
    if thumb_extended_sideways and pinky_up and not index_up and not middle_up and not ring_up:
        print("✅ Recognized: Y")
        return 'Y'

    # --- NEW: G and H (horizontal signs) ---
    # Must check before "closed fist" logic

    # H: Index and Middle sideways
    if index_sideways and middle_sideways and not ring_up and not pinky_up:
        print("✅ Recognized: H")
        return 'H'
        
    # G: Index sideways
    if index_sideways and not middle_sideways and not ring_up and not pinky_up:
        print("✅ Recognized: G")
        return 'G'
    # ---

    # F: Middle, Ring, Pinky up. Index and Thumb touching.
    thumb_to_index_dist = get_distance(thumb_tip, index_tip)
    if (middle_up and ring_up and pinky_up) and \
       (not index_up) and \
       (thumb_to_index_dist < 0.05): 
        print("✅ Recognized: F")
        return 'F'

    # D: Index up, others closed in a circle
    if index_up and not middle_up and not ring_up and not pinky_up and not thumb_extended_sideways:
        thumb_near_middle_y = abs(thumb_tip['y'] - middle_tip['y']) < 0.07
        thumb_near_ring_y = abs(thumb_tip['y'] - ring_tip['y']) < 0.07
        if thumb_near_middle_y or thumb_near_ring_y:
            print("✅ Recognized: D")
            return 'D'

    # I: only pinky up
    if pinky_up and not index_up and not middle_up and not ring_up:
        print("✅ Recognized: I")
        return 'I'
    
    # 'A' and 'E' logic (fist)
    all_fingers_closed = not index_up and not middle_up and not ring_up and not pinky_up \
                         and not index_sideways and not middle_sideways # G/H check
    
    if all_fingers_closed:
        if thumb_extended_sideways:
            print("✅ Recognized: A")
            return 'A'
        else:
            print("✅ Recognized: E")
            return 'E'
    
    # 'B' and 'C' logic (all fingers up)
    all_fingers_up = index_up and middle_up and ring_up and pinky_up
    
    if all_fingers_up:
        all_fingers_straight = not index_curved and not middle_curved and not ring_curved and not pinky_curved
        if all_fingers_straight and not thumb_extended_sideways:
            print("✅ Recognized: B")
            return 'B'

        curved_count = sum([index_curved, middle_curved, ring_curved, pinky_curved])
        if curved_count >= 3:
            print("✅ Recognized: C")
            return 'C'
    
    print(f"❌ No letter match")
    return None

# ---------- Hand Tracking APIs ----------

@api_view(["POST"])
def track_hands(request):
    """
    Track hands and recognize static ASL letters (A, B, C, I, L, V, Y)
    Used for the practice page
    """
    try:
        # Get base64 image from frontend
        image_data = request.data.get("image")

        if not image_data:
            return Response({"error": "No image data provided"}, status=400)

        # Handle "data:image/png;base64,..." prefix if present
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]

        # Decode base64 -> bytes -> numpy array -> OpenCV image
        try:
            img_bytes = base64.b64decode(image_data)
        except Exception as e:
            return Response({"error": f"Invalid base64 data: {e}"}, status=400)

        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            return Response({"error": "Could not decode image"}, status=400)

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
                        "x": landmark.x,
                        "y": landmark.y,
                        "z": landmark.z,
                    })
                hand_data.append(landmarks)
                
                # Recognize the letter
                letter = recognize_asl_letter(landmarks)
                if letter:
                    recognized_letters.append(letter)

        return Response({
            "hands": hand_data,
            "letters": recognized_letters
        })

    except Exception as e:
        import traceback
        print(f"Error in track_hands: {str(e)}")
        print(traceback.format_exc())
        return Response({"error": str(e)}, status=500)


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


# ---------- Model Status APIs ----------

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


# ---------- Progress Tracking API (optional) ----------

@api_view(["GET", "POST"])
def progress_api(request):
    """
    Track user progress through lessons
    Only available if progress app is installed
    """
    if not HAS_PROGRESS:
        return Response({"detail": "Progress tracking not available"}, status=404)
    
    if not request.user.is_authenticated:
        return Response({"detail": "Authentication required"}, status=401)

    if request.method == "GET":
        # return all progress for this user
        progress_qs = UserProgress.objects.filter(user=request.user).select_related("lesson")
        data = [
            {
                "lesson_slug": p.lesson.slug,
                "lesson_title": p.lesson.title,
                "completed": p.completed,
                "last_score": p.last_score,
                "updated_at": p.updated_at.isoformat(),
            }
            for p in progress_qs
        ]
        return Response({"progress": data})

    # POST: update/record progress for a lesson
    lesson_slug = request.data.get("lesson_slug")
    completed = request.data.get("completed", False)
    score = request.data.get("score")

    if not lesson_slug:
        return Response({"detail": "lesson_slug is required"}, status=400)

    lesson = get_object_or_404(Lesson, slug=lesson_slug)

    progress, _created = UserProgress.objects.get_or_create(
        user=request.user,
        lesson=lesson,
    )

    progress.completed = bool(completed)
    if score is not None:
        try:
            progress.last_score = float(score)
        except ValueError:
            return Response({"detail": "score must be a number"}, status=400)
    progress.save()

    return Response({
        "detail": "Progress saved",
        "lesson_slug": lesson.slug,
        "completed": progress.completed,
        "last_score": progress.last_score,
    })