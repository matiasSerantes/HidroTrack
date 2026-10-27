@echo off
cd /d "%~dp0"
python backup_app.py
if errorlevel 1 pause
