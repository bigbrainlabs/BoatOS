"""
Lock (Schleuse) Storage Module
Handles database operations for locks/sluices on German waterways
"""

import sqlite3
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime, time

# Database path
DB_DIR = Path("data")
DB_DIR.mkdir(exist_ok=True)
DB_PATH = DB_DIR / "locks.db"

def init_locks_db():
    """Initialize locks database with schema"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS locks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            waterway TEXT NOT NULL,

            -- Location
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            river_km REAL,

            -- Contact Information
            phone TEXT,
            vhf_channel TEXT,
            email TEXT,
            website TEXT,

            -- Opening Hours (JSON format)
            -- Example: {"mo": "06:00-20:00", "tu": "06:00-20:00", ...}
            opening_hours TEXT,

            -- Break times (JSON format)
            -- Example: [{"start": "12:00", "end": "13:00"}]
            break_times TEXT,

            -- Technical Data
            max_length REAL,      -- meters
            max_width REAL,       -- meters
            max_draft REAL,       -- meters
            max_height REAL,      -- meters (above water)

            -- Lock Operation
            avg_duration INTEGER, -- minutes
            requires_booking BOOLEAN DEFAULT 0,
            supports_sms BOOLEAN DEFAULT 0,
            api_endpoint TEXT,

            -- Additional Info
            notes TEXT,
            facilities TEXT,      -- JSON: ["water", "electricity", "waste"]

            -- Community Data
            rating REAL,
            wait_time_current INTEGER,  -- minutes, updated by users
            last_updated TIMESTAMP,

            -- Metadata
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create index for geographic queries
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_locks_location
        ON locks(lat, lon)
    """)

    # Create index for waterway queries
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_locks_waterway
        ON locks(waterway)
    """)

    conn.commit()
    conn.close()
    print("✅ Locks database initialized")

def load_locks() -> List[Dict[str, Any]]:
    """Load all locks from database"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM locks ORDER BY waterway, name")
    rows = cursor.fetchall()

    locks = []
    for row in rows:
        lock = dict(row)
        # Parse JSON fields
        if lock['opening_hours']:
            lock['opening_hours'] = json.loads(lock['opening_hours'])
        if lock['break_times']:
            lock['break_times'] = json.loads(lock['break_times'])
        if lock['facilities']:
            lock['facilities'] = json.loads(lock['facilities'])
        locks.append(lock)

    conn.close()
    return locks

def get_lock(lock_id: int) -> Optional[Dict[str, Any]]:
    """Get lock by ID"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM locks WHERE id = ?", (lock_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    lock = dict(row)
    # Parse JSON fields
    if lock['opening_hours']:
        lock['opening_hours'] = json.loads(lock['opening_hours'])
    if lock['break_times']:
        lock['break_times'] = json.loads(lock['break_times'])
    if lock['facilities']:
        lock['facilities'] = json.loads(lock['facilities'])

    return lock

def get_locks_in_bounds(lat_min: float, lon_min: float,
                        lat_max: float, lon_max: float) -> List[Dict[str, Any]]:
    """Get locks within geographic bounds"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM locks
        WHERE lat BETWEEN ? AND ?
        AND lon BETWEEN ? AND ?
        ORDER BY name
    """, (lat_min, lat_max, lon_min, lon_max))

    rows = cursor.fetchall()
    conn.close()

    locks = []
    for row in rows:
        lock = dict(row)
        # Parse JSON fields
        if lock['opening_hours']:
            lock['opening_hours'] = json.loads(lock['opening_hours'])
        if lock['break_times']:
            lock['break_times'] = json.loads(lock['break_times'])
        if lock['facilities']:
            lock['facilities'] = json.loads(lock['facilities'])
        locks.append(lock)

    return locks

def get_locks_nearby(lat: float, lon: float, radius_km: float = 50) -> List[Dict[str, Any]]:
    """
    Get locks near a location (simplified rectangular bounds)
    For accurate distance, use Haversine formula
    """
    # Rough approximation: 1 degree lat ≈ 111 km, 1 degree lon ≈ 71 km (at Germany's latitude)
    lat_delta = radius_km / 111.0
    lon_delta = radius_km / 71.0

    return get_locks_in_bounds(
        lat - lat_delta, lon - lon_delta,
        lat + lat_delta, lon + lon_delta
    )

def add_lock(lock_data: Dict[str, Any]) -> int:
    """Add new lock to database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Serialize JSON fields
    if 'opening_hours' in lock_data and isinstance(lock_data['opening_hours'], dict):
        lock_data['opening_hours'] = json.dumps(lock_data['opening_hours'])
    if 'break_times' in lock_data and isinstance(lock_data['break_times'], list):
        lock_data['break_times'] = json.dumps(lock_data['break_times'])
    if 'facilities' in lock_data and isinstance(lock_data['facilities'], list):
        lock_data['facilities'] = json.dumps(lock_data['facilities'])

    cursor.execute("""
        INSERT INTO locks (
            name, waterway, lat, lon, river_km,
            phone, vhf_channel, email, website,
            opening_hours, break_times,
            max_length, max_width, max_draft, max_height,
            avg_duration, requires_booking, supports_sms, api_endpoint,
            notes, facilities
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        lock_data.get('name'),
        lock_data.get('waterway'),
        lock_data.get('lat'),
        lock_data.get('lon'),
        lock_data.get('river_km'),
        lock_data.get('phone'),
        lock_data.get('vhf_channel'),
        lock_data.get('email'),
        lock_data.get('website'),
        lock_data.get('opening_hours'),
        lock_data.get('break_times'),
        lock_data.get('max_length'),
        lock_data.get('max_width'),
        lock_data.get('max_draft'),
        lock_data.get('max_height'),
        lock_data.get('avg_duration'),
        lock_data.get('requires_booking', 0),
        lock_data.get('supports_sms', 0),
        lock_data.get('api_endpoint'),
        lock_data.get('notes'),
        lock_data.get('facilities')
    ))

    lock_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return lock_id

def update_lock(lock_id: int, lock_data: Dict[str, Any]) -> bool:
    """Update existing lock"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Serialize JSON fields
    if 'opening_hours' in lock_data and isinstance(lock_data['opening_hours'], dict):
        lock_data['opening_hours'] = json.dumps(lock_data['opening_hours'])
    if 'break_times' in lock_data and isinstance(lock_data['break_times'], list):
        lock_data['break_times'] = json.dumps(lock_data['break_times'])
    if 'facilities' in lock_data and isinstance(lock_data['facilities'], list):
        lock_data['facilities'] = json.dumps(lock_data['facilities'])

    # Build UPDATE query dynamically based on provided fields
    fields = []
    values = []
    for key, value in lock_data.items():
        if key != 'id':
            fields.append(f"{key} = ?")
            values.append(value)

    if not fields:
        conn.close()
        return False

    # Add updated_at timestamp
    fields.append("updated_at = CURRENT_TIMESTAMP")
    values.append(lock_id)

    query = f"UPDATE locks SET {', '.join(fields)} WHERE id = ?"
    cursor.execute(query, values)

    success = cursor.rowcount > 0
    conn.commit()
    conn.close()

    return success

def delete_lock(lock_id: int) -> bool:
    """Delete lock from database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("DELETE FROM locks WHERE id = ?", (lock_id,))

    success = cursor.rowcount > 0
    conn.commit()
    conn.close()

    return success

def is_lock_open(lock_id: int, check_time: datetime = None) -> Dict[str, Any]:
    """
    Check if lock is currently open

    Returns:
        {
            "is_open": bool,
            "reason": str,
            "next_opening": str (ISO format),
            "next_closing": str (ISO format)
        }
    """
    if check_time is None:
        check_time = datetime.now()

    lock = get_lock(lock_id)
    if not lock:
        return {"is_open": False, "reason": "Lock not found"}

    if not lock['opening_hours']:
        return {"is_open": True, "reason": "24/7 operation (no hours specified)"}

    # Get weekday (0=Monday, 6=Sunday)
    weekday_map = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su']
    weekday = weekday_map[check_time.weekday()]

    hours = lock['opening_hours'].get(weekday)
    if not hours:
        return {"is_open": False, "reason": f"Closed on {weekday.upper()}"}

    # Parse opening hours (format: "06:00-20:00")
    try:
        open_time_str, close_time_str = hours.split('-')
        open_hour, open_min = map(int, open_time_str.split(':'))
        close_hour, close_min = map(int, close_time_str.split(':'))

        open_time = time(open_hour, open_min)
        close_time = time(close_hour, close_min)
        current_time = check_time.time()

        is_open = open_time <= current_time <= close_time

        # Check break times
        if is_open and lock['break_times']:
            for break_period in lock['break_times']:
                break_start_str = break_period['start']
                break_end_str = break_period['end']
                break_start_h, break_start_m = map(int, break_start_str.split(':'))
                break_end_h, break_end_m = map(int, break_end_str.split(':'))

                break_start = time(break_start_h, break_start_m)
                break_end = time(break_end_h, break_end_m)

                if break_start <= current_time <= break_end:
                    return {
                        "is_open": False,
                        "reason": f"Break time ({break_start_str}-{break_end_str})",
                        "next_opening": break_end_str
                    }

        return {
            "is_open": is_open,
            "reason": "Open" if is_open else f"Closed (hours: {hours})",
            "opens_at": open_time_str if not is_open else None,
            "closes_at": close_time_str if is_open else None
        }

    except Exception as e:
        return {"is_open": False, "reason": f"Error parsing hours: {e}"}

def get_locks_by_waterway(waterway: str) -> List[Dict[str, Any]]:
    """Get all locks on a specific waterway"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM locks
        WHERE waterway LIKE ?
        ORDER BY river_km
    """, (f"%{waterway}%",))

    rows = cursor.fetchall()
    conn.close()

    locks = []
    for row in rows:
        lock = dict(row)
        if lock['opening_hours']:
            lock['opening_hours'] = json.loads(lock['opening_hours'])
        if lock['break_times']:
            lock['break_times'] = json.loads(lock['break_times'])
        if lock['facilities']:
            lock['facilities'] = json.loads(lock['facilities'])
        locks.append(lock)

    return locks

def get_locks_on_route(route_coordinates: List[List[float]], buffer_meters: float = 500) -> List[Dict[str, Any]]:
    """
    Find locks along a route

    Args:
        route_coordinates: List of [lon, lat] coordinates
        buffer_meters: Buffer distance in meters to search around route (default: 500m)

    Returns:
        List of locks along the route with distance from start
    """
    import math

    def haversine_distance(lat1, lon1, lat2, lon2):
        """Calculate distance in meters between two points"""
        R = 6371000  # Earth radius in meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = (math.sin(delta_phi / 2) ** 2 +
             math.cos(phi1) * math.cos(phi2) *
             math.sin(delta_lambda / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c

    def point_to_line_distance(point_lat, point_lon, line_start, line_end):
        """Calculate minimum distance from point to line segment"""
        lat1, lon1 = line_end[1], line_end[0]  # Convert from [lon, lat]
        lat2, lon2 = line_start[1], line_start[0]
        lat3, lon3 = point_lat, point_lon

        # Calculate distances
        d12 = haversine_distance(lat1, lon1, lat2, lon2)
        d13 = haversine_distance(lat1, lon1, lat3, lon3)
        d23 = haversine_distance(lat2, lon2, lat3, lon3)

        if d12 == 0:
            return d13

        # Use Heron's formula to find perpendicular distance
        s = (d12 + d13 + d23) / 2
        area = math.sqrt(max(0, s * (s - d12) * (s - d13) * (s - d23)))
        distance = (2 * area) / d12

        # Check if projection falls within segment
        dot = ((lat3 - lat1) * (lat2 - lat1) + (lon3 - lon1) * (lon2 - lon1))
        len_sq = (lat2 - lat1) ** 2 + (lon2 - lon1) ** 2

        if len_sq == 0:
            return d13

        param = dot / len_sq

        if param < 0:
            return d13
        elif param > 1:
            return d23
        else:
            return distance

    # Get bounding box of route
    lats = [coord[1] for coord in route_coordinates]
    lons = [coord[0] for coord in route_coordinates]

    # Add buffer (approx 500m = 0.0045 degrees)
    buffer_deg = buffer_meters / 111000  # Rough conversion

    lat_min = min(lats) - buffer_deg
    lat_max = max(lats) + buffer_deg
    lon_min = min(lons) - buffer_deg
    lon_max = max(lons) + buffer_deg

    # Get all locks in bounding box
    candidate_locks = get_locks_in_bounds(lat_min, lon_min, lat_max, lon_max)

    # Filter locks that are actually close to the route
    locks_on_route = []

    for lock in candidate_locks:
        lock_lat, lock_lon = lock['lat'], lock['lon']

        # Check distance to each route segment
        min_distance = float('inf')
        closest_segment_idx = -1

        for i in range(len(route_coordinates) - 1):
            distance = point_to_line_distance(
                lock_lat, lock_lon,
                route_coordinates[i],
                route_coordinates[i + 1]
            )

            if distance < min_distance:
                min_distance = distance
                closest_segment_idx = i

        # If lock is within buffer distance, include it
        if min_distance <= buffer_meters:
            # Calculate distance from route start
            distance_from_start = 0
            for i in range(closest_segment_idx):
                distance_from_start += haversine_distance(
                    route_coordinates[i][1], route_coordinates[i][0],
                    route_coordinates[i + 1][1], route_coordinates[i + 1][0]
                )

            # Add lock with additional info
            lock['distance_from_start'] = round(distance_from_start)
            lock['distance_from_route'] = round(min_distance)
            locks_on_route.append(lock)

    # Sort by distance from start
    locks_on_route.sort(key=lambda x: x['distance_from_start'])

    return locks_on_route

def check_locks_availability(locks_on_route: List[Dict[str, Any]],
                             departure_time: datetime,
                             boat_speed_kmh: float) -> List[Dict[str, Any]]:
    """
    Check if locks will be open at estimated arrival time

    Args:
        locks_on_route: List of locks with distance_from_start in meters
        departure_time: Planned departure datetime
        boat_speed_kmh: Boat speed in km/h

    Returns:
        List of warnings for closed locks with suggested departure times
    """
    import math
    from datetime import timedelta

    warnings = []
    boat_speed_ms = boat_speed_kmh * 1000 / 3600  # Convert to m/s

    for lock in locks_on_route:
        # Calculate travel time to this lock
        distance_m = lock.get('distance_from_start', 0)
        travel_time_s = distance_m / boat_speed_ms if boat_speed_ms > 0 else 0

        # Add time for previous locks
        previous_locks_time_s = 0
        for prev_lock in locks_on_route:
            if prev_lock['distance_from_start'] < distance_m:
                lock_duration_min = prev_lock.get('avg_duration', 15)
                previous_locks_time_s += lock_duration_min * 60

        total_travel_time_s = travel_time_s + previous_locks_time_s
        arrival_time = departure_time + timedelta(seconds=total_travel_time_s)

        # Check if lock is open at arrival time
        lock_status = is_lock_open(lock['id'], arrival_time)

        if not lock_status.get('is_open', True):
            # Lock will be closed - create warning
            warning = {
                'lock_id': lock['id'],
                'lock_name': lock['name'],
                'waterway': lock.get('waterway', ''),
                'distance_from_start_m': distance_m,
                'distance_from_start_km': round(distance_m / 1000, 1),
                'estimated_arrival': arrival_time.isoformat(),
                'estimated_arrival_formatted': arrival_time.strftime('%H:%M'),
                'is_open': False,
                'reason': lock_status.get('reason', 'Closed'),
                'opens_at': lock_status.get('opens_at'),
                'closes_at': lock_status.get('closes_at'),
            }

            # Calculate suggested departure time to arrive when open
            if lock_status.get('opens_at'):
                # Parse opening time
                try:
                    open_hour, open_min = map(int, lock_status['opens_at'].split(':'))

                    # Find next opening (could be today or tomorrow)
                    next_opening = arrival_time.replace(hour=open_hour, minute=open_min, second=0, microsecond=0)

                    if next_opening <= arrival_time:
                        # Opening already passed today, use tomorrow
                        next_opening += timedelta(days=1)

                    # Calculate when to depart to arrive at opening time
                    suggested_departure = next_opening - timedelta(seconds=total_travel_time_s)

                    warning['suggested_departure'] = suggested_departure.isoformat()
                    warning['suggested_departure_formatted'] = suggested_departure.strftime('%H:%M')
                    warning['next_opening'] = next_opening.isoformat()
                    warning['next_opening_formatted'] = next_opening.strftime('%H:%M')

                    # Calculate delay
                    delay_s = (suggested_departure - departure_time).total_seconds()
                    if delay_s > 0:
                        warning['delay_hours'] = round(delay_s / 3600, 1)
                        warning['delay_formatted'] = f"{int(delay_s // 3600)}h {int((delay_s % 3600) // 60)}min"

                except Exception as e:
                    warning['error'] = f"Could not calculate suggested departure: {e}"

            warnings.append(warning)

    return warnings

# Initialize database on module load
init_locks_db()
