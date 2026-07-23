@echo off
set PYTHONPATH=C:\Users\Syed Emio\Desktop\backend
set SECRET_KEY=your-super-secret-key-change-in-production
set DATABASE_URL=postgresql+asyncpg://fleksi:password@localhost:5432/flekxitask
set GOOGLE_CLIENT_ID=dummy
set GOOGLE_CLIENT_SECRET=dummy
set BOOTSTRAP_ADMIN_EMAIL=enghoo2004@gmail.com
set BOOTSTRAP_ADMIN_PASSWORD=Admin@123
set REDIS_URL=redis://localhost:6379/0
set ALLOWED_ORIGINS=["http://localhost:3000","http://localhost:3001","http://localhost:5173","http://localhost:4173"]
set FRONTEND_URL=http://localhost:3000
set SMTP_HOST=
set SMTP_PORT=587
set SMTP_USER=
set SMTP_PASSWORD=
set SMTP_FROM=
cd /d "C:\Users\Syed Emio\Desktop\backend"
echo Starting backend on http://localhost:8000 ...
"C:\Users\Syed Emio\Desktop\.venv\Scripts\uvicorn" app.main:app --host 0.0.0.0 --port 8000
pause