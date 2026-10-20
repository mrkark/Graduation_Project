/**
 * AI MoCap Global Internet HTTPS Tunnel Service (Karate Bunkai Explorer)
 * 
 * Создает валидный глобальный HTTPS-туннель к локальному AI MoCap серверу (порт 8000)
 * через localhost.run / pinggy.
 * 
 * Позволяет подключать смартфоны для захвата движения из ЛЮБОЙ сети мира (4G, 5G, LTE,
 * мобильный интернет, чужой Wi-Fi), БЕЗ необходимости находиться в одной сети с ПК!
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const PORT = process.env.TUNNEL_PORT ? parseInt(process.env.TUNNEL_PORT, 10) : 8000;
const ROOT_DIR = path.resolve(__dirname, '..');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const STATUS_FILE = path.join(UPLOADS_DIR, 'tunnel-info.json');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function updateTunnelStatus(url, active = true) {
  let existing = {};
  try {
    if (fs.existsSync(STATUS_FILE)) {
      existing = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    }
  } catch (e) {}

  const payload = {
    ...existing,
    active: true,
    publicUrl: url || null,
    tunnelUrl: url || null,
    tunnelActive: active,
    updatedAt: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {
    console.error('[!] Ошибка записи tunnel-info.json:', e.message);
  }

  // Оповещаем Express API
  const postData = JSON.stringify(payload);
  const req = http.request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/mocap/tunnel',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 2500,
    },
    (res) => {}
  );
  req.on('error', () => {});
  req.write(postData);
  req.end();
}

let currentProcess = null;
let reconnectTimer = null;
let healthCheckTimer = null;
let currentUrl = null;
let providerIndex = 0;

const PROVIDERS = [
  { name: 'Serveo', host: 'serveo.net', args: (p) => ['-o', 'StrictHostKeyChecking=no', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3', '-R', `80:127.0.0.1:${p}`, 'serveo.net'] },
  { name: 'LocalhostRun', host: 'nokey@localhost.run', args: (p) => ['-o', 'StrictHostKeyChecking=no', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3', '-R', `80:127.0.0.1:${p}`, 'nokey@localhost.run'] },
];

function checkTunnelHealth() {
  if (!currentUrl) return;
  const testUrl = `${currentUrl}/status`;
  https.get(testUrl, { timeout: 6000 }, (res) => {
    if (res.statusCode !== 200) {
      console.warn(`[!] Туннель вернул статус ${res.statusCode}. Перезапуск соединения...`);
      restartTunnel();
    }
  }).on('error', (err) => {
    console.warn('[!] Туннель недоступен:', err.message);
  });
}

function restartTunnel() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  if (currentProcess) {
    try { currentProcess.kill('SIGTERM'); } catch (e) {}
    currentProcess = null;
  }
  providerIndex = (providerIndex + 1) % PROVIDERS.length;
  reconnectTimer = setTimeout(startTunnel, 2000);
}

function startTunnel() {
  const provider = PROVIDERS[providerIndex];
  console.log('\n========================================================');
  console.log('🥋 Karate Bunkai Explorer — AI MoCap Global Internet Tunnel');
  console.log('========================================================');
  console.log(`[+] Создание глобального HTTPS-туннеля через ${provider.name} для порта ${PORT}...`);

  const args = provider.args(PORT);
  const sshBin = process.platform === 'win32' ? 'ssh.exe' : 'ssh';
  currentProcess = spawn(sshBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  let buffer = '';

  const handleData = (chunk) => {
    const text = chunk.toString();
    buffer += text;

    // Ищем URL вида https://...serveousercontent.com или https://...lhr.life
    const match = buffer.match(/https:\/\/[a-zA-Z0-9_.-]+(?:\.serveousercontent\.com|\.lhr\.life)/i);
    if (match && match[0] !== currentUrl) {
      currentUrl = match[0];
      updateTunnelStatus(currentUrl, true);

      console.log('\n--------------------------------------------------------');
      console.log(`✔ ГЛОБАЛЬНЫЙ ИНТЕРНЕТ-ТУННЕЛЬ УСПЕШНО АКТИВИРОВАН (${provider.name})!`);
      console.log(`🌐 Публичный адрес:      ${currentUrl}`);
      console.log('--------------------------------------------------------');
      console.log(`📱 Камера 1 (Фронт):     ${currentUrl}/cam1`);
      console.log(`📱 Камера 2 (Бок 90°):   ${currentUrl}/cam2`);
      console.log(`📱 Камера 3 (Диагональ): ${currentUrl}/cam3`);
      console.log(`🥋 3D Додзё студия:      ${currentUrl}/studio`);
      console.log('--------------------------------------------------------');
      console.log('✔ Смартфон может быть в ЛЮБОЙ сети (4G / 5G / LTE / другой Wi-Fi)!');
      console.log('✔ Safari и Chrome включают камеру БЕЗ предупреждений сертификата!');
      console.log('========================================================\n');

      if (healthCheckTimer) clearInterval(healthCheckTimer);
      healthCheckTimer = setInterval(checkTunnelHealth, 25000);
    }
  };

  currentProcess.stdout.on('data', handleData);
  currentProcess.stderr.on('data', handleData);

  currentProcess.on('close', (code) => {
    console.log(`[!] Туннель закрылся (код ${code}). Переподключение через 4 секунды...`);
    updateTunnelStatus(currentUrl, false);
    if (healthCheckTimer) clearInterval(healthCheckTimer);
    reconnectTimer = setTimeout(startTunnel, 4000);
  });

  currentProcess.on('error', (err) => {
    console.error('[!] Ошибка запуска ssh:', err.message);
    if (healthCheckTimer) clearInterval(healthCheckTimer);
    reconnectTimer = setTimeout(startTunnel, 4000);
  });
}

function cleanup() {
  console.log('\n[+] Остановка интернет-туннеля...');
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (healthCheckTimer) clearInterval(healthCheckTimer);
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
