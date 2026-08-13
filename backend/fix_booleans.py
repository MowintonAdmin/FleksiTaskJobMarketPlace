import sqlite3

conn = sqlite3.connect('local.db')
cur = conn.cursor()

bool_cols = [
    ('users', ['is_admin', 'is_super_admin', 'is_active', 'is_verified', 'is_employer', 'phone_verified']),
    ('tasks', ['max_applicants']),
    ('projects', ['status']),
]

for table, cols in bool_cols:
    for col in cols:
        try:
            cur.execute(f"UPDATE {table} SET {col} = 1 WHERE {col} = 't' OR {col} = 'true'")
            cur.execute(f"UPDATE {table} SET {col} = 0 WHERE {col} = 'f' OR {col} = 'false'")
        except Exception as e:
            print(f"Error on {table}.{col}: {e}")

conn.commit()

admins = cur.execute("SELECT id, email, full_name, is_admin, is_super_admin FROM users WHERE is_admin = 1").fetchall()
print("=== FIXED ADMIN USERS IN LOCAL.DB ===")
for a in admins:
    print(a)

conn.close()
