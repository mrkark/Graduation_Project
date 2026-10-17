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
  ],
};

export default function PhoneCameraPage() {
  const [params] = useSearchParams();
  const initialRoom = params.get('room') || 'MOCAP-DOJO';
  const [roomId, setRoomId] = useState(initialRoom);

  const [facingMode, setFacingMode] = useState('environment'); // 'user' | 'environment'
  const [streamActive, setStreamActive] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
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

  // Подключение к Socket.IO пространству /mocap
  useEffect(() => {
    const socket = io(`${SOCKET_URL}/mocap`, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('mocap:join-room', { roomId, role: 'camera' }, (res) => {
        if (!res?.ok) setErrorMsg('Не удалось войти в комнату захвата');
      });
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
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

    // Получение Offer от ПК (хоста)
    socket.on('mocap:offer', async ({ sdp, senderId }) => {
      try {
        if (!peerRef.current) return;
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        socket.emit('mocap:answer', { roomId, sdp: answer, targetId: senderId });
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
  }, [roomId]);

  // Запуск камеры смартфона
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setStreamActive(true);

      // Инициализируем WebRTC соединение
      setupPeerConnection(stream);
    } catch (err) {
      console.error('Ошибка доступа к камере телефона:', err);
      setErrorMsg('Разрешите доступ к камере в браузере мобильного устройства.');
      setStreamActive(false);
    }
  }, [facingMode]);

  // Настройка WebRTC соединения
  const setupPeerConnection = (stream) => {
    if (peerRef.current) {
      peerRef.current.close();
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
    });
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="phone-cam-page">
      {/* Заголовок мобильного видоискателя */}
      <header className="phone-cam-header">
        <div className="phone-cam-brand">
          <span className="hanko">分解</span>
          <div>
            <h1>Мобильная Камера Додзё</h1>
            <span className="phone-cam-room-tag">Комната: <strong>{roomId}</strong></span>
          </div>
        </div>

        <div className="phone-cam-status-pill">
          <span className={`status-dot ${peerConnected ? 'online' : socketConnected ? 'standby' : 'offline'}`} />
          <span>
            {peerConnected
              ? 'Трансляция на ПК активна'
              : socketConnected
              ? 'Ожидание подключения ПК'
              : 'Подключение к серверу...'}
          </span>
        </div>
      </header>

      {errorMsg && (
        <div className="phone-cam-error">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Экран видеопотока с камеры */}
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
          <span className="reticle-guide-text">Встаньте в полный рост для каратэ-трекинга</span>
        </div>

        {/* Индикатор активной записи анимации для ПК */}
        {isRecording && (
          <div className="phone-cam-rec-banner blink">
            <span className="rec-dot" />
            <span>СЪЕМКА АНИМАЦИИ: {formatTimer(recordSeconds)}</span>
            <span className="rec-frames">({recordFrames} кадров)</span>
          </div>
        )}

        {/* Уведомление об успешной записи */}
        {lastSavedNotice && (
          <div className="phone-cam-rec-success">
            🥋 Анимация записана! Проверьте 3D-аватар на экране ноутбука.
          </div>
        )}

        {/* Оверлей телеметрии */}
        <div className="phone-cam-overlay">
          <div className="telemetry-pill">
            <span>Камера: {facingMode === 'environment' ? 'Основная' : 'Фронтальная'}</span>
            <span>{fps} FPS</span>
          </div>
        </div>
      </main>

      {/* Панель управления на телефоне */}
      <footer className="phone-cam-controls">
        <button
          type="button"
          className={`btn btn-phone-action btn-phone-record ${isRecording ? 'is-recording' : ''}`}
          onClick={handleToggleRecord}
        >
          {isRecording ? '⏹ Остановить запись и смотреть на ПК' : '⏺ Начать запись анимации'}
        </button>

        <div className="phone-cam-secondary-actions">
          <button type="button" className="btn btn-phone-action" onClick={toggleFacing}>
            🔄 {facingMode === 'environment' ? 'Селфи-камера' : 'Основная камера'}
          </button>

          <button
            type="button"
            className="btn btn-phone-action btn-gold"
            onClick={() => {
              if (streamRef.current) setupPeerConnection(streamRef.current);
            }}
          >
            ⚡ Переподключить
          </button>
        </div>
      </footer>
    </div>
  );
}
