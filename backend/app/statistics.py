"""
Statistics Module
Provides overview statistics for trips, fuel, crew, etc.
"""
import json
from pathlib import Path
from typing import Dict, List
from datetime import datetime, timedelta
import logbook_storage
import fuel_tracking
import crew_management

def get_trip_statistics(days: int = 365) -> Dict:
    """Get trip statistics for the last N days."""
    trips = logbook_storage.load_logbook_entries()

    # Filter by date
    cutoff = datetime.now() - timedelta(days=days)
    recent_trips = [
        t for t in trips
        if datetime.fromisoformat(t.get("trip_end", "")) > cutoff
    ]

    if not trips:
        return {
            "total_trips": 0,
            "total_distance_nm": 0,
            "total_duration_hours": 0,
            "avg_distance_nm": 0,
            "avg_duration_hours": 0,
            "longest_trip_nm": 0,
            "longest_trip_duration": 0
        }

    # Calculate totals
    total_distance = sum(float(t.get("distance", 0)) for t in trips)
    recent_distance = sum(float(t.get("distance", 0)) for t in recent_trips)

    # Parse duration strings (format: "H:MM" or "HH:MM")
    def parse_duration(duration_str: str) -> float:
        """Parse duration string to hours."""
        if not duration_str:
            return 0
        try:
            parts = duration_str.split(":")
            hours = int(parts[0])
            minutes = int(parts[1]) if len(parts) > 1 else 0
            return hours + minutes / 60
        except:
            return 0

    durations = [parse_duration(t.get("duration", "0:00")) for t in trips]
    total_duration = sum(durations)
    recent_durations = [parse_duration(t.get("duration", "0:00")) for t in recent_trips]
    recent_duration = sum(recent_durations)

    # Averages
    avg_distance = total_distance / len(trips) if trips else 0
    avg_duration = total_duration / len(trips) if trips else 0

    # Find longest
    trips_with_distance = [(t, float(t.get("distance", 0))) for t in trips]
    longest_trip_by_distance = max(trips_with_distance, key=lambda x: x[1], default=(None, 0))

    trips_with_duration = [(t, parse_duration(t.get("duration", "0:00"))) for t in trips]
    longest_trip_by_duration = max(trips_with_duration, key=lambda x: x[1], default=(None, 0))

    return {
        "total_trips": len(trips),
        "recent_trips": len(recent_trips),
        "total_distance_nm": round(total_distance, 2),
        "recent_distance_nm": round(recent_distance, 2),
        "total_duration_hours": round(total_duration, 1),
        "recent_duration_hours": round(recent_duration, 1),
        "avg_distance_nm": round(avg_distance, 2),
        "avg_duration_hours": round(avg_duration, 1),
        "longest_trip_nm": round(longest_trip_by_distance[1], 2),
        "longest_trip_duration_hours": round(longest_trip_by_duration[1], 1),
        "period_days": days
    }

def get_monthly_statistics() -> List[Dict]:
    """Get monthly breakdown of trips and distance."""
    trips = logbook_storage.load_logbook_entries()

    # Group by month
    monthly_data = {}

    for trip in trips:
        trip_end = datetime.fromisoformat(trip.get("trip_end", ""))
        month_key = trip_end.strftime("%Y-%m")

        if month_key not in monthly_data:
            monthly_data[month_key] = {
                "month": month_key,
                "month_name": trip_end.strftime("%B %Y"),
                "trips": 0,
                "distance_nm": 0
            }

        monthly_data[month_key]["trips"] += 1
        monthly_data[month_key]["distance_nm"] += float(trip.get("distance", 0))

    # Convert to list and sort by month
    result = list(monthly_data.values())
    result.sort(key=lambda x: x["month"])

    # Round distances
    for month in result:
        month["distance_nm"] = round(month["distance_nm"], 2)

    return result

def get_dashboard_summary() -> Dict:
    """Get complete dashboard summary with all statistics."""
    trip_stats = get_trip_statistics(days=365)
    fuel_stats = fuel_tracking.get_fuel_stats(days=30)
    crew_stats = crew_management.get_crew_stats()
    monthly = get_monthly_statistics()

    # Get last 6 months for charts
    recent_monthly = monthly[-6:] if len(monthly) >= 6 else monthly

    return {
        "trips": trip_stats,
        "fuel": fuel_stats,
        "crew": crew_stats,
        "monthly_breakdown": recent_monthly,
        "generated_at": datetime.now().isoformat()
    }

def get_yearly_comparison() -> Dict:
    """Compare current year with previous year."""
    trips = logbook_storage.load_logbook_entries()

    current_year = datetime.now().year
    previous_year = current_year - 1

    current_year_trips = [
        t for t in trips
        if datetime.fromisoformat(t.get("trip_end", "")).year == current_year
    ]

    previous_year_trips = [
        t for t in trips
        if datetime.fromisoformat(t.get("trip_end", "")).year == previous_year
    ]

    def calc_totals(trip_list):
        distance = sum(float(t.get("distance", 0)) for t in trip_list)
        return {
            "trips": len(trip_list),
            "distance_nm": round(distance, 2)
        }

    current = calc_totals(current_year_trips)
    previous = calc_totals(previous_year_trips)

    # Calculate change percentages
    trip_change = ((current["trips"] - previous["trips"]) / previous["trips"] * 100) if previous["trips"] > 0 else 0
    distance_change = ((current["distance_nm"] - previous["distance_nm"]) / previous["distance_nm"] * 100) if previous["distance_nm"] > 0 else 0

    return {
        "current_year": current_year,
        "current": current,
        "previous_year": previous_year,
        "previous": previous,
        "trip_change_percent": round(trip_change, 1),
        "distance_change_percent": round(distance_change, 1)
    }
