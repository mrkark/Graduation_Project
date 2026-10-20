[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $ScriptDir "karate_motion_studio")

Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "  🥋 Karate Motion Studio — Сервер AI Мокапа и Видеотрекинга (Python)" -ForegroundColor Cyan
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "  [+] Порт 8000 (HTTP)  : ПК интерфейс, 3D Аватар Three.js, iFrame" -ForegroundColor Yellow
Write-Host "  [+] Порт 8088 (HTTPS) : Подключение камеры смартфона (iPhone / Android)" -ForegroundColor Yellow
Write-Host "=========================================================================" -ForegroundColor Cyan

$pythonExe = "C:\Users\user\Downloads\bunkai_explorer_karate_motion_capture\bunkai_explorer_karate_motion_capture\.venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    $pythonExe = "python"
}

Write-Host "[+] Исполняемый файл Python: $pythonExe" -ForegroundColor Green
Write-Host "[+] Запуск web_studio_server.py..." -ForegroundColor Green

& $pythonExe web_studio_server.py
