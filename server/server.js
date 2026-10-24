require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

const app = require('./src/app');
const { poolPromise } = require('./src/config/database');
const { registerChatSocket } = require('./src/sockets/chatSocket');
const { registerMocapSocket } = require('./src/sockets/mocapSocket');

const PORT = process.env.PORT || 5000;
const net = require('net');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function checkAndStartPythonMocap() {
  const s = new net.Socket();
  let handled = false;

  const launch = () => {
    if (handled) return;
    handled = true;
    try { s.destroy(); } catch {}

    const studioDir = path.resolve(__dirname, '../karate_motion_studio');
    const studioScript = path.join(studioDir, 'web_studio_server.py');
    if (!fs.existsSync(studioScript)) return;

    // Автопоиск Python с поддержкой виртуального окружения
    const candidatePythons = [
      process.env.PYTHON_PATH,
      process.env.MOCAP_PYTHON,
      path.join(studioDir, '.venv', 'Scripts', 'python.exe'),
      path.resolve(__dirname, '../../.venv/Scripts/python.exe'),
      'C:\\Users\\user\\Downloads\\bunkai_explorer_karate_motion_capture\\bunkai_explorer_karate_motion_capture\\.venv\\Scripts\\python.exe',
      'python',
      'python3',
      'py',
    ].filter(Boolean);

    let pythonExe = candidatePythons.find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    }) || 'python';

    try {
      const child = spawn(pythonExe, ['web_studio_server.py'], {
        cwd: studioDir,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.unref();
      console.log(`✔ Python AI MoCap Server автоматически запущен вместе с проектом (${pythonExe})`);
    } catch (err) {
      console.warn('✘ Не удалось запустить Python AI MoCap Server автоматически:', err.message);
    }
  };

  s.setTimeout(800);
  s.on('connect', () => {
    handled = true;
    s.destroy();
    console.log('✔ Python AI MoCap Studio уже активен на порту 8000');
  });
  s.on('error', launch);
  s.on('timeout', launch);
  s.connect(8000, '127.0.0.1');
}

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
  },
});

registerChatSocket(io);
registerMocapSocket(io.of('/mocap'));

// Делаем io доступным контроллерам, если понадобится эмитить события вне сокет-хендлеров
app.set('io', io);

async function start() {
  try {
    await poolPromise;
    console.log('✔ Подключение к Microsoft SQL Server (библиотека mssql) установлено.');
  } catch (err) {
    console.error('✘ Не удалось подключиться к базе данных:', err.message);
    console.error('  Проверьте .env (DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD) и доступность MSSQL на Docker.');
    process.exit(1);
  }

  server.listen(PORT, () => {
    console.log(`✔ Bunkai Explorer API запущен на порту ${PORT}`);
    console.log(`✔ Socket.IO ожидает подключения (CORS origin: ${process.env.CLIENT_URL || 'http://localhost:5173'})`);
    checkAndStartPythonMocap();
  });
}

start();

process.on('unhandledRejection', (reason) => {
  console.error('Необработанное отклонение промиса:', reason);
});
