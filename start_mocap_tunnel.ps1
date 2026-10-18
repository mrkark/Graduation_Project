# ========================================================
# Karate Bunkai Explorer — Скрипт HTTPS Туннеля для AI MoCap
# Позволяет подключать телефон из любой сети (4G/LTE/Wi-Fi)
# ========================================================
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Karate Bunkai Explorer — Запуск AI MoCap HTTPS Туннеля" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Туннель создает доверенный публичный HTTPS-домен для" -ForegroundColor Yellow
Write-Host "камеры смартфона (без chrome://flags и без предупреждений)." -ForegroundColor Yellow
Write-Host "--------------------------------------------------------"

node scripts/start-mocap-tunnel.js
