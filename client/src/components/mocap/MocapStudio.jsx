import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import io from 'socket.io-client';
import TraditionalDojo from '../../three/TraditionalDojo';
import MocapPuppetAvatar from '../../three/MocapPuppetAvatar';
import {
  loadMediaPipePose,
  analyzeKarateBiomechanics,
  mapPoseToAvatarBones,
  drawNeonKarateSkeleton,
} from '../../utils/mocapPoseTracker';
import './MocapStudio.css';

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

export default function MocapStudio() {
  // Режим источника: 'phone' (смартфон по WebRTC) | 'webcam' (камера ПК)
  const [sourceMode, setSourceMode] = useState('phone');
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  // Состояние WebRTC и подключения смартфона
  const [roomId] = useState(() => 'DOJO-' + Math.floor(1000 + Math.random() * 9000));
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Настройка сетевого IP для QR-кода телефона (авто-определение локальной сети)
  const defaultNetworkHost = typeof window !== 'undefined'
    ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? '192.168.100.6' : window.location.hostname)
    : 'localhost';
  const [networkHost, setNetworkHost] = useState(defaultNetworkHost);
  const [networkPort, setNetworkPort] = useState(() => (typeof window !== 'undefined' ? window.location.port || '5173' : '5173'));

  // Состояние захвата движений и биомеханики
  const [isPoseModelLoading, setIsPoseModelLoading] = useState(true);
  const [bodyDetected, setBodyDetected] = useState(false);
  const [karateMetrics, setKarateMetrics] = useState({
    stanceName: 'Ожидание стойки...',
    stanceJp: '構え · Kamae',
    detectedStance: 'ready',
    kneeAngleL: 180,
    kneeAngleR: 180,
    elbowAngleL: 180,
    elbowAngleR: 180,
    hikiteScore: 0,
    overallScore: 0,
    detectedAction: 'ready',
    actionTitle: 'Ожидание человека в кадре',
  });

  // Повороты костей для 3D-аватара (Puppet Rig)
  const [boneRotations, setBoneRotations] = useState(null);

  // Запись сессии MoCap
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedFrames, setRecordedFrames] = useState([]);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isPlayingRecorded, setIsPlayingRecorded] = useState(false);

  // Ссылки на элементы
  const videoRef = useRef(null);
  const phoneVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const localStreamRef = useRef(null);
  const phoneStreamRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const poseInstanceRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const recordTimerRef = useRef(null);

  // 1. Инициализация библиотеки MediaPipe Pose
  useEffect(() => {
    let active = true;
    setIsPoseModelLoading(true);
    loadMediaPipePose()
      .then((pose) => {
        if (!active) return;
        poseInstanceRef.current = pose;
        pose.onResults(onPoseResults);
        setIsPoseModelLoading(false);
      })
      .catch((err) => {
        console.error('Ошибка MediaPipe Pose:', err);
        if (active) {
          setIsPoseModelLoading(false);
          setCameraError('Не удалось инициализировать модель захвата движений');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // 2. Обработка результатов компьютерного зрения MediaPipe
  const onPoseResults = useCallback((results) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (results.poseLandmarks && results.poseLandmarks.length >= 33) {
      setBodyDetected(true);
      const metrics = analyzeKarateBiomechanics(results.poseLandmarks, results.poseWorldLandmarks);
      setKarateMetrics(metrics);

      // Отрисовываем неоновый скелет и бейджи углов
      drawNeonKarateSkeleton(ctx, results.poseLandmarks, w, h, metrics);

      // Вычисляем повороты костей и передаем в 3D аватар
      const mappedBones = mapPoseToAvatarBones(results.poseLandmarks, results.poseWorldLandmarks);
      if (mappedBones) {
        setBoneRotations(mappedBones.bones);
      }

      // Сохраняем кадр, если включена запись
      if (isRecording) {
        setRecordedFrames((prev) => [
          ...prev,
          {
            timestamp: Date.now(),
            landmarks: results.poseLandmarks,
            metrics,
            bones: mappedBones?.bones || null,
          },
        ]);
      }
    } else {
      setBodyDetected(false);
      setBoneRotations(null);
    }
  }, [isRecording]);

  // 3. Получение списка доступных веб-камер компьютера
  const updateDeviceList = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setAvailableDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (e) {
      console.warn('Не удалось получить список камер:', e);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    updateDeviceList();
  }, [updateDeviceList]);

  // 4. Запуск камеры компьютера
  const startWebcam = useCallback(async () => {
    try {
      setCameraError(null);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      const constraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setCameraActive(true);
        };
      }
    } catch (err) {
      console.error('Ошибка доступа к веб-камере:', err);
      setCameraActive(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Доступ к камере заблокирован. Разрешите использование камеры в настройках браузера.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('Камера не обнаружена. Подключите веб-камеру или используйте смартфон.');
      } else {
        setCameraError(`Не удалось запустить камеру: ${err.message || 'Ошибка устройства'}`);
      }
    }
  }, [selectedDeviceId]);

  // 5. Остановка локальной камеры
  const stopWebcam = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setBodyDetected(false);
    setBoneRotations(null);
  }, []);

  // 6. Подключение WebRTC сигналинга для смартфона
  useEffect(() => {
    if (sourceMode !== 'phone') return;

    const socket = io(`${SOCKET_URL}/mocap`, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('mocap:join-room', { roomId, role: 'host' });
    });

    // Когда смартфон зашел в комнату
    socket.on('mocap:peer-joined', () => {
      initiateHostWebRTC();
    });

    // Обработка входящего Offer от смартфона
    socket.on('mocap:offer', async ({ sdp, senderId }) => {
      try {
        const peer = getOrCreateHostPeer();
        await peer.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit('mocap:answer', { roomId, sdp: answer, targetId: senderId });
      } catch (err) {
        console.error('Ошибка обработки Offer со смартфона:', err);
      }
    });

    // Ответ Answer от смартфона
    socket.on('mocap:answer', async ({ sdp }) => {
      try {
        if (peerRef.current) {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        }
      } catch (err) {
        console.error('Ошибка установки Answer:', err);
      }
    });

    // ICE кандидаты
    socket.on('mocap:candidate', async ({ candidate }) => {
      try {
        if (peerRef.current && candidate) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('Ошибка добавления ICE кандидата:', err);
      }
    });

    // Обработка удаленной команды записи со смартфона
    socket.on('mocap:record-command', ({ action }) => {
      if (action === 'start') {
        setIsRecording(true);
      } else if (action === 'stop') {
        setIsRecording(false);
      } else if (action === 'toggle') {
        setIsRecording((prev) => !prev);
      }
    });

    socket.on('mocap:peer-left', () => {
      setPhoneConnected(false);
      setCameraActive(false);
      if (phoneStreamRef.current) {
        phoneStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    });

    function getOrCreateHostPeer() {
      if (peerRef.current && peerRef.current.connectionState !== 'closed') {
        return peerRef.current;
      }
      const peer = new RTCPeerConnection(ICE_SERVERS);
      peerRef.current = peer;

      peer.ontrack = (event) => {
        const stream = event.streams[0];
        phoneStreamRef.current = stream;
        if (phoneVideoRef.current) {
          phoneVideoRef.current.srcObject = stream;
          phoneVideoRef.current.onloadedmetadata = () => {
            phoneVideoRef.current.play();
            setCameraActive(true);
            setPhoneConnected(true);
          };
        }
      };

      peer.onicecandidate = (e) => {
        if (e.candidate && socketRef.current) {
          socketRef.current.emit('mocap:candidate', { roomId, candidate: e.candidate });
        }
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'connected') {
          setPhoneConnected(true);
          setCameraActive(true);
        } else if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') {
          setPhoneConnected(false);
        }
      };

      return peer;
    }

    function initiateHostWebRTC() {
      const peer = getOrCreateHostPeer();
      peer
        .createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: false })
        .then((offer) => peer.setLocalDescription(offer))
        .then(() => {
          socket.emit('mocap:offer', { roomId, sdp: peer.localDescription });
        })
        .catch((e) => console.error('Ошибка создания хост-оффера:', e));
    }

    return () => {
      socket.disconnect();
      if (peerRef.current) {
        peerRef.current.close();
      }
    };
  }, [sourceMode, roomId]);

  // Переключение режима источника
  useEffect(() => {
    if (sourceMode === 'webcam') {
      startWebcam();
    } else {
      stopWebcam();
    }
  }, [sourceMode, startWebcam, stopWebcam]);

  // 7. Основной цикл передачи кадров активного видеопотока в MediaPipe Pose
  useEffect(() => {
    if (!cameraActive) return;

    let isProcessing = false;

    const frameLoop = async () => {
      const video = sourceMode === 'phone' ? phoneVideoRef.current : videoRef.current;
      const pose = poseInstanceRef.current;

      if (video && video.readyState >= 2 && pose && !isProcessing) {
        try {
          isProcessing = true;
          await pose.send({ image: video });
        } catch (e) {
          // Кадр пропущен
        } finally {
          isProcessing = false;
        }
      }

      animFrameIdRef.current = requestAnimationFrame(frameLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(frameLoop);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [cameraActive, sourceMode]);

  // 8. Таймер записи MoCap
  useEffect(() => {
    if (isRecording) {
      setRecordSeconds(0);
      setRecordedFrames([]);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    }
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, [isRecording]);

  // Синхронизация состояния записи со смартфоном в реальном времени
  useEffect(() => {
    if (socketRef.current && sourceMode === 'phone') {
      socketRef.current.emit('mocap:recording-state', {
        roomId,
        isRecording,
        duration: recordSeconds,
        frameCount: recordedFrames.length,
      });
    }
  }, [roomId, isRecording, recordSeconds, recordedFrames.length, sourceMode]);

  // Экспорт анимации в JSON
  const exportMocapJson = () => {
    if (recordedFrames.length === 0) {
      alert('Нет записанных кадров для экспорта.');
      return;
    }
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(recordedFrames, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `bunkai_mocap_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const phoneConnectUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${networkHost}:${networkPort}/phone-camera?room=${roomId}`
    : `http://localhost:5173/phone-camera?room=${roomId}`;

  const copyPhoneUrl = () => {
    navigator.clipboard.writeText(phoneConnectUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  return (
    <div className="mocap-studio">
      {/* ВЕРХНЯЯ ПАНЕЛЬ СТОЛПА AIMOKAP */}
      <header className="mocap-header">
        <div className="mocap-title-group">
          <div className="mocap-kanji-stamp">捕</div>
          <div>
            <h2 className="mocap-title">AI MoCap Додзё (Aimokap)</h2>
            <p className="mocap-subtitle">
              Захват движений в реальном времени · Компьютерное зрение MediaPipe · 3D-Зеркало мастера
            </p>
          </div>
        </div>

        {/* Выбор источника видео */}
        <div className="mocap-source-switcher">
          <button
            type="button"
            className={`source-tab-btn ${sourceMode === 'webcam' ? 'active' : ''}`}
            onClick={() => setSourceMode('webcam')}
          >
            💻 Веб-камера ПК
          </button>
          <button
            type="button"
            className={`source-tab-btn ${sourceMode === 'phone' ? 'active' : ''}`}
            onClick={() => {
              setSourceMode('phone');
              setShowQrModal(true);
            }}
          >
            📱 Камера смартфона {phoneConnected && '🟢'}
          </button>
        </div>
      </header>

      {/* ПАНЕЛЬ ПРЕДУПРЕЖДЕНИЙ И СТАТУСОВ */}
      {cameraError && (
        <div className="mocap-alert mocap-alert--error">
          <span>⚠️ {cameraError}</span>
          {sourceMode === 'webcam' && (
            <button type="button" className="btn btn-sm btn-gold" onClick={startWebcam}>
              Повторить попытку
            </button>
          )}
        </div>
      )}

      {isPoseModelLoading && (
        <div className="mocap-alert mocap-alert--info">
          <span>⌛ Инициализация нейросети MediaPipe Pose... Пожалуйста, подождите.</span>
        </div>
      )}

      {/* РАБОЧАЯ ОБЛАСТЬ: 3D СЦЕНА + ОКНО КАМЕРЫ С НЕОНОВЫМ СКЕЛЕТОМ */}
      <div className="mocap-workspace">
        {/* ГЛАВНАЯ ОБЛАСТЬ: 3D ДОДЗЁ С КИНЕМАТИЧЕСКИМ АВАТАРОМ */}
        <div className="mocap-3d-stage">
          <Canvas
            shadows
            camera={{ position: [0, 1.3, 3.2], fov: 42 }}
            style={{ width: '100%', height: '100%', background: '#0a0807' }}
          >
            <ambientLight intensity={0.7} />
            <directionalLight
              position={[4, 7, 5]}
              intensity={1.2}
              castShadow
              shadow-mapSize={[1024, 1024]}
            />
            <pointLight position={[-3, 2, -2]} intensity={0.4} color="#e8c57b" />

            <Suspense fallback={null}>
              <TraditionalDojo />
              <MocapPuppetAvatar
                boneRotations={boneRotations}
                detectedStance={karateMetrics.detectedStance}
                position={[0, 0, 0]}
                rotation={[0, 0, 0]}
              />
              <ContactShadows opacity={0.7} scale={6} blur={1.5} far={4} color="#000000" />
            </Suspense>

            <OrbitControls
              makeDefault
              minDistance={1.2}
              maxDistance={7}
              maxPolarAngle={Math.PI / 2 - 0.05}
              target={[0, 0.9, 0]}
            />
          </Canvas>

          {/* HUD СЕНСЕЯ В 3D СЦЕНЕ */}
          <div className="mocap-hud-overlay">
            <div className="hud-badge-group">
              <div className="hud-badge stance">
                <span className="hud-badge__jp">{karateMetrics.stanceJp}</span>
                <strong className="hud-badge__val">{karateMetrics.stanceName}</strong>
              </div>

              <div className="hud-badge action">
                <span className="hud-badge__jp">技 · Техника</span>
                <strong className="hud-badge__val">{karateMetrics.actionTitle}</strong>
              </div>
            </div>

            <div className="hud-score-card">
              <span className="hud-score-label">SENSEI SCORE</span>
              <span className="hud-score-num">{bodyDetected ? `${karateMetrics.overallScore}%` : '—'}</span>
              <div className="hud-score-bar">
                <div
                  className="hud-score-fill"
                  style={{ width: `${bodyDetected ? karateMetrics.overallScore : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ПРАВАЯ/ВСПЛЫВАЮЩАЯ ПАНЕЛЬ ВИДЕОПОТОКА С КАМЕРЫ */}
        <aside className="mocap-cam-sidebar">
          <div className="viewfinder-card">
            <div className="viewfinder-header">
              <div className="viewfinder-title">
                <span className={`status-dot ${cameraActive ? (bodyDetected ? 'online' : 'standby') : 'offline'}`} />
                <span>
                  {sourceMode === 'webcam'
                    ? 'Веб-камера компьютера'
                    : phoneConnected
                    ? 'Трансляция со смартфона'
                    : 'Ожидание смартфона...'}
                </span>
              </div>

              {sourceMode === 'phone' && (
                <button
                  type="button"
                  className="btn btn-sm btn-gold"
                  onClick={() => setShowQrModal(true)}
                >
                  QR-код
                </button>
              )}
            </div>

            {/* Элементы видеопотока и наложения холста */}
            <div className="viewfinder-media">
              {/* Локальное видео */}
              <video
                ref={videoRef}
                playsInline
                muted
                className={`viewfinder-video ${sourceMode === 'webcam' ? 'active' : 'hidden'}`}
              />

              {/* Видео со смартфона */}
              <video
                ref={phoneVideoRef}
                playsInline
                autoPlay
                className={`viewfinder-video ${sourceMode === 'phone' ? 'active' : 'hidden'}`}
              />

              {/* Холст с неоновым скелетом каратэ */}
              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="viewfinder-canvas"
              />

              {!cameraActive && (
                <div className="viewfinder-placeholder">
                  {sourceMode === 'webcam' ? (
                    <div>
                      <span className="placeholder-icon">📹</span>
                      <p>Камера не запущена</p>
                      <button type="button" className="btn btn-primary" onClick={startWebcam}>
                        Включить камеру
                      </button>
                    </div>
                  ) : (
                    <div>
                      <span className="placeholder-icon">📱</span>
                      <p>Подключите смартфон для захвата</p>
                      <button type="button" className="btn btn-gold" onClick={() => setShowQrModal(true)}>
                        Открыть QR-код
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Селектор устройств для веб-камеры */}
            {sourceMode === 'webcam' && availableDevices.length > 1 && (
              <div className="device-select-wrap">
                <label>Выбор камеры:</label>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                >
                  {availableDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Камера #${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Телеметрия углов суставов в реальном времени */}
            <div className="mocap-angles-grid">
              <div className="angle-card">
                <span className="angle-card__label">Левое колено</span>
                <span className="angle-card__value">{bodyDetected ? `${karateMetrics.kneeAngleL}°` : '—'}</span>
              </div>
              <div className="angle-card">
                <span className="angle-card__label">Правое колено</span>
                <span className="angle-card__value">{bodyDetected ? `${karateMetrics.kneeAngleR}°` : '—'}</span>
              </div>
              <div className="angle-card">
                <span className="angle-card__label">Левый локоть</span>
                <span className="angle-card__value">{bodyDetected ? `${karateMetrics.elbowAngleL}°` : '—'}</span>
              </div>
              <div className="angle-card">
                <span className="angle-card__label">Правый локоть</span>
                <span className="angle-card__value">{bodyDetected ? `${karateMetrics.elbowAngleR}°` : '—'}</span>
              </div>
            </div>

            {/* Кнопки управления записью MoCap */}
            <div className="mocap-recorder-box">
              <div className="recorder-status">
                {isRecording ? (
                  <span className="rec-active">
                    <span className="rec-dot" /> Запись: {recordSeconds} сек ({recordedFrames.length} кадров)
                  </span>
                ) : (
                  <span className="rec-idle">
                    {recordedFrames.length > 0
                      ? `Записано: ${recordedFrames.length} кадров`
                      : 'Готов к записи движений'}
                  </span>
                )}
              </div>

              <div className="recorder-actions">
                {!isRecording ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => setIsRecording(true)}
                    disabled={!bodyDetected}
                  >
                    ⏺ Начать запись MoCap
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setIsRecording(false)}
                  >
                    ⏹ Завершить запись
                  </button>
                )}

                {recordedFrames.length > 0 && !isRecording && (
                  <button type="button" className="btn btn-gold" onClick={exportMocapJson}>
                    💾 Скачать JSON
                  </button>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* МОДАЛЬНОЕ ОКНО ПОДКЛЮЧЕНИЯ КАМЕРЫ ТЕЛЕФОНА */}
      {showQrModal && (
        <div className="qr-modal-backdrop" onClick={() => setShowQrModal(false)}>
          <div className="qr-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="qr-modal-head">
              <h3>📱 Подключение камеры смартфона</h3>
              <button
                type="button"
                className="qr-close-btn"
                onClick={() => setShowQrModal(false)}
              >
                ✕
              </button>
            </div>

            <p className="qr-modal-desc">
              Отсканируйте QR-код камерой телефона или перейдите по ссылке в мобильном браузере:
            </p>

            <div className="qr-image-wrap">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                  phoneConnectUrl
                )}`}
                alt="QR Code для подключения камеры телефона"
                className="qr-image"
              />
            </div>

            <div className="qr-room-box">
              <span>Код Додзё-комнаты:</span>
              <strong>{roomId}</strong>
            </div>

            <div className="qr-link-input-wrap">
              <input type="text" readOnly value={phoneConnectUrl} className="qr-link-input" />
              <button type="button" className="btn btn-gold" onClick={copyPhoneUrl}>
                {copiedLink ? 'Скопировано! ✔' : 'Копировать'}
              </button>
            </div>

            <div className="qr-ip-config">
              <label className="qr-ip-label">Локальный IP компьютера для доступа с телефона:</label>
              <div className="qr-ip-row">
                <input
                  type="text"
                  value={networkHost}
                  onChange={(e) => setNetworkHost(e.target.value.trim())}
                  placeholder="192.168.100.6"
                  className="qr-ip-input"
                />
                <button
                  type="button"
                  className="btn btn-sm btn-subtle"
                  onClick={() => setNetworkHost('192.168.100.6')}
                  title="Подставить Wi-Fi IP ПК"
                >
                  IP Wi-Fi
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-subtle"
                  onClick={() => setNetworkHost('192.168.100.28')}
                  title="Подставить Ethernet IP ПК"
                >
                  IP Ethernet
                </button>
              </div>
            </div>

            <p className="qr-tip">
              💡 Смартфон и компьютер должны находиться в одной локальной сети Wi-Fi или иметь доступ по сетевому IP-адресу.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
