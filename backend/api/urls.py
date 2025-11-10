from django.urls import path
from .views import (
    register_api,
    track_hands,  # Add this
    login_api,
    progress_api,
    track_video_sequence,
    get_available_signs,
    check_model_status,
    track_asl_numbers,
    test_siglip_model,
    get_reference_sign,
    record_reference_sign
)

urlpatterns = [
    path("register/", register_api, name="register_api"),
    path("track-hands/", track_hands, name="track_hands"),
    path("track-numbers/", track_asl_numbers, name="track_numbers"),
    path("login/", login_api, name="login_api"),
    path("progress/", progress_api, name="progress_api"),
    path("track-video/", track_video_sequence, name="track_video"),
    path("available-signs/", get_available_signs, name="available_signs"),
    path("model-status/", check_model_status, name="model_status"),
    path("test-siglip/", test_siglip_model, name="test_siglip_model"),
    path("reference-sign/<str:sign_name>/", get_reference_sign, name="get_reference_sign"),
    path("record-reference-sign/", record_reference_sign, name="record_reference_sign"),
]
