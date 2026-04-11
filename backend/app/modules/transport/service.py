"""
Transport Service — Google Maps Distance Matrix + fare calculation
"""
import os
import httpx
from typing import Optional

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

# DEFAULT fare table (overridden by DB values)
DEFAULT_FARES = {
    "BIKE": {"base_fare": 30.0,  "per_km_rate": 8.0},
    "CAR":  {"base_fare": 60.0,  "per_km_rate": 14.0},
    "VAN":  {"base_fare": 100.0, "per_km_rate": 20.0},
}


async def get_distance_km(origin: str, destination: str) -> float:
    """
    Call Google Maps Distance Matrix API.
    Returns distance in km (road distance, not straight line).
    Falls back to 0 if API key missing or call fails.
    """
    if not GOOGLE_MAPS_API_KEY or GOOGLE_MAPS_API_KEY == "YOUR_GOOGLE_MAPS_API_KEY_HERE":
        raise ValueError("GOOGLE_MAPS_API_KEY not configured in .env")

    url = "https://maps.googleapis.com/maps/api/distancematrix/json"
    params = {
        "origins": origin,
        "destinations": destination,
        "units": "metric",
        "key": GOOGLE_MAPS_API_KEY,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    try:
        element = data["rows"][0]["elements"][0]
        if element["status"] != "OK":
            raise ValueError(f"Google Maps returned status: {element['status']}")
        distance_meters = element["distance"]["value"]
        return round(distance_meters / 1000, 2)
    except (KeyError, IndexError) as e:
        raise ValueError(f"Unexpected Google Maps response: {e}")


def calculate_fare(distance_km: float, vehicle_type: str, fare_doc: Optional[dict] = None) -> float:
    """
    fare = base_fare + (distance_km * per_km_rate)
    Uses DB fare doc if provided, else DEFAULT_FARES.
    """
    if fare_doc:
        base = fare_doc.get("base_fare", DEFAULT_FARES[vehicle_type]["base_fare"])
        rate = fare_doc.get("per_km_rate", DEFAULT_FARES[vehicle_type]["per_km_rate"])
    else:
        base = DEFAULT_FARES[vehicle_type]["base_fare"]
        rate = DEFAULT_FARES[vehicle_type]["per_km_rate"]

    return round(base + (distance_km * rate), 2)
