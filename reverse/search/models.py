from django.db import models

class Image(models.Model):
    name = models.CharField(max_length=255)
    file = models.ImageField(upload_to='images/')
    histogram = models.JSONField()  # Store the histogram as JSON

    def __str__(self):
        return self.name