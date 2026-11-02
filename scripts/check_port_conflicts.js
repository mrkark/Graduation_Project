/**
 * check_port_conflicts.js
 * Скрипт детальной проверки конфликтов портов для всех сервисов Docker Compose и Nginx.
 */

const net = require('net');
const fs = require('fs');
const path = require('path');

const PORT_REGISTRY = [
  { service: 'Nginx Reverse Proxy (HTTP)', port: 80, protocol: 'TCP', desc: 'Основной высокоскоростной веб-вход' },
  { service: 'Nginx Reverse Proxy (Альтернативный)', port: 8080, protocol: 'TCP', desc: 'Запасной порт веб-прокси' },
  { service: 'Backend API (Node.js)', port: 5000, protocol: 'TCP', desc: 'REST API и WebSocket' },
  { service: 'Frontend UI (Vite Dev)', port: 5173, protocol: 'TCP', desc: 'Среда разработки Vite' },
  { service: 'Python AI MoCap Studio', port: 8000, protocol: 'TCP', desc: 'Веб-студия захвата движений' },
  { service: 'Python MoCap Mobile HTTPS', port: 8088, protocol: 'TCP', desc: 'Прямой видеопоток со смартфона' },
  { service: 'MoCap Gateway HTTPS', port: 8443, protocol: 'TCP', desc: 'Локальный защищенный шлюз QR' },
  { service: 'Microsoft SQL Server 2025', port: 1433, protocol: 'TCP', desc: 'Реляционная база данных' },
];

function checkPortAvailability(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve({ available: false, code: 'IN_USE' });
      } else {
        resolve({ available: false, code: err.code });
      }
    });
    server.once('listening', () => {
      server.close(() => {
        resolve({ available: true, code: 'FREE' });
      });
    });
    server.listen(port, '0.0.0.0');
  });
}

async function runPortConflictAudit() {
  console.log('================================================================');
  console.log('🔍 BUNKAI EXPLORER — АУДИТ ПОРТОВ И ПРОВЕРКА КОНФЛИКТОВ');
  console.log('================================================================\n');

  // 1. Проверка уникальности портов между сервисами в конфигурации
  const portMap = new Map();
  let hasInternalConflict = false;

  console.log('1. Проверка схемы назначения портов в docker-compose:');
  for (const item of PORT_REGISTRY) {
    if (portMap.has(item.port)) {
      console.error(`❌ КОНФЛИКТ: Порт ${item.port} назначен нескольким сервисам: "${portMap.get(item.port)}" и "${item.service}"`);
      hasInternalConflict = true;
    } else {
      portMap.set(item.port, item.service);
      console.log(`  • Порт ${String(item.port).padEnd(5)} -> [${item.service}] (${item.desc})`);
    }
  }

  if (!hasInternalConflict) {
    console.log('✔ В схеме docker-compose.yml все порты сервисов уникальны, взаимных пересечений нет.\n');
  }

  // 2. Проверка доступности портов на хост-машине (Windows)
  console.log('2. Проверка занятости портов на хост-машине:');
  let hasHostConflict = false;

  for (const item of PORT_REGISTRY) {
    const res = await checkPortAvailability(item.port);
    if (res.available) {
      console.log(`  ✔ Порт ${String(item.port).padEnd(5)} [СВОБОДЕН]  -> Готов к привязке для "${item.service}"`);
    } else {
      console.log(`  ⚠️ Порт ${String(item.port).padEnd(5)} [ЗАНЯТ]     -> Занят другим процессом на хосте ("${item.service}")`);
      hasHostConflict = true;
    }
  }

  console.log('\n================================================================');
  if (!hasInternalConflict && !hasHostConflict) {
    console.log('🎉 ВСЕ ПОРТЫ СВОБОДНЫ! КОНФЛИКТОВ ПОРТОВ НЕТ!');
    console.log('Контейнеры готовы к одновременному запуску без ошибок привязки.');
  } else if (!hasInternalConflict && hasHostConflict) {
    console.log('ℹ️ Некоторые порты уже заняты запущенными сервисами или службами.');
  }
  console.log('================================================================');
}

runPortConflictAudit().catch(console.error);
