@echo off
setlocal
cd /d "%~dp0"
title Taptym update
set "COREPACK_ENABLE_DOWNLOAD_PROMPT=0"
set "PNPM=pnpm"
where pnpm >nul 2>nul
if errorlevel 1 set "PNPM=corepack pnpm"

echo [Taptym] Downloading the latest code...
git pull
if errorlevel 1 goto :fail
call %PNPM% install
if errorlevel 1 goto :fail
call %PNPM% build:web
if errorlevel 1 goto :fail
echo.
echo [Taptym] Done. Close the server window and run start-server.bat again.
pause
exit /b 0

:fail
echo.
echo [Taptym] Update failed - see the messages above.
pause
exit /b 1
