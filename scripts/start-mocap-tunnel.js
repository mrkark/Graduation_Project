/**
 * AI MoCap HTTPS Tunnel & Network Discovery Service (Karate Bunkai Explorer)
 * 
 * 1. Автоматически определяет реальный IPv4-адрес компьютера в локальной сети (Wi-Fi/Ethernet)
 *    для прямого подключения смартфона внутри домашней сети.
 * 2. Создает и поддерживает живой защищенный HTTPS-туннель (localhost.run) для смартфонов
 *    из внешней сети (4G/LTE), где мобильный браузер мгновенно получает доступ к камере
 *    без флагов chrome://flags.
 * 3. Регулярно мониторит здоровье HTTPS туннеля (health-check) и мгновенно перезапускает его
 *    при сбоях связи (HTTP 502 / тайм-аут).
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const os = require('os');
const dgram = require('dgram');

const PORT = 5173;
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const STATUS_FILE = path.join(UPLOADS_DIR, 'tunnel-info.json');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Определение основного IP-адреса хоста в локальной сети
function getLocalNetworkAddresses() {
  return new Promise((resolve) => {
    let primaryIp = '192.168.100.28';

    const finish = (mainIp) => {
      const ifaces = os.networkInterfaces();
      const list = [];

      for (const [name, addrs] of Object.entries(ifaces)) {
        // Исключаем виртуальные адаптеры гипервизоров и WSL
        if (/vEthernet|VMware|Virtual|Loopback|WSL/i.test(name)) continue;
        for (const a of addrs) {
          if (a.family === 'IPv4' && !a.internal) {
            list.push({
              name,
              ip: a.address,
              isPrimary: a.address === mainIp,
            });
          }
        }
      }

      if (!list.some((item) => item.ip === mainIp)) {
        list.unshift({ name: 'Основной адаптер', ip: mainIp, isPrimary: true });
      }

      resolve({ primaryIp: mainIp, all: list });
    };

    try {
      const s = dgram.createSocket('udp4');
      s.connect(80, '8.8.8.8', () => {
        primaryIp = s.address().address;
        s.close();
        finish(primaryIp);
      });
      s.on('error', () => finish(primaryIp));
    } catch (e) {
      finish(primaryIp);
    }
  });
}

let cachedNetworkInfo = { primaryIp: '192.168.100.28', all: [] };
let currentProcess = null;
let reconnectTimer = null;
let healthCheckTimer = null;
let currentUrl = null;
let isHealthy = false;
let consecutiveFailures = 0;

function updateStatusFile(url, active = true) {
  const payload = {
    active,
    url: url || null,
    localIp: cachedNetworkInfo.primaryIp,
    localIps: cachedNetworkInfo.all,
    updatedAt: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {
    console.error('[-] Ошибка записи tunnel-info.json:', e.message);
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
  req.on('error', () => {});
  req.write(JSON.stringify(payload));
  req.end();
}

// Проверка работоспособности туннеля через реальный HTTP-запрос
function checkTunnelHealth(url) {
  if (!url) return;

  const targetUrl = `${url.replace(/\/+$/, '')}/phone-camera`;

  const req = https.get(targetUrl, { timeout: 8000 }, (res) => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      consecutiveFailures = 0;
      if (!isHealthy) {
        isHealthy = true;
        updateStatusFile(url, true);
        console.log(`[✔] Проверка связи HTTPS туннеля успешна: HTTP ${res.statusCode} OK`);
      }
    } else {
      consecutiveFailures++;
      console.warn(`[!] Туннель вернул статус HTTP ${res.statusCode} (сбой #${consecutiveFailures})`);
      if (consecutiveFailures >= 2) {
        restartTunnel('HTTP статус не 200/300');
      }
    }
  });

  req.on('error', (err) => {
    consecutiveFailures++;
    console.warn(`[!] Ошибка проверки HTTPS туннеля: ${err.message} (сбой #${consecutiveFailures})`);
    if (consecutiveFailures >= 2) {
      restartTunnel('Тайм-аут или ошибка сети');
    }
  });

  req.on('timeout', () => {
    req.destroy();
    consecutiveFailures++;
    console.warn(`[!] Превышен тайм-аут HTTPS туннеля (сбой #${consecutiveFailures})`);
    if (consecutiveFailures >= 2) {
      restartTunnel('Превышен тайм-аут ответа');
    }
  });
}

function restartTunnel(reason) {
  console.log(`\n[!] Перезапуск туннеля по причине: ${reason}`);
  consecutiveFailures = 0;
  isHealthy = false;
  if (healthCheckTimer) clearInterval(healthCheckTimer);

  if (currentProcess) {
    try {
      currentProcess.kill('SIGTERM');
    } catch (e) {}
    currentProcess = null;
  }

  updateStatusFile(currentUrl, false);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(startTunnel, 3000);
}

async function startTunnel() {
  cachedNetworkInfo = await getLocalNetworkAddresses();

  console.log('\n========================================================');
  console.log('🥋 Karate Bunkai Explorer — Сетевой шлюз MoCap & HTTPS');
  console.log('========================================================');
  console.log(`🏠 Локальный IP компьютера: ${cachedNetworkInfo.primaryIp}`);
  cachedNetworkInfo.all.forEach((item) => {
    console.log(`   - [${item.name}]: http://${item.ip}:${PORT}`);
  });
  console.log(`[+] Подключение к безопасному HTTPS-туннелю (localhost.run)...`);

  // Сразу сохраняем локальный IP в tunnel-info.json, чтобы фронтенд сразу его увидел
  updateStatusFile(currentUrl, false);

  const args = [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'ExitOnForwardFailure=yes',
    '-R', `80:127.0.0.1:${PORT}`,
    'nokey@localhost.run',
  ];

  const sshBin = process.platform === 'win32' ? 'ssh.exe' : 'ssh';
  currentProcess = spawn(sshBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  let buffer = '';

  const handleData = (chunk) => {
    const text = chunk.toString();
    buffer += text;

    const match = buffer.match(/https:\/\/[a-zA-Z0-9.-]+\.lhr\.life/);
    if (match && match[0] !== currentUrl) {
      currentUrl = match[0];
      isHealthy = false;
      consecutiveFailures = 0;

      console.log('\n--------------------------------------------------------');
      console.log('✔ ПУБЛИЧНЫЙ HTTPS ТУННЕЛЬ УСПЕШНО АКТИВИРОВАН!');
      console.log(`🌐 Адрес для смартфонов: ${currentUrl}`);
      console.log(`📱 Ссылка для камеры:   ${currentUrl}/phone-camera`);
      console.log('--------------------------------------------------------');
      console.log('✔ Смартфон может быть в 4G/LTE, а ПК дома на Wi-Fi!');
      console.log('========================================================\n');

      updateStatusFile(currentUrl, true);

      // Запускаем периодический мониторинг здоровья туннеля раз в 15 секунд
      if (healthCheckTimer) clearInterval(healthCheckTimer);
      healthCheckTimer = setInterval(() => checkTunnelHealth(currentUrl), 15000);
      // И сразу первую быструю проверку через 3 секунды
      setTimeout(() => checkTunnelHealth(currentUrl), 3000);
    }
  };

  currentProcess.stdout.on('data', handleData);
  currentProcess.stderr.on('data', handleData);

  currentProcess.on('close', (code) => {
    console.log(`[!] SSH-процесс завершился с кодом ${code}. Переподключение через 5 сек...`);
    if (healthCheckTimer) clearInterval(healthCheckTimer);
    updateStatusFile(currentUrl, false);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(startTunnel, 5000);
  });

  currentProcess.on('error', (err) => {
    console.error('[!] Ошибка запуска ssh:', err.message);
    if (healthCheckTimer) clearInterval(healthCheckTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(startTunnel, 5000);
  });
}

function cleanup() {
  console.log('\n[+] Остановка сетевого шлюза MoCap...');
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  updateStatusFile(null, false);
  if (currentProcess) {
    try {
      currentProcess.kill('SIGTERM');
    } catch (e) {}
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', () => updateStatusFile(null, false));

startTunnel();
