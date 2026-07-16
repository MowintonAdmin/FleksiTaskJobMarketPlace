"""
Migrate data from SQLite (local.db) to PostgreSQL (running Docker container).
Run this script INSIDE the backend Docker container:
    docker cp backend/local.db flekxitask-backend:/app/local.db
    docker exec -it flekxitask-backend python /app/migrate_sqlite_to_postgres.py
"""

import asyncio
import os
import sys

sys.path.insert(0, '/app')

import sqlite3
from datetime import datetime

# PostgreSQL connection
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://fleksi:password@postgres:5432/flekxitask"
)

# Parse the async URL to get sync URL
PG_URL = DATABASE_URL.replace("+asyncpg", "")


async def migrate():
    import asyncpg

    # Connect to SQLite
    sqlite_path = "/app/local.db"
    if not os.path.exists(sqlite_path):
        print(f"ERROR: SQLite database not found at {sqlite_path}")
        return

    sl_conn = sqlite3.connect(sqlite_path)
    sl_conn.row_factory = sqlite3.Row
    print(f"SQLite connected: {sqlite_path}")

    # Connect to PostgreSQL
    pg_conn = await asyncpg.connect(
        user="fleksi", password="password",
        host="postgres", port=5432, database="flekxitask"
    )
    print("PostgreSQL connected")

    # Tables to migrate (excluding alembic_version)
    tables = [
        "users", "projects", "tasks", "applications", "messages",
        "wallets", "transactions", "withdrawal_requests",
        "bank_accounts", "task_sessions"
    ]

    total_migrated = 0
    total_skipped = 0

    for table in tables:
        # Get SQLite rows
        sl_rows = sl_conn.execute(f"SELECT * FROM {table}").fetchall()
        if not sl_rows:
            print(f"{table}: 0 rows (empty)")
            continue

        # Get column names (excluding id for existing rows check)
        columns = [desc[0] for desc in sl_conn.execute(f"PRAGMA table_info({table})").fetchall()]

        migrated = 0
        skipped = 0

        for row in sl_rows:
            row_dict = dict(row)

            # Check if record already exists in PostgreSQL
            existing = await pg_conn.fetchrow(f"SELECT id FROM {table} WHERE id = $1", row_dict["id"])
            if existing:
                skipped += 1
                continue

            # Insert
            cols = ", ".join(columns)
            placeholders = ", ".join(f"${i+1}" for i in range(len(columns)))
            values = [row_dict[c] for c in columns]

            # Convert empty strings to None for nullable columns
            values = [v if v != "" else None for v in values]

            try:
                await pg_conn.execute(
                    f"INSERT INTO {table} ({cols}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING",
                    *values
                )
                migrated += 1
            except Exception as e:
                print(f"  ERROR inserting into {table} (id={row_dict.get('id')}): {e}")
                skipped += 1

        total_migrated += migrated
        total_skipped += skipped
        print(f"{table}: {migrated} migrated, {skipped} skipped (from {len(sl_rows)} total)")

    await pg_conn.close()
    sl_conn.close()
    print(f"\n=== Migration complete: {total_migrated} rows migrated, {total_skipped} skipped ===")


if __name__ == "__main__":
    asyncio.run(migrate())