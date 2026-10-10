@echo off
setlocal
title Navia Local Companion

where wsl.exe >nul 2>nul
if errorlevel 1 (
  echo Windows Subsystem for Linux was not found.
  echo Install or enable WSL, then run this launcher again.
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start Navia Runtime.ps1"
set "NAVIA_EXIT=%ERRORLEVEL%"

exit /b %NAVIA_EXIT%
