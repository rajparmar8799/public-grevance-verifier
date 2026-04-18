@echo off
TITLE Swagat AI Verifier - Integrated Setup
SETLOCAL EnableDelayedExpansion

echo ======================================================
echo    SWAGAT AI VERIFIER - AUTOMATED SETUP ^& RUNNER
echo ======================================================
echo.

:: 1. CHECK DEPENDENCIES
echo [Step 1/5] Checking environment dependencies...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install it from https://nodejs.org/
    pause
    exit /b
)

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed. Please install it and add to PATH.
    pause
    exit /b
)
echo [OK] Node and Python found.

:: 2. INSTALL LIBRARIES
echo.
echo [Step 2/5] Synchronizing dependencies (npm ^& pip)...
call npm install
call pip install -r ml/requirements.txt
echo [OK] Dependencies ready.

:: 3. SEED DATABASE
echo.
echo [Step 3/5] Initializing fresh Swagat workspace (Clean Run)...
node seed.js
if %errorlevel% neq 0 (
    echo [ERROR] Database initialization failed. Make sure MongoDB is running on port 27017.
    pause
    exit /b
)
echo [OK] Database seeded with sample audit records.

:: 4. START SERVERS
echo.
echo [Step 4/5] Launching backend systems...

:: Start Python ML API in a new window
start "Swagat ML API (Port 5001)" cmd /k "python ml/api.py"

:: Start Node.js Server in a new window
start "Swagat Portal (Port 3000)" cmd /k "node server.js"

echo [OK] Servers are booting up...

:: 5. OPEN BROWSER
echo.
echo [Step 5/5] Connecting to local node...
timeout /t 3 /nobreak >nul
start http://localhost:3000

echo.
echo ======================================================
echo    SYSTEM INITIALIZED SUCCESSFULLY
echo    Node Dashboard: http://localhost:3000
echo    ML Engine: http://localhost:5001
echo ======================================================
echo.
echo Keep the other terminal windows open to maintain the system.
echo Press any key to close this installer...
pause >nul

