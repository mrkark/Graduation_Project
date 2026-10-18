@echo off
title AI MoCap HTTPS Gateway - Karate Bunkai Explorer
echo ========================================================
echo   Karate Bunkai Explorer - AI MoCap HTTPS Gateway
echo ========================================================
echo Starting local secure HTTPS gateway for phone cameras...
cd /d "%~dp0"
node scripts\start-mocap-gateway.js
pause
