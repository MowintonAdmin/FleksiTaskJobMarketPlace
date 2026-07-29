"""
E2E Test Suite for FleksiTask Job Marketplace
Tests: health, auth, users, tasks, projects, applications, admin, wallet, messages, frontends
"""
import requests
import json
import sys
from datetime import datetime

BASE = "http://localhost:8000"
WEB = "http://localhost:3000"
ADMIN = "http://localhost:3001"
RESULTS = []
passed = 0
failed = 0

def test(name, condition, detail=""):
    global passed, failed
    RESULTS.append((name, condition, detail))
    if condition:
        passed += 1
        print(f"  PASS: {name}")
    else:
        failed += 1
        print(f"  FAIL: {name} ({detail})")

def j(r):
    try: return r.json()
    except: return {}

print("=" * 60)
print("FLEKSITASK - E2E TEST SUITE")
print(f"Started: {datetime.now().isoformat()}")
print("=" * 60)

# 1. FRONTENDS
print("\n--- 1. FRONTENDS ---")
try:
    r = requests.get(f"{WEB}/", timeout=10, allow_redirects=False)
    test("Worker frontend (3000)", r.status_code == 200, f"Status {r.status_code}")
except Exception as e:
    test("Worker frontend (3000)", False, str(e))
try:
    r = requests.get(f"{ADMIN}/", timeout=10, allow_redirects=False)
    test("Admin frontend (3001)", r.status_code == 200, f"Status {r.status_code}")
except Exception as e:
    test("Admin frontend (3001)", False, str(e))
try:
    r = requests.get(f"{WEB}/api/v1/tasks?page=1&page_size=1", timeout=10)
    test("Worker nginx proxies /api/", r.status_code == 200, f"Status {r.status_code}")
except Exception as e:
    test("Worker nginx proxies /api/", False, str(e))
try:
    r = requests.get(f"{ADMIN}/api/v1/health", timeout=10)
    test("Admin nginx proxies /api/", r.status_code == 200, f"Status {r.status_code}")
except Exception as e:
    test("Admin nginx proxies /api/", False, str(e))

# 2. HEALTH
print("\n--- 2. HEALTH ---")
try:
    r = requests.get(f"{BASE}/health", timeout=10)
    test("Health endpoint", r.status_code == 200, f"Status {r.status_code}")
    test("Health = healthy", j(r).get("status") == "healthy", str(j(r)))
except Exception as e:
    test("Health endpoint", False, str(e))
try:
    r = requests.get(f"{BASE}/docs", timeout=10, allow_redirects=True)
    test("Swagger docs", r.status_code == 200, f"Status {r.status_code}")
except Exception as e:
    test("Swagger docs", False, str(e))

# 3. AUTH
print("\n--- 3. AUTHENTICATION ---")
TS = datetime.now().timestamp()
TEST_EMAIL = f"e2e_{TS}@test.com"
TOKEN = None
ADMIN_TOKEN = None

try:
    r = requests.post(f"{BASE}/api/v1/auth/register", json={
        "email": TEST_EMAIL, "full_name": "E2E User",
        "password": "TestPass123!", "location": "KL",
    }, timeout=10)
    test("Register new user", r.status_code == 201, f"Status {r.status_code}")
except Exception as e:
    test("Register new user", False, str(e))

try:
    r = requests.post(f"{BASE}/api/v1/auth/register", json={
        "email": TEST_EMAIL, "full_name": "Dup", "password": "TestPass123!",
    }, timeout=10)
    test("Duplicate register -> 409", r.status_code == 409, f"Status {r.status_code}")
except Exception as e:
    test("Duplicate register -> 409", False, str(e))

try:
    r = requests.post(f"{BASE}/api/v1/auth/login", json={
        "email": TEST_EMAIL, "password": "TestPass123!",
    }, timeout=10)
    test("Login success", r.status_code == 200, f"Status {r.status_code}")
    TOKEN = j(r).get("access_token")
    test("Login returns token", bool(TOKEN), "")
    test("Has refresh_token", bool(j(r).get("refresh_token")), "")
    test("httpOnly cookie set", "access_token" in r.cookies, str(dict(r.cookies)))
except Exception as e:
    test("Login", False, str(e))

try:
    r = requests.post(f"{BASE}/api/v1/auth/login", json={
        "email": TEST_EMAIL, "password": "WRONG!",
    }, timeout=10)
    test("Wrong password -> 401", r.status_code == 401, f"Status {r.status_code}")
    test("Generic error msg", "not found" not in j(r).get("detail","").lower(), j(r).get("detail",""))
except Exception as e:
    test("Wrong password -> 401", False, str(e))

for creds in [("admin@flekxitask.com", "Admin123!"), ("admin@flekxitask.com", "admin123")]:
    try:
        r = requests.post(f"{BASE}/api/v1/auth/login", json={"email": creds[0], "password": creds[1]}, timeout=10)
        if r.status_code == 200:
            ADMIN_TOKEN = j(r).get("access_token")
            test(f"Admin login OK ({creds[0]})", True, "")
            break
    except:
        pass
if not ADMIN_TOKEN:
    test("Admin login", False, "No bootstrap credentials worked")

try:
    r = requests.get(f"{BASE}/api/v1/files/test.jpg", timeout=10)
    test("Media no-auth -> 401", r.status_code == 401, f"Status {r.status_code}")
except Exception as e:
    test("Media no-auth -> 401", False, str(e))

# 4. TASKS
print("\n--- 4. TASKS ---")
HEADERS = {"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}
ADMIN_HEADERS = {"Authorization": f"Bearer {ADMIN_TOKEN}"} if ADMIN_TOKEN else {}
TASK_ID = None

try:
    r = requests.get(f"{BASE}/api/v1/tasks?page=1&page_size=3", timeout=10)
    test("List tasks (public)", r.status_code == 200, f"Status {r.status_code}")
    data = j(r)
    test("Has 'tasks' array", "tasks" in data, str(list(data.keys())))
    test("Has 'total' count", "total" in data, "")
except Exception as e:
    test("List tasks", False, str(e))

try:
    r = requests.get(f"{BASE}/api/v1/tasks?category=Delivery&page_size=3", timeout=10)
    test("Filter by category", r.status_code == 200, f"Status {r.status_code}")
except Exception as e:
    test("Filter by category", False, str(e))

if TOKEN:
    try:
        r = requests.post(f"{BASE}/api/v1/tasks", json={
            "title": f"E2E Task {TS}", "description": "E2E test", "location": "KL",
            "category": "Cleaning", "pay_rate_per_minute": 0.25,
            "estimated_duration_minutes": 120, "max_applicants": 3,
        }, headers=HEADERS, timeout=10)
        test("Create task", r.status_code == 201, f"Status {r.status_code}")
        TASK_ID = j(r).get("id")
        test("Task has ID", bool(TASK_ID), "")
    except Exception as e:
        test("Create task", False, str(e))

if TASK_ID:
    try:
        r = requests.get(f"{BASE}/api/v1/tasks/{TASK_ID}", timeout=10)
        test("Get task by ID", r.status_code == 200, f"Status {r.status_code}")
        test("Correct task ID", j(r).get("id") == TASK_ID, "")
    except Exception as e:
        test("Get task by ID", False, str(e))

if TASK_ID and TOKEN:
    try:
        r = requests.put(f"{BASE}/api/v1/tasks/{TASK_ID}", json={"title": "Updated E2E"}, headers=HEADERS, timeout=10)
        test("Update task", r.status_code == 200, f"Status {r.status_code}")
    except Exception as e:
        test("Update task", False, str(e))

# 5. PROJECTS
print("\n--- 5. PROJECTS (Admin) ---")
PROJ_ID = None
if ADMIN_TOKEN:
    try:
        r = requests.get(f"{BASE}/api/v1/admin/projects", headers=ADMIN_HEADERS, timeout=10)
        test("List projects", r.status_code == 200, f"Status {r.status_code}")
        test("Has 'projects'", "projects" in j(r), str(list(j(r).keys())))
    except Exception as e:
        test("List projects", False, str(e))
    try:
        r = requests.post(f"{BASE}/api/v1/admin/projects", json={
            "name": f"E2E Project {TS}", "description": "E2E test",
            "category": "Cleaning", "location": "KL",
        }, headers=ADMIN_HEADERS, timeout=10)
        test("Create project", r.status_code == 201, f"Status {r.status_code}")
        PROJ_ID = j(r).get("id")
        test("Auto-assigned company_tag", bool(j(r).get("company_tag")), f"tag={j(r).get('company_tag')}")
    except Exception as e:
        test("Create project", False, str(e))
    if PROJ_ID:
        try:
            r = requests.put(f"{BASE}/api/v1/admin/projects/{PROJ_ID}", json={"name": "Updated Project"}, headers=ADMIN_HEADERS, timeout=10)
            test("Update project", r.status_code == 200, f"Status {r.status_code}")
        except Exception as e:
            test("Update project", False, str(e))

# 6. APPLICATIONS
print("\n--- 6. APPLICATIONS ---")
if ADMIN_TOKEN:
    try:
        r = requests.get(f"{BASE}/api/v1/admin/applications", headers=ADMIN_HEADERS, timeout=10)
        test("List applications", r.status_code == 200, f"Status {r.status_code}")
    except Exception as e:
        test("List applications", False, str(e))
    try:
        r = requests.get(f"{BASE}/api/v1/admin/applications?status=pending", headers=ADMIN_HEADERS, timeout=10)
        test("Filter by status", r.status_code == 200, f"Status {r.status_code}")
    except Exception as e:
        test("Filter by status", False, str(e))

# 7. USERS
print("\n--- 7. USERS ---")
if ADMIN_TOKEN:
    try:
        r = requests.get(f"{BASE}/api/v1/admin/users", headers=ADMIN_HEADERS, timeout=10)
        test("List users", r.status_code == 200, f"Status {r.status_code}")
        data = j(r)
        if isinstance(data, list) and len(data) > 0:
            test("No nric_passport leaked", "nric_passport" not in data[0], f"Keys: {list(data[0].keys())[:8]}")
            test("Has email", "email" in data[0], "")
    except Exception as e:
        test("List users", False, str(e))
    try:
        r = requests.get(f"{BASE}/api/v1/admin/users/admins", headers=ADMIN_HEADERS, timeout=10)
        test("List admin users", r.status_code == 200, f"Status {r.status_code}")
    except Exception as e:
        test("List admin users", False, str(e))
    try:
        r = requests.get(f"{BASE}/api/v1/admin/users/unverified", headers=ADMIN_HEADERS, timeout=10)
        test("List unverified users", r.status_code == 200, f"Status {r.status_code}")
    except Exception as e:
        test("List unverified users", False, str(e))

# 8. WALLET
print("\n--- 8. WALLET ---")
if TOKEN:
    try:
        r = requests.get(f"{BASE}/api/v1/wallet", headers=HEADERS, timeout=10)
        test("Get wallet", r.status_code == 200, f"Status {r.status_code}")
        test("Has available_balance", "available_balance" in j(r), str(list(j(r).keys())))
    except Exception as e:
        test("Get wallet", False, str(e))
    try:
        r = requests.get(f"{BASE}/api/v1/wallet/transactions", headers=HEADERS, timeout=10)
        test("Get transactions", r.status_code == 200, f"Status {r.status_code}")
    except Exception as e:
        test("Get transactions", False, str(e))
    try:
        r = requests.get(f"{BASE}/api/v1/wallet/withdrawals", headers=HEADERS, timeout=10)
        test("Get withdrawals", r.status_code == 200, f"Status {r.status_code}")
    except Exception as e:
        test("Get withdrawals", False, str(e))

# 9. MESSAGES
print("\n--- 9. MESSAGES ---")
if TOKEN:
    try:
        r = requests.get(f"{BASE}/api/v1/messages/conversations", headers=HEADERS, timeout=10)
        test("Get conversations", r.status_code == 200, f"Status {r.status_code}")
    except Exception as e:
        test("Get conversations", False, str(e))
    try:
        r = requests.get(f"{BASE}/api/v1/messages/unread-count", headers=HEADERS, timeout=10)
        test("Get unread count", r.status_code == 200, f"Status {r.status_code}")
    except Exception as e:
        test("Get unread count", False, str(e))

# 10. ANALYTICS
print("\n--- 10. ANALYTICS ---")
if ADMIN_TOKEN:
    try:
        r = requests.get(f"{BASE}/api/v1/admin/analytics/dashboard", headers=ADMIN_HEADERS, timeout=10)
        test("Dashboard analytics", r.status_code == 200, f"Status {r.status_code}")
        d = j(r)
        test("Has users count", "users" in d, "")
        test("Has tasks count", "tasks" in d, "")
        test("Has revenue data", "revenue" in d, "")
    except Exception as e:
        test("Dashboard analytics", False, str(e))
    try:
        r = requests.get(f"{BASE}/api/v1/admin/analytics/monthly?year=2026", headers=ADMIN_HEADERS, timeout=10)
        test("Monthly analytics", r.status_code == 200, f"Status {r.status_code}")
        test("Has months array", "months" in j(r), "")
    except Exception as e:
        test("Monthly analytics", False, str(e))
    try:
        r = requests.get(f"{BASE}/api/v1/admin/analytics/task-completion", headers=ADMIN_HEADERS, timeout=10)
        test("Task completion analytics", r.status_code == 200, f"Status {r.status_code}")
    except Exception as e:
        test("Task completion analytics", False, str(e))

# 11. ADMIN OPERATIONS
print("\n--- 11. ADMIN OPERATIONS ---")
if ADMIN_TOKEN:
    endpoints = [
        ("Active workers", "/admin/workers/active"),
        ("Withdrawals list", "/admin/withdrawals"),
        ("Session approval", "/admin/sessions/pending-approval"),
        ("Time logs", "/admin/time-logs"),
        ("Task costs", "/admin/tasks/costs"),
        ("Admin tasks list", "/admin/tasks?page=1&page_size=5"),
    ]
    for name, path in endpoints:
        try:
            r = requests.get(f"{BASE}/api/v1{path}", headers=ADMIN_HEADERS, timeout=10)
            test(f"{name}", r.status_code == 200, f"Status {r.status_code}")
        except Exception as e:
            test(f"{name}", False, str(e))

# 12. PROFILE
print("\n--- 12. USER PROFILE ---")
if TOKEN:
    try:
        r = requests.get(f"{BASE}/api/v1/users/me", headers=HEADERS, timeout=10)
        test("Get own profile", r.status_code == 200, f"Status {r.status_code}")
        p = j(r)
        test("Has full_name", "full_name" in p, "")
        test("Has email", "email" in p, "")
    except Exception as e:
        test("Get own profile", False, str(e))

# SUMMARY
print("\n" + "=" * 60)
total = passed + failed
pct = round(passed / total * 100, 1) if total else 0
print(f"RESULTS: {passed}/{total} passed ({pct}%)")
print(f"PASSED: {passed}")
print(f"FAILED: {failed}")
print("=" * 60)

if failed > 0:
    sys.exit(1)
else:
    sys.exit(0)