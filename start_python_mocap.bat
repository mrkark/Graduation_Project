@echo off
chcp 65001 > nul
title Karate Motion Studio AI Python Server
echo =========================================================================
echo   🥋 Karate Motion Studio — Сервер AI Мокапа и Видеотрекинга (Python)
echo =========================================================================
echo   [+] Порт 8000 (HTTP)  : ПК интерфейс, 3D Аватар Three.js, iFrame
echo   [+] Порт 8088 (HTTPS) : Подключение камеры смартфона (iPhone / Android)
echo =========================================================================

if exist "%~dp0scripts\ensure-network-and-ssl.js" (
    echo [+] Автоопределение сети и обновление SSL сертификатов...
    node "%~dp0scripts\ensure-network-and-ssl.js"
)

cd /d "%~dp0karate_motion_studio"

set "PYTHON_EXE=C:\Users\user\Downloads\bunkai_explorer_karate_motion_capture\bunkai_explorer_karate_motion_capture\.venv\Scripts\python.exe"

if not exist "%PYTHON_EXE%" (
    set "PYTHON_EXE=python"
)

echo [+] Запуск: "%PYTHON_EXE%" web_studio_server.py
"%PYTHON_EXE%" web_studio_server.py

pause
