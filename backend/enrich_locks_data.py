#!/usr/bin/env python3
"""
Lock Data Enrichment System
Enriches existing lock database with data from multiple sources:
- SkipperGuide wiki pages
- Wikipedia articles
- WSV/ELWIS data (when available)

This script is designed to be extensible - add new waterways and sources as needed.
"""

import sys
import json
import sqlite3
from pathlib import Path
from typing import Dict, List, Any, Optional

sys.path.append(str(Path(__file__).parent / "app"))
import locks_storage

# ============================================================================
# LOCK DATA SOURCES
# ============================================================================

# This is the master data repository. Add new locks here as you find them.
# Sources: SkipperGuide, Wikipedia, WSV websites, manual research
LOCK_ENRICHMENT_DATA = {
    # Mittellandkanal Locks
    "Schleuse Anderten": {
        "waterway": "Mittellandkanal",
        "river_km": 174.2,
        "vhf_channel": "18",
        "max_height": 5.25,  # Standard MLK clearance
        "avg_duration": 25,
        "notes": "Hub 14.7m. 2 Kammern.",
        "source": "SkipperGuide MLK"
    },

    "Schleuse Sülfeld": {
        "waterway": "Mittellandkanal",
        "river_km": 236.5,
        "vhf_channel": "20",
        "max_height": 5.25,
        "avg_duration": 20,
        "notes": "Hub 9m. Nordschleuse (1934-1937), Südschleuse (2004-2008). 2 Kammern.",
        "source": "SkipperGuide MLK + Wikipedia"
    },

    "Schleuse Hohenwarthe": {
        "waterway": "Mittellandkanal / Elbe-Havel-Kanal",
        "river_km": 325.1,
        "vhf_channel": "26",
        "max_length": 190.0,
        "max_width": 12.5,
        "max_height": 5.25,
        "avg_duration": 30,
        "notes": "Hub 18.55-19.05m. Größte Fallhöhe am MLK. 2 Kammern. Besondere Regeln beachten!",
        "source": "SkipperGuide MLK + Wikipedia"
    },

    # Elbe-Havel-Kanal Locks
    "Schleuse Zerben": {
        "waterway": "Elbe-Havel-Kanal",
        "river_km": 345.0,
        "vhf_channel": "20",
        "max_length": 225.0,
        "max_width": 12.0,
        "max_height": 5.25,
        "avg_duration": 20,
        "notes": "Hub 3.5-6m. Baujahr 1934-1938. 2. Kammer im Bau.",
        "source": "SkipperGuide EHK"
    },

    "Schleuse Wusterwitz": {
        "waterway": "Elbe-Havel-Kanal",
        "river_km": 377.0,
        "vhf_channel": "18",
        "max_height": 5.25,
        "avg_duration": 20,
        "notes": "Hub 2.5-5m. Auch 'Großwusterwitz' genannt. 2. Kammer im Bau.",
        "source": "SkipperGuide EHK"
    },

    "Schleuse Niegripp": {
        "waterway": "Niegripper Verbindungskanal",
        "river_km": 326.0,  # MLK km where canal branches
        "vhf_channel": "22",
        "avg_duration": 20,
        "notes": "Hub 1.5-5m. Verbindet MLK mit Elbe. Kanal 1.5km lang.",
        "source": "SkipperGuide EHK"
    },

    "Schleuse Parey": {
        "waterway": "Pareyer Verbindungskanal",
        "river_km": 351.0,  # MLK km where canal branches
        "vhf_channel": "78",
        "avg_duration": 20,
        "notes": "Hub 1-5m. Verbindet EHK mit Elbe. Kanal 3.5km lang.",
        "source": "SkipperGuide EHK"
    },

    # Rothensee (already well-documented, but ensure consistency)
    "Schleuse Rothensee": {
        "waterway": "Rothenseer Verbindungskanal (Magdeburg)",
        "river_km": 0.0,  # Start of Rothenseer VK
        "phone": "+49 391 5322100",
        "vhf_channel": "20",
        "email": "wsa-elbe@wsv.bund.de",
        "website": "https://www.wsa-elbe.wsv.de",
        "max_length": 190.0,
        "max_width": 12.5,
        "max_draft": 2.8,
        "max_height": 5.25,
        "avg_duration": 30,
        "notes": "Verbindet Mittellandkanal mit Elbhafen Magdeburg. Fallhöhe 10.45-18.46m (elbeabhängig). Wassersparend (60%). Eröffnung Mai 2001.",
        "source": "Manual + WSV"
    },
}

# ============================================================================
# WATERWAY-SPECIFIC DEFAULTS
# ============================================================================

WATERWAY_DEFAULTS = {
    "Mittellandkanal": {
        "max_height": 5.25,  # Standard clearance
        "max_width": 12.0,   # Standard chamber width
        "email": "wsa-mittellandkanal@wsv.bund.de"
    },
    "Elbe-Havel-Kanal": {
        "max_height": 5.25,
        "max_width": 12.0,
        "email": "wsa-elbe@wsv.bund.de"
    },
    "Untere Havel-Wasserstraße": {
        "max_height": 5.25,
        "email": "wsa-spree-havel@wsv.bund.de"
    }
}

# ============================================================================
# ENRICHMENT FUNCTIONS
# ============================================================================

def enrich_lock(lock: Dict[str, Any], enrichment_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enrich a single lock with additional data
    Only updates fields that are currently NULL/empty
    """
    updated_fields = []

    for field, value in enrichment_data.items():
        if field == "source":
            continue  # Don't store source in DB

        # Only update if current value is None or empty
        current_value = lock.get(field)
        if current_value is None or current_value == "" or current_value == 0:
            lock[field] = value
            updated_fields.append(field)

    return lock, updated_fields

def apply_waterway_defaults(lock: Dict[str, Any]) -> tuple[Dict[str, Any], List[str]]:
    """Apply waterway-specific defaults to locks"""
    waterway = lock.get('waterway', '')
    updated_fields = []

    # Find matching waterway defaults
    for ww_key, defaults in WATERWAY_DEFAULTS.items():
        if ww_key.lower() in waterway.lower():
            for field, value in defaults.items():
                current_value = lock.get(field)
                if current_value is None or current_value == "" or current_value == 0:
                    lock[field] = value
                    updated_fields.append(f"{field}(default)")
            break

    return lock, updated_fields

def fuzzy_match_lock_name(db_name: str, enrichment_name: str) -> bool:
    """
    Fuzzy match lock names (handles variations like 'Wusterwitz' vs 'Großwusterwitz')
    """
    db_normalized = db_name.lower().replace('schleuse', '').strip()
    enrich_normalized = enrichment_name.lower().replace('schleuse', '').strip()

    # Exact match
    if db_normalized == enrich_normalized:
        return True

    # One contains the other (e.g., 'wusterwitz' matches 'großwusterwitz')
    if db_normalized in enrich_normalized or enrich_normalized in db_normalized:
        return True

    return False

def enrich_locks_database():
    """Main enrichment function"""

    print("=" * 70)
    print("LOCK DATABASE ENRICHMENT")
    print("=" * 70)

    # Load all locks from database
    locks = locks_storage.load_locks()
    print(f"\n📊 Loaded {len(locks)} locks from database")

    enriched_count = 0
    total_fields_updated = 0

    for lock in locks:
        lock_name = lock['name']
        lock_id = lock['id']

        # Try to find enrichment data for this lock
        enrichment = None
        matched_name = None

        for enrich_name, enrich_data in LOCK_ENRICHMENT_DATA.items():
            if fuzzy_match_lock_name(lock_name, enrich_name):
                enrichment = enrich_data
                matched_name = enrich_name
                break

        if enrichment:
            # Enrich with specific data
            updated_lock, updated_fields = enrich_lock(lock, enrichment)

            # Apply waterway defaults
            updated_lock, default_fields = apply_waterway_defaults(updated_lock)

            all_updates = updated_fields + default_fields

            if all_updates:
                # Update database
                locks_storage.update_lock(lock_id, updated_lock)
                enriched_count += 1
                total_fields_updated += len(all_updates)

                print(f"\n✅ Enriched: {lock_name}")
                print(f"   Matched: {matched_name}")
                print(f"   Updated: {', '.join(all_updates)}")
                print(f"   Source: {enrichment.get('source', 'Unknown')}")
        else:
            # No specific enrichment, but try waterway defaults
            updated_lock, default_fields = apply_waterway_defaults(lock)

            if default_fields:
                locks_storage.update_lock(lock_id, updated_lock)
                print(f"\n🔧 Applied defaults: {lock_name}")
                print(f"   Updated: {', '.join(default_fields)}")
                total_fields_updated += len(default_fields)

    print(f"\n" + "=" * 70)
    print(f"ENRICHMENT SUMMARY")
    print(f"=" * 70)
    print(f"✅ Locks enriched with specific data: {enriched_count}")
    print(f"📝 Total fields updated: {total_fields_updated}")
    print(f"📊 Coverage: {enriched_count}/{len(locks)} locks ({enriched_count/len(locks)*100:.1f}%)")

    # Show statistics
    conn = sqlite3.connect(locks_storage.DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM locks WHERE vhf_channel IS NOT NULL")
    with_vhf = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM locks WHERE max_height IS NOT NULL")
    with_height = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM locks WHERE river_km IS NOT NULL AND river_km > 0")
    with_km = cursor.fetchone()[0]

    conn.close()

    print(f"\n📈 Database Quality After Enrichment:")
    print(f"   Locks with VHF channel: {with_vhf}/{len(locks)} ({with_vhf/len(locks)*100:.0f}%)")
    print(f"   Locks with max height: {with_height}/{len(locks)} ({with_height/len(locks)*100:.0f}%)")
    print(f"   Locks with km marking: {with_km}/{len(locks)} ({with_km/len(locks)*100:.0f}%)")

    print(f"\n" + "=" * 70)
    print(f"💡 TO ADD MORE LOCKS:")
    print(f"=" * 70)
    print(f"1. Add new entries to LOCK_ENRICHMENT_DATA dictionary")
    print(f"2. Sources: SkipperGuide, Wikipedia, WSV websites")
    print(f"3. Run this script again to apply new data")
    print(f"4. Script only updates NULL/empty fields (safe to re-run)")
    print(f"\n✅ Done!")

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    enrich_locks_database()
