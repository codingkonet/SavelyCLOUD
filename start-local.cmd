@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js 20 or newer is required.
  echo Download it from https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not defined HOST set "HOST=127.0.0.1"
if not defined PORT set "PORT=8787"
if not defined STORAGE_PATH set "STORAGE_PATH=%~dp0storage"
if not defined DATA_PATH set "DATA_PATH=%~dp0.local-cloud-data"
if not defined MAX_STORAGE set "MAX_STORAGE=20GB"
if not defined MAX_FILE_SIZE set "MAX_FILE_SIZE=2GB"

if not exist "%STORAGE_PATH%" mkdir "%STORAGE_PATH%"
if not exist "%DATA_PATH%" mkdir "%DATA_PATH%"

echo.
echo   SavelyCLOUD is starting
echo   Open http://127.0.0.1:%PORT%
echo   Keep this window open. Press Ctrl+C to stop.
echo.

node server.js

echo.
echo SavelyCLOUD stopped or could not start.
pause
