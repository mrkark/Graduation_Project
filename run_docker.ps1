# ========================================================
# Karate Bunkai Explorer — Скрипт запуска 3 Docker-контейнеров
# ========================================================
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Karate Bunkai Explorer — Сборка и запуск 3 контейнеров" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "1. MSSQL 2022  -> Порт 1433" -ForegroundColor Yellow
Write-Host "2. Backend API -> Порт 5000" -ForegroundColor Yellow
Write-Host "3. Frontend UI -> Порт 5173" -ForegroundColor Yellow
Write-Host "--------------------------------------------------------"

# Проверка доступности Docker
docker version >$null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Docker Daemon не запущен. Пожалуйста, запустите Docker Desktop." -ForegroundColor Red
    exit 1
}

Write-Host "[+] Запуск контейнеров (docker compose up -d --build)..." -ForegroundColor Green
docker compose up -d --build

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[✔] Все 3 контейнера успешно запущены!" -ForegroundColor Green
    Write-Host "  Фронтенд: http://localhost:5173" -ForegroundColor Cyan
    Write-Host "  Бэкенд:   http://localhost:5000/api" -ForegroundColor Cyan
    Write-Host "  База БД:  localhost:1433" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Для просмотра логов выполните: docker compose logs -f" -ForegroundColor Gray
} else {
    Write-Host "[!] Ошибка при запуске контейнеров." -ForegroundColor Red
}
