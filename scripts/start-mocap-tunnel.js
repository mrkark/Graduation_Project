/**
 * AI MoCap Network Gateway & Stable HTTPS Tunnel (Karate Bunkai Explorer)
 * 
 * 1. Определяет реальный IPv4-адрес компьютера в локальной сети (Wi-Fi/Ethernet: 192.168.100.28).
 * 2. Запускает надежный HTTPS туннель с постоянным поддоменом (localtunnel).
 * 3. Сохраняет статус в uploads/tunnel-info.json.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const dgram = require('dgram');

const PORT = 5173;
const SUBDOMAIN = 'bunkai-dojo-karate';
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const STATUS_FILE = path.join(UPLOADS_DIR, 'tunnel-info.json');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function getLocalNetworkAddresses() {
  return new Promise((resolve) => {
    let primaryIp = '192.168.100.28';

    const finish = (mainIp) => {
      const ifaces = os.networkInterfaces();
      const list = [];

      for (const [name, addrs] of Object.entries(ifaces)) {
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
        list.unshift({ name: 'Ethernet (LAN)', ip: mainIp, isPrimary: true });
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

let cachedNetwork = { primaryIp: '192.168.100.28', all: [] };
let currentTunnelProcess = null;
let currentUrl = `https://${SUBDOMAIN}.loca.lt`;

function saveStatus(url, active = true) {
  const payload = {
    active,
    url: url || `https://${SUBDOMAIN}.loca.lt`,
    localIp: cachedNetwork.primaryIp,
    localIps: cachedNetwork.all,
    updatedAt: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {
    console.error('[-] Ошибка сохранения tunnel-info.json:', e.message);
  }

  // Оповещаем бэкенд
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

async function start() {
  cachedNetwork = await getLocalNetworkAddresses();

  console.log('\n========================================================');
  console.log('🥋 Karate Bunkai Explorer — Сетевой шлюз MoCap');
  console.log('========================================================');
  console.log(`🏠 Основной локальный IP компьютера: ${cachedNetwork.primaryIp}`);
  cachedNetwork.all.forEach((item) => {
    console.log(`   - [${item.name}]: http://${item.ip}:${PORT}`);
  });
  console.log(`[+] Запуск стабильного HTTPS туннеля (localtunnel: ${SUBDOMAIN})...`);

  saveStatus(currentUrl, true);

  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  currentTunnelProcess = spawn(npxCmd, ['--yes', 'localtunnel', '--port', String(PORT), '--subdomain', SUBDOMAIN], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  currentTunnelProcess.stdout.on('data', (d) => {
    const text = d.toString();
    console.log('[Tunnel]', text.trim());
    if (text.includes('your url is:')) {
      const match = text.match(/https:\/\/[^\s]+/);
      if (match) {
        currentUrl = match[0];
        saveStatus(currentUrl, true);
        console.log(`[✔] Постоянный HTTPS адрес: ${currentUrl}`);
      }
    }
  });

  currentTunnelProcess.stderr.on('data', (d) => {
    console.warn('[Tunnel Error]', d.toString().trim());
  });

  currentTunnelProcess.on('close', (code) => {
    console.log(`[!] Туннель завершился (код ${code}). Перезапуск через 5 сек...`);
    saveStatus(currentUrl, false);
    setTimeout(start, 5000);
  });
}

function cleanup() {
  saveStatus(null, false);
  if (currentTunnelProcess) {
    try {
      currentTunnelProcess.kill();
    } catch (e) {}
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', () => saveStatus(null, false));

start();
