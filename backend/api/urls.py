from django.urls import path
from .views import register_api, track_hands

urlpatterns = [
    path("register/", register_api, name="register_api"),
    path("track-hands/", track_hands, name="track_hands"),
]
