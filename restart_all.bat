@echo off
echo Restarting all services...

:: Kill existing processes
taskkill /F /IM python.exe 2>nul
taskkill /F /IM node.exe 2>nul
taskkill /F /IM uvicorn.exe 2>nul

:: Wait a moment
timeout /t 2 /nobreak >nul

:: Start backend
start /B cmd /C "python start_backend.py"

:: Wait for backend
timeout /t 5 /nobreak >nul

:: Start admin frontend
start /B cmd /C "npm --prefix FleksiTaskJobMarketPlace\frontend\admin run dev"

:: Start web frontend
start /B cmd /C "npm --prefix FleksiTaskJobMarketPlace\frontend\web run dev"

echo All services starting...
echo Backend: http://localhost:8000
echo Admin:   http://localhost:5174
echo Web:     http://localhost:5173