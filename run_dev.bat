@echo off
echo Starting Stuffing Calculator Dev Environment...

:: Navigate to the desktop app directory
cd /d "%~dp0\apps\desktop"

:: Start Vite server in a new window using cmd (avoids PowerShell execution policy)
start "Vite Dev Server" cmd /k "npm run dev"

echo.
echo Waiting for Vite server to start on port 3000...
echo Checking http://localhost:3000 availability...
echo.

:: Wait for the server to be ready (max 60 seconds)
set MAX_ATTEMPTS=60
set ATTEMPT=0

:WAIT_LOOP
set /a ATTEMPT+=1
if %ATTEMPT% GTR %MAX_ATTEMPTS% (
    echo.
    echo ============================================
    echo ERROR: Vite server did not start within 60 seconds
    echo Please check the "Vite Dev Server" window for errors
    echo Common issues:
    echo   - npm execution blocked by PowerShell policy
    echo   - Port 3000 already in use
    echo   - Dependency installation needed
    echo   - Permission/Firewall issues
    echo.
    echo Try running as Administrator if permission errors persist
    echo ============================================
    echo.
    pause
    exit /b 1
)

:: Simple port check using netstat
netstat -an | findstr ":3000" | findstr "LISTENING" >nul 2>&1

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo Vite server is ready on port 3000!
    echo ============================================
    echo.
    timeout /t 2 /nobreak >nul
    goto START_ELECTRON
)

if %ATTEMPT% LEQ 3 (
    echo Attempt %ATTEMPT%/%MAX_ATTEMPTS% - Waiting for Vite to start...
) else (
    if %ATTEMPT% EQU 4 echo Still waiting... This may take a moment on first run.
    echo Attempt %ATTEMPT%/%MAX_ATTEMPTS%
)
timeout /t 1 /nobreak >nul
goto WAIT_LOOP

:START_ELECTRON
echo Starting Electron...
echo.
npm run electron

echo.
echo Electron has closed.
pause
