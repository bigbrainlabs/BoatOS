"""
Weather Alerts Module
Fetches severe weather warnings from DWD via Bright Sky API
"""
import aiohttp
from datetime import datetime
from typing import List, Dict, Any

BRIGHTSKY_API_URL = "https://api.brightsky.dev"

# Cache for alerts
alerts_cache: Dict[str, Any] = {
    "alerts": [],
    "last_updated": None,
    "location": None
}

async def fetch_weather_alerts(lat: float, lon: float) -> Dict[str, Any]:
    """
    Fetch weather alerts for a given location from Bright Sky (DWD data)

    Args:
        lat: Latitude
        lon: Longitude

    Returns:
        Dict with alerts and metadata
    """
    global alerts_cache

    try:
        async with aiohttp.ClientSession() as session:
            url = f"{BRIGHTSKY_API_URL}/alerts?lat={lat}&lon={lon}"

            async with session.get(url) as resp:
                if resp.status == 200:
                    data = await resp.json()

                    # Update cache
                    alerts_cache = {
                        "alerts": data.get("alerts", []),
                        "last_updated": datetime.now().isoformat(),
                        "location": {"lat": lat, "lon": lon},
                        "count": len(data.get("alerts", []))
                    }

                    print(f"✅ Weather alerts updated: {alerts_cache['count']} active warning(s)")
                    return alerts_cache
                else:
                    print(f"⚠️ Weather alerts API error: {resp.status}")
                    return alerts_cache
    except Exception as e:
        print(f"⚠️ Weather alerts fetch error: {e}")
        return alerts_cache

def get_cached_alerts() -> Dict[str, Any]:
    """Get cached alerts without making a new API call"""
    return alerts_cache

def get_alert_severity_level(severity: str) -> int:
    """
    Convert DWD severity to numeric level for UI

    DWD Severity levels:
    - Minor: Level 1 (Yellow)
    - Moderate: Level 2 (Orange)
    - Severe: Level 3 (Red)
    - Extreme: Level 4 (Dark Red)

    Args:
        severity: DWD severity string

    Returns:
        int: Numeric level (1-4)
    """
    severity_map = {
        "Minor": 1,
        "Moderate": 2,
        "Severe": 3,
        "Extreme": 4
    }
    return severity_map.get(severity, 1)

def get_alert_color(severity: str) -> str:
    """
    Get color code for alert severity

    Args:
        severity: DWD severity string

    Returns:
        str: Hex color code
    """
    color_map = {
        "Minor": "#FFD700",      # Yellow
        "Moderate": "#FF8C00",   # Orange
        "Severe": "#FF4500",     # Red-Orange
        "Extreme": "#8B0000"     # Dark Red
    }
    return color_map.get(severity, "#FFD700")

def filter_alerts_by_severity(alerts: List[Dict], min_severity: int = 1) -> List[Dict]:
    """
    Filter alerts by minimum severity level

    Args:
        alerts: List of alert dicts
        min_severity: Minimum severity level (1-4)

    Returns:
        List of filtered alerts
    """
    return [
        alert for alert in alerts
        if get_alert_severity_level(alert.get("severity", "Minor")) >= min_severity
    ]

def get_highest_severity_alert(alerts: List[Dict]) -> Dict[str, Any]:
    """
    Get the most severe alert from a list

    Args:
        alerts: List of alert dicts

    Returns:
        Dict with highest severity alert or None
    """
    if not alerts:
        return None

    return max(
        alerts,
        key=lambda a: get_alert_severity_level(a.get("severity", "Minor"))
    )

def format_alert_for_ui(alert: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format alert data for frontend display

    Args:
        alert: Raw alert dict from Bright Sky

    Returns:
        Formatted alert dict
    """
    severity = alert.get("severity", "Minor")

    return {
        "id": alert.get("id"),
        "event": alert.get("event", "Unknown Event"),
        "headline": alert.get("headline", ""),
        "description": alert.get("description", ""),
        "severity": severity,
        "severity_level": get_alert_severity_level(severity),
        "color": get_alert_color(severity),
        "effective": alert.get("effective"),
        "onset": alert.get("onset"),
        "expires": alert.get("expires"),
        "instruction": alert.get("instruction", ""),
        "urgency": alert.get("urgency", ""),
        "category": alert.get("category", "")
    }
