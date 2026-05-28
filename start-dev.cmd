@echo off
setlocal
cd /d "%~dp0"

where npm.cmd > nul 2> nul
if %errorlevel% equ 0 (
  npm.cmd run dev
) else if exist ".tools\node-v24.15.0-win-x64\npm.cmd" (
  ".tools\node-v24.15.0-win-x64\npm.cmd" run dev
) else (
  echo npm was not found.
  echo Install Node.js from https://nodejs.org/ and run npm.cmd install.
  pause
  exit /b 1
)
if errorlevel 1 pause
