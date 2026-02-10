from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import requests
import time
from datetime import datetime
from model import get_model

app = FastAPI()

def time_risk_factor(hour: int) -> float:
    """Return a multiplier (0.7–1.5) based on time of day."""
    if hour is None:
        return 1.0
    if 6 <= hour < 12:   # Morning
        return 0.7
    elif 12 <= hour < 18:  # Afternoon
        return 0.9
    elif 18 <= hour < 22:  # Evening
        return 1.1
    else:  # Night
        return 1.5


# Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔑 Add your GraphHopper API key here
GRAPHHOPPER_API_KEY = "823224fe-2f07-44e8-9e7f-db72909eccd3"

# Base URLs
GH_GEOCODE_URL = "https://graphhopper.com/api/1/geocode"
GH_ROUTE_URL = "https://graphhopper.com/api/1/route"

safety_model = get_model()


def geocode(location):
    """Get latitude and longitude from GraphHopper."""
    params = {
        "q": location,
        "locale": "en",
        "limit": 1,
        "key": GRAPHHOPPER_API_KEY
    }
    r = requests.get(GH_GEOCODE_URL, params=params, timeout=10)
    r.raise_for_status()
    data = r.json()
    hits = data.get("hits", [])
    if not hits:
        return None
    point = hits[0]["point"]
    return point["lat"], point["lng"]


@app.get("/routes")
def get_routes(source: str = Query(...), destination: str = Query(...), hour: int = None):
    """
    Returns safe routes between source and destination using GraphHopper API.
    """
    # Geocode both locations
    s = geocode(source)
    if not s:
        return {"error": f"Could not find source location: {source}"}
    time.sleep(0.5)

    d = geocode(destination)
    if not d:
        return {"error": f"Could not find destination location: {destination}"}
    time.sleep(0.5)

    lat1, lon1 = s
    lat2, lon2 = d

    # Request route from GraphHopper
    params = {
        "point": [f"{lat1},{lon1}", f"{lat2},{lon2}"],
        "vehicle": "car",
        "points_encoded": "false",
        "key": GRAPHHOPPER_API_KEY,
        "locale": "en",
        "instructions": "false",
        "alternative_route.max_paths": 3  # up to 3 alternative routes
    }

    r = requests.get(GH_ROUTE_URL, params=params, timeout=15)
    r.raise_for_status()
    gh_data = r.json()

    routes = []
    if hour is None:
        hour = datetime.now().hour

    for i, path in enumerate(gh_data.get("paths", [])):
        distance_m = path.get("distance", 0)
        duration_s = path.get("time", 0) / 1000  # milliseconds → seconds
        coords = path.get("points", {}).get("coordinates", [])

        if not coords:
            continue

        start_city = source
        end_city = destination

        # Compute safety score using your model
        r1 = safety_model.get_risk(start_city, hour)
        r2 = safety_model.get_risk(end_city, hour)
        # Apply time-based adjustment
        time_factor = time_risk_factor(hour)
        adjusted_score = (r1 + r2) / 2.0 * time_factor
        safety_score = round(min(adjusted_score, 1.0), 3)


        # Convert to [lat, lon] for frontend
        latlngs = [[lat, lon] for lon, lat in coords]

        routes.append({
            "route_id": i + 1,
            "distance_km": round(distance_m / 1000.0, 2),
            "duration_min": round(duration_s / 60.0, 1),
            "safety_score": safety_score,
            "coords": latlngs
        })

    routes = sorted(routes, key=lambda x: x["safety_score"])
    return {"routes": routes}
