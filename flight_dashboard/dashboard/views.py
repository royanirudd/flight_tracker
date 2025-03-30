import os
import requests
from django.http import JsonResponse, StreamingHttpResponse
from django.shortcuts import render
import cv2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Constants
CITY = "Singapore"
LAT, LON = 1.3521, 103.8198
WEATHER_API_KEY = os.getenv('WEATHER_API_KEY')
FLIGHT_API_URL = "https://opensky-network.org/api/states/all"

def dashboard(request):
    context = {
        'center_lat': LAT,
        'center_lon': LON,
    }
    return render(request, "dashboard/index.html", context)

def weather_data(request, lat=None, lon=None):
    # If no coordinates provided, use Singapore's coordinates
    lat = lat or LAT
    lon = lon or LON
    
    url = f"http://api.weatherapi.com/v1/current.json?key={WEATHER_API_KEY}&q={lat},{lon}"
    try:
        response = requests.get(url).json()
        
        return JsonResponse({
            'temperature': f"{response['current']['temp_c']}°C",
            'condition': response['current']['condition']['text'],
            'wind_speed': f"{response['current']['wind_kph']} km/h",
            'humidity': f"{response['current']['humidity']}%",
            'feels_like': f"{response['current']['feelslike_c']}°C",
            'pressure': f"{response['current']['pressure_mb']} mb"
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

def flight_data(request):
    try:
        response = requests.get(FLIGHT_API_URL, timeout=10)
        
        # Add debugging
        print(f"API Response Status: {response.status_code}")
        print(f"API Response Content: {response.text[:500]}")  # Print first 500 chars
        
        if response.status_code != 200:
            return JsonResponse({
                "error": f"API returned status code {response.status_code}"
            }, status=500)

        data = response.json()
        
        if not isinstance(data, dict) or "states" not in data:
            return JsonResponse({
                "error": "Invalid data format from API",
                "data_received": str(data)[:500]
            }, status=500)

        flights = []
        center_lat, center_lon = LAT, LON
        
        for flight in data.get("states", []):
            if flight and len(flight) >= 8 and flight[5] and flight[6]:
                try:
                    lat = float(flight[6])
                    lon = float(flight[5])
                    
                    # Calculate distance from Singapore (rough approximation)
                    lat_diff = abs(lat - center_lat)
                    lon_diff = abs(lon - center_lon)
                    
                    # Only include flights within roughly 500km of Singapore
                    if lat_diff < 4.5 and lon_diff < 4.5:
                        flights.append({
                            "callsign": str(flight[1]).strip() if flight[1] else "Unknown",
                            "origin_country": str(flight[2]) if flight[2] else "Unknown",
                            "lat": lat,
                            "lon": lon,
                            "altitude": f"{round(float(flight[7] or 0) * 3.28084)} ft",
                            "velocity": f"{round(float(flight[9] or 0) * 1.944)} knots",
                            "heading": f"{round(float(flight[10] or 0))}°",
                        })
                except (ValueError, TypeError) as e:
                    print(f"Error processing flight data: {e}")
                    continue

        if not flights:
            # Return empty array instead of error
            return JsonResponse([], safe=False)

        return JsonResponse(flights, safe=False)

    except requests.exceptions.RequestException as e:
        print(f"API Request Error: {str(e)}")
        return JsonResponse({
            "error": "Failed to fetch flight data",
            "details": str(e)
        }, status=500)
    except Exception as e:
        print(f"Unexpected Error: {str(e)}")
        return JsonResponse({
            "error": "Internal server error",
            "details": str(e)
        }, status=500)

def generate_video():
    # For testing, generate a simple color pattern
    frame = cv2.imread('dashboard/static/dashboard/placeholder.jpg')
    while True:
        if frame is None:
            # Create a blank colored frame if no image is available
            frame = cv2.rectangle(
                cv2.imread('dashboard/static/dashboard/placeholder.jpg'),
                (50, 50),
                (200, 200),
                (0, 255, 0),
                -1
            )
        _, buffer = cv2.imencode('.jpg', frame)
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

def video_feed(request):
    return StreamingHttpResponse(
        generate_video(),
        content_type='multipart/x-mixed-replace; boundary=frame'
    )
