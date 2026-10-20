@echo off
chcp 65001 > nul
title Karate Motion Studio Web Server
echo =========================================================================
echo   🥋 Karate Motion Studio — Сервер AI Мокапа и Видеотрекинга
echo =========================================================================
echo   [+] Порт 8000 (HTTP)  : ПК интерфейс, 3D Аватар Three.js, iFrame
echo   [+] Порт 8088 (HTTPS) : Подключение камеры смартфона (iPhone / Android)
echo =========================================================================
cd /d "%~dp0"
"..\bunkai_explorer_karate_motion_capture\.venv\Scripts\python.exe" web_studio_server.py
pause
