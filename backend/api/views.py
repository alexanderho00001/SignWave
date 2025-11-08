from django.shortcuts import render, get_object_or_404

from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import json

import cv2
import mediapipe as mp
import base64
import numpy as np

from rest_framework.decorators import api_view
from rest_framework.response import Response

from progress.models import Lesson, UserProgress




@csrf_exempt  # for dev only; better to configure proper CSRF later
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


# ---------- MediaPipe hand tracker ----------
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(static_image_mode=False, max_num_hands=2)
# Add this new view for hand tracking
@api_view(["POST"])
def track_hands(request):
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

        hand_data: list[list[dict]] = []

        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                landmarks = []
                for landmark in hand_landmarks.landmark:
                    landmarks.append(
                        {
                            "x": landmark.x,
                            "y": landmark.y,
                            "z": landmark.z,
                        }
                    )
                hand_data.append(landmarks)

        return Response({"hands": hand_data})

    except Exception as e:
        # Final catch-all: return error as JSON instead of crashing
        return Response({"error": str(e)}, status=500)
# ---------- Login API ----------


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

@api_view(["GET", "POST"])
def progress_api(request):
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

    return Response(
        {
            "detail": "Progress saved",
            "lesson_slug": lesson.slug,
            "completed": progress.completed,
            "last_score": progress.last_score,
        }
    )