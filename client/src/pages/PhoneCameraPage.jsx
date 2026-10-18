import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import io from 'socket.io-client';
import './PhoneCameraPage.css';

function getSocketUrl() {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
}

const SOCKET_URL = getSocketUrl();

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
};

const PHONE_ROLES = [
  { slot: 1, label: 'Фронт (0°)', desc: 'Основной ракурс спереди' },
  { slot: 2, label: 'Бок (90°)', desc: 'Профиль / глубина стоек Z' },
  { slot: 3, label: 'Угол (45°)', desc: 'Диагональная триангуляция' },
];

// Короткий звуковой сигнал подтверждения через Web Audio API
function playBeep(freq = 880, duration = 0.12) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

export default function PhoneCameraPage() {
  const [params] = useSearchParams();
  const roomId = params.get('room') || 'MOCAP-DOJO';
  const initialSlot = Number(params.get('slot')) || 1;

  const [assignedSlot, setAssignedSlot] = useState(initialSlot);
  const [deviceLabel, setDeviceLabel] = useState(PHONE_ROLES[initialSlot - 1]?.label || 'Камера 1');
  const [facingMode, setFacingMode] = useState('environment'); // 'user' | 'environment'

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [fps, setFps] = useState(0);
  const [videoDim, setVideoDim] = useState({ w: 0, h: 0 });

  const [socketConnected, setSocketConnected] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [hostId, setHostId] = useState(null);
  const [roomCameras, setRoomCameras] = useState([]);

  // Запись сессии MoCap
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordFrames, setRecordFrames] = useState(0);
  const [showSavedToast, setShowSavedToast] = useState(false);

  // Статус туннеля и флагов Chrome
  const [tunnelUrl, setTunnelUrl] = useState(null);
  const [copiedFlag, setCopiedFlag] = useState(false);
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const frameCountRef = useRef(0);
  const isStartingRef = useRef(false);

  // Запрос статуса туннеля для 1-клик HTTPS подсказки
  useEffect(() => {
    fetch('/api/mocap/tunnel')
      .then((r) => r.json())
      .then((json) => {
        if (json?.data?.active && json?.data?.url) {
          setTunnelUrl(json.data.url);
        }
      })
      .catch(() => {});
  }, []);

  // 1. Привязка видеопотока к элементу <video>
  const bindStream = useCallback((stream) => {
    const v = videoRef.current;
    if (!v) return;

    v.srcObject = stream;
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute('playsinline', 'true');
    v.setAttribute('webkit-playsinline', 'true');
    v.setAttribute('autoplay', 'true');
    v.setAttribute('muted', 'true');

    const tryPlay = () => {
      const p = v.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          setIsCameraActive(true);
          setVideoDim({ w: v.videoWidth || 1280, h: v.videoHeight || 720 });
        }).catch(() => {
          setIsCameraActive(false);
        });
      }
    };

    v.onloadedmetadata = () => {
      setVideoDim({ w: v.videoWidth, h: v.videoHeight });
      tryPlay();
    };
    v.onplaying = () => setIsCameraActive(true);
    tryPlay();
  }, []);

  // 2. Запуск камеры смартфона с прогрессивными ограничениями
  const startCamera = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setCameraError(null);

    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const md = nav?.mediaDevices;

    if (!md || typeof md.getUserMedia !== 'function') {
      isStartingRef.current = false;
      setIsCameraActive(false);
      setCameraError('Браузер блокирует камеру на незащищенном HTTP-адресе.');
      return;
    }

    const tiers = [
      { video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
      { video: { facingMode: { ideal: facingMode } }, audio: false },
      { video: true, audio: false },
    ];

    let stream = null;
    let lastErr = null;

    for (const constraints of tiers) {
      try {
        stream = await md.getUserMedia(constraints);
        if (stream) break;
      } catch (err) {
        lastErr = err;
      }
    }

    isStartingRef.current = false;

    if (!stream) {
      setIsCameraActive(false);
      const msg = lastErr?.name === 'NotAllowedError'
        ? 'Доступ к камере отклонен. Разрешите доступ в браузере.'
        : `Не удалось включить камеру (${lastErr?.name || 'Сбой'}).`;
      setCameraError(msg);
      return;
    }

    if (streamRef.current && streamRef.current !== stream) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }

    streamRef.current = stream;
    bindStream(stream);

    // Если хост уже подключен, настраиваем WebRTC передачу
    if (hostId) {
      setupPeerConnection(stream, hostId);
    }
  }, [facingMode, bindStream, hostId]);

  // 3. WebRTC соединение для трансляции на ПК
  const setupPeerConnection = useCallback((stream, targetHostId) => {
    if (!stream || !targetHostId) return;

    if (peerRef.current) {
      try { peerRef.current.close(); } catch (e) {}
    }

    const peer = new RTCPeerConnection(ICE_SERVERS);
    peerRef.current = peer;

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
      } else if (['disconnected', 'failed', 'closed'].includes(peer.connectionState)) {
        setPeerConnected(false);
      }
    };

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
      .catch((err) => console.warn('WebRTC Offer Error:', err));
  }, [roomId, assignedSlot]);

  // 4. Подключение к Socket.IO
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
          preferredSlot: assignedSlot,
          label: PHONE_ROLES[assignedSlot - 1]?.label || `Камера ${assignedSlot}`,
        },
        (res) => {
          if (res?.ok) {
            setAssignedSlot(res.slot);
            setDeviceLabel(res.label);
            setHostId(res.hostId || null);
            if (res.cameras) setRoomCameras(res.cameras);
          }
        }
      );
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
      setPeerConnected(false);
    });

    socket.on('mocap:cameras-updated', ({ cameras }) => {
      if (Array.isArray(cameras)) setRoomCameras(cameras);
    });

    socket.on('mocap:host-joined', ({ hostId: newHostId }) => {
      setHostId(newHostId);
    });

    socket.on('mocap:host-left', () => {
      setHostId(null);
      setPeerConnected(false);
    });

    socket.on('mocap:recording-state', ({ isRecording: rec, duration, frameCount }) => {
      setIsRecording(Boolean(rec));
      if (duration !== undefined) setRecordSeconds(duration);
      if (frameCount !== undefined) setRecordFrames(frameCount);
      if (!rec && duration > 0) {
        setShowSavedToast(true);
        setTimeout(() => setShowSavedToast(false), 5000);
      }
    });

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
      } catch (e) {}
    });

    socket.on('mocap:answer', async ({ sdp }) => {
      try {
        if (peerRef.current) {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        }
      } catch (e) {}
    });

    socket.on('mocap:candidate', async ({ candidate }) => {
      try {
        if (peerRef.current && candidate) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (e) {}
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, assignedSlot]);

  // Запуск камеры при монтировании
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

  // Переключение селфи/основная камера
  const toggleFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Переключение слота ракурса
  const handleSelectSlot = (newSlot) => {
    if (newSlot === assignedSlot) return;
    setAssignedSlot(newSlot);
    setDeviceLabel(PHONE_ROLES[newSlot - 1]?.label || `Камера ${newSlot}`);
    if (socketRef.current && socketConnected) {
      socketRef.current.emit(
        'mocap:join-room',
        {
          roomId,
          role: 'camera',
          preferredSlot: newSlot,
          label: PHONE_ROLES[newSlot - 1]?.label || `Камера ${newSlot}`,
        },
        (res) => {
          if (res?.ok) {
            setAssignedSlot(res.slot);
            setDeviceLabel(res.label);
          }
        }
      );
    }
  };

  // Старт/стоп записи с телефона
  const handleToggleRecord = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([100]);
    }
    playBeep(isRecording ? 440 : 880, 0.15);

    if (socketRef.current && socketConnected) {
      socketRef.current.emit('mocap:toggle-record', { roomId });
    }
    setIsRecording((prev) => !prev);
  };

  // Полноэкранный режим
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const copyChromeFlag = () => {
    navigator.clipboard.writeText('chrome://flags/#unsafely-treat-insecure-origin-as-secure').then(() => {
      setCopiedFlag(true);
      setTimeout(() => setCopiedFlag(false), 2500);
    });
  };

  const copyOriginUrl = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.origin).then(() => {
        setCopiedOrigin(true);
        setTimeout(() => setCopiedOrigin(false), 2500);
      });
    }
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isHttp = typeof window !== 'undefined' && window.location.protocol === 'http:' && window.location.hostname !== 'localhost';

  return (
    <div className="phone-cam-root">
      {/* 1. ПОЛНОЭКРАННЫЙ ВИДОИСКАТЕЛЬ */}
      <div className={`phone-cam-viewport ${isRecording ? 'is-recording' : ''}`} onClick={startCamera}>
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className="phone-cam-video"
          onTimeUpdate={() => { frameCountRef.current++; }}
        />

        {/* HUD-элементы кадрирования */}
        <div className="phone-cam-hud">
          <div className="hud-corner tl" />
          <div className="hud-corner tr" />
          <div className="hud-corner bl" />
          <div className="hud-corner br" />

          <div className="hud-guide-silhouette">
            <span className="hud-guide-text">
              {assignedSlot === 1 && 'Встаньте лицом к камере в полный рост (Фронт)'}
              {assignedSlot === 2 && 'Встаньте боком для фиксации глубины удара (Бок)'}
              {assignedSlot === 3 && 'Диагональный угол 45° для 3D триангуляции'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. ВЕРХНЯЯ ПАНЕЛЬ СТАТУСА (GLASS BAR) */}
      <header className="phone-cam-topbar">
        <div className="topbar-main-row">
          <div className="topbar-brand">
            <span className="topbar-logo">🥋</span>
            <div className="topbar-title-box">
              <h1>MoCap Camera</h1>
              <span className="topbar-room-badge">{roomId} · #{assignedSlot}</span>
            </div>
          </div>

          <div className="topbar-status-group">
            <div className={`topbar-status-pill ${peerConnected ? 'online' : socketConnected ? 'standby' : 'offline'}`}>
              <span className="topbar-status-dot" />
              <span>
                {peerConnected
                  ? 'В эфире (ПК)'
                  : socketConnected
                  ? (hostId ? 'Связь с ПК...' : 'Ожидание 3D')
                  : 'Подключение...'}
              </span>
            </div>

            <button type="button" className="topbar-icon-btn" onClick={toggleFullscreen} title="На весь экран">
              {isFullscreen ? '⤦' : '⛶'}
            </button>
          </div>
        </div>

        {/* Переключатель ракурса слота (Фронт / Бок / Угол) */}
        <div className="topbar-slots-row">
          {PHONE_ROLES.map((r) => {
            const isTaken = roomCameras.some((c) => c.slot === r.slot && c.peerId !== socketRef.current?.id);
            return (
              <button
                key={r.slot}
                type="button"
                className={`slot-btn ${assignedSlot === r.slot ? 'active' : ''}`}
                onClick={() => handleSelectSlot(r.slot)}
                disabled={isTaken}
              >
                <span>#{r.slot}</span>
                <span>{r.label}</span>
                {assignedSlot === r.slot && <span>🟢</span>}
                {isTaken && <span>(занят)</span>}
              </button>
            );
          })}
        </div>
      </header>

      {/* 3. ИНДИКАТОР АКТИВНОЙ ЗАПИСИ АНИМАЦИИ */}
      {isRecording && (
        <div className="phone-cam-rec-pill">
          <span className="rec-pulse-circle" />
          <span>ЗАПИСЬ 3D: {formatTimer(recordSeconds)}</span>
          <span>({recordFrames} кадров)</span>
        </div>
      )}

      {/* Всплывающий тост при успешной записи */}
      {showSavedToast && (
        <div className="phone-cam-toast-success">
          🥋 3D-Анимация успешно записана и передана мастеру на ПК!
        </div>
      )}

      {/* Телеметрия (FPS и разрешение) */}
      {isCameraActive && (
        <div className="phone-cam-telemetry-pill">
          <span>{fps} FPS</span>
          <span>•</span>
          <span>{videoDim.w}×{videoDim.h}</span>
          <span>•</span>
          <strong>{facingMode === 'environment' ? 'Основная' : 'Селфи'}</strong>
        </div>
      )}

      {/* 4. ОВЕРЛЕЙ ЗАПУСКА КАМЕРЫ (ЕСЛИ ЕЩЕ НЕ ВКЛЮЧЕНА ИЛИ БРАУЗЕР БЛОКИРУЕТ) */}
      {!isCameraActive && (
        <div className="phone-cam-starter-overlay">
          <div className="starter-card">
            <span className="starter-icon">🎥</span>
            <h2>Включение камеры</h2>
            <p>
              {cameraError || 'Нажмите кнопку ниже, чтобы начать видеотрансляцию для захвата движений мастера.'}
            </p>

            <button type="button" className="starter-btn-main" onClick={startCamera}>
              ВКЛЮЧИТЬ КАМЕРУ
            </button>

            {/* Подсказка для Chrome Android при подключении по HTTP */}
            {isHttp && (
              <div className="starter-chrome-help">
                <div>
                  <strong>💡 Chrome блокирует камеру на локальном IP?</strong>
                </div>

                {tunnelUrl ? (
                  <div className="starter-help-actions">
                    <span>Доступен защищенный режим без настроек:</span>
                    <a
                      href={`${tunnelUrl}/phone-camera?room=${roomId}&slot=${assignedSlot}`}
                      className="starter-https-redirect"
                    >
                      🔒 Открыть через HTTPS (Без настроек)
                    </a>
                  </div>
                ) : (
                  <div className="starter-help-actions">
                    <span>Для работы по домашней сети Wi-Fi включите флаг Chrome:</span>
                    <button type="button" className="starter-copy-btn" onClick={copyChromeFlag}>
                      {copiedFlag ? '✔ Скопировано' : '1. Скопировать адрес флага'}
                    </button>
                    <button type="button" className="starter-copy-btn" onClick={copyOriginUrl}>
                      {copiedOrigin ? '✔ Скопировано' : '2. Скопировать адрес сайта'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. НИЖНЯЯ ПАНЕЛЬ ДЕЙСТВИЙ (RECORD BAR) */}
      <footer className="phone-cam-bottom-bar">
        {/* Переворот камеры */}
        <button type="button" className="ctrl-side-btn" onClick={toggleFacing} title="Сменить камеру">
          <span>🔄</span>
          <label>{facingMode === 'environment' ? 'Селфи' : 'Сзади'}</label>
        </button>

        {/* Центральная кнопка записи 3D MoCap */}
        <div className="ctrl-record-btn-wrap">
          <button
            type="button"
            className={`ctrl-record-btn ${isRecording ? 'recording' : ''}`}
            onClick={handleToggleRecord}
            title={isRecording ? 'Остановить запись' : 'Начать запись 3D MoCap'}
          >
            <div className="ctrl-record-inner" />
          </button>
          <span className="ctrl-record-label">
            {isRecording ? formatTimer(recordSeconds) : 'Запись 3D'}
          </span>
        </div>

        {/* Перезапуск/фокус камеры */}
        <button type="button" className="ctrl-side-btn" onClick={startCamera} title="Обновить камеру">
          <span>⚡</span>
          <label>Старт</label>
        </button>
      </footer>
    </div>
  );
}
