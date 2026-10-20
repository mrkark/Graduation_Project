@echo off
chcp 65001 >nul
title Karate Bunkai Explorer - AI MoCap Global Internet Tunnel (4G/5G/LTE)
color 0b

echo ========================================================
echo  🥋 Karate Bunkai Explorer — AI MoCap Global Tunnel
echo  Подключение мобильных телефонов через 4G/5G/LTE
echo ========================================================
echo.

cd /d "%~dp0"
node scripts\start-mocap-tunnel.js

pause
