import requests
import json

# Login
r = requests.post('http://localhost:8000/api/v1/auth/login',
    json={'email': 'enghoo2004@gmail.com', 'password': 'Admin@123'}, timeout=10)
print('Login status:', r.status_code)
j = r.json()
print('Response:', json.dumps(j, indent=2)[:200])

token = j.get('access_token', '')
if not token:
    print('No token found')
    exit(1)

print('\nToken obtained, length:', len(token))

# Step 1: Preview
with open('/app/import_data.xlsx', 'rb') as f:
    r2 = requests.post('http://localhost:8000/api/v1/admin/import/preview',
        headers={'Authorization': f'Bearer {token}'},
        files={'file': ('data.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')},
        params={'worksheet_name': 'Feb - June Tracker (Cleaned)'},
        timeout=60)
    print('\nPreview status:', r2.status_code)
    if r2.status_code == 200:
        d = r2.json()
        for k in ['total_rows','valid_rows','sessions_import','workers_created','workers_matched','duplicate_rows']:
            print(f'  {k}: {d.get(k, "?")}')
        print('\nPreview successful! Now run confirm...')
    else:
        print('Preview ERROR:', r2.text[:500])