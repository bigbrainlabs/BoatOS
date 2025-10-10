import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

LOGBOOK_DIR = Path("/home/arielle/BoatOS/data/logbook")

def save_logbook_entry(entry: Dict) -> str:
    """Save a logbook entry (trip or individual entry) to a JSON file.
    Returns the filename."""
    
    # Check if this is a trip (has trip_end) or a single entry (has timestamp)
    if "trip_end" in entry:
        # This is a complete trip
        timestamp = datetime.fromisoformat(entry["trip_end"])
        filename = f"trip_{timestamp.strftime('%Y-%m-%d_%H-%M-%S')}.json"
    else:
        # This is a single entry
        timestamp = datetime.fromisoformat(entry["timestamp"])
        filename = f"logbook_{timestamp.strftime('%Y-%m-%d_%H-%M-%S')}.json"
    
    filepath = LOGBOOK_DIR / filename
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(entry, f, indent=2, ensure_ascii=False)
    
    return filename

def load_logbook_entries() -> List[Dict]:
    """Load all logbook entries (trips) from disk, sorted by timestamp."""
    entries = []
    
    if not LOGBOOK_DIR.exists():
        LOGBOOK_DIR.mkdir(parents=True, exist_ok=True)
        return entries
    
    for filepath in LOGBOOK_DIR.glob("trip_*.json"):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                entry = json.load(f)
                entries.append(entry)
        except Exception as e:
            print(f"Error loading {filepath}: {e}")
    
    # Sort by trip_end timestamp
    entries.sort(key=lambda x: x.get("trip_end", ""))
    return entries

def get_logbook_entry(entry_id: int) -> Optional[Dict]:
    """Get a specific logbook entry by ID."""
    entries = load_logbook_entries()
    for entry in entries:
        if entry.get("id") == entry_id:
            return entry
    return None

def delete_logbook_entry(entry_id: int) -> bool:
    """Delete a logbook entry by ID."""
    entries = load_logbook_entries()
    for entry in entries:
        if entry.get("id") == entry_id:
            timestamp = datetime.fromisoformat(entry.get("trip_end", entry.get("timestamp")))
            prefix = "trip" if "trip_end" in entry else "logbook"
            filename = f"{prefix}_{timestamp.strftime('%Y-%m-%d_%H-%M-%S')}.json"
            filepath = LOGBOOK_DIR / filename
            if filepath.exists():
                filepath.unlink()
                return True
    return False

def update_logbook_entry(entry: Dict) -> bool:
    """Update an existing logbook entry."""
    delete_logbook_entry(entry["id"])
    save_logbook_entry(entry)
    return True
