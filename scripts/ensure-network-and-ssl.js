/**
 * Bunkai Explorer — Dynamic Network & SSL Certificate Manager
 * 
 * Automatically executed on every launch of the application:
 * 1. Detects the real active local IPv4 address (Wi-Fi / LAN).
 * 2. Collects all candidate network interfaces for quick switching.
 * 3. Updates .env with HOST_IP=<activeIp>.
 * 4. Updates uploads/tunnel-info.json with fresh network metadata.
 * 5. Checks if SSL certificates (for camera streaming) have activeIp in SAN.
 *    If not, regenerates RSA 2048 self-signed SSL certificates with Subject Alternative Names.
 * 6. Guarantees that QR codes always point to the correct, working IP.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const dgram = require('dgram');

const ROOT_DIR = path.resolve(__dirname, '..');
const SSL_DIR = path.join(ROOT_DIR, 'ssl');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const STUDIO_DIR = path.join(ROOT_DIR, 'karate_motion_studio');
const STUDIO_ASSETS_DIR = path.join(STUDIO_DIR, 'demo_assets');
const STATUS_FILE = path.join(UPLOADS_DIR, 'tunnel-info.json');
const ENV_FILE = path.join(ROOT_DIR, '.env');

// 1. Detect active network IP and all candidates
async function detectActiveNetwork() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  let primaryIp = null;

  // Attempt UDP socket detection to 8.8.8.8 to find outbound route interface
  const detectedViaSocket = await new Promise((resolve) => {
    try {
      const socket = dgram.createSocket('udp4');
      socket.connect(80, '8.8.8.8', () => {
        const addr = socket.address().address;
        socket.close();
        resolve(addr);
      });
      socket.on('error', () => {
        try { socket.close(); } catch (e) {}
        resolve(null);
      });
      setTimeout(() => {
        try { socket.close(); } catch (e) {}
        resolve(null);
      }, 1000);
    } catch {
      resolve(null);
    }
  });

  // Inspect all system interfaces
  for (const [name, ifaceList] of Object.entries(interfaces)) {
    const isVirtual = /virtual|vmware|vbox|wsl|hyper-v|loopback/i.test(name);
    for (const iface of ifaceList) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const ip = iface.address;
        // Ignore link-local and default virtual bridge ranges
        if (ip.startsWith('169.254.') || ip.startsWith('192.168.56.')) {
          continue;
        }

        const isProbablePrimary = (!isVirtual && !ip.startsWith('172.')) || (detectedViaSocket && ip === detectedViaSocket);
        candidates.push({
          name: name.includes('Беспроводная') || /wi-?fi|wlan/i.test(name) ? `Wi-Fi (${name})` : name,
          ip: ip,
          isPrimary: false,
          isVirtual: isVirtual || ip.startsWith('172.'),
        });
      }
    }
  }

  // Determine primary IP
  if (detectedViaSocket && !detectedViaSocket.startsWith('127.') && !detectedViaSocket.startsWith('172.') && !detectedViaSocket.startsWith('169.254.')) {
    primaryIp = detectedViaSocket;
  } else {
    const nonVirtual = candidates.filter((c) => !c.isVirtual);
    if (nonVirtual.length > 0) {
      primaryIp = nonVirtual[0].ip;
    } else if (candidates.length > 0) {
      primaryIp = candidates[0].ip;
    } else {
      primaryIp = '127.0.0.1';
    }
  }

  // Format candidate list for UI selector
  const formattedCandidates = [];
  formattedCandidates.push({
    name: 'Wi-Fi (Активный LAN)',
    ip: primaryIp,
    isPrimary: true,
  });

  for (const c of candidates) {
    if (c.ip !== primaryIp && !formattedCandidates.some((it) => it.ip === c.ip)) {
      formattedCandidates.push({
        name: c.name,
        ip: c.ip,
        isPrimary: false,
      });
    }
  }

  formattedCandidates.push({
    name: 'Localhost (ПК)',
    ip: '127.0.0.1',
    isPrimary: false,
  });

  return { primaryIp, candidates: formattedCandidates };
}

// 2. Update .env file
function updateEnvFile(primaryIp) {
  try {
    let lines = [];
    if (fs.existsSync(ENV_FILE)) {
      lines = fs.readFileSync(ENV_FILE, 'utf8').split('\n').filter((l) => !l.startsWith('HOST_IP='));
    }
    lines.push(`HOST_IP=${primaryIp}`);
    fs.writeFileSync(ENV_FILE, lines.join('\n').trim() + '\n', 'utf8');
    console.log(`[✔] .env обновлен: HOST_IP=${primaryIp}`);
  } catch (err) {
    console.warn('[!] Ошибка обновления .env:', err.message);
  }
}

// 3. Update uploads/tunnel-info.json
function updateTunnelInfo(primaryIp, candidateIps) {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  let existing = {};
  if (fs.existsSync(STATUS_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    } catch {}
  }

  const payload = {
    ...existing,
    active: true,
    localIp: primaryIp,
    httpsPort: 8088,
    httpsUrl: `https://${primaryIp}:8088`,
    gatewayPort: 8443,
    gatewayUrl: `https://${primaryIp}:8443`,
    httpPort: 5173,
    httpUrl: `http://${primaryIp}:5173`,
    studioPort: 8000,
    studioUrl: `http://${primaryIp}:8000/studio`,
    url: `https://${primaryIp}:8088`,
    localIps: candidateIps,
    publicUrl: existing.publicUrl || null,
    tunnelUrl: existing.tunnelUrl || null,
    tunnelActive: Boolean(existing.tunnelActive),
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(STATUS_FILE, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`[✔] tunnel-info.json обновлен (IP: ${primaryIp})`);
}

// 4. Check SAN and generate SSL certificates if needed
function ensureSslCertificates(primaryIp, candidateIps) {
  if (!fs.existsSync(SSL_DIR)) fs.mkdirSync(SSL_DIR, { recursive: true });
  if (!fs.existsSync(STUDIO_ASSETS_DIR)) fs.mkdirSync(STUDIO_ASSETS_DIR, { recursive: true });

  const certPath = path.join(SSL_DIR, 'ssl_cert.pem');
  const keyPath = path.join(SSL_DIR, 'ssl_key.pem');

  let needsRegen = true;
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    // Check if current primaryIp is in SAN
    const checkResult = spawnSync('openssl', ['x509', '-in', certPath, '-text', '-noout'], { encoding: 'utf8' });
    if (checkResult.status === 0 && checkResult.stdout.includes(`IP Address:${primaryIp}`)) {
      needsRegen = false;
    }
  }

  if (!needsRegen) {
    console.log(`[✔] SSL сертификат актуален для ${primaryIp}`);
    // Sync to studio demo_assets
    copyCertFiles(certPath, keyPath);
    return;
  }

  console.log(`[+] Генерация SSL сертификата с SAN для ${primaryIp}...`);

  const sanIps = Array.from(new Set(['127.0.0.1', primaryIp, ...candidateIps.map((c) => c.ip)])).filter(Boolean);
  const sanList = ['DNS:localhost', ...sanIps.map((ip) => `IP:${ip}`)].join(',');

  // Attempt openssl generation
  const opensslArgs = [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', keyPath,
    '-out', certPath,
    '-days', '3650',
    '-subj', `/C=RU/O=KarateBunkaiExplorer/CN=${primaryIp}`,
    '-addext', `subjectAltName=${sanList}`,
  ];

  const genResult = spawnSync('openssl', opensslArgs, { encoding: 'utf8' });
  if (genResult.status === 0) {
    console.log(`[✔] SSL сертификат успешно создан через OpenSSL для ${primaryIp}!`);
    copyCertFiles(certPath, keyPath);
    return;
  }

  // Fallback via Python venv
  console.log('[!] OpenSSL не сработал, запуск генератора через Python...');
  const venvPythonCandidates = [
    'C:\\Users\\user\\Downloads\\bunkai_explorer_karate_motion_capture\\bunkai_explorer_karate_motion_capture\\.venv\\Scripts\\python.exe',
    path.join(STUDIO_DIR, '.venv', 'Scripts', 'python.exe'),
    'python',
  ];

  let pyExe = venvPythonCandidates.find((p) => fs.existsSync(p)) || 'python';
  const pyCode = `
import sys
sys.path.append(r"${STUDIO_DIR.replace(/\\/g, '/')}")
from core.phone_stream_server import generate_self_signed_cert
from pathlib import Path
ok = generate_self_signed_cert(Path(r"${certPath.replace(/\\/g, '/')}"), Path(r"${keyPath.replace(/\\/g, '/')}"), "${primaryIp}")
print("PY_RESULT:", ok)
`;
  const pyRes = spawnSync(pyExe, ['-c', pyCode], { encoding: 'utf8' });
  if (pyRes.status === 0 && pyRes.stdout.includes('PY_RESULT: True')) {
    console.log(`[✔] SSL сертификат создан через Python для ${primaryIp}!`);
    copyCertFiles(certPath, keyPath);
  } else {
    console.warn('[!] Предупреждение: генерация SSL сертификата вернула ошибку:', pyRes.stderr || pyRes.stdout);
  }
}

function copyCertFiles(certPath, keyPath) {
  try {
    const studioCert = path.join(STUDIO_ASSETS_DIR, 'ssl_cert.pem');
    const studioKey = path.join(STUDIO_ASSETS_DIR, 'ssl_key.pem');
    fs.copyFileSync(certPath, studioCert);
    fs.copyFileSync(keyPath, studioKey);
  } catch (err) {
    console.warn('[!] Ошибка копирования сертификатов в demo_assets:', err.message);
  }
}

async function main() {
  const { primaryIp, candidates } = await detectActiveNetwork();
  console.log('========================================================');
  console.log('🥋 Bunkai Explorer — Инициализация Сети и QR Кодов');
  console.log('========================================================');
  console.log(`[+] Активный IP компьютера: ${primaryIp}`);

  updateEnvFile(primaryIp);
  updateTunnelInfo(primaryIp, candidates);
  ensureSslCertificates(primaryIp, candidates);

  console.log('--------------------------------------------------------');
  console.log(`📱 Ссылка для телефона (Камера 1): https://${primaryIp}:8088/cam1`);
  console.log(`📱 Альтернативный порт (Шлюз):      https://${primaryIp}:8443/cam1`);
  console.log(`🥋 3D Додзё студия (ПК):           http://localhost:5173/motion-lab`);
  console.log('========================================================\n');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { detectActiveNetwork, updateEnvFile, updateTunnelInfo, ensureSslCertificates };
