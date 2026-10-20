@echo off
chcp 65001 >nul
title Настройка брандмауэра и сети для Karate MoCap
color 0a

:: Проверка прав администратора
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Запрос прав Администратора для открытия портов в Брандмауэре Windows...
    powershell -Command "Start-Process cmd -ArgumentList '/c `\"%~dpnx0`\"' -Verb RunAs"
    exit /b
)

echo =========================================================================
echo  🥋 Karate Bunkai Explorer — Открытие портов для телефона и MoCap
echo =========================================================================
echo.
echo [1/2] Открытие входящих портов (8000, 8088, 8443, 5173, 5000)...
netsh advfirewall firewall delete rule name="Karate Bunkai Explorer Ports" >nul 2>&1
netsh advfirewall firewall add rule name="Karate Bunkai Explorer Ports" dir=in action=allow protocol=TCP localport=8000,8088,8443,5000,5173 profile=any >nul
if %errorlevel% equ 0 (
    echo   [✔] Правило брандмауэра успешно добавлено!
) else (
    echo   [!] Не удалось обновить брандмауэр.
)

echo.
echo [2/2] Переключение активного Wi-Fi адаптера в режим 'Частная сеть' (Private)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetConnectionProfile | Where-Object { $_.IPv4Connectivity -eq 'Internet' -or $_.InterfaceAlias -like '*Беспроводная*' } | Set-NetConnectionProfile -NetworkCategory Private"
if %errorlevel% equ 0 (
    echo   [✔] Сеть переключена в режим 'Частная сеть' (Private)!
) else (
    echo   [!] Замечание по переключению профиля сети.
)

echo.
echo =========================================================================
echo  [✔] ГОТОВО! Теперь телефон гарантированно сможет подключиться.
echo =========================================================================
echo.
pause
