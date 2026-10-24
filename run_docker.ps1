# ========================================================
# Karate Bunkai Explorer — Скрипт запуска 4 Docker-контейнеров
# Включает: Базу данных, Бэкенд, Фронтенд и HTTPS Шлюз для QR-кода
# ========================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$CurrentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $CurrentDir

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Karate Bunkai Explorer — Сборка и запуск 5 контейнеров" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "1. MSSQL 2025      -> Порт 1433" -ForegroundColor Yellow
Write-Host "2. Backend API     -> Порт 5000" -ForegroundColor Yellow
Write-Host "3. Frontend UI     -> Порт 5173" -ForegroundColor Yellow
Write-Host "4. MoCap Gateway   -> Порт 8443 (HTTPS для подключения смартфонов по QR)" -ForegroundColor Yellow
Write-Host "5. Python MoCap    -> Порты 8000 и 8088 (ИИ захват движения и 3D студия)" -ForegroundColor Yellow
Write-Host "--------------------------------------------------------"

# 1. Автоматическое определение активного локального IP-адреса Wi-Fi / LAN
$defaultInterface = (Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Sort-Object RouteMetric | Select-Object -First 1).InterfaceAlias
$activeIp = $null
if ($defaultInterface) {
    $activeIp = (Get-NetIPAddress -InterfaceAlias $defaultInterface -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "169.254*" } | Select-Object -ExpandProperty IPAddress -First 1)
}

if (-not $activeIp) {
    # Fallback поиск первого не-виртуального интерфейса
    $activeIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { 
        $_.InterfaceAlias -notlike "*Loopback*" -and 
        $_.InterfaceAlias -notlike "*vEthernet*" -and 
        $_.InterfaceAlias -notlike "*VMware*" -and 
        $_.InterfaceAlias -notlike "*Virtual*" -and 
        $_.InterfaceAlias -notlike "*Host-Only*" -and 
        $_.IPAddress -notlike "169.254*" -and
        $_.IPAddress -notlike "192.168.56.*" -and
        $_.IPAddress -notlike "127.*"
    } | Select-Object -ExpandProperty IPAddress -First 1)
}

if (-not $activeIp) {
    $activeIp = "192.168.100.6"
}

Write-Host "[+] Активный IP компьютера в сети: $activeIp ($defaultInterface)" -ForegroundColor Cyan

# Сбор всех сетевых адаптеров для кнопок быстрого выбора в веб-интерфейсе
$candidateIps = @()
$candidateIps += @{ name = "Wi-Fi (Активный LAN)"; ip = $activeIp; isPrimary = $true }
Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {
    $_.IPAddress -ne $activeIp -and
    $_.IPAddress -notlike "127.*" -and
    $_.IPAddress -notlike "169.254*" -and
    $_.InterfaceAlias -notlike "*Loopback*" -and
    $_.InterfaceAlias -notlike "*vEthernet*"
} | ForEach-Object {
    $candidateIps += @{ name = $_.InterfaceAlias; ip = $_.IPAddress; isPrimary = $false }
}
$candidateIps += @{ name = "Localhost (ПК)"; ip = "127.0.0.1"; isPrimary = $false }

# 2. Обновление .env для Docker Compose
$envFile = Join-Path $CurrentDir ".env"
$envLines = @()
if (Test-Path $envFile) {
    $envLines = Get-Content $envFile | Where-Object { $_ -notmatch '^HOST_IP=' }
}
$envLines += "HOST_IP=$activeIp"
Set-Content -Path $envFile -Value $envLines -Encoding utf8

# 3. Предварительное сохранение статуса в uploads/tunnel-info.json
$uploadsDir = Join-Path $CurrentDir "uploads"
if (-not (Test-Path $uploadsDir)) {
    New-Item -ItemType Directory -Path $uploadsDir -Force | Out-Null
}
$tunnelJsonPath = Join-Path $uploadsDir "tunnel-info.json"
$existingPublicUrl = $null
$existingTunnelActive = $false
if (Test-Path $tunnelJsonPath) {
    try {
        $existingData = Get-Content $tunnelJsonPath -Raw | ConvertFrom-Json
        if ($existingData.publicUrl) {
            $existingPublicUrl = $existingData.publicUrl
            $existingTunnelActive = [bool]$existingData.tunnelActive
        }
    } catch {}
}

$tunnelPayloadObj = [ordered]@{
    active = $true
    localIp = $activeIp
    httpsPort = 8443
    httpsUrl = "https://$activeIp:8443"
    httpPort = 5173
    httpUrl = "http://$activeIp:5173"
    url = "https://$activeIp:8443"
    localIps = $candidateIps
    publicUrl = $existingPublicUrl
    tunnelUrl = $existingPublicUrl
    tunnelActive = $existingTunnelActive
    updatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
}
$tunnelPayload = $tunnelPayloadObj | ConvertTo-Json -Depth 4
Set-Content -Path $tunnelJsonPath -Value $tunnelPayload -Encoding utf8

# 4. Проверка доступности Docker
docker version >$null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Docker Daemon не запущен. Пожалуйста, запустите Docker Desktop." -ForegroundColor Red
    exit 1
}

Write-Host "[+] Запуск 5 контейнеров (docker compose up -d --build)..." -ForegroundColor Green
docker compose up -d --build

if ($LASTEXITCODE -eq 0) {
    # 5. Проверка и автоматический запуск Python AI MoCap сервера (порты 8000 и 8088)
    $port8000Active = (Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' })
    if (-not $port8000Active) {
        Write-Host "[+] Запуск Python AI MoCap сервера (web_studio_server.py)..." -ForegroundColor Cyan
        $pythonExe = "C:\Users\user\Downloads\bunkai_explorer_karate_motion_capture\bunkai_explorer_karate_motion_capture\.venv\Scripts\python.exe"
        if (-not (Test-Path $pythonExe)) {
            $pythonExe = "python"
        }
        $studioScript = Join-Path $CurrentDir "karate_motion_studio\web_studio_server.py"
        if (Test-Path $studioScript) {
            Start-Process -FilePath $pythonExe -ArgumentList "`"$studioScript`"" -WorkingDirectory (Split-Path $studioScript) -WindowStyle Minimized
            Start-Sleep -Seconds 3
        }
    }

    Write-Host ""
    Write-Host "[✔] Все сервисы и контейнеры успешно запущены и работают!" -ForegroundColor Green
    Write-Host "  💻 Фронтенд Додзё (ПК):       http://localhost:5173/motion-lab" -ForegroundColor Cyan
    Write-Host "  🥋 Python AI MoCap (Порт 8000): http://localhost:8000/studio" -ForegroundColor Green
    Write-Host "  📱 Камера смартфона (HTTPS Wi-Fi): https://${activeIp}:8088/cam1" -ForegroundColor Yellow
    Write-Host "  🌐 Подключение через 4G/LTE (чужая сеть): запустите start_mocap_tunnel.bat" -ForegroundColor Magenta
    Write-Host "  ⚙️  Бэкенд API:                http://localhost:5000/api" -ForegroundColor Cyan
    Write-Host "  🗄️  База данных:              localhost:1433" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Для подключения смартфона (Камера 1 / 2 / 3):" -ForegroundColor White
    Write-Host "  1. Убедитесь, что телефон подключен к тому же Wi-Fi (IP ПК: $activeIp)" -ForegroundColor Gray
    Write-Host "  2. Откройте в браузере телефона: https://${activeIp}:8088/cam1" -ForegroundColor Yellow
    Write-Host "  3. Подтвердите локальный сертификат: 'Дополнительно' -> 'Перейти на сайт'" -ForegroundColor Gray
    Write-Host "  4. В браузере ПК на http://localhost:5173/motion-lab сразу появится 3D-аватар!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Для просмотра логов контейнеров выполните: docker compose logs -f" -ForegroundColor Gray
} else {
    Write-Host "[!] Ошибка при запуске контейнеров." -ForegroundColor Red
}
