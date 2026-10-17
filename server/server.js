require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

const app = require('./src/app');
const { poolPromise } = require('./src/config/database');
const { registerChatSocket } = require('./src/sockets/chatSocket');
const { registerMocapSocket } = require('./src/sockets/mocapSocket');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
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
  });
}

start();

process.on('unhandledRejection', (reason) => {
  console.error('Необработанное отклонение промиса:', reason);
});
