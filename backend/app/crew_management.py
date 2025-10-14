"""
Crew Management Module
Handles crew members and their assignments to trips
"""
import json
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime

CREW_FILE = Path("/home/arielle/BoatOS/data/crew.json")
CREW_FILE.parent.mkdir(parents=True, exist_ok=True)

def load_crew() -> List[Dict]:
    """Load all crew members from disk."""
    if not CREW_FILE.exists():
        return []

    try:
        with open(CREW_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading crew: {e}")
        return []

def save_crew(crew_list: List[Dict]) -> bool:
    """Save crew list to disk."""
    try:
        with open(CREW_FILE, 'w', encoding='utf-8') as f:
            json.dump(crew_list, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving crew: {e}")
        return False

def add_crew_member(name: str, role: str = "Crew", email: str = "", phone: str = "") -> Dict:
    """Add a new crew member."""
    crew_list = load_crew()

    # Generate new ID
    new_id = max([c.get("id", 0) for c in crew_list], default=0) + 1

    crew_member = {
        "id": new_id,
        "name": name,
        "role": role,  # Captain, Crew, Guest
        "email": email,
        "phone": phone,
        "trips": 0,  # Count of trips participated
        "created": datetime.now().isoformat()
    }

    crew_list.append(crew_member)
    save_crew(crew_list)

    return crew_member

def get_crew_member(crew_id: int) -> Optional[Dict]:
    """Get a specific crew member by ID."""
    crew_list = load_crew()
    for member in crew_list:
        if member.get("id") == crew_id:
            return member
    return None

def update_crew_member(crew_id: int, updates: Dict) -> Optional[Dict]:
    """Update crew member information."""
    crew_list = load_crew()

    for i, member in enumerate(crew_list):
        if member.get("id") == crew_id:
            # Update fields
            for key, value in updates.items():
                if key != "id":  # Don't allow ID changes
                    member[key] = value

            crew_list[i] = member
            save_crew(crew_list)
            return member

    return None

def delete_crew_member(crew_id: int) -> bool:
    """Delete a crew member."""
    crew_list = load_crew()
    crew_list = [c for c in crew_list if c.get("id") != crew_id]
    return save_crew(crew_list)

def increment_trip_count(crew_id: int):
    """Increment trip count for a crew member."""
    crew_list = load_crew()

    for i, member in enumerate(crew_list):
        if member.get("id") == crew_id:
            member["trips"] = member.get("trips", 0) + 1
            crew_list[i] = member
            save_crew(crew_list)
            break

def increment_crew_trips(crew_id: int):
    """Alias for increment_trip_count for consistency."""
    increment_trip_count(crew_id)

def get_crew_stats() -> Dict:
    """Get crew statistics."""
    crew_list = load_crew()

    return {
        "total_members": len(crew_list),
        "captains": len([c for c in crew_list if c.get("role") == "Captain"]),
        "crew": len([c for c in crew_list if c.get("role") == "Crew"]),
        "guests": len([c for c in crew_list if c.get("role") == "Guest"]),
        "most_active": sorted(crew_list, key=lambda x: x.get("trips", 0), reverse=True)[:5]
    }
