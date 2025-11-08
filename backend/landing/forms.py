from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User

ASL_LEVEL_CHOICES = [
    ('beginner', 'Beginner'),
    ('intermediate', 'Intermediate'),
    ('advanced', 'Advanced'),
]

class ASLRegisterForm(UserCreationForm):
    email = forms.EmailField(required=True)
    asl_level = forms.ChoiceField(
        choices=ASL_LEVEL_CHOICES,
        required=False,
        label="ASL Level (optional)"
    )

    class Meta:
        model = User
        fields = ['username', 'email', 'asl_level', 'password1', 'password2']

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data['email']
        # if you want to do something with asl_level later,
        # you can access self.cleaned_data['asl_level'] here
        if commit:
            user.save()
        return user