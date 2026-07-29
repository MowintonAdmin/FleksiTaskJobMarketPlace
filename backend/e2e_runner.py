import requests, json, sys
from datetime import datetime

BASE = "http://localhost:8000"
passed = 0
failed = 0

def test(name, condition):
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS: {name}")
    else:
        failed += 1
        print(f"  FAIL: {name}")

def j(r):
    try: return r.json()
    except: return {}

print("=" * 55)
print("FLEKSITASK E2E TEST SUITE")
print(f"Started: {datetime.now().isoformat()}")
print("=" * 55)

# 1. Health
print("\n--- 1. HEALTH ---")
r = requests.get(f"{BASE}/health", timeout=10)
test("Health endpoint returns 200", r.status_code == 200)
test("Health status = healthy", j(r).get("status") == "healthy")

# 2. Auth
print("\n--- 2. AUTH ---")
ts = datetime.now().timestamp()
email = f"e2e_{ts}@test.com"

r = requests.post(f"{BASE}/api/v1/auth/register", json={
    "email": email, "full_name": "E2E User",
    "password": "TestPass123!", "location": "KL",
}, timeout=10)
test("Register user -> 201", r.status_code == 201)

r = requests.post(f"{BASE}/api/v1/auth/register", json={
    "email": email, "full_name": "Dup", "password": "TestPass123!",
}, timeout=10)
test("Duplicate register -> 409", r.status_code == 409)

r = requests.post(f"{BASE}/api/v1/auth/login", json={
    "email": email, "password": "TestPass123!",
}, timeout=10)
test("Login -> 200", r.status_code == 200)
TOKEN = j(r).get("access_token")
test("Has access_token", bool(TOKEN))
test("Has refresh_token", bool(j(r).get("refresh_token")))

r = requests.post(f"{BASE}/api/v1/auth/login", json={
    "email": email, "password": "WRONG!",
}, timeout=10)
test("Wrong password -> 401", r.status_code == 401)
msg = j(r).get("detail", "").lower()
test("Generic error (no email leak)", "not found" not in msg)

# Admin login
ADMIN_TOKEN = None
for pw in ["Admin123!", "admin123"]:
    r = requests.post(f"{BASE}/api/v1/auth/login", json={
        "email": "admin@flekxitask.com", "password": pw,
    }, timeout=10)
    if r.status_code == 200:
        ADMIN_TOKEN = j(r).get("access_token")
        test("Admin login works", True)
        break
if not ADMIN_TOKEN:
    test("Admin login works", False)

# Media auth
r = requests.get(f"{BASE}/api/v1/files/test.jpg", timeout=10)
test("Media no-auth -> 401", r.status_code == 401)

# 3. Tasks
print("\n--- 3. TASKS ---")
HEADERS = {"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}
AHEADERS = {"Authorization": f"Bearer {ADMIN_TOKEN}"} if ADMIN_TOKEN else {}

r = requests.get(f"{BASE}/api/v1/tasks?page=1&page_size=2", timeout=10)
test("List tasks (public)", r.status_code == 200)
test("Response has 'tasks'", "tasks" in j(r))

if TOKEN:
    r = requests.post(f"{BASE}/api/v1/tasks", json={
        "title": f"Task {ts}", "description": "E2E test", "location": "KL",
        "category": "Cleaning", "pay_rate_per_minute": 0.25,
        "estimated_duration_minutes": 120, "max_applicants": 3,
    }, headers=HEADERS, timeout=10)
    test("Create task -> 201", r.status_code == 201)
    TASK_ID = j(r).get("id")
    test("Task has ID", bool(TASK_ID))
    if TASK_ID:
        r = requests.get(f"{BASE}/api/v1/tasks/{TASK_ID}", timeout=10)
        test("Get task by ID -> 200", r.status_code == 200)
        r = requests.put(f"{BASE}/api/v1/tasks/{TASK_ID}", json={"title": "Updated"}, headers=HEADERS, timeout=10)
        test("Update task -> 200", r.status_code == 200)

# 4. Projects
print("\n--- 4. PROJECTS ---")
if ADMIN_TOKEN:
    r = requests.get(f"{BASE}/api/v1/admin/projects", headers=AHEADERS, timeout=10)
    test("List projects -> 200", r.status_code == 200)
    r = requests.post(f"{BASE}/api/v1/admin/projects", json={
        "name": f"Project {ts}", "description": "E2E test", "category": "Cleaning", "location": "KL",
    }, headers=AHEADERS, timeout=10)
    test("Create project -> 201", r.status_code == 201)
    PROJ_ID = j(r).get("id")
    test("Auto-assigned company_tag", bool(j(r).get("company_tag")))

# 5. Applications
print("\n--- 5. APPLICATIONS ---")
if ADMIN_TOKEN:
    r = requests.get(f"{BASE}/api/v1/admin/applications", headers=AHEADERS, timeout=10)
    test("List applications -> 200", r.status_code == 200)
    r = requests.get(f"{BASE}/api/v1/admin/applications?status=pending", headers=AHEADERS, timeout=10)
    test("Filter by status -> 200", r.status_code == 200)

# 6. Users (safe response)
print("\n--- 6. USERS ---")
if ADMIN_TOKEN:
    r = requests.get(f"{BASE}/api/v1/admin/users", headers=AHEADERS, timeout=10)
    test("List users -> 200", r.status_code == 200)
    u = j(r)
    if isinstance(u, list) and len(u) > 0:
        test("No nric_passport leaked", "nric_passport" not in u[0])
    r = requests.get(f"{BASE}/api/v1/admin/users/admins", headers=AHEADERS, timeout=10)
    test("List admins -> 200", r.status_code == 200)
    r = requests.get(f"{BASE}/api/v1/admin/users/unverified", headers=AHEADERS, timeout=10)
    test("List unverified -> 200", r.status_code == 200)

# 7. Wallet
print("\n--- 7. WALLET ---")
if TOKEN:
    r = requests.get(f"{BASE}/api/v1/wallet", headers=HEADERS, timeout=10)
    test("Get wallet -> 200", r.status_code == 200)
    r = requests.get(f"{BASE}/api/v1/wallet/transactions", headers=HEADERS, timeout=10)
    test("Get transactions -> 200", r.status_code == 200)
    r = requests.get(f"{BASE}/api/v1/wallet/withdrawals", headers=HEADERS, timeout=10)
    test("Get withdrawals -> 200", r.status_code == 200)

# 8. Messages
print("\n--- 8. MESSAGES ---")
if TOKEN:
    r = requests.get(f"{BASE}/api/v1/messages/conversations", headers=HEADERS, timeout=10)
    test("Get conversations -> 200", r.status_code == 200)
    r = requests.get(f"{BASE}/api/v1/messages/unread-count", headers=HEADERS, timeout=10)
    test("Unread count -> 200", r.status_code == 200)

# 9. Analytics
print("\n--- 9. ANALYTICS ---")
if ADMIN_TOKEN:
    for path in ["/admin/analytics/dashboard", "/admin/analytics/monthly?year=2026", "/admin/analytics/task-completion"]:
        name = path.split("/")[-1].split("?")[0]
        r = requests.get(f"{BASE}/api/v1{path}", headers=AHEADERS, timeout=10)
        test(f"{name} -> 200", r.status_code == 200)

# 10. Admin operations
print("\n--- 10. ADMIN OPS ---")
if ADMIN_TOKEN:
    for name, path in [
        ("Active workers", "/admin/workers/active"),
        ("Withdrawals", "/admin/withdrawals"),
        ("Session approval", "/admin/sessions/pending-approval"),
        ("Time logs", "/admin/time-logs"),
        ("Task costs", "/admin/tasks/costs"),
        ("Tasks list", "/admin/tasks?page=1&page_size=5"),
    ]:
        r = requests.get(f"{BASE}/api/v1{path}", headers=AHEADERS, timeout=10)
        test(f"{name} -> 200", r.status_code == 200)

# 11. Profile
print("\n--- 11. PROFILE ---")
if TOKEN:
    r = requests.get(f"{BASE}/api/v1/users/me", headers=HEADERS, timeout=10)
    test("Get profile -> 200", r.status_code == 200)
    p = j(r)
    test("Has full_name", "full_name" in p)
    test("Has email", "email" in p)

# Summary
print("\n" + "=" * 55)
total = passed + failed
pct = round(passed / total * 100, 1) if total else 0
print(f"RESULTS: {passed}/{total} passed ({pct}%)")
print(f"PASSED: {passed}")
print(f"FAILED: {failed}")
print("=" * 55)

if failed > 0:
    print("\nSome tests FAILED! Check above.")
else:
    print("\nALL TESTS PASSED!")

sys.exit(0 if failed == 0 else 1)