@echo off
echo.
echo ========================================
echo 🤖 AI-Powered Video Proctoring System
echo ========================================
echo.

echo 📦 Installing dependencies...
call npm install
cd backend
call npm install
cd ..

echo.
echo 🚀 Starting AI Video Proctoring System...
echo.

echo 📊 Starting Backend Server (Port 5000)...
start "Backend Server" cmd /k "cd backend && npm run dev"

echo ⏳ Waiting for backend to start...
timeout /t 3 /nobreak > nul

echo 🌐 Starting Frontend Server (Port 3000)...
start "Frontend Server" cmd /k "cd frontend && python -m http.server 3000"

echo ⏳ Waiting for frontend to start...
timeout /t 2 /nobreak > nul

echo.
echo ✅ System Started Successfully!
echo.
echo 📱 Frontend: http://localhost:3000
echo 🔧 Backend:  http://localhost:5000
echo.
echo 🤖 AI Models will load automatically when you open the frontend
echo 📊 Check browser console for AI loading status
echo.
echo Press any key to open the application...
pause > nul

start http://localhost:3000

echo.
echo 🎯 System is now running!
echo 📝 To stop: Close both terminal windows
echo.
pause
