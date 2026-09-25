@echo off
setlocal
cd /d "%~dp0"
title Taptym APK build
rem Usage: build-apk.bat [customer^|supplier] [--url http://192.168.0.4:3000] [--all-abis]
node scripts\build-apk.mjs %*
pause
