const { verifyAccessToken } = require('../utils/jwt');
const authRepo = require('../db/authRepo');
const chatRepo = require('../db/chatRepo');
const { callScalarFunction } = require('../db/execProc');
const { logActivity } = require('../utils/activityLogger');

const MAX_MESSAGE_LENGTH = 2000;
const SPAM_WINDOW_MS = 10 * 1000;
const SPAM_MAX_MESSAGES = 8; // не более 8 сообщений за 10 секунд — базовая защита от спама

function registerChatSocket(io) {
  // Middleware аутентификации хэндшейка — гость никогда не подключится к чату (раздел 2 ТЗ)
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('NO_TOKEN'));

      const payload = verifyAccessToken(token);
      const row = await authRepo.getById(payload.userId);
      if (!row) return next(new Error('USER_NOT_FOUND'));
      if (row.Is_Blocked) return next(new Error('USER_BLOCKED'));

      socket.user = authRepo.toSafeUser(row);
      socket.userRole = authRepo.roleOf(row);
      next();
    } catch (err) {
      next(new Error('INVALID_TOKEN'));
    }
  });

  io.on('connection', (socket) => {
    const recentTimestamps = [];

    socket.emit('connected', {
      user: socket.user,
      role: socket.userRole,
    });

    socket.on('room:join', async (roomId, cb) => {
      try {
        // dbo.fn_CanAccessChatRoom — единственная проверка доступа к комнате, живёт в БД
        const canAccess = await callScalarFunction('fn_CanAccessChatRoom', [roomId, socket.user.User_ID]);
        if (!canAccess) return cb?.({ ok: false, error: 'Комната не найдена или недостаточно прав' });

        socket.join(`room:${roomId}`);
        cb?.({ ok: true });
      } catch (err) {
        cb?.({ ok: false, error: 'Внутренняя ошибка' });
      }
    });

    socket.on('room:leave', (roomId) => {
      socket.leave(`room:${roomId}`);
    });

    socket.on('typing', ({ roomId, isTyping }) => {
      socket.to(`room:${roomId}`).emit('typing', {
        userId: socket.user.User_ID,
        username: socket.user.Display_Name || socket.user.Username,
        isTyping: !!isTyping,
      });
    });

    socket.on('message:send', async ({ roomId, text }, cb) => {
      try {
        const trimmed = (text || '').trim();
        if (!trimmed) return cb?.({ ok: false, error: 'Сообщение не может быть пустым' });
        if (trimmed.length > MAX_MESSAGE_LENGTH) return cb?.({ ok: false, error: 'Сообщение слишком длинное' });

        // Базовая защита от спама: скользящее окно (держим в памяти сокета — не SQL-логика)
        const now = Date.now();
        while (recentTimestamps.length && now - recentTimestamps[0] > SPAM_WINDOW_MS) recentTimestamps.shift();
        if (recentTimestamps.length >= SPAM_MAX_MESSAGES) {
          return cb?.({ ok: false, error: 'Слишком много сообщений подряд, подождите немного' });
        }
        recentTimestamps.push(now);

        // sp_Chat_CreateMessage сама проверяет существование комнаты и права доступа
        const message = await chatRepo.createMessage(roomId, socket.user.User_ID, trimmed);

        io.to(`room:${roomId}`).emit('message:new', message);
        cb?.({ ok: true, message });

        await logActivity({ userId: socket.user.User_ID, action: 'send_message', entityType: 'ChatMessage', entityId: message.Message_ID });
      } catch (err) {
        cb?.({ ok: false, error: err.message || 'Не удалось отправить сообщение' });
      }
    });

    socket.on('message:delete', async (messageId, cb) => {
      try {
        // sp_Chat_DeleteMessage сама проверяет владение/роль
        const result = await chatRepo.deleteMessage(messageId, socket.user.User_ID, socket.userRole);
        io.to(`room:${result.ChatRoom_ID}`).emit('message:deleted', { messageId: result.Message_ID });
        cb?.({ ok: true });
      } catch (err) {
        cb?.({ ok: false, error: err.message || 'Не удалось удалить сообщение' });
      }
    });

    socket.on('disconnect', () => {
      // Комнаты покидаются автоматически; индикатор "онлайн" на фронтенде опирается на событие connect/disconnect.
    });
  });
}

module.exports = { registerChatSocket };
