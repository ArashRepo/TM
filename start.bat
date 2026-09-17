@echo off
chcp 65001 >nul
title TM Launcher
cls

echo =======================================================
echo          Starting TM Application...
echo =======================================================
echo.

REM Free port 3000 if occupied by previous session
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Freeing port 3000 from PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)

echo Opening browser: http://localhost:3000
start "" "http://localhost:3000"

echo Launching server...
node src/server.js

pause
