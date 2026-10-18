/**
 * Bunkai Explorer — Local HTTPS Gateway for AI MoCap
 * 
 * Provides rock-solid, zero-internet local HTTPS for smartphone cameras
 * matching the proven architecture of Karate Motion Studio:
 * 1. Automatically detects active Wi-Fi LAN IP (e.g. 192.168.100.6)
 * 2. Uses SSL certificate with Subject Alternative Names (SAN) for the IP
 * 3. Proxies HTTPS and WebSockets to Vite (port 5173) and backend API (port 5000)
 * 4. Enables phone cameras in 1 tap over local Wi-Fi without chrome://flags!
 */

const https = require('https');
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const dgram = require('dgram');

const HTTPS_PORT = process.env.MOCAP_HTTPS_PORT ? parseInt(process.env.MOCAP_HTTPS_PORT, 10) : 8443;
const VITE_PORT = process.env.VITE_PORT ? parseInt(process.env.VITE_PORT, 10) : 5173;
const TARGET_HOST = '127.0.0.1';

const ROOT_DIR = path.resolve(__dirname, '..');
const SSL_DIR = path.join(ROOT_DIR, 'ssl');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const STATUS_FILE = path.join(UPLOADS_DIR, 'tunnel-info.json');

const CERT_PATH = path.join(SSL_DIR, 'ssl_cert.pem');
const KEY_PATH = path.join(SSL_DIR, 'ssl_key.pem');

// 1. Динамическое определение активного локального IP-адреса Wi-Fi / LAN
function detectLocalIp() {
  return new Promise((resolve) => {
    try {
      const socket = dgram.createSocket('udp4');
      socket.connect(80, '8.8.8.8', () => {
        const ip = socket.address().address;
        socket.close();
        resolve(ip);
      });
      socket.on('error', () => {
        try { socket.close(); } catch (e) {}
        resolve('127.0.0.1');
      });
    } catch (e) {
      resolve('127.0.0.1');
    }
  });
}

// 2. Обновление статуса в uploads/tunnel-info.json и отправка на backend
function updateGatewayStatus(info) {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const payload = {
    active: true,
    localIp: info.localIp,
    httpsPort: HTTPS_PORT,
    httpsUrl: `https://${info.localIp}:${HTTPS_PORT}`,
    httpPort: VITE_PORT,
    httpUrl: `http://${info.localIp}:${VITE_PORT}`,
    url: `https://${info.localIp}:${HTTPS_PORT}`,
    localIps: [
      { name: 'Wi-Fi (Активный LAN)', ip: info.localIp, isPrimary: true },
      { name: 'Localhost (ПК)', ip: '127.0.0.1', isPrimary: false },
    ],
    updatedAt: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {
    console.warn('[!] Не удалось сохранить tunnel-info.json:', e.message);
  }

  // Оповещаем бэкенд на порту 5000
  const postData = JSON.stringify(payload);
  const req = http.request(
    {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/mocap/tunnel',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 2000,
    },
    () => {}
  );
  req.on('error', () => {}); // Бэкенд может еще инициализироваться
  req.write(postData);
  req.end();
}

async function main() {
  const localIp = await detectLocalIp();

  if (!fs.existsSync(CERT_PATH) || !fs.existsSync(KEY_PATH)) {
    console.error(`[!] SSL сертификаты не найдены в ${SSL_DIR}`);
    console.error('Пожалуйста, убедитесь, что ssl_cert.pem и ssl_key.pem присутствуют.');
    process.exit(1);
  }

  const sslOptions = {
    key: fs.readFileSync(KEY_PATH),
    cert: fs.readFileSync(CERT_PATH),
  };

  // HTTPS Прокси для HTTP запросов
  const server = https.createServer(sslOptions, (clientReq, clientRes) => {
    const options = {
      hostname: TARGET_HOST,
      port: VITE_PORT,
      path: clientReq.url,
      method: clientReq.method,
      headers: {
        ...clientReq.headers,
        host: `${TARGET_HOST}:${VITE_PORT}`,
        'x-forwarded-proto': 'https',
        'x-forwarded-host': clientReq.headers.host || `${localIp}:${HTTPS_PORT}`,
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(clientRes);
    });

    proxyReq.on('error', (err) => {
      clientRes.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
      clientRes.end(`
        <div style="font-family: sans-serif; padding: 24px; text-align: center; color: #fff; background: #121214; min-height: 100vh;">
          <h2 style="color: #ef4444;">⚠️ Ошибка соединения с Vite (порт ${VITE_PORT})</h2>
          <p>Убедитесь, что клиентское приложение Bunkai Explorer запущено на порту ${VITE_PORT}.</p>
          <p style="color: #888;">${err.message}</p>
        </div>
      `);
    });

    clientReq.pipe(proxyReq);
  });

  // WebSocket Upgrade Прокси для Socket.IO и HMR
  server.on('upgrade', (req, clientSocket, head) => {
    const proxySocket = net.connect(VITE_PORT, TARGET_HOST, () => {
      proxySocket.write(
        `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n` +
          Object.entries(req.headers)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\r\n') +
          '\r\n\r\n'
      );
      if (head && head.length) proxySocket.write(head);
      proxySocket.pipe(clientSocket);
      clientSocket.pipe(proxySocket);
    });

    proxySocket.on('error', () => {
      clientSocket.destroy();
    });
    clientSocket.on('error', () => {
      proxySocket.destroy();
    });
  });

  server.listen(HTTPS_PORT, '0.0.0.0', () => {
    updateGatewayStatus({ localIp });

    console.log('\n========================================================');
    console.log('🥋 Karate Bunkai Explorer — Local HTTPS Gateway (AI MoCap)');
    console.log('========================================================');
    console.log(`[+] Локальный IP компьютера в сети Wi-Fi: ${localIp}`);
    console.log(`[+] Внутренний порт Vite:                  ${VITE_PORT}`);
    console.log(`[+] Защищенный порт шлюза (SSL):           ${HTTPS_PORT}`);
    console.log('--------------------------------------------------------');
    console.log(`✔ ШЛЮЗ АКТИВЕН: https://${localIp}:${HTTPS_PORT}`);
    console.log(`📱 Ссылка для камеры телефона:`);
    console.log(`   https://${localIp}:${HTTPS_PORT}/phone-camera`);
    console.log('--------------------------------------------------------');
    console.log('✔ Телефон и компьютер подключаются напрямую через Wi-Fi');
    console.log('✔ Камера включается нативно БЕЗ флагов и без туннелей!');
    console.log('✔ При первом переходе подтвердите сертификат:');
    console.log('  "Дополнительно" -> "Перейти на сайт (небезопасно)"');
    console.log('========================================================\n');
  });

  // Периодическое обновление статуса раз в 15 секунд
  setInterval(async () => {
    const curIp = await detectLocalIp();
    updateGatewayStatus({ localIp: curIp });
  }, 15000);

  function cleanup() {
    console.log('\n[+] Остановка HTTPS шлюза...');
    try {
      const payload = { active: false, updatedAt: new Date().toISOString() };
      fs.writeFileSync(STATUS_FILE, JSON.stringify(payload, null, 2), 'utf8');
    } catch (e) {}
    server.close(() => process.exit(0));
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((err) => {
  console.error('[!] Критическая ошибка запуска Local HTTPS Gateway:', err);
  process.exit(1);
});
