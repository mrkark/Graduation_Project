import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import io from 'socket.io-client';
import './PhoneCameraPage.css';

function getSocketUrl() {
  if (typeof window !== 'undefined') {
    if (window.location.protocol === 'https:' || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')) {
      return window.location.origin;
    }
  }
  const envUrl = import.meta.env.VITE_SOCKET_URL;
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

// Безопасное получение navigator.mediaDevices с поддержкой legacy API (webkitGetUserMedia и т.д.)
function getMediaDevices() {
  if (typeof navigator === 'undefined') return null;
  if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
    return navigator.mediaDevices;
  }
  const legacyGetUserMedia =
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;

  if (legacyGetUserMedia) {
    return {
      getUserMedia: (constraints) =>
        new Promise((resolve, reject) => {
          legacyGetUserMedia.call(navigator, constraints, resolve, reject);
        }),
    };
  }
  return null;
}

// Прогрессивные наборы ограничений видеопотока (от идеального мобильного до универсального fallback)
const CONSTRAINT_TIERS = [
  // Уровень 1: Идеальное качество под смартфон (без жестких ограничений max, предотвращая OverconstrainedError в портретном режиме)
  (facing) => ({
    video: {
      facingMode: facing ? { ideal: facing } : 'environment',
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  }),
  // Уровень 2: Только направление камеры (facingMode)
  (facing) => ({
    video: {
      facingMode: facing ? { ideal: facing } : 'environment',
    },
    audio: false,
  }),
  // Уровень 3: Базовое видео (гарантированное включение на любом смартфоне и браузере)
  () => ({
    video: true,
    audio: false,
  }),
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
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [hostId, setHostId] = useState(null);
  const [roomCameras, setRoomCameras] = useState([]);

  // Состояние разрешения и контекста безопасности браузера
  const [permissionState, setPermissionState] = useState('prompt'); // 'prompt' | 'granted' | 'denied'
  const [permissionGuideVisible, setPermissionGuideVisible] = useState(true);
  const [isInsecureOrigin, setIsInsecureOrigin] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [fps, setFps] = useState(0);

  // Копирование адресов для настройки Chrome
  const [copiedFlag, setCopiedFlag] = useState(false);
  const [copiedOrigin, setCopiedOrigin] = useState(false);

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
  const isStartingRef = useRef(false);

  // Проверка Secure Context и Permissions API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isHttps = window.location.protocol === 'https:';
      const isSecure = Boolean(window.isSecureContext ?? (isLocal || isHttps));
      const hasMedia = Boolean(getMediaDevices());

      if (!isSecure && !hasMedia) {
        setIsInsecureOrigin(true);
      }
    }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'camera' })
        .then((status) => {
          setPermissionState(status.state);
          status.onchange = () => {
            setPermissionState(status.state);
            if (status.state === 'granted' && !streamRef.current) {
              startCamera();
            }
          };
        })
        .catch(() => {
          // Игнорируем: в некоторых браузерах permissions.query не поддерживает 'camera'
        });
    }
  }, []);

  // Привязка видеопотока к элементу <video> с принудительным autoplay и muted для iOS/Android
  const bindStreamToVideo = useCallback((stream) => {
    const v = videoRef.current;
    if (!v) return;

    v.srcObject = stream;
    // Обязательные свойства для Safari iOS и мобильного Chrome
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute('playsinline', 'true');
    v.setAttribute('webkit-playsinline', 'true');
    v.setAttribute('autoplay', 'true');
    v.setAttribute('muted', 'true');

    const tryPlay = () => {
      const playPromise = v.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            setStreamActive(true);
            setIsVideoPlaying(true);
          })
          .catch((err) => {
            console.warn('Autoplay отложен до касания экрана:', err);
            setIsVideoPlaying(false);
          });
      }
    };

    v.onloadedmetadata = tryPlay;
    v.oncanplay = tryPlay;
    v.onplaying = () => setIsVideoPlaying(true);
    v.onpause = () => setIsVideoPlaying(false);
    tryPlay();
  }, []);

  // Запуск камеры смартфона с прогрессивными уровнями fallback (не зависит от сокетов и hostId)
  const startCamera = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setErrorMsg(null);

    const md = getMediaDevices();
    if (!md) {
      isStartingRef.current = false;
      setStreamActive(false);
      setIsVideoPlaying(false);
      setIsInsecureOrigin(true);
      setErrorMsg('Браузер телефона блокирует доступ к камере на HTTP-адресе. Включите флаг Chrome по инструкции ниже.');
      return;
    }

    let stream = null;
    let lastError = null;

    for (let i = 0; i < CONSTRAINT_TIERS.length; i++) {
      try {
        const constraints = CONSTRAINT_TIERS[i](facingMode);
        stream = await md.getUserMedia(constraints);
        if (stream) break;
      } catch (err) {
        lastError = err;
        console.warn(`Уровень ограничений ${i + 1} отклонен, пробуем запасной...`, err);
      }
    }

    isStartingRef.current = false;

    if (!stream) {
      setStreamActive(false);
      setIsVideoPlaying(false);
      console.error('Все уровни подключения камеры завершились ошибкой:', lastError);

      if (lastError?.name === 'NotAllowedError' || lastError?.name === 'PermissionDeniedError') {
        setPermissionState('denied');
        setErrorMsg('Доступ к камере заблокирован в настройках сайта. Нажмите на значок 🔒 или настроек в адресной строке и выберите «Камера ➔ Разрешить».');
      } else if (lastError?.name === 'NotFoundError' || lastError?.name === 'DevicesNotFoundError') {
        setErrorMsg('Камера не найдена на этом устройстве.');
      } else if (lastError?.name === 'NotReadableError' || lastError?.name === 'AbortError') {
        setErrorMsg('Камера занята другим приложением или перезагружается. Нажмите «Включить камеру» снова.');
      } else {
        setErrorMsg(`Ошибка доступа к камере: ${lastError?.message || 'Неизвестная ошибка'}`);
      }
      return;
    }

    // При успешном получении нового потока аккуратно заменяем старый
    if (streamRef.current && streamRef.current !== stream) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }

    streamRef.current = stream;
    setPermissionState('granted');
    setErrorMsg(null);
    bindStreamToVideo(stream);
  }, [facingMode, bindStreamToVideo]);

  // Настройка WebRTC соединения для трансляции на ПК
  const setupPeerConnection = useCallback((stream, targetHostId) => {
    if (!stream || !targetHostId) return;

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
  }, [roomId, assignedSlot]);

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

  // Синхронизация WebRTC при появлении хоста ПК (НЕ перезапускает видеопоток камеры!)
  useEffect(() => {
    if (streamRef.current && hostId) {
      setupPeerConnection(streamRef.current, hostId);
    }
  }, [hostId, assignedSlot, setupPeerConnection]);

  // Запуск камеры при монтировании компонента и смене facingMode
  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
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
            if (streamRef.current && res.hostId) {
              setupPeerConnection(streamRef.current, res.hostId);
            }
          }
        }
      );
    }
  };

  // Прямое пользовательское касание экрана для гарантированного запуска воспроизведения
  const handleViewportTap = () => {
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current
        .play()
        .then(() => setIsVideoPlaying(true))
        .catch(console.warn);
    }
    if (!streamActive || !streamRef.current) {
      startCamera();
    }
  };

  const copyOriginToClipboard = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.origin).then(() => {
        setCopiedOrigin(true);
        setTimeout(() => setCopiedOrigin(false), 2500);
      });
    }
  };

  const copyFlagToClipboard = () => {
    navigator.clipboard.writeText('chrome://flags/#unsafely-treat-insecure-origin-as-secure').then(() => {
      setCopiedFlag(true);
      setTimeout(() => setCopiedFlag(false), 2500);
    });
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isStreamFullyLive = streamActive && isVideoPlaying;
  const isHttp =
    typeof window !== 'undefined' &&
    window.location.protocol === 'http:' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';

  const switchToHttps = () => {
    if (typeof window !== 'undefined') {
      window.location.href = window.location.href.replace(/^http:/, 'https:');
    }
  };

  return (
    <div className="phone-cam-page">
      {/* 0. БАННЕР ПЕРЕХОДА НА HTTPS (РЕШАЕТ ПРОБЛЕМУ БЛОКИРОВКИ КАМЕРЫ НА ТЕЛЕФОНАХ) */}
      {isHttp && (
        <div className="phone-cam-https-banner">
          <div className="https-banner-content">
            <span className="https-banner-icon">⚡</span>
            <div className="https-banner-text">
              <strong>Камера разрешена в настройках, но заблокирована из-за HTTP</strong>
              <p>
                Браузеры телефонов (Chrome/Safari) запускают камеру только по защищенному протоколу <code>https://</code>.
                Нажмите кнопку ниже для моментального перехода — камера включится сразу!
              </p>
            </div>
            <button type="button" className="btn btn-sm btn-gold btn-pulse" onClick={switchToHttps}>
              🔒 Перейти на HTTPS
            </button>
          </div>
          <div className="https-banner-hint">
            * При переходе нажмите «Дополнительно» ➔ «Перейти на сайт (небезопасно)», так как это локальный сертификат Додзё.
          </div>
        </div>
      )}

      {/* 1. БАННЕР-ИНСТРУКЦИЯ О РАЗРЕШЕНИИ НА КАМЕРУ */}
      {permissionGuideVisible && (
        <div className={`phone-cam-perm-banner ${isStreamFullyLive ? 'is-granted' : 'is-prompt'}`}>
          <div className="perm-banner-content">
            <div className="perm-banner-icon">
              {isStreamFullyLive ? '✅' : '📷'}
            </div>
            <div className="perm-banner-text">
              <strong>
                {isStreamFullyLive
                  ? 'Камера включена и транслируется в Додзё'
                  : 'Нажмите кнопку ниже для включения камеры смартфона'}
              </strong>
              <p>
                {isStreamFullyLive
                  ? `Поток активен (${fps} FPS) · Привязан как ${deviceLabel}. Закрепите телефон неподвижно.`
                  : 'Для захвата 3D-биомеханики требуется подтвердить доступ к камере в браузере.'}
              </p>
            </div>
            <div className="perm-banner-actions">
              {!isStreamFullyLive && (
                <button type="button" className="btn btn-sm btn-gold btn-pulse" onClick={handleViewportTap}>
                  🎥 Включить камеру
                </button>
              )}
              {isStreamFullyLive && (
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
              <span className="help-title">⚠️ Браузер заблокировал доступ к камере:</span>
              <ol>
                <li>В адресной строке браузера нажмите на значок замочка <strong>🔒</strong> или настроек сайта.</li>
                <li>Найдите пункт <strong>«Камера»</strong> и переключите в режим <strong>«Разрешить»</strong>.</li>
                <li>В iOS Safari: «Настройки» → «Safari» → «Камера» → «Разрешить».</li>
                <li>После изменения нажмите кнопку «Включить камеру» выше.</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* 2. СПЕЦИАЛЬНОЕ РУКОВОДСТВО ДЛЯ CHROME ПРИ ПОДКЛЮЧЕНИИ ПО ЛОКАЛЬНОМУ HTTP */}
      {isInsecureOrigin && !isStreamFullyLive && (
        <div className="phone-cam-insecure-guide">
          <div className="insecure-guide-head">
            <span className="insecure-icon">🔒</span>
            <div className="insecure-title-box">
              <strong>Браузер смартфона требует подтвердить локальный IP-адрес</strong>
              <p>Chrome и Safari блокируют камеру на незащищенных HTTP-сайтах без флага доверия.</p>
            </div>
          </div>

          <div className="insecure-steps">
            <div className="insecure-step">
              <span className="step-badge">1</span>
              <div className="step-body">
                <span>Скопируйте адрес флага для Chrome:</span>
                <button type="button" className="btn btn-xs btn-outline-gold" onClick={copyFlagToClipboard}>
                  {copiedFlag ? '✔ Скопировано' : '📋 Скопировать chrome://flags/...'}
                </button>
              </div>
            </div>

            <div className="insecure-step">
              <span className="step-badge">2</span>
              <div className="step-body">
                <span>Откройте новую вкладку в Chrome, вставьте флаг и введите в поле этот адрес:</span>
                <button type="button" className="btn btn-xs btn-outline-gold" onClick={copyOriginToClipboard}>
                  {copiedOrigin ? '✔ Скопировано' : `📋 Скопировать ${typeof window !== 'undefined' ? window.location.origin : ''}`}
                </button>
              </div>
            </div>

            <div className="insecure-step">
              <span className="step-badge">3</span>
              <div className="step-body">
                <span>Переключите в <strong>Enabled</strong> и нажмите синюю кнопку <strong>Relaunch</strong>.</span>
              </div>
            </div>
          </div>

          <div className="insecure-footer">
            <button type="button" className="btn btn-sm btn-gold" onClick={startCamera}>
              🔄 Проверить и включить камеру
            </button>
          </div>
        </div>
      )}

      {/* 3. ЗАГОЛОВОК МОБИЛЬНОГО ВИДОИСКАТЕЛЯ */}
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

      {/* 4. ПАНЕЛЬ ВЫБОРА РОЛИ ТЕЛЕФОНА (МУЛЬТИ-КАМЕРА ДО 3 ТЕЛЕФОНОВ) */}
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

      {/* 5. ЭКРАН ВИДЕОПОТОКА С КАМЕРЫ С ИНТЕРАКТИВНЫМ ОВЕРЛЕЕМ ЗАПУСКА */}
      <main className="phone-cam-viewport" onClick={handleViewportTap}>
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className="phone-cam-video"
          onTimeUpdate={() => { frameCountRef.current++; }}
        />

        {/* Интерактивный оверлей для запуска камеры касанием (обходит блокировку Autoplay мобильных браузеров) */}
        {!isStreamFullyLive && (
          <div className="phone-cam-tap-overlay">
            <button type="button" className="tap-play-btn" onClick={(e) => { e.stopPropagation(); handleViewportTap(); }}>
              🎥 Коснитесь для включения камеры
            </button>
            <span className="tap-play-hint">
              {permissionState === 'denied'
                ? '⚠️ Доступ отклонен браузером. Нажмите значок замочка 🔒 в строке адреса.'
                : 'Нажмите в любой точке экрана для передачи видео в 3D Додзё'}
            </span>
          </div>
        )}

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
            <span>{isStreamFullyLive ? `${fps} FPS` : 'Камера ожидает'}</span>
          </div>
        </div>
      </main>

      {/* 6. ПАНЕЛЬ УПРАВЛЕНИЯ НА ТЕЛЕФОНЕ */}
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
            onClick={handleViewportTap}
          >
            ⚡ {isStreamFullyLive ? 'Обновить камеру' : 'Включить камеру'}
          </button>
        </div>
      </footer>
    </div>
  );
}
