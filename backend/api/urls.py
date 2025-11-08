from django.urls import path
from .views import register_api, login_api, track_hands, progress_api

urlpatterns = [
    path("register/", register_api, name="register_api"),
    path("track_hands/", track_hands, name="track_hands"),
    path("login/", login_api, name="login_api"),
    path("progress/", progress_api, name="progress_api"),
]
