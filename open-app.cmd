@echo off
setlocal
cd /d "%~dp0"

where npm.cmd > nul 2> nul
if %errorlevel% equ 0 (
  set "NPM_CMD=npm.cmd"
) else if exist ".tools\node-v24.15.0-win-x64\npm.cmd" (
  set "NPM_CMD=.tools\node-v24.15.0-win-x64\npm.cmd"
) else (
  echo npm was not found.
  echo Install Node.js from https://nodejs.org/ and run npm.cmd install.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies...
  "%NPM_CMD%" install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

start "Wrapping Board Dev Server" cmd /k "cd /d ""%~dp0"" && ""%NPM_CMD%"" run dev"
timeout /t 6 /nobreak > nul
start "" "http://localhost:3000"
