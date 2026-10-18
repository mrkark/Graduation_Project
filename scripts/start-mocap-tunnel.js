/**
 * AI MoCap HTTPS Tunnel Service (Karate Bunkai Explorer)
 * 
 * Создает защищенный HTTPS-туннель к локальному Vite-серверу (порт 5173) через localhost.run,
 * позволяя смартфонам подключать камеру по валидному SSL/HTTPS из любой сети мира (4G/LTE/Wi-Fi)
 * без необходимости находиться в одной локальной сети с компьютером.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = 5173;
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const STATUS_FILE = path.join(UPLOADS_DIR, 'tunnel-info.json');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function updateTunnelStatus(url, active = true) {
  const payload = {
    active,
    url: url || null,
    updatedAt: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {
    console.error('Ошибка записи tunnel-info.json:', e.message);
  }

  // Оповещаем бэкенд через локальный API
  const req = http.request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/mocap/tunnel',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 2000,
    },
    (res) => {}
  );
  req.on('error', () => {}); // бэкенд может еще запускаться
  req.write(JSON.stringify(payload));
  req.end();
}

let currentProcess = null;
let reconnectTimer = null;
let currentUrl = null;

function startTunnel() {
  console.log('\n========================================================');
  console.log('🥋 Karate Bunkai Explorer — Запуск AI MoCap HTTPS Туннеля');
  console.log('========================================================');
  console.log(`[+] Подключение к безопасному туннелю для порта ${PORT}...`);

  const args = [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ServerAliveCountMax=3',
    '-R', `80:127.0.0.1:${PORT}`,
    'nokey@localhost.run',
  ];

  const sshBin = process.platform === 'win32' ? 'ssh.exe' : 'ssh';
  currentProcess = spawn(sshBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  let buffer = '';

  const handleData = (chunk) => {
    const text = chunk.toString();
    buffer += text;

    // Ищем строку вида: https://<hash>.lhr.life
    const match = buffer.match(/https:\/\/[a-zA-Z0-9.-]+\.lhr\.life/);
    if (match && match[0] !== currentUrl) {
      currentUrl = match[0];
      updateTunnelStatus(currentUrl, true);

      console.log('\n--------------------------------------------------------');
      console.log('✔ ПУБЛИЧНЫЙ HTTPS ТУННЕЛЬ УСПЕШНО АКТИВИРОВАН!');
      console.log(`🌐 Адрес для смартфонов: ${currentUrl}`);
      console.log(`📱 Ссылка для камеры:   ${currentUrl}/phone-camera`);
      console.log('--------------------------------------------------------');
      console.log('✔ Мобильный браузер (Safari / Chrome) включит камеру');
      console.log('  сразу БЕЗ флагов chrome://flags и БЕЗ предупреждений!');
      console.log('✔ Смартфон может быть в 4G/LTE, а ПК дома на Wi-Fi!');
      console.log('========================================================\n');
    }
  };

  currentProcess.stdout.on('data', handleData);
  currentProcess.stderr.on('data', handleData);

  currentProcess.on('close', (code) => {
    console.log(`[!] Туннель завершил работу (код ${code}). Переподключение через 5 секунд...`);
    updateTunnelStatus(currentUrl, false);
    reconnectTimer = setTimeout(startTunnel, 5000);
  });

  currentProcess.on('error', (err) => {
    console.error('[!] Ошибка запуска ssh:', err.message);
    reconnectTimer = setTimeout(startTunnel, 5000);
  });
}

function cleanup() {
  console.log('\n[+] Остановка HTTPS туннеля...');
  if (reconnectTimer) clearTimeout(reconnectTimer);
  updateTunnelStatus(null, false);
  if (currentProcess) {
    try {
      currentProcess.kill('SIGTERM');
    } catch (e) {}
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', () => updateTunnelStatus(null, false));

startTunnel();
