import requests, traceback, sys

BASE = 'http://localhost:8000/api/v1'
try:
    r = requests.post(f'{BASE}/auth/login', json={'email':'enghoo2004@gmail.com','password':'Admin@123'}, timeout=10)
    t = r.json()['access_token']
    r2 = requests.get(f'{BASE}/admin/analytics/export/workers', headers={'Authorization':f'Bearer {t}'}, timeout=30)
    print(f'Status: {r2.status_code}')
    if r2.status_code != 200:
        print(f'Response: {r2.text[:500]}')
    else:
        print(f'OK - {len(r2.text)} bytes')
except Exception as e:
    traceback.print_exc()