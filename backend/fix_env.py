import json
content = [
    'DATABASE_URL=postgresql+asyncpg://fleksi:password@postgres:5432/flekxitask',
    'SECRET_KEY=your-super-secret-key-change-in-production',
    'ALLOWED_ORIGINS=' + json.dumps(["http://localhost:3000","http://localhost:3001","http://localhost:5173","http://localhost:4173"]),
    'BOOTSTRAP_ADMIN_EMAIL=enghoo2004@gmail.com',
    'BOOTSTRAP_ADMIN_PASSWORD=Admin@123',
    'REDIS_URL=redis://redis:6379/0',
    'DEBUG=false',
]
with open('/app/.env', 'w', newline='\n') as f:
    f.write('\n'.join(content) + '\n')
print("Done")
with open('/app/.env', 'rb') as f:
    for line in f:
        if b'ALLOWED' in line:
            print('ALLOWED_ORIGINS:', repr(line))