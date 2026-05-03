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
    filepaths = []

    if not LOGBOOK_DIR.exists():
        LOGBOOK_DIR.mkdir(parents=True, exist_ok=True)
        return entries

    for filepath in LOGBOOK_DIR.glob("trip_*.json"):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                entry = json.load(f)
                entries.append(entry)
                filepaths.append(filepath)
        except Exception as e:
            print(f"Error loading {filepath}: {e}")

    # Sort by trip_end timestamp
    paired = sorted(zip(entries, filepaths), key=lambda x: x[0].get("trip_end", ""))
    entries = [e for e, _ in paired]
    filepaths = [f for _, f in paired]

    # Fix duplicate or missing IDs: reassign and persist
    seen_ids: set = set()
    needs_fix = any(e.get("id") is None or e.get("id") in seen_ids
                    or not seen_ids.add(e.get("id")) and False
                    for e in entries)
    seen_ids = set()
    for e in entries:
        eid = e.get("id")
        if eid is None or eid in seen_ids:
            needs_fix = True
            break
        seen_ids.add(eid)

    if needs_fix:
        for i, (entry, filepath) in enumerate(zip(entries, filepaths)):
            entry["id"] = i + 1
            try:
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(entry, f, indent=2, ensure_ascii=False)
            except Exception as e:
                print(f"Error fixing ID in {filepath}: {e}")

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
