from django.shortcuts import render

# Create your views here.
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import json

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
