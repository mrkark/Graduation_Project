# ========================================================
# Karate Bunkai Explorer — Запуск AI MoCap Шлюза (HTTPS)
# Позволяет подключать телефон по локальному Wi-Fi с нативной камерой
# ========================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Karate Bunkai Explorer — Запуск AI MoCap Шлюза (HTTPS)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Шлюз обеспечивает защищенное HTTPS-соединение для смартфона" -ForegroundColor Yellow
Write-Host "внутри локальной сети Wi-Fi (без необходимости chrome://flags)." -ForegroundColor Yellow
Write-Host "--------------------------------------------------------"

$CurrentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $CurrentDir

node scripts/start-mocap-gateway.js
