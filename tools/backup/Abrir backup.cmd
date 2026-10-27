@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0preparar-y-abrir.ps1"
if errorlevel 1 pause
