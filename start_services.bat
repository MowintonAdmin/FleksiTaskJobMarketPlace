@echo off
echo Starting all FleksiTask services...

:: Kill old processes
taskkill /F /IM python.exe 2>nul
taskkill /F /IM node.exe 2>nul

:: Start backend
cd /d "%~dp0FleksiTaskJobMarketPlace\backend"
start "Backend" python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

:: Wait for backend
timeout /t 5 /nobreak >nul

:: Start admin frontend
start "Admin" cmd /c "npm --prefix "%~dp0FleksiTaskJobMarketPlace\frontend\admin" run dev"

:: Start web frontend
start "Web" cmd /c "npm --prefix "%~dp0FleksiTaskJobMarketPlace\frontend\web" run dev"

:: Open browser windows
timeout /t 3 /nobreak >nul
start http://localhost:3000
start http://localhost:3001

echo.
echo Services are starting...
echo Admin: http://localhost:3000
echo Web:   http://localhost:3001
echo Backend: http://localhost:8000
echo.
echo Close these windows to stop all services.
pause