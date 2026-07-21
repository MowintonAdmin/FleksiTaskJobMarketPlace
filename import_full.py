import requests
import json

BASE = 'http://localhost:8000/api/v1'

# Login
r = requests.post(f'{BASE}/auth/login',
    json={'email': 'enghoo2004@gmail.com', 'password': 'Admin@123'}, timeout=10)
j = r.json()
token = j['access_token']
print('Login OK')

# Step 1: Preview
with open('/app/import_data.xlsx', 'rb') as f:
    r2 = requests.post(f'{BASE}/admin/import/preview',
        headers={'Authorization': f'Bearer {token}'},
        files={'file': ('data.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')},
        params={'worksheet_name': 'Feb - June Tracker (Cleaned)'},
        timeout=60)
    print('Preview:', r2.status_code)
    if r2.status_code != 200:
        print('ERROR:', r2.text[:500])
        exit(1)
    preview = r2.json()
    for k in ['total_rows','valid_rows','sessions_import','workers_created','workers_matched','duplicate_rows']:
        print(f'  {k}: {preview.get(k, "?")}')

# Step 2: Confirm import
with open('/app/import_data.xlsx', 'rb') as f:
    r3 = requests.post(f'{BASE}/admin/import/confirm',
        headers={'Authorization': f'Bearer {token}'},
        files={'file': ('data.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')},
        params={'worksheet_name': 'Feb - June Tracker (Cleaned)'},
        timeout=120)
    print('\nConfirm:', r3.status_code)
    if r3.status_code == 200:
        result = r3.json()
        for k in result:
            v = result[k]
            if isinstance(v, (int, float, str)):
                print(f'  {k}: {v}')
            elif isinstance(v, list) and len(v) <= 5:
                print(f'  {k}: {v}')
            elif isinstance(v, dict):
                for sk, sv in v.items():
                    if isinstance(sv, (int, float, str)):
                        print(f'  {k}.{sk}: {sv}')
        print('\nIMPORT COMPLETE!')
    else:
        print('Confirm ERROR:', r3.text[:500])