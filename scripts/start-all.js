const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT_DIR = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(ROOT_DIR, 'server');
const CLIENT_DIR = path.join(ROOT_DIR, 'client');
const STUDIO_DIR = path.join(ROOT_DIR, 'karate_motion_studio');

const children = [];

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

function checkPort(port) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(700);
    s.on('connect', () => {
      s.destroy();
      resolve(true);
    });
    s.on('error', () => {
      s.destroy();
      resolve(false);
    });
    s.on('timeout', () => {
      s.destroy();
      resolve(false);
    });
    s.connect(port, '127.0.0.1');
  });
}

function getPythonExecutable() {
  const candidates = [
    process.env.PYTHON_PATH,
    process.env.MOCAP_PYTHON,
    path.join(STUDIO_DIR, '.venv', 'Scripts', 'python.exe'),
    path.resolve(ROOT_DIR, '..', '.venv', 'Scripts', 'python.exe'),
    'C:\\Users\\user\\Downloads\\bunkai_explorer_karate_motion_capture\\bunkai_explorer_karate_motion_capture\\.venv\\Scripts\\python.exe',
    'python',
    'python3',
    'py',
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return 'python';
}

async function startMoCapStudio() {
  const isRunning = await checkPort(8000);
  if (isRunning) {
    console.log('[✔] Python AI MoCap Studio уже запущен на порту 8000 (Docker или процесс)');
    return;
  }

  const pythonExe = getPythonExecutable();
  console.log(`[+] Запуск Python AI MoCap Studio (${pythonExe})...`);

  const mocap = spawn(pythonExe, ['web_studio_server.py'], {
    cwd: STUDIO_DIR,
    stdio: 'inherit',
    shell: true,
  });

  children.push(mocap);
  mocap.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.warn(`[!] Python MoCap Studio завершился с кодом ${code}`);
    }
  });
}

function startBackend() {
  console.log('[+] Запуск Backend API (Node.js Express)...');
  const server = spawn('npm', ['run', 'dev'], {
    cwd: SERVER_DIR,
    stdio: 'inherit',
    shell: true,
  });

  children.push(server);
  server.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.warn(`[!] Backend API завершился с кодом ${code}`);
    }
  });
}

function startFrontend() {
  console.log('[+] Запуск Frontend UI (React + Vite)...');
  const client = spawn('npm', ['run', 'dev'], {
    cwd: CLIENT_DIR,
    stdio: 'inherit',
    shell: true,
  });

  children.push(client);
  client.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.warn(`[!] Frontend UI завершился с кодом ${code}`);
    }
  });
}

function cleanup() {
  console.log('\n[!] Завершение работы всех процессов Bunkai Explorer...');
  for (const child of children) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', child.pid, '/f', '/t'], { stdio: 'ignore' });
      } else {
        child.kill('SIGINT');
      }
    } catch {}
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

async function main() {
  const localIp = getLocalIp();

  console.log('========================================================');
  console.log('  🥋 Karate Bunkai Explorer — Полный запуск проекта');
  console.log('========================================================');

  await startMoCapStudio();
  startBackend();
  startFrontend();

  console.log('\n========================================================');
  console.log(`  💻 Веб-приложение Додзё:      http://localhost:5173`);
  console.log(`  ⚙️  Бэкенд API:                http://localhost:5000/api`);
  console.log(`  🥋 Python AI MoCap (Порт 8000): http://localhost:8000/studio`);
  console.log(`  📱 Камера смартфона (HTTPS):  https://${localIp}:8088/cam1`);
  console.log('========================================================\n');
}

main().catch(console.error);
