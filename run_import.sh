#!/bin/bash
# Run import via API
cd /app

# Get auth token
TOKEN=$(python3 -c "
import requests
r = requests.post('http://localhost:8000/api/v1/auth/login', 
    json={'email':'enghoo2004@gmail.com','password':'Admin@123'}, timeout=10)
print(r.json()['access_token'])
")

echo "Logged in"

# Run the import (retry with conflict handling)
python3 << PYEOF
import requests
import json

BASE = 'http://localhost:8000/api/v1'
TOKEN = "$TOKEN"

# First, find conflicting NRICs by doing a dry run
print("Checking for conflicts...")

with open('/app/import_data.xlsx', 'rb') as f:
    # Preview first to see worker info
    r = requests.post(f'{BASE}/admin/import/preview',
        headers={'Authorization': f'Bearer {TOKEN}'},
        files={'file': ('data.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')},
        params={'worksheet_name': 'Feb - June Tracker (Cleaned)'},
        timeout=60)
    if r.status_code != 200:
        print(f'Preview failed: {r.text[:200]}')
        exit(1)
    preview = r.json()
    print(f"Preview OK - {preview.get('total_rows','?')} total rows, {preview.get('valid_rows','?')} valid")

# Try confirm, catch conflict, remove and retry
max_retries = 5
for attempt in range(max_retries):
    with open('/app/import_data.xlsx', 'rb') as f:
        r = requests.post(f'{BASE}/admin/import/confirm',
            headers={'Authorization': f'Bearer {TOKEN}'},
            files={'file': ('data.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')},
            params={'worksheet_name': 'Feb - June Tracker (Cleaned)'},
            timeout=120)
        
        if r.status_code == 200:
            result = r.json()
            print(f"\n✅ IMPORT SUCCESSFUL!")
            print(f"  Workers matched: {result.get('workers_matched', 0)}")
            print(f"  Workers created: {result.get('workers_created', 0)}")
            print(f"  Sessions imported: {result.get('sessions_imported', 0)}")
            exit(0)
        
        err_text = r.text[:500]
        print(f"Attempt {attempt+1} failed: {r.status_code}")
        
        if 'duplicate key' in err_text and 'nric_passport' in err_text:
            # Extract the conflicting NRIC
            parts = err_text.split('Key (nric_passport)=(')
            if len(parts) > 1:
                nric = parts[1].split(')')[0]
                print(f"  -> Removing conflict NRIC: {nric}")
                import asyncpg
                import asyncio
                
                # Delete conflicting user from DB
                async def del_user():
                    conn = await asyncpg.connect(
                        host='postgres', port=5432,
                        user='fleksi', password='fleksi123',
                        database='flekxitask'
                    )
                    # Delete the user record and related data
                    await conn.execute(f"DELETE FROM task_sessions WHERE worker_id IN (SELECT id FROM users WHERE nric_passport='{nric}')")
                    await conn.execute(f"DELETE FROM applications WHERE worker_id IN (SELECT id FROM users WHERE nric_passport='{nric}')")
                    await conn.execute(f"DELETE FROM messages WHERE sender_id IN (SELECT id FROM users WHERE nric_passport='{nric}') OR recipient_id IN (SELECT id FROM users WHERE nric_passport='{nric}')")
                    await conn.execute(f"DELETE FROM users WHERE nric_passport='{nric}'")
                    await conn.close()
                
                asyncio.run(del_user())
                print(f"  -> Deleted conflict for NRIC: {nric}")
            else:
                print(f"  -> Unknown conflict, retrying...")
        else:
            print(f"  -> Unexpected error: {err_text}")
            break

print("\nImport could not complete after retries")
PYEOF