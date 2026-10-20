[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Karate Bunkai Explorer — AI MoCap Global Internet Tunnel" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Туннель позволяет подключать смартфоны из ЛЮБОЙ сети мира" -ForegroundColor Yellow
Write-Host "(мобильный 4G / 5G / LTE или чужой Wi-Fi) с валидным SSL." -ForegroundColor Yellow
Write-Host "--------------------------------------------------------"

$CurrentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $CurrentDir

node scripts/start-mocap-tunnel.js
