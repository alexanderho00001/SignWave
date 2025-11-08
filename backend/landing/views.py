from django.shortcuts import render, redirect
from django.contrib.auth import login
from .forms import ASLRegisterForm

def register(request):
    if request.method == 'POST':
        form = ASLRegisterForm(request.POST)
        if form.is_valid():
            user = form.save()
            # auto-login after registration
            login(request, user)
            # redirect to your home/dashboard/lesson page
            return redirect('home')
    else:
        form = ASLRegisterForm()

    return render(request, 'accounts/register.html', {'form': form})