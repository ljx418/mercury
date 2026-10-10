@echo off
setlocal
title Navia V3-5.1 Fixed Candidate Review Runtime

where wsl.exe >nul 2>nul
if errorlevel 1 (
  echo Windows Subsystem for Linux was not found.
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start Navia V3-5.1 Review Runtime.ps1"
exit /b %ERRORLEVEL%
