import asyncio, requests

async def main():
    BASE = 'http://localhost:8000/api/v1'
    r = requests.post(f'{BASE}/auth/login', json={'email':'enghoo2004@gmail.com','password':'Admin@123'})
    t = r.json()['access_token']
    
    r2 = requests.get(f'{BASE}/admin/applications', headers={'Authorization':f'Bearer {t}'})
    print('Status:', r2.status_code)
    if r2.status_code != 200:
        print('Error:', r2.text[:2000])
    else:
        print('OK, apps:', len(r2.json()))
    
    # Also test the sidebar loads
    r3 = requests.get(f'{BASE}/admin/analytics/dashboard', headers={'Authorization':f'Bearer {t}'})
    print('Dashboard:', r3.status_code)
    if r3.status_code != 200:
        print('Dashboard error:', r3.text[:300])

asyncio.run(main())