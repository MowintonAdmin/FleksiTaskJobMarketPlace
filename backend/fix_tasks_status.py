import sqlite3

conn = sqlite3.connect('local.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

rows = cur.execute("""
    SELECT t.id, t.title, t.status, t.max_applicants, COUNT(s.id) as settled_count
    FROM tasks t
    LEFT JOIN task_sessions s ON s.task_id = t.id AND LOWER(s.status) = 'settled'
    WHERE (LOWER(t.status) = 'completed') AND t.max_applicants > 1
    GROUP BY t.id
""").fetchall()

reverted = 0
for r in rows:
    if r['settled_count'] < r['max_applicants']:
        cur.execute("UPDATE tasks SET status = 'OPEN' WHERE id = ?", (r['id'],))
        print(f"Restored task '{r['title']}' (Workers needed: {r['max_applicants']}, Approved: {r['settled_count']}) back to OPEN")
        reverted += 1

conn.commit()
print(f"Total tasks restored to OPEN: {reverted}")
conn.close()
