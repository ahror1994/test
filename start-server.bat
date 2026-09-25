@echo off
setlocal
cd /d "%~dp0"
title Taptym server
set "COREPACK_ENABLE_DOWNLOAD_PROMPT=0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

set "PNPM=pnpm"
where pnpm >nul 2>nul
if errorlevel 1 set "PNPM=corepack pnpm"

if not exist "node_modules\tsx\package.json" (
  echo [Taptym] Installing dependencies, the first run takes a few minutes...
  call %PNPM% install
  if errorlevel 1 goto :fail
)

set "NEED_BUILD="
if not exist "apps\customer\dist\index.html" set "NEED_BUILD=1"
if not exist "apps\supplier\dist\index.html" set "NEED_BUILD=1"
if not exist "apps\admin\dist\index.html" set "NEED_BUILD=1"
if defined NEED_BUILD (
  echo [Taptym] Building the web apps...
  call %PNPM% build:web
  if errorlevel 1 goto :fail
)

node --import tsx apps\api\src\server.ts
echo.
echo [Taptym] Server stopped.
pause
exit /b 0

:fail
echo.
echo [Taptym] Something went wrong - see the messages above.
pause
exit /b 1
