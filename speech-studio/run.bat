@echo off
rem اجرای محلی استودیوی گفتار روی http://127.0.0.1:8765
set PYTHONUTF8=1
cd /d "%~dp0server"
"%~dp0.venv\Scripts\python.exe" app.py
