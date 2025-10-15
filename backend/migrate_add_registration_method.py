#!/usr/bin/env python3
"""
Migration: Add registration_method column to locks table
"""

import sqlite3
from pathlib import Path

# Database path
DB_DIR = Path("data")
DB_PATH = DB_DIR / "locks.db"

def migrate():
    """Add registration_method column to locks table"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(locks)")
        columns = [row[1] for row in cursor.fetchall()]

        if 'registration_method' in columns:
            print("⚠️  Column 'registration_method' already exists. Skipping migration.")
            return

        # Add the new column
        cursor.execute("""
            ALTER TABLE locks
            ADD COLUMN registration_method TEXT
        """)

        conn.commit()
        print("✅ Successfully added 'registration_method' column to locks table")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
