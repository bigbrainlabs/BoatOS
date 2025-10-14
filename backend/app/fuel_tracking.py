"""
Fuel Tracking Module
Handles fuel refills, consumption tracking and cost calculations
"""
import json
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime

FUEL_FILE = Path("/home/arielle/BoatOS/data/fuel.json")
FUEL_FILE.parent.mkdir(parents=True, exist_ok=True)

def load_fuel_entries() -> List[Dict]:
    """Load all fuel entries from disk."""
    if not FUEL_FILE.exists():
        return []

    try:
        with open(FUEL_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading fuel entries: {e}")
        return []

def save_fuel_entries(fuel_list: List[Dict]) -> bool:
    """Save fuel entries to disk."""
    try:
        with open(FUEL_FILE, 'w', encoding='utf-8') as f:
            json.dump(fuel_list, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving fuel entries: {e}")
        return False

def add_fuel_entry(liters: float, price_per_liter: float, location: str = "",
                   odometer: float = 0, notes: str = "", position: Dict = None) -> Dict:
    """Add a new fuel entry."""
    fuel_list = load_fuel_entries()

    # Generate new ID
    new_id = max([f.get("id", 0) for f in fuel_list], default=0) + 1

    total_cost = liters * price_per_liter

    fuel_entry = {
        "id": new_id,
        "timestamp": datetime.now().isoformat(),
        "liters": round(liters, 2),
        "price_per_liter": round(price_per_liter, 3),
        "total_cost": round(total_cost, 2),
        "currency": "EUR",
        "location": location,
        "odometer": round(odometer, 2) if odometer else None,  # NM or hours
        "notes": notes,
        "position": position  # {lat, lon}
    }

    fuel_list.append(fuel_entry)
    save_fuel_entries(fuel_list)

    return fuel_entry

def get_fuel_entry(fuel_id: int) -> Optional[Dict]:
    """Get a specific fuel entry by ID."""
    fuel_list = load_fuel_entries()
    for entry in fuel_list:
        if entry.get("id") == fuel_id:
            return entry
    return None

def update_fuel_entry(fuel_id: int, updates: Dict) -> Optional[Dict]:
    """Update fuel entry information."""
    fuel_list = load_fuel_entries()

    for i, entry in enumerate(fuel_list):
        if entry.get("id") == fuel_id:
            # Update fields
            for key, value in updates.items():
                if key != "id":
                    entry[key] = value

            # Recalculate total cost if liters or price changed
            if "liters" in updates or "price_per_liter" in updates:
                entry["total_cost"] = round(entry["liters"] * entry["price_per_liter"], 2)

            fuel_list[i] = entry
            save_fuel_entries(fuel_list)
            return entry

    return None

def delete_fuel_entry(fuel_id: int) -> bool:
    """Delete a fuel entry."""
    fuel_list = load_fuel_entries()
    fuel_list = [f for f in fuel_list if f.get("id") != fuel_id]
    return save_fuel_entries(fuel_list)

def get_fuel_stats(days: int = 30) -> Dict:
    """Get fuel statistics for the last N days."""
    from datetime import timedelta

    fuel_list = load_fuel_entries()

    # Filter by date
    cutoff = datetime.now() - timedelta(days=days)
    recent_entries = [
        f for f in fuel_list
        if datetime.fromisoformat(f.get("timestamp", "")) > cutoff
    ]

    if not fuel_list:
        return {
            "total_entries": 0,
            "total_liters": 0,
            "total_cost": 0,
            "avg_price_per_liter": 0,
            "last_refill": None
        }

    total_liters = sum(f.get("liters", 0) for f in fuel_list)
    total_cost = sum(f.get("total_cost", 0) for f in fuel_list)

    recent_liters = sum(f.get("liters", 0) for f in recent_entries)
    recent_cost = sum(f.get("total_cost", 0) for f in recent_entries)

    # Average price
    avg_price = total_cost / total_liters if total_liters > 0 else 0

    # Last refill
    sorted_fuel = sorted(fuel_list, key=lambda x: x.get("timestamp", ""), reverse=True)
    last_refill = sorted_fuel[0] if sorted_fuel else None

    return {
        "total_entries": len(fuel_list),
        "total_liters": round(total_liters, 2),
        "total_cost": round(total_cost, 2),
        "avg_price_per_liter": round(avg_price, 3),
        "recent_entries": len(recent_entries),
        "recent_liters": round(recent_liters, 2),
        "recent_cost": round(recent_cost, 2),
        "last_refill": last_refill,
        "currency": "EUR"
    }

def calculate_consumption(distance_nm: float, fuel_used: float) -> float:
    """Calculate fuel consumption in liters per nautical mile."""
    if distance_nm <= 0:
        return 0
    return round(fuel_used / distance_nm, 3)

def get_consumption_stats() -> Dict:
    """
    Calculate consumption statistics based on trips and fuel refills.
    Links fuel entries with trips to estimate consumption.
    """
    from datetime import datetime, timedelta
    import sys
    import os

    # Import logbook_storage
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    import logbook_storage

    fuel_list = load_fuel_entries()
    trips = logbook_storage.load_logbook_entries()

    # Load tank capacity from settings file directly
    tank_capacity = 100.0  # Default
    try:
        settings_file = Path("data/settings.json")
        if settings_file.exists():
            with open(settings_file, 'r', encoding='utf-8') as f:
                settings = json.load(f)
                tank_capacity = settings.get("boat", {}).get("fuelCapacity", 100.0)
    except Exception as e:
        print(f"⚠️ Could not load tank capacity from settings: {e}")

    if not fuel_list or not trips:
        return {
            "avg_consumption_per_nm": 0,
            "avg_consumption_per_hour": 0,
            "total_distance_with_fuel": 0,
            "total_fuel_consumed": 0,
            "estimated_range_nm": 0,
            "trips_analyzed": 0,
            "tank_capacity_l": tank_capacity
        }

    # Sort by date
    fuel_sorted = sorted(fuel_list, key=lambda x: datetime.fromisoformat(x["timestamp"]))
    trips_sorted = sorted(trips, key=lambda x: datetime.fromisoformat(x["trip_end"]))

    total_fuel = 0
    total_distance = 0
    total_duration_hours = 0
    trips_with_fuel = 0

    # Match trips with fuel refills
    # Simple approach: Sum all fuel and all distance, calculate average
    for trip in trips_sorted:
        if trip.get("distance") and trip.get("distance") > 0:
            total_distance += trip["distance"]
            trips_with_fuel += 1

            # Parse duration (format: "H:MM" or "HH:MM")
            if trip.get("duration"):
                duration_str = trip["duration"]
                try:
                    parts = duration_str.split(":")
                    hours = int(parts[0])
                    minutes = int(parts[1]) if len(parts) > 1 else 0
                    total_duration_hours += hours + (minutes / 60.0)
                except:
                    pass

    # Total fuel consumed (all refills)
    total_fuel = sum(f.get("liters", 0) for f in fuel_list)

    # Calculate averages
    avg_consumption_per_nm = total_fuel / total_distance if total_distance > 0 else 0
    avg_consumption_per_hour = total_fuel / total_duration_hours if total_duration_hours > 0 else 0

    # Estimated range with full tank (from settings)
    estimated_range_nm = tank_capacity / avg_consumption_per_nm if avg_consumption_per_nm > 0 else 0

    return {
        "avg_consumption_per_nm": round(avg_consumption_per_nm, 3),
        "avg_consumption_per_hour": round(avg_consumption_per_hour, 2),
        "total_distance_with_fuel": round(total_distance, 2),
        "total_fuel_consumed": round(total_fuel, 2),
        "estimated_range_nm": round(estimated_range_nm, 1),
        "trips_analyzed": trips_with_fuel,
        "tank_capacity_l": tank_capacity
    }

def get_consumption_trend(months: int = 6) -> List[Dict]:
    """
    Get monthly consumption trend.
    Returns consumption per month for the last N months.
    """
    from datetime import datetime, timedelta
    import calendar
    import sys
    import os

    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    import logbook_storage

    fuel_list = load_fuel_entries()
    trips = logbook_storage.load_logbook_entries()

    if not fuel_list or not trips:
        return []

    # Get last N months
    now = datetime.now()
    months_data = []

    for i in range(months):
        # Calculate month start/end
        target_month = now.month - i
        target_year = now.year

        while target_month <= 0:
            target_month += 12
            target_year -= 1

        month_start = datetime(target_year, target_month, 1)

        # Get last day of month
        last_day = calendar.monthrange(target_year, target_month)[1]
        month_end = datetime(target_year, target_month, last_day, 23, 59, 59)

        # Filter trips and fuel for this month
        month_trips = [
            t for t in trips
            if month_start <= datetime.fromisoformat(t["trip_end"]) <= month_end
        ]

        month_fuel = [
            f for f in fuel_list
            if month_start <= datetime.fromisoformat(f["timestamp"]) <= month_end
        ]

        # Calculate stats
        total_distance = sum(t.get("distance", 0) for t in month_trips)
        total_fuel = sum(f.get("liters", 0) for f in month_fuel)

        consumption_per_nm = total_fuel / total_distance if total_distance > 0 else 0

        month_name = month_start.strftime("%B %Y")

        months_data.append({
            "month": target_month,
            "year": target_year,
            "month_name": month_name,
            "distance_nm": round(total_distance, 2),
            "fuel_liters": round(total_fuel, 2),
            "consumption_per_nm": round(consumption_per_nm, 3),
            "trips": len(month_trips),
            "refills": len(month_fuel)
        })

    # Reverse to show oldest first
    return list(reversed(months_data))
