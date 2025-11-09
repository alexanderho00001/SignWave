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
import tensorflow as tf

# Import the pre-trained model
from .asl_pretrained_model import ASLPretrainedModel

from .islr_loader import (
    islr_model,
    idx_to_sign,
    holistic,
    sequence_buffers,
    SEQ_LEN,
    THRESH_HOLD,
)

from .src.landmarks_extraction import extract_coordinates

# Import SigLIP model for alphabet detection
# try:
#     import sys
#     import os
#     # Add play directory to path
#     play_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'play')
#     if play_dir not in sys.path:
#         sys.path.insert(0, play_dir)
    
#     from transformers import AutoImageProcessor, SiglipForImageClassification
#     from transformers.image_utils import load_image
#     from PIL import Image
#     import torch
    
#     # Load SigLIP model
#     model_name = "prithivMLmods/Alphabet-Sign-Language-Detection"
#     base_siglip_model = SiglipForImageClassification.from_pretrained(model_name)
#     siglip_processor = AutoImageProcessor.from_pretrained(model_name)
    
#     # Wrap with improved model
#     from .improved_siglip import ImprovedSigLIPModel
#     siglip_model = ImprovedSigLIPModel(
#         base_siglip_model,
#         siglip_processor,
#         smoothing_window=5,  # Average last 5 predictions
#         confidence_threshold=0.2  # Minimum confidence threshold
#     )
#     SIGLIP_AVAILABLE = True
#     print("✅ Improved SigLIP model loaded successfully")
# except Exception as e:
#     import traceback
#     print(f"⚠️ SigLIP model not available: {e}")
#     print(traceback.format_exc())
#     SIGLIP_AVAILABLE = False
#     siglip_model = None
#     siglip_processor = None

# Import progress models (if they exist)
try:
    from progress.models import Lesson, UserProgress
    HAS_PROGRESS = True
except ImportError:
    HAS_PROGRESS = False

# Initialize MediaPipe
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(static_image_mode=False, max_num_hands=2, min_detection_confidence=0.5)


# Buffer to store sequences for video recognition
sequence_buffers = {}

def get_distance(p1, p2):
    """Calculate 2D Euclidean distance between two landmark points"""
    return math.hypot(p1['x'] - p2['x'], p1['y'] - p2['y'])

def get_hand_orientation(landmarks):
    """
    Determines if the hand is held 'vertical' or 'horizontal'
    by checking the vector from the wrist to the palm center.
    --- MODIFIED: Added a 1.5x bias towards horizontal ---
    """
    wrist = landmarks[0]
    mcp_5, mcp_9, mcp_13, mcp_17 = landmarks[5], landmarks[9], landmarks[13], landmarks[17]
    
    avg_mcp_x = (mcp_5['x'] + mcp_9['x'] + mcp_13['x'] + mcp_17['x']) / 4
    avg_mcp_y = (mcp_5['y'] + mcp_9['y'] + mcp_13['y'] + mcp_17['y']) / 4
    
    palm_vec_x = avg_mcp_x - wrist['x']
    palm_vec_y = avg_mcp_y - wrist['y']
    
    # --- NEW BIAS ---
    # Hand is only 'vertical' if the Y-component is 1.5x larger than the X.
    # This prevents flickering when the hand is mostly horizontal.
    if abs(palm_vec_y) > (abs(palm_vec_x) * 1.5):
        return "vertical"
    else:
        return "horizontal"

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

# (Keep your 'get_hand_orientation' and 'get_distance' functions as they are)

def recognize_asl_letter(landmarks):
    """
    Recognizes ASL letters by first determining hand orientation.
    """
    if not landmarks or len(landmarks) != 21:
        print(f"❌ Invalid landmarks")
        return None
    
    # --- STEP 1: Determine Orientation ---
    orientation = get_hand_orientation(landmarks)
    
    # --- STEP 2: Get all landmarks ---
    thumb_tip = landmarks[4]
    index_tip = landmarks[8]
    middle_tip = landmarks[12]
    ring_tip = landmarks[16]
    pinky_tip = landmarks[20]
    
    index_mcp = landmarks[5]
    middle_mcp = landmarks[9]
    ring_mcp = landmarks[13]
    pinky_mcp = landmarks[17]

    index_pip = landmarks[6]
    middle_pip = landmarks[10]
    ring_pip = landmarks[14]
    pinky_pip = landmarks[18]
    
    # --- STEP 3: Define Helper Functions ---
    
    def is_finger_up_vertical(tip, mcp):
        return tip['y'] < mcp['y'] - 0.08 

    def is_finger_curved(tip, pip):
        return tip['y'] > pip['y']

    def is_finger_out_horizontal(tip, mcp):
        return abs(tip['x'] - mcp['x']) > 0.02
    
    # --- STEP 4: Get finger states for BOTH orientations ---
    
    # Vertical states
    thumb_extended_sideways = thumb_tip['x'] > index_mcp['x'] + 0.06
    index_up_v = is_finger_up_vertical(index_tip, index_mcp)
    middle_up_v = is_finger_up_vertical(middle_tip, middle_mcp)
    ring_up_v = is_finger_up_vertical(ring_tip, ring_mcp)
    pinky_up_v = is_finger_up_vertical(pinky_tip, pinky_mcp)
    
    # Horizontal states
    index_out_h = is_finger_out_horizontal(index_tip, index_mcp)
    middle_out_h = is_finger_out_horizontal(middle_tip, middle_mcp)
    ring_out_h = is_finger_out_horizontal(ring_tip, ring_mcp)
    pinky_out_h = is_finger_out_horizontal(pinky_tip, pinky_mcp)
    
    # Curve states (used by vertical)
    index_curved = is_finger_curved(index_tip, index_pip)
    middle_curved = is_finger_curved(middle_tip, middle_pip)
    ring_curved = is_finger_curved(ring_tip, ring_pip)
    pinky_curved = is_finger_curved(pinky_tip, pinky_pip)

    # --- STEP 5: Run logic based on orientation ---
    
    if orientation == "vertical":
        print("🖐️ Orientation: Vertical")
        
        # --- MODIFIED: 'K' and 'V' logic combined ---
        # K and V both have index and middle up, others down
        if index_up_v and middle_up_v and not ring_up_v and not pinky_up_v:
            # Check thumb position to differentiate K vs V
            thumb_to_middle_pip_dist = get_distance(thumb_tip, middle_pip)
            thumb_is_up = thumb_tip['y'] < index_mcp['y'] # Check if thumb is 'up'
            
            # K: Thumb is 'up' and 'in' (not sideways) and touching the middle finger
            if thumb_is_up and not thumb_extended_sideways and thumb_to_middle_pip_dist < 0.06:
                print("✅ Recognized: K")
                return 'K'
            else:
                # If thumb isn't placed for 'K', it's a 'V'
                print("✅ Recognized: V")
                return 'V'
        # ---
        
        # L: index up, thumb out
        if index_up_v and not middle_up_v and not ring_up_v and not pinky_up_v and thumb_extended_sideways:
            print("✅ Recognized: L")
            return 'L'
        
        # Y: thumb and pinky up
        if thumb_extended_sideways and pinky_up_v and not index_up_v and not middle_up_v and not ring_up_v:
            print("✅ Recognized: Y")
            return 'Y'

        # F: Middle, Ring, Pinky up. Index and Thumb touching.
        thumb_to_index_dist = get_distance(thumb_tip, index_tip)
        if (middle_up_v and ring_up_v and pinky_up_v) and \
           (not index_up_v) and \
           (thumb_to_index_dist < 0.05): 
            print("✅ Recognized: F")
            return 'F'

        # D: Index up, others closed in a circle
        if index_up_v and not middle_up_v and not ring_up_v and not pinky_up_v and not thumb_extended_sideways:
            thumb_near_middle_y = abs(thumb_tip['y'] - middle_tip['y']) < 0.07
            thumb_near_ring_y = abs(thumb_tip['y'] - ring_tip['y']) < 0.07
            if thumb_near_middle_y or thumb_near_ring_y:
                print("✅ Recognized: D")
                return 'D'

        # I: only pinky up
        if pinky_up_v and not index_up_v and not middle_up_v and not ring_up_v:
            print("✅ Recognized: I")
            return 'I'
        
        # 'A' and 'E' logic (fist)
        all_fingers_closed = not index_up_v and not middle_up_v and not ring_up_v and not pinky_up_v
        
        if all_fingers_closed:
            if thumb_extended_sideways:
                print("✅ Recognized: A")
                return 'A'
            else:
                print("✅ Recognized: E")
                return 'E'
        
        # 'B' and 'C' logic (all fingers up)
        all_fingers_up = index_up_v and middle_up_v and ring_up_v and pinky_up_v
        
        if all_fingers_up:
            all_fingers_straight = not index_curved and not middle_curved and not ring_curved and not pinky_curved
            if all_fingers_straight and not thumb_extended_sideways:
                print("✅ Recognized: B")
                return 'B'

            curved_count = sum([index_curved, middle_curved, ring_curved, pinky_curved])
            if curved_count >= 3:
                print("✅ Recognized: C")
                return 'C'

    elif orientation == "horizontal":
        print("🖐️ Orientation: Horizontal")
        
        all_fingers_level = not index_up_v and not middle_up_v and not ring_up_v and not pinky_up_v
        print(f"    DEBUG (H): all_level={all_fingers_level}")
        print(f"    DEBUG (H): I_out={index_out_h}, M_out={middle_out_h}, R_out={ring_out_h}, P_out={pinky_out_h}")
        
        if all_fingers_level:
            # H: Index and Middle extended horizontally
            if index_out_h and middle_out_h and not ring_out_h and not pinky_out_h:
                print("✅ Recognized: H")
                return 'H'
            
            # G: Index extended horizontally
            if index_out_h and not middle_out_h and not ring_out_h and not pinky_out_h:
                print("✅ Recognized: G")
                return 'G'

    print(f"❌ No letter match (Orientation: {orientation})")
    return None

def recognize_asl_number(landmarks):
    """
    Recognizes ASL numbers 0-9.
    This logic assumes a vertical hand orientation.
    """
    if not landmarks or len(landmarks) != 21:
        print(f"❌ Invalid landmarks for number")
        return None

    # Get key landmark positions
    thumb_tip = landmarks[4]
    index_tip = landmarks[8]
    middle_tip = landmarks[12]
    ring_tip = landmarks[16]
    pinky_tip = landmarks[20]
    
    thumb_ip = landmarks[3] # Thumb knuckle
    index_mcp = landmarks[5]
    middle_mcp = landmarks[9]
    ring_mcp = landmarks[13]
    pinky_mcp = landmarks[17]

    # --- Helpers ---
    def is_finger_up(tip, mcp):
        # Using the same "vertical up" logic
        return tip['y'] < mcp['y'] - 0.05 

    def is_thumb_up(tip, ip_knuckle):
        # Thumb "up" is more about being above its own knuckle
        return tip['y'] < ip_knuckle['y']
    
    # --- Get Finger States ---
    index_up = is_finger_up(index_tip, index_mcp)
    middle_up = is_finger_up(middle_tip, middle_mcp)
    ring_up = is_finger_up(ring_tip, ring_mcp)
    pinky_up = is_finger_up(pinky_tip, pinky_mcp)
    thumb_up = is_thumb_up(thumb_tip, thumb_ip)
    
    print(f"    DEBUG (Num): I_up={index_up}, M_up={middle_up}, R_up={ring_up}, P_up={pinky_up}")
    
    # --- Get Distances for 6, 7, 8, 9 ---
    TOUCH_THRESHOLD = 0.06
    thumb_to_index_dist = get_distance(thumb_tip, index_tip)
    thumb_to_middle_dist = get_distance(thumb_tip, middle_tip)
    thumb_to_ring_dist = get_distance(thumb_tip, ring_tip)
    thumb_to_pinky_dist = get_distance(thumb_tip, pinky_tip)

    # --- Number Logic (Order is Critical!) ---

    # --- MODIFIED: Correct logic for 6, 7, 8, 9 ---
    
    # 9: Index finger touches thumb. Middle, Ring, Pinky are UP.
    if (middle_up and ring_up and pinky_up) and (not index_up) and (thumb_to_index_dist < TOUCH_THRESHOLD):
        print("✅ Recognized: 9")
        return '9'
        
    # 8: Middle finger touches thumb. Index, Ring, Pinky are UP.
    if (index_up and ring_up and pinky_up) and (not middle_up) and (thumb_to_middle_dist < TOUCH_THRESHOLD):
        print("✅ Recognized: 8")
        return '8'

    # 7: Ring finger touches thumb. Index, Middle, Pinky are UP.
    if (index_up and middle_up and pinky_up) and (not ring_up) and (thumb_to_ring_dist < TOUCH_THRESHOLD):
        print(f"    DEBUG (7?): RingDist={thumb_to_ring_dist:.4f} (Threshold={TOUCH_THRESHOLD})")
        print("✅ Recognized: 7")
        return '7'

    # 6: Pinky finger touches thumb. Index, Middle, Ring are UP.
    if (index_up and middle_up and ring_up) and (not pinky_up) and (thumb_to_pinky_dist < TOUCH_THRESHOLD):
        print("✅ Recognized: 6")
        return '6'
    
    # ---

    # 5: All 5 fingers up
    if index_up and middle_up and ring_up and pinky_up and thumb_up:
        print("✅ Recognized: 5")
        return '5'
        
    # 4: 4 fingers up (no thumb)
    if index_up and middle_up and ring_up and pinky_up:
        print("✅ Recognized: 4")
        return '4'
        
    # 3: Index, Middle, and Thumb up
    if index_up and middle_up and thumb_up and not ring_up and not pinky_up:
        print("✅ Recognized: 3")
        return '3'

    # 2: Index and Middle up (like 'V')
    if index_up and middle_up and not ring_up and not pinky_up:
        print("✅ Recognized: 2")
        return '2'
        
    # 1: Index up (like 'D')
    if index_up and not middle_up and not ring_up and not pinky_up:
        print("✅ Recognized: 1")
        return '1'
        
    # 0: Closed fist (like 'A'/'E')
    all_fingers_down = not index_up and not middle_up and not ring_up and not pinky_up
    if all_fingers_down:
        print("✅ Recognized: 0")
        return '0'
        
    print(f"❌ No number match")
    return None

# --- NEW API ENDPOINT ---
@api_view(["POST"])
def track_asl_numbers(request):
    """
    Track hands and recognize static ASL numbers (0-9)
    Used for the number practice page
    """
    try:
        # Get base64 image from frontend
        image_data = request.data.get("image")
        if not image_data:
            return Response({"error": "No image data provided"}, status=400)

        if "," in image_data:
            image_data = image_data.split(",", 1)[1]

        img_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            return Response({"error": "Could not decode image"}, status=400)

        # Process with MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands.process(rgb_frame)

        hand_data = []
        recognized_numbers = []

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
                
                # --- MODIFIED: Call the new number function ---
                number = recognize_asl_number(landmarks)
                if number:
                    recognized_numbers.append(number)

        return Response({
            "hands": hand_data,
            "letters": recognized_numbers  # Frontend expects a 'letters' key
        })

    except Exception as e:
        import traceback
        print(f"Error in track_asl_numbers: {str(e)}")
        print(traceback.format_exc())
        return Response({"error": str(e)}, status=500)

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
    Track landmarks over time and run the 209sontung Transformer model.
    Used for the 'recognize' page (full words).
    """

    # Make sure the backend model actually loaded
    if islr_model is None:
        return Response(
            {"error": "ISLR model not loaded on backend"},
            status=503,
        )

    try:
        session_id = request.data.get('session_id', 'default')
        image_data = request.data.get('image')
        reset = request.data.get('reset', False)

        # Reset the per-session buffer if requested
        if reset:
            sequence_buffers[session_id] = []
            return Response({
                'message': 'Buffer reset',
                'buffer_length': 0,
                'predicted_sign': None,
                'confidence': 0,
            })

        if not image_data:
            return Response({'error': 'No image data provided'}, status=400)

        # Strip "data:image/...;base64," prefix if present
        if ',' in image_data:
            image_data = image_data.split(',', 1)[1]

        # Decode base64 → OpenCV frame
        try:
            img_bytes = base64.b64decode(image_data)
        except Exception as e:
            return Response({'error': f'Invalid base64 data: {e}'}, status=400)

        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            return Response({"error": "Could not decode image"}, status=400)

        # Run MediaPipe Holistic (face + pose + both hands)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = holistic.process(rgb_frame)

        # --- Build landmarks for this frame (like main.py) ---
        try:
            landmarks_arr = extract_coordinates(results)  # shape (543, 3)
        except Exception:
            # Fallback if mediapipe failed → use zeros
            landmarks_arr = np.zeros((468 + 21 + 33 + 21, 3), dtype=np.float32)

        if session_id not in sequence_buffers:
            sequence_buffers[session_id] = []

        sequence_buffers[session_id].append(landmarks_arr)
        buffer_len = len(sequence_buffers[session_id])

        predicted_sign = None
        confidence = 0.0

        # DEBUG LOG
        print(
            f"[track_video_sequence] session={session_id} "
            f"buffer_len={buffer_len} SEQ_LEN={SEQ_LEN}"
        )

        # --- Run the model once we have SEQ_LEN frames ---
        if buffer_len == SEQ_LEN:
            # Use exactly the last SEQ_LEN frames
            seq = np.array(sequence_buffers[session_id], dtype=np.float32)
            prediction = islr_model(seq)["outputs"]

            if isinstance(prediction, tf.Tensor):
                pred_np = prediction.numpy()
            else:
                pred_np = np.array(prediction)

            max_val = float(np.max(pred_np, axis=-1))
            idx = int(np.argmax(pred_np, axis=-1))
            confidence = max_val * 100.0

            sign_name = idx_to_sign.get(idx, "<?>")
            print(
                f"[track_video_sequence] session={session_id} "
                f"raw_max={max_val:.3f} idx={idx} sign={sign_name}"
            )

            if max_val > THRESH_HOLD:
                predicted_sign = idx_to_sign.get(idx)
            sequence_buffers[session_id] = []

        landmarks_list = landmarks_arr.tolist()

        # 🔧 Ensure confidence is a finite float
        if not np.isfinite(confidence):
            confidence = 0.0

        landmarks_clean = np.nan_to_num(
            landmarks_arr,
            nan=0.0,
            posinf=0.0,
            neginf=0.0,
        )
        landmarks_list = landmarks_clean.tolist()
        return Response({
            'landmarks': landmarks_list,
            'buffer_length': len(sequence_buffers.get(session_id, [])),
            'predicted_sign': predicted_sign,
            'confidence': float(round(confidence, 2)),
            'model_loaded': True,
            'session_id': session_id,
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
    return Response({
        'model_loaded': asl_model.model is not None,
        'num_signs': asl_model.num_actions,
        'signs': asl_model.actions,
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


@api_view(['POST'])
def test_siglip_model(request):
    """
    Test the SigLIP model from play/model.py
    Accepts an image and returns predictions for all 26 alphabet letters
    """
    if not SIGLIP_AVAILABLE:
        return Response({
            'error': 'SigLIP model not available',
            'message': 'Model failed to load. Check backend logs.'
        }, status=503)
    
    try:
        image_data = request.data.get('image')
        if not image_data:
            return Response({'error': 'No image data provided'}, status=400)
        
        # Decode base64 image
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        img_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return Response({'error': 'Failed to decode image'}, status=400)
        
        # Convert BGR to RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(rgb_frame)
        
        # Use improved model with smoothing and preprocessing
        session_id = request.data.get('session_id', 'default')
        reset_buffer = request.data.get('reset_buffer', False)
        
        # Reset buffer if requested
        if reset_buffer:
            siglip_model.reset_buffer()
        
        # Get predictions with smoothing
        smoothed_predictions, raw_predictions = siglip_model.predict_with_smoothing(
            pil_image,
            use_hand_crop=True,  # Crop to hand region
            use_preprocessing=True  # Apply image enhancement
        )
        
        # Get top prediction
        top_letter, top_conf = siglip_model.get_top_prediction(smoothed_predictions)
        
        # Round predictions for response
        predictions = {letter: round(conf, 4) for letter, conf in smoothed_predictions.items()}
        raw_predictions_rounded = {letter: round(conf, 4) for letter, conf in raw_predictions.items()}
        
        # Sort by probability
        sorted_predictions = sorted(predictions.items(), key=lambda x: x[1], reverse=True)
        top_prediction = (top_letter or sorted_predictions[0][0], top_conf)
        
        return Response({
            'success': True,
            'top_prediction': {
                'letter': top_prediction[0],
                'confidence': round(top_prediction[1], 4)
            },
            'all_predictions': predictions,
            'raw_predictions': raw_predictions_rounded,  # Current frame without smoothing
            'top_5': [{'letter': letter, 'confidence': conf} for letter, conf in sorted_predictions[:5]],
            'buffer_size': len(siglip_model.prediction_buffer),
            'hand_detected': True  # Will be False if no hand found in cropping
        })
        
    except Exception as e:
        import traceback
        print(f"Error in test_siglip_model: {str(e)}")
        print(traceback.format_exc())
        return Response({
            'error': str(e),
            'traceback': traceback.format_exc()
        }, status=500)


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