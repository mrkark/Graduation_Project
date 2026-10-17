/**
 * Bunkai Explorer — WebRTC Сигналинг для подключения камеры телефона к Aimokap
 * Позволяет смартфону подключиться к сессии захвата движений на ПК по QR-коду / коду комнаты.
 */

function registerMocapSocket(mocapIo) {
  mocapIo.on('connection', (socket) => {
    let currentRoom = null;
    let currentRole = null;

    // Вход в сессию захвата движений (host — ПК Додзё, camera — смартфон)
    socket.on('mocap:join-room', ({ roomId, role }, cb) => {
      if (!roomId) return cb?.({ ok: false, error: 'ROOM_REQUIRED' });
      currentRoom = roomId;
      currentRole = role || 'camera';
      socket.join(`mocap:${roomId}`);

      // Оповещаем остальных участников комнаты о подключении
      socket.to(`mocap:${roomId}`).emit('mocap:peer-joined', {
        peerId: socket.id,
        role: currentRole,
      });

      cb?.({ ok: true, peerId: socket.id });
    });

    // Передача WebRTC Offer (SDP)
    socket.on('mocap:offer', ({ roomId, sdp, targetId }) => {
      const room = roomId || currentRoom;
      if (targetId) {
        mocapIo.to(targetId).emit('mocap:offer', { sdp, senderId: socket.id });
      } else if (room) {
        socket.to(`mocap:${room}`).emit('mocap:offer', { sdp, senderId: socket.id });
      }
    });

    // Передача WebRTC Answer (SDP)
    socket.on('mocap:answer', ({ roomId, sdp, targetId }) => {
      const room = roomId || currentRoom;
      if (targetId) {
        mocapIo.to(targetId).emit('mocap:answer', { sdp, senderId: socket.id });
      } else if (room) {
        socket.to(`mocap:${room}`).emit('mocap:answer', { sdp, senderId: socket.id });
      }
    });

    // Обмен ICE-кандидатами
    socket.on('mocap:candidate', ({ roomId, candidate, targetId }) => {
      const room = roomId || currentRoom;
      if (targetId) {
        mocapIo.to(targetId).emit('mocap:candidate', { candidate, senderId: socket.id });
      } else if (room) {
        socket.to(`mocap:${room}`).emit('mocap:candidate', { candidate, senderId: socket.id });
      }
    });

    // Резервная быстрая передача ключевых точек / кадров, если прямой WebRTC блокирован строгим NAT
    socket.on('mocap:landmarks-stream', ({ roomId, landmarks, metrics }) => {
      const room = roomId || currentRoom;
      if (room) {
        socket.to(`mocap:${room}`).emit('mocap:landmarks-data', { landmarks, metrics });
      }
    });

    // Удаленное управление созданием / записью анимации с телефона
    socket.on('mocap:record-command', ({ roomId, action }) => {
      const room = roomId || currentRoom;
      if (room) {
        socket.to(`mocap:${room}`).emit('mocap:record-command', { action, senderId: socket.id });
      }
    });

    // Трансляция статуса записи анимации (с ПК на телефон)
    socket.on('mocap:recording-state', ({ roomId, isRecording, duration, frameCount }) => {
      const room = roomId || currentRoom;
      if (room) {
        socket.to(`mocap:${room}`).emit('mocap:recording-state', {
          isRecording,
          duration,
          frameCount,
          senderId: socket.id,
        });
      }
    });

    // Выход из сессии
    const handleLeave = () => {
      if (currentRoom) {
        socket.to(`mocap:${currentRoom}`).emit('mocap:peer-left', {
          peerId: socket.id,
          role: currentRole,
        });
        socket.leave(`mocap:${currentRoom}`);
        currentRoom = null;
      }
    };

    socket.on('mocap:leave', handleLeave);
    socket.on('disconnect', handleLeave);
  });
}

module.exports = { registerMocapSocket };
