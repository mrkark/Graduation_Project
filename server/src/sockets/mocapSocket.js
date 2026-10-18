/**
 * Bunkai Explorer — WebRTC Сигналинг для подключения до 3 телефонов к Aimokap
 * Позволяет подключить до 3 смартфонов (мульти-камерный захват: фронт, бок, угол)
 * к сессии захвата движений на ПК по QR-коду / коду комнаты.
 */

const MAX_PHONES_PER_ROOM = 3;

// Реестр активных комнат MoCap: roomId -> { hostId: string, cameras: Map<socketId, { peerId, slot, label }> }
const mocapRooms = new Map();

function getOrCreateRoom(roomId) {
  if (!mocapRooms.has(roomId)) {
    mocapRooms.set(roomId, {
      roomId,
      hostId: null,
      cameras: new Map(),
    });
  }
  return mocapRooms.get(roomId);
}

function getAvailableSlot(camerasMap, preferredSlot) {
  const usedSlots = new Set();
  camerasMap.forEach((cam) => {
    if (cam.slot) usedSlots.add(cam.slot);
  });

  if (preferredSlot && preferredSlot >= 1 && preferredSlot <= MAX_PHONES_PER_ROOM && !usedSlots.has(preferredSlot)) {
    return preferredSlot;
  }

  for (let slot = 1; slot <= MAX_PHONES_PER_ROOM; slot++) {
    if (!usedSlots.has(slot)) return slot;
  }
  return null;
}

function getDefaultSlotLabel(slot) {
  switch (slot) {
    case 1:
      return 'Телефон 1 (Фронт / 0°)';
    case 2:
      return 'Телефон 2 (Сбоку / 90°)';
    case 3:
      return 'Телефон 3 (Угол / 45°)';
    default:
      return `Телефон #${slot}`;
  }
}

function registerMocapSocket(mocapIo) {
  mocapIo.on('connection', (socket) => {
    let currentRoom = null;
    let currentRole = null;
    let currentSlot = null;

    // Вход в сессию захвата движений (host — ПК Додзё, camera — смартфон 1, 2 или 3)
    socket.on('mocap:join-room', ({ roomId, role, preferredSlot, label }, cb) => {
      if (!roomId) return cb?.({ ok: false, error: 'ROOM_REQUIRED' });

      currentRoom = roomId;
      currentRole = role || 'camera';
      socket.join(`mocap:${roomId}`);

      const room = getOrCreateRoom(roomId);

      if (currentRole === 'host') {
        room.hostId = socket.id;
        const cameraList = Array.from(room.cameras.values());

        // Оповещаем подключенные камеры о появлении хоста
        socket.to(`mocap:${roomId}`).emit('mocap:host-joined', { hostId: socket.id });

        return cb?.({
          ok: true,
          peerId: socket.id,
          role: 'host',
          cameras: cameraList,
          maxPhones: MAX_PHONES_PER_ROOM,
        });
      }

      // Роль: camera (смартфон)
      const slot = getAvailableSlot(room.cameras, preferredSlot ? Number(preferredSlot) : null);
      if (!slot) {
        return cb?.({
          ok: false,
          error: 'MAX_CAMERAS_REACHED',
          message: `В комнате уже подключено максимальное число телефонов (${MAX_PHONES_PER_ROOM}).`,
        });
      }

      currentSlot = slot;
      const deviceLabel = label || getDefaultSlotLabel(slot);
      const cameraInfo = {
        peerId: socket.id,
        slot,
        label: deviceLabel,
        connectedAt: Date.now(),
      };

      room.cameras.set(socket.id, cameraInfo);

      const updatedCameraList = Array.from(room.cameras.values());

      // Оповещаем ПК-хост о подключении конкретного телефона
      if (room.hostId) {
        mocapIo.to(room.hostId).emit('mocap:camera-joined', cameraInfo);
      }

      // Рассылаем всем участникам комнаты актуальный список камер
      mocapIo.to(`mocap:${roomId}`).emit('mocap:cameras-updated', {
        cameras: updatedCameraList,
        total: updatedCameraList.length,
      });

      cb?.({
        ok: true,
        peerId: socket.id,
        role: 'camera',
        slot,
        label: deviceLabel,
        hostId: room.hostId,
        cameras: updatedCameraList,
      });
    });

    // Запрос списка подключенных устройств
    socket.on('mocap:get-cameras', ({ roomId }, cb) => {
      const room = mocapRooms.get(roomId || currentRoom);
      const cameras = room ? Array.from(room.cameras.values()) : [];
      cb?.({ ok: true, cameras, hostOnline: Boolean(room?.hostId) });
    });

    // Передача WebRTC Offer (SDP)
    socket.on('mocap:offer', ({ roomId, sdp, targetId, slot }) => {
      const room = roomId || currentRoom;
      const target = targetId || (room && mocapRooms.get(room)?.hostId);

      if (target) {
        mocapIo.to(target).emit('mocap:offer', {
          sdp,
          senderId: socket.id,
          slot: slot || currentSlot,
        });
      } else if (room) {
        socket.to(`mocap:${room}`).emit('mocap:offer', {
          sdp,
          senderId: socket.id,
          slot: slot || currentSlot,
        });
      }
    });

    // Передача WebRTC Answer (SDP)
    socket.on('mocap:answer', ({ roomId, sdp, targetId, slot }) => {
      const room = roomId || currentRoom;
      const target = targetId || (room && mocapRooms.get(room)?.hostId);

      if (target) {
        mocapIo.to(target).emit('mocap:answer', {
          sdp,
          senderId: socket.id,
          slot: slot || currentSlot,
        });
      } else if (room) {
        socket.to(`mocap:${room}`).emit('mocap:answer', {
          sdp,
          senderId: socket.id,
          slot: slot || currentSlot,
        });
      }
    });

    // Обмен ICE-кандидатами
    socket.on('mocap:candidate', ({ roomId, candidate, targetId, slot }) => {
      const room = roomId || currentRoom;
      const target = targetId || (room && mocapRooms.get(room)?.hostId);

      if (target) {
        mocapIo.to(target).emit('mocap:candidate', {
          candidate,
          senderId: socket.id,
          slot: slot || currentSlot,
        });
      } else if (room) {
        socket.to(`mocap:${room}`).emit('mocap:candidate', {
          candidate,
          senderId: socket.id,
          slot: slot || currentSlot,
        });
      }
    });

    // Потоковая передача ключевых точек / телеметрии от конкретной камеры
    socket.on('mocap:landmarks-stream', ({ roomId, landmarks, worldLandmarks, metrics, slot }) => {
      const room = roomId || currentRoom;
      if (room) {
        socket.to(`mocap:${room}`).emit('mocap:landmarks-data', {
          landmarks,
          worldLandmarks,
          metrics,
          slot: slot || currentSlot,
          senderId: socket.id,
        });
      }
    });

    // Удаленное управление созданием / записью анимации с любого из телефонов
    socket.on('mocap:record-command', ({ roomId, action }) => {
      const room = roomId || currentRoom;
      if (room) {
        socket.to(`mocap:${room}`).emit('mocap:record-command', {
          action,
          senderId: socket.id,
          slot: currentSlot,
        });
      }
    });

    // Трансляция статуса записи анимации (с ПК на телефоны)
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
      if (!currentRoom) return;
      const room = mocapRooms.get(currentRoom);

      if (room) {
        if (currentRole === 'host') {
          room.hostId = null;
          socket.to(`mocap:${currentRoom}`).emit('mocap:host-left');
        } else if (currentRole === 'camera') {
          room.cameras.delete(socket.id);
          const remainingCameras = Array.from(room.cameras.values());

          socket.to(`mocap:${currentRoom}`).emit('mocap:camera-left', {
            peerId: socket.id,
            slot: currentSlot,
          });

          mocapIo.to(`mocap:${currentRoom}`).emit('mocap:cameras-updated', {
            cameras: remainingCameras,
            total: remainingCameras.length,
          });
        }

        if (!room.hostId && room.cameras.size === 0) {
          mocapRooms.delete(currentRoom);
        }
      }

      socket.leave(`mocap:${currentRoom}`);
      currentRoom = null;
      currentRole = null;
      currentSlot = null;
    };

    socket.on('mocap:leave', handleLeave);
    socket.on('disconnect', handleLeave);
  });
}

module.exports = { registerMocapSocket, MAX_PHONES_PER_ROOM };
