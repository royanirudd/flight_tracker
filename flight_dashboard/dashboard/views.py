import os
import requests
from django.http import JsonResponse, StreamingHttpResponse
from django.shortcuts import render
import cv2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Constants
CITY = "Massachusetts"
LAT, LON = 42.3601, -71.0589  # Boston coordinates
WEATHER_API_KEY = os.getenv('WEATHER_API_KEY')
FLIGHT_API_URL = "https://opensky-network.org/api/states/all"

def dashboard(request):
    context = {
        'center_lat': LAT,
        'center_lon': LON,
    }
    return render(request, "dashboard/index.html", context)

def flight_data(request):
    try:
        response = requests.get(FLIGHT_API_URL, timeout=10)
        
        if response.status_code != 200:
            return JsonResponse({
                "error": f"API returned status code {response.status_code}"
            }, status=500)

        data = response.json()
        
        if not isinstance(data, dict) or "states" not in data:
            return JsonResponse({"error": "Invalid data format"}, status=500)

        processed_states = []
        
        for state in data["states"]:
            if not state or len(state) < 8:
                continue
                
            try:
                if state[6] is not None and state[5] is not None:
                    lat = float(state[6])
                    lon = float(state[5])
                    
                    lat_diff = abs(lat - LAT)
                    lon_diff = abs(lon - LON)
                    
                    if lat_diff < 5 and lon_diff < 5:
                        processed_states.append([
                            state[0] or "",                     # icao24
                            state[1].strip() if state[1] else "",  # callsign
                            state[2] or "",                     # origin_country
                            state[3] or 0,                      # time_position
                            state[4] or 0,                      # last_contact
                            lon,                                # longitude
                            lat,                                # latitude
                            float(state[7] or 0),              # altitude
                            bool(state[8]) if state[8] is not None else False,  # on_ground
                            float(state[9] or 0),              # velocity
                            float(state[10] or 0),             # heading
                            float(state[11] or 0),             # vertical_rate
                            state[12] or None,                 # sensors
                            float(state[13] or 0),             # baro_altitude
                            state[14] or "",                   # squawk
                            bool(state[15]) if state[15] is not None else False,  # spi
                            int(state[16] or 0)                # position_source
                        ])
            except (ValueError, TypeError, IndexError) as e:
                print(f"Error processing flight: {e}")
                continue

        return JsonResponse({
            "time": int(data.get("time", 0)),
            "states": processed_states
        })

    except Exception as e:
        print(f"Error: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)

def weather_data(request, lat=None, lon=None):
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

def generate_video():
    frame = cv2.imread('dashboard/static/dashboard/placeholder.jpg')
    while True:
        if frame is None:
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
