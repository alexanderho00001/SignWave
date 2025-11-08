from django.db import models
from django.contrib.auth.models import User

class Lesson(models.Model):
    slug = models.SlugField(unique=True)  # e.g. "asl-alphabet", "greetings-1"
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.title


class UserProgress(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE)
    completed = models.BooleanField(default=False)
    last_score = models.FloatField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "lesson")  # one row per user+lesson

    def __str__(self):
        return f"{self.user.username} - {self.lesson.slug}"
