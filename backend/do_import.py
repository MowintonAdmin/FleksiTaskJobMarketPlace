import requests

BASE = "http://localhost:8000/api/v1"
r = requests.post(f"{BASE}/auth/login", json={"email":"enghoo2004@gmail.com","password":"Admin@123"}, timeout=10)
t = r.json()["access_token"]
print("Logged in")

with open("/app/import_data.xlsx", "rb") as f:
    print("Uploading and confirming import...")
    r2 = requests.post(f"{BASE}/admin/import/confirm",
        headers={"Authorization": f"Bearer {t}"},
        files={"file": ("data.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        params={"worksheet_name": "Feb - June Tracker (Cleaned)"},
        timeout=600)
    print(f"Status: {r2.status_code}")
    if r2.status_code == 200:
        d = r2.json()
        print(f"Workers matched: {d.get('workers_matched', 0)}")
        print(f"Workers created: {d.get('workers_created', 0)}")
        print(f"Sessions imported: {d.get('sessions_imported', 0)}")
        print("SUCCESS!")
    else:
        print(f"Error: {r2.text[:1000]}")