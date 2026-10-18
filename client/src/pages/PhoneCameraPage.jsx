import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import io from 'socket.io-client';
import './PhoneCameraPage.css';

function getSocketUrl() {
  const envUrl = import.meta.env.VITE_SOCKET_URL;
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    if (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
      return `${window.location.protocol}//${window.location.hostname}:5000`;
    }
  }
  return envUrl || 'http://localhost:5000';
}

const SOCKET_URL = getSocketUrl();

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

const PHONE_ROLES = [
  { slot: 1, label: 'Телефон 1 (Фронт / 0°)', desc: 'Основная фронтальная плоскость (X, Y)' },
  { slot: 2, label: 'Телефон 2 (Сбоку / 90°)', desc: 'Профиль / глубина ударов и стоек (Z, Y)' },
  { slot: 3, label: 'Телефон 3 (Угол / 45°)', desc: 'Диагональ / устранение слепых зон' },
];

export default function PhoneCameraPage() {
  const [params] = useSearchParams();
  const initialRoom = params.get('room') || 'MOCAP-DOJO';
  const initialSlot = Number(params.get('slot')) || 1;

  const [roomId, setRoomId] = useState(initialRoom);
  const [selectedSlot, setSelectedSlot] = useState(initialSlot);
  const [assignedSlot, setAssignedSlot] = useState(initialSlot);
  const [deviceLabel, setDeviceLabel] = useState(PHONE_ROLES[initialSlot - 1]?.label || 'Телефон 1');

  const [facingMode, setFacingMode] = useState('environment'); // 'user' | 'environment'
  const [streamActive, setStreamActive] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [hostId, setHostId] = useState(null);
  const [roomCameras, setRoomCameras] = useState([]);

  // Состояние разрешения на камеру
  const [permissionState, setPermissionState] = useState('prompt'); // 'prompt' | 'granted' | 'denied'
  const [permissionGuideVisible, setPermissionGuideVisible] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [fps, setFps] = useState(0);

  // Состояние записи MoCap анимации, инициируемой с телефона
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordFrames, setRecordFrames] = useState(0);
  const [lastSavedNotice, setLastSavedNotice] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const frameCountRef = useRef(0);

  // Проверка статуса разрешения браузера на камеру (Permissions API)
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'camera' })
        .then((status) => {
          setPermissionState(status.state);
          status.onchange = () => {
            setPermissionState(status.state);
            if (status.state === 'granted') {
              startCamera();
            }
          };
        })
        .catch(() => {
          // Permissions query может не поддерживаться в некоторых мобильных браузерах
        });
    }
  }, []);

  // Подключение к Socket.IO пространству /mocap
  useEffect(() => {
    const socket = io(`${SOCKET_URL}/mocap`, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit(
        'mocap:join-room',
        {
          roomId,
          role: 'camera',
          preferredSlot: selectedSlot,
          label: PHONE_ROLES[selectedSlot - 1]?.label || `Телефон ${selectedSlot}`,
        },
        (res) => {
          if (!res?.ok) {
            setErrorMsg(res?.message || 'Не удалось войти в комнату захвата');
          } else {
            setAssignedSlot(res.slot);
            setDeviceLabel(res.label);
            setHostId(res.hostId || null);
            if (res.cameras) setRoomCameras(res.cameras);
            setErrorMsg(null);
          }
        }
      );
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
      setPeerConnected(false);
    });

    // Обновление списка камер в комнате (до 3 смартфонов)
    socket.on('mocap:cameras-updated', ({ cameras }) => {
      if (Array.isArray(cameras)) {
        setRoomCameras(cameras);
      }
    });

    socket.on('mocap:host-joined', ({ hostId: newHostId }) => {
      setHostId(newHostId);
      // Если видеопоток уже работает, заново инициируем WebRTC подключение к хосту
      if (streamRef.current) {
        setupPeerConnection(streamRef.current, newHostId);
      }
    });

    socket.on('mocap:host-left', () => {
      setHostId(null);
      setPeerConnected(false);
    });

    // Получение статуса записи от ПК (хоста)
    socket.on('mocap:recording-state', ({ isRecording: rec, duration, frameCount }) => {
      setIsRecording(Boolean(rec));
      if (duration !== undefined) setRecordSeconds(duration);
      if (frameCount !== undefined) setRecordFrames(frameCount);
      if (!rec && duration > 0) {
        setLastSavedNotice(true);
        setTimeout(() => setLastSavedNotice(false), 5000);
      }
    });

    // Получение WebRTC Offer от ПК (хоста)
    socket.on('mocap:offer', async ({ sdp, senderId }) => {
      try {
        if (!peerRef.current) return;
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        socket.emit('mocap:answer', {
          roomId,
          sdp: answer,
          targetId: senderId,
          slot: assignedSlot,
        });
      } catch (err) {
        console.error('Ошибка WebRTC Answer:', err);
      }
    });

    // Получение Answer от ПК
    socket.on('mocap:answer', async ({ sdp }) => {
      try {
        if (peerRef.current) {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        }
      } catch (err) {
        console.error('Ошибка установки RemoteDescription:', err);
      }
    });

    // ICE кандидат
    socket.on('mocap:candidate', async ({ candidate }) => {
      try {
        if (peerRef.current && candidate) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('Ошибка добавления ICE:', err);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, selectedSlot, assignedSlot]);

  // Запуск камеры смартфона с явной обработкой разрешений
  const startCamera = useCallback(async () => {
    try {
      setErrorMsg(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setPermissionState('granted');
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.warn('Autoplay предупреждение:', e));
      }
      setStreamActive(true);

      // Инициализируем WebRTC соединение для трансляции на ПК
      setupPeerConnection(stream, hostId);
    } catch (err) {
      console.error('Ошибка доступа к камере телефона:', err);
      setStreamActive(false);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionState('denied');
        setErrorMsg('Доступ к камере заблокирован в настройках браузера. Разрешите камеру для этого сайта.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMsg('Камера на устройстве не найдена.');
      } else {
        setErrorMsg(`Не удалось включить камеру: ${err.message || 'Ошибка устройства'}`);
      }
    }
  }, [facingMode, hostId, assignedSlot]);

  // Настройка WebRTC соединения
  const setupPeerConnection = (stream, targetHostId) => {
    if (peerRef.current) {
      try {
        peerRef.current.close();
      } catch (e) {}
    }

    const peer = new RTCPeerConnection(ICE_SERVERS);
    peerRef.current = peer;

    // Добавляем видеотрек с камеры телефона
    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });

    peer.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('mocap:candidate', {
          roomId,
          candidate: event.candidate,
          targetId: targetHostId,
          slot: assignedSlot,
        });
      }
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        setPeerConnected(true);
      } else if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') {
        setPeerConnected(false);
      }
    };

    // Создаем Offer для ПК
    peer
      .createOffer({ offerToReceiveVideo: false, offerToReceiveAudio: false })
      .then((offer) => peer.setLocalDescription(offer))
      .then(() => {
        if (socketRef.current) {
          socketRef.current.emit('mocap:offer', {
            roomId,
            sdp: peer.localDescription,
            targetId: targetHostId,
            slot: assignedSlot,
          });
        }
      })
      .catch((err) => console.error('Ошибка создания Offer:', err));
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (peerRef.current) {
        peerRef.current.close();
      }
    };
  }, [startCamera]);

  // Подсчет FPS
  useEffect(() => {
    const timer = setInterval(() => {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleToggleRecord = () => {
    if (!socketRef.current || !socketConnected) return;
    socketRef.current.emit('mocap:record-command', {
      roomId,
      action: isRecording ? 'stop' : 'start',
      slot: assignedSlot,
    });
  };

  const handleSlotChange = (slotNum) => {
    setSelectedSlot(slotNum);
    if (socketRef.current && socketConnected) {
      socketRef.current.emit('mocap:leave');
      socketRef.current.emit(
        'mocap:join-room',
        {
          roomId,
          role: 'camera',
          preferredSlot: slotNum,
          label: PHONE_ROLES[slotNum - 1]?.label,
        },
        (res) => {
          if (res?.ok) {
            setAssignedSlot(res.slot);
            setDeviceLabel(res.label);
            if (streamRef.current) {
              setupPeerConnection(streamRef.current, res.hostId);
            }
          }
        }
      );
    }
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="phone-cam-page">
      {/* 1. БАННЕР-ИНСТРУКЦИЯ О РАЗРЕШЕНИИ НА КАМЕРУ */}
      {permissionGuideVisible && (
        <div className={`phone-cam-perm-banner ${permissionState === 'granted' && streamActive ? 'is-granted' : 'is-prompt'}`}>
          <div className="perm-banner-content">
            <div className="perm-banner-icon">
              {permissionState === 'granted' && streamActive ? '✅' : '📷'}
            </div>
            <div className="perm-banner-text">
              <strong>
                {permissionState === 'granted' && streamActive
                  ? 'Камера разрешена и транслируется в Додзё'
                  : 'Включите разрешение на использование камеры на этом сайте'}
              </strong>
              <p>
                {permissionState === 'granted' && streamActive
                  ? `Поток активен (${fps} FPS) · Привязан как ${deviceLabel}. Закрепите телефон неподвижно.`
                  : 'Для захвата 3D-движений и биомеханики каратэ браузеру требуется доступ к камере вашего смартфона.'}
              </p>
            </div>
            <div className="perm-banner-actions">
              {(!streamActive || permissionState !== 'granted') && (
                <button type="button" className="btn btn-sm btn-gold" onClick={startCamera}>
                  🎥 Включить камеру
                </button>
              )}
              {permissionState === 'granted' && streamActive && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost-light"
                  onClick={() => setPermissionGuideVisible(false)}
                >
                  ✕ Скрыть
                </button>
              )}
            </div>
          </div>

          {permissionState === 'denied' && (
            <div className="perm-banner-help">
              <span className="help-title">⚠️ Как включить доступ, если он был запрещен:</span>
              <ol>
                <li>В адресной строке браузера нажмите на значок замочка <strong>🔒</strong> или настроек сайта.</li>
                <li>Найдите пункт <strong>«Камера»</strong> и переключите в режим <strong>«Разрешить»</strong>.</li>
                <li>В iOS Safari: «Настройки» → «Safari» → «Камера» → «Разрешить».</li>
                <li>После изменения разрешения нажмите кнопку «Включить камеру» выше или обновите страницу.</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* 2. ЗАГОЛОВОК МОБИЛЬНОГО ВИДОИСКАТЕЛЯ */}
      <header className="phone-cam-header">
        <div className="phone-cam-brand">
          <span className="hanko">分解</span>
          <div>
            <h1>Мобильная Камера Додзё</h1>
            <div className="phone-cam-meta">
              <span className="phone-cam-room-tag">Комната: <strong>{roomId}</strong></span>
              <span className="phone-cam-slot-tag">Камера <strong>#{assignedSlot}</strong></span>
            </div>
          </div>
        </div>

        <div className="phone-cam-status-pill">
          <span className={`status-dot ${peerConnected ? 'online' : socketConnected ? 'standby' : 'offline'}`} />
          <span>
            {peerConnected
              ? 'Трансляция на ПК активна'
              : socketConnected
              ? (hostId ? 'ПК найден · Связь...' : 'Ожидание запуска Додзё на ПК')
              : 'Подключение к серверу...'}
          </span>
        </div>
      </header>

      {/* 3. ПАНЕЛЬ ВЫБОРА РОЛИ ТЕЛЕФОНА (МУЛЬТИ-КАМЕРА ДО 3 ТЕЛЕФОНОВ) */}
      <div className="phone-cam-slots-bar">
        <span className="slots-title">Позиция смартфона:</span>
        <div className="slots-pills">
          {PHONE_ROLES.map((r) => {
            const isAssigned = assignedSlot === r.slot;
            const isTakenByOther = roomCameras.some((c) => c.slot === r.slot && c.peerId !== socketRef.current?.id);

            return (
              <button
                key={r.slot}
                type="button"
                className={`slot-pill ${isAssigned ? 'active' : ''} ${isTakenByOther ? 'is-taken' : ''}`}
                onClick={() => handleSlotChange(r.slot)}
                disabled={isTakenByOther}
                title={r.desc}
              >
                <span className="slot-num">{r.slot}</span>
                <span className="slot-txt">{r.slot === 1 ? 'Фронт (0°)' : r.slot === 2 ? 'Бок (90°)' : 'Угол (45°)'}</span>
                {isAssigned && <span className="slot-current-badge">Это устройство</span>}
                {isTakenByOther && <span className="slot-taken-badge">Занят</span>}
              </button>
            );
          })}
        </div>
        <div className="slots-info">
          <span>Подключено телефонов к Додзё: <strong>{roomCameras.length} / 3</strong></span>
        </div>
      </div>

      {errorMsg && (
        <div className="phone-cam-error">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* 4. ЭКРАН ВИДЕОПОТОКА С КАМЕРЫ */}
      <main className="phone-cam-viewport">
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className="phone-cam-video"
          onTimeUpdate={() => { frameCountRef.current++; }}
        />

        {/* Сетка эмбусэн прицеливания */}
        <div className="phone-cam-reticle">
          <div className="reticle-corner top-left" />
          <div className="reticle-corner top-right" />
          <div className="reticle-corner bottom-left" />
          <div className="reticle-corner bottom-right" />
          <span className="reticle-guide-text">
            {assignedSlot === 1 && 'Встаньте лицом к экрану в полный рост (Фронтальный захват)'}
            {assignedSlot === 2 && 'Встаньте боком к камере для точного отслеживания глубины Z (Профиль)'}
            {assignedSlot === 3 && 'Камера под углом 45° для трехмерной триангуляции движений'}
          </span>
        </div>

        {/* Индикатор активной записи анимации для ПК */}
        {isRecording && (
          <div className="phone-cam-rec-banner blink">
            <span className="rec-dot" />
            <span>СЪЕМКА 3D АНИМАЦИИ: {formatTimer(recordSeconds)}</span>
            <span className="rec-frames">({recordFrames} кадров)</span>
          </div>
        )}

        {/* Уведомление об успешной записи */}
        {lastSavedNotice && (
          <div className="phone-cam-rec-success">
            🥋 3D-Анимация успешно записана! Проверьте 3D-модель на экране компьютера.
          </div>
        )}

        {/* Оверлей телеметрии */}
        <div className="phone-cam-overlay">
          <div className="telemetry-pill">
            <span>{deviceLabel}</span>
            <span>{facingMode === 'environment' ? 'Основная' : 'Селфи'}</span>
            <span>{fps} FPS</span>
          </div>
        </div>
      </main>

      {/* 5. ПАНЕЛЬ УПРАВЛЕНИЯ НА ТЕЛЕФОНЕ */}
      <footer className="phone-cam-controls">
        <button
          type="button"
          className={`btn btn-phone-action btn-phone-record ${isRecording ? 'is-recording' : ''}`}
          onClick={handleToggleRecord}
        >
          {isRecording ? '⏹ Остановить запись и смотреть 3D на ПК' : '⏺ Начать запись 3D MoCap'}
        </button>

        <div className="phone-cam-secondary-actions">
          <button type="button" className="btn btn-phone-action" onClick={toggleFacing}>
            🔄 {facingMode === 'environment' ? 'Селфи-камера' : 'Основная камера'}
          </button>

          <button
            type="button"
            className="btn btn-phone-action btn-gold"
            onClick={() => {
              startCamera();
            }}
          >
            ⚡ Обновить камеру
          </button>
        </div>
      </footer>
    </div>
  );
}
