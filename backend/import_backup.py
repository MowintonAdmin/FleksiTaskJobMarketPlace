"""
Import PostgreSQL pg_dump backup into SQLite database.
Parses COPY ... FROM stdin data sections and inserts into SQLite.
Uses aiosqlite directly for bulk insert performance.
"""
import re
import sys
import os
import asyncio
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"
BACKUP_FILE = Path(__file__).parent / "fleksitask_backup_2026-07-13T01-41-23.sql"


def parse_copy_data(filepath):
    """Parse PostgreSQL COPY data sections from pg_dump output."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    sections = []
    pattern = re.compile(
        r"COPY public\.(\w+)\s*\((.*?)\)\s*FROM stdin;\n(.*?)\\\.\n",
        re.DOTALL
    )

    for match in pattern.finditer(content):
        table_name = match.group(1)
        columns = [col.strip() for col in match.group(2).split(",")]
        data_lines = match.group(3).strip().split("\n")
        rows = []
        for line in data_lines:
            if line.strip() and not line.startswith("\\."):
                values = []
                for val in line.split("\t"):
                    if val == r"\N" or val == "":
                        values.append(None)
                    else:
                        values.append(val)
                rows.append(values)
        sections.append((table_name, columns, rows))
    return sections


async def import_to_sqlite(sections):
    """Import parsed data into SQLite using aiosqlite directly."""
    db_path = str(Path(__file__).parent / "local.db")

    import aiosqlite

    table_map = {
        "users": "users",
        "projects": "projects",
        "tasks": "tasks",
        "applications": "applications",
        "task_sessions": "task_sessions",
        "messages": "messages",
        "wallets": "wallets",
        "transactions": "transactions",
        "bank_accounts": "bank_accounts",
        "withdrawal_requests": "withdrawal_requests",
    }

    async with aiosqlite.connect(db_path) as db:
        for pg_table, columns, rows in sections:
            sqlite_table = table_map.get(pg_table)
            if not sqlite_table:
                print("[SKIP] unknown table: %s" % pg_table)
                continue

            if not rows:
                print("[SKIP] %s: 0 rows" % pg_table)
                continue

            col_list = ", ".join(columns)
            placeholders = ", ".join(["?" for _ in columns])
            insert_sql = "INSERT OR IGNORE INTO %s (%s) VALUES (%s)" % (sqlite_table, col_list, placeholders)

            count = 0
            for row in rows:
                cleaned = list(row[:len(columns)])
                while len(cleaned) < len(columns):
                    cleaned.append(None)
                try:
                    await db.execute(insert_sql, cleaned)
                    count += 1
                except Exception as e:
                    print("[ERROR] %s row %d: %s" % (pg_table, count + 1, e))
                    print("       Data: %s" % str(cleaned[:5]))

                if count % 50 == 0:
                    await db.commit()

            await db.commit()
            print("[OK] %s: %d rows imported" % (pg_table, count))

    print("[DONE] Import complete!")


def main():
    print("[*] Parsing PostgreSQL backup file...")
    sections = parse_copy_data(BACKUP_FILE)
    print("[*] Found %d tables with data:" % len(sections))
    for name, cols, rows in sections:
        print("     - %s: %d rows, %d cols" % (name, len(rows), len(cols)))

    print("[*] Importing into SQLite...")
    asyncio.run(import_to_sqlite(sections))


if __name__ == "__main__":
    main()