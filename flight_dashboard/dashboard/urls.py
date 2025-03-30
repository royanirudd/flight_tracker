from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard, name='dashboard'),
    path('api/weather/', views.weather_data, name='weather_data'),
    path('api/flights/', views.flight_data, name='flight_data'),
    path('video_feed/', views.video_feed, name='video_feed'),
]
