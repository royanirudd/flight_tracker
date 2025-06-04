import os
import requests
import pandas as pd
from datetime import datetime
import pytz
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
USE_API = True

# Cache for CSV data
csv_data = None
last_load_time = None

def dashboard(request):
    context = {
        'center_lat': LAT,
        'center_lon': LON,
    }
    return render(request, "dashboard/index.html", context)

def flight_data(request):
    try:
        # Get map bounds from request parameters
        bounds = None
        if all(param in request.GET for param in ['north', 'south', 'east', 'west']):
            bounds = {
                'north': float(request.GET['north']),
                'south': float(request.GET['south']),
                'east': float(request.GET['east']),
                'west': float(request.GET['west'])
            }

        if USE_API:
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
                        
                        # Filter by bounds if provided
                        if bounds:
                            if not (bounds['south'] <= lat <= bounds['north'] and 
                                  bounds['west'] <= lon <= bounds['east']):
                                continue
                        
                        processed_states.append([
                            state[0] or "",
                            state[1].strip() if state[1] else "",
                            state[2] or "",
                            state[3] or 0,
                            state[4] or 0,
                            lon,
                            lat,
                            float(state[7] or 0),
                            bool(state[8]) if state[8] is not None else False,
                            float(state[9] or 0),
                            float(state[10] or 0),
                            float(state[11] or 0),
                            state[12] or None,
                            float(state[13] or 0),
                            state[14] or "",
                            bool(state[15]) if state[15] is not None else False,
                            int(state[16] or 0)
                        ])
                except (ValueError, TypeError, IndexError) as e:
                    print(f"Error processing flight: {e}")
                    continue

            current_time = int(data.get("time", 0))

            return JsonResponse({
                "time": current_time,
                "states": processed_states
            })
        else:
            # Use local CSV data
            processed_states = process_local_flights(bounds)
            current_time = int(datetime.now().timestamp())

            return JsonResponse({
                "time": current_time,
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
def load_csv_data():
    global csv_data, last_load_time
    
    try:
        # Only reload if data hasn't been loaded or it's been more than 5 minutes
        if csv_data is None or last_load_time is None or (datetime.now() - last_load_time).total_seconds() > 300:
            current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            csv_path = os.path.join(current_dir, 'adsb.csv')
            
            # Read CSV
            df = pd.read_csv(csv_path)
            
            # Rename 'ts' column to 's' for consistency
            df = df.rename(columns={'ts': 's'})
            
            # Convert columns to appropriate types
            df = df.astype({
                's': 'float64',
                'icao': 'str',
                'lat': 'float64',
                'lon': 'float64'
            })
            
            # Handle optional columns
            for col in ['alt', 'gs', 'trk', 'roc']:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
            
            if 'callsign' in df.columns:
                df['callsign'] = df['callsign'].fillna('').astype(str)
            
            # Convert timestamp to datetime
            df['timestamp'] = pd.to_datetime(df['s'], unit='s')
            
            # Group by ICAO address and get the latest record for each
            latest_records = df.sort_values('s').groupby('icao').last().reset_index()
            
            csv_data = latest_records
            last_load_time = datetime.now()
            
        return csv_data
    
    except Exception as e:
        print(f"Error loading CSV: {str(e)}")
        raise

def process_local_flights(bounds=None):
    try:
        df = load_csv_data()
        
        # Filter by map bounds if provided
        if bounds:
            df = df[
                (df['lat'] >= bounds['south']) & 
                (df['lat'] <= bounds['north']) & 
                (df['lon'] >= bounds['west']) & 
                (df['lon'] <= bounds['east'])
            ]
        
        processed_states = []
        
        for _, flight in df.iterrows():
            try:
                state = [
                    str(flight['icao']),           # icao24
                    str(flight.get('callsign', '')).strip(),  # callsign
                    "Unknown",                      # origin_country
                    int(flight['s']),              # time_position
                    int(flight['s']),              # last_contact
                    float(flight['lon']),          # longitude
                    float(flight['lat']),          # latitude
                    float(flight.get('alt', 0)),   # altitude
                    False,                         # on_ground
                    float(flight.get('gs', 0)),    # velocity
                    float(flight.get('trk', 0)),   # heading
                    float(flight.get('roc', 0)),   # vertical_rate
                    None,                          # sensors
                    float(flight.get('alt', 0)),   # baro_altitude
                    "",                            # squawk
                    False,                         # spi
                    0                              # position_source
                ]
                processed_states.append(state)
            except Exception as e:
                print(f"Error processing flight {flight.get('icao', 'unknown')}: {e}")
                continue
        
        return processed_states
    
    except Exception as e:
        print(f"Error in process_local_flights: {str(e)}")
        raise

