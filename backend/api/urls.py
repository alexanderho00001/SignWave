from django.urls import path
from .views import register_api  # adjust if your view name is different

urlpatterns = [
    path("register/", register_api, name="register_api"),
]
