from django.urls import path
from .views import (
    register_api, 
    track_hands,  # Add this
    track_video_sequence, 
    get_available_signs,
    check_model_status
)

urlpatterns = [
    path("register/", register_api, name="register_api"),
    path("track-hands/", track_hands, name="track_hands"),  # Add this
    path("track-video/", track_video_sequence, name="track_video"),
    path("available-signs/", get_available_signs, name="available_signs"),
    path("model-status/", check_model_status, name="model_status"),
]