import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import io from 'socket.io-client';
import {
  createFreshPoseInstance,
  loadMediaPipeHands,
  drawNeonKarateSkeleton,
  analyzeKarateBiomechanics,
  extractHandBiomechanics,
  estimateHeadOrientation,
} from '../utils/mocapPoseTracker';
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
  const [facingMode, setFacingMode] = useState('user'); // 'user' (селфи по умолчанию) | 'environment'
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [performanceMode, setPerformanceMode] = useState('balanced'); // 'ultra' | 'balanced' | 'eco'
  const [isCamSettingsOpen, setIsCamSettingsOpen] = useState(false);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [fps, setFps] = useState(0);
  const [videoDim, setVideoDim] = useState({ w: 0, h: 0 });

  const [socketConnected, setSocketConnected] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [hostId, setHostId] = useState(null);
  const [roomCameras, setRoomCameras] = useState([]);

  // Неоновый скелет на телефоне и слои отображения
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showBody, setShowBody] = useState(true);
  const [showHands, setShowHands] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(true);
  const [precisionHandMode, setPrecisionHandMode] = useState(false); // По умолчанию выключено для 30+ FPS и стабильности WebGL
  const [handsDetectedCount, setHandsDetectedCount] = useState(0);
  const [pingMs, setPingMs] = useState(0);
  const [limbWarnings, setLimbWarnings] = useState([]);
  const [bodyInFrame, setBodyInFrame] = useState(false);
  const [detectedStance, setDetectedStance] = useState('');
  const [aiModelStatus, setAiModelStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [aiModelError, setAiModelError] = useState(null);

  // Запись сессии MoCap
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordFrames, setRecordFrames] = useState(0);
  const [showSavedToast, setShowSavedToast] = useState(false);

  // Локальный таймер отсчета записи на телефоне
  useEffect(() => {
    let timer = null;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } else {
      setRecordSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording]);

  const assignedSlotRef = useRef(assignedSlot);
  useEffect(() => { assignedSlotRef.current = assignedSlot; }, [assignedSlot]);
  const socketConnectedRef = useRef(socketConnected);
  useEffect(() => { socketConnectedRef.current = socketConnected; }, [socketConnected]);
  const hostIdRef = useRef(hostId);
  useEffect(() => { hostIdRef.current = hostId; }, [hostId]);
  const roomIdRef = useRef(roomId);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
  const showSkeletonRef = useRef(showSkeleton);
  useEffect(() => { showSkeletonRef.current = showSkeleton; }, [showSkeleton]);
  const showBodyRef = useRef(showBody);
  useEffect(() => { showBodyRef.current = showBody; }, [showBody]);
  const showHandsRef = useRef(showHands);
  useEffect(() => { showHandsRef.current = showHands; }, [showHands]);
  const showDiagnosticsRef = useRef(showDiagnostics);
  useEffect(() => { showDiagnosticsRef.current = showDiagnostics; }, [showDiagnostics]);
  const precisionHandModeRef = useRef(precisionHandMode);
  useEffect(() => { precisionHandModeRef.current = precisionHandMode; }, [precisionHandMode]);
  const performanceModeRef = useRef(performanceMode);
  useEffect(() => { performanceModeRef.current = performanceMode; }, [performanceMode]);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const poseRef = useRef(null);
  const handsRef = useRef(null);
  const detectedHandsRef = useRef([]);
  const isHandsProcessingRef = useRef(false);
  const loopFrameCountRef = useRef(0);
  const animFrameRef = useRef(null);
  const frameCountRef = useRef(0);
  const isStartingRef = useRef(false);
  const offscreenCanvasRef = useRef(null);
  const letterboxParamsRef = useRef(null);
  const localRecTimerRef = useRef(null);
  const recStartTimeRef = useRef(0);

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
          const vw = v.videoWidth || 1280;
          const vh = v.videoHeight || 720;
          setVideoDim({ w: vw, h: vh });
          if (canvasRef.current) {
            canvasRef.current.width = vw;
            canvasRef.current.height = vh;
          }
        }).catch(() => {
          setIsCameraActive(false);
        });
      }
    };

    v.onloadedmetadata = () => {
      const vw = v.videoWidth;
      const vh = v.videoHeight;
      setVideoDim({ w: vw, h: vh });
      if (canvasRef.current) {
        canvasRef.current.width = vw;
        canvasRef.current.height = vh;
      }
      tryPlay();
    };
    v.onplaying = () => setIsCameraActive(true);
    tryPlay();
  }, []);

  // 2. WebRTC соединение для трансляции видео на ПК
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
          slot: assignedSlotRef.current,
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
            slot: assignedSlotRef.current,
          });
        }
      })
      .catch((err) => console.warn('WebRTC Offer Error:', err));
  }, [roomId]);

  // Диагностика ошибок веб-камеры
  const getDiagnosticErrorMsg = (err) => {
    if (!err) return 'Не удалось включить камеру.';
    switch (err.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return '🚫 Доступ к камере отклонен. Разрешите доступ в настройках браузера (значок замка в адресной строке).';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return '📷 Камера не найдена на этом устройстве.';
      case 'NotReadableError':
      case 'TrackStartError':
        return '⚠️ Камера занята другим приложением или вкладкой. Закройте другие программы камеры.';
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return '🔄 Запрошенное разрешение или камера не поддерживается. Переключаемся на базовый режим...';
      case 'SecurityError':
        return '🔒 Доступ к камере блокирован политикой безопасности. Требуется защищенный шлюз HTTPS.';
      default:
        return `⚠️ Ошибка камеры: ${err.message || err.name || 'Сбой инициализации'}`;
    }
  };

  // Опрос доступных видеокамер на устройстве
  const refreshCameraDevices = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const vDevs = devices.filter((d) => d.kind === 'videoinput');
        setVideoDevices(vDevs);
      } catch (e) {
        console.warn('Не удалось получить список камер:', e);
      }
    }
  }, []);

  // Остановка захвата камеры
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  // 3. Запуск камеры смартфона с выбором устройства и уровнями fallback
  const startCamera = useCallback(async (targetDeviceId = null, targetFacing = null) => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setCameraError(null);

    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const md = nav?.mediaDevices;

    if (!md || typeof md.getUserMedia !== 'function') {
      isStartingRef.current = false;
      setIsCameraActive(false);
      setCameraError('Браузер блокирует доступ к камере.');
      return;
    }

    const useDeviceId = targetDeviceId !== null ? targetDeviceId : selectedDeviceId;
    const useFacing = targetFacing !== null ? targetFacing : facingMode;

    let tiers = [];
    if (useDeviceId) {
      tiers = [
        { video: { deviceId: { exact: useDeviceId }, width: { ideal: 1280 } }, audio: false },
        { video: { deviceId: { exact: useDeviceId } }, audio: false },
        { video: true, audio: false },
      ];
    } else {
      tiers = [
        { video: { facingMode: useFacing ? { ideal: useFacing } : 'user', width: { ideal: 1280 } }, audio: false },
        { video: { facingMode: useFacing ? { ideal: useFacing } : 'user' }, audio: false },
        { video: true, audio: false },
      ];
    }

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
      setCameraError(getDiagnosticErrorMsg(lastErr));
      return;
    }

    if (streamRef.current && streamRef.current !== stream) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }

    streamRef.current = stream;
    bindStream(stream);
    refreshCameraDevices();

    if (hostIdRef.current) {
      setupPeerConnection(stream, hostIdRef.current);
    }
  }, [facingMode, selectedDeviceId, bindStream, refreshCameraDevices, setupPeerConnection]);

  // 4. Подключение к Socket.IO шлюзу (/mocap)
  useEffect(() => {
    const socket = io(`${SOCKET_URL}/mocap`, {
      path: '/socket.io/',
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
          preferredSlot: assignedSlotRef.current,
          label: PHONE_ROLES[(assignedSlotRef.current || 1) - 1]?.label || `Камера ${assignedSlotRef.current || 1}`,
        },
        (res) => {
          if (res?.ok) {
            setAssignedSlot(res.slot);
            setDeviceLabel(res.label);
            if (res.hostId) {
              setHostId(res.hostId);
              if (streamRef.current) {
                setupPeerConnection(streamRef.current, res.hostId);
              }
            }
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
      if (streamRef.current) {
        setupPeerConnection(streamRef.current, newHostId);
      }
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
          slot: assignedSlotRef.current,
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
  }, [roomId]);

  // 5. Замер пинга сети (RTT) каждые 2.5 секунды
  useEffect(() => {
    if (!socketConnected) return;
    const interval = setInterval(() => {
      if (socketRef.current) {
        const t0 = Date.now();
        socketRef.current.emit('mocap:ping', { timestamp: t0 }, (res) => {
          if (res?.clientTimestamp) {
            setPingMs(Date.now() - res.clientTimestamp);
          }
        });
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [socketConnected]);

  // 6. Инициализация и цикл трекинга MediaPipe Pose и MediaPipe Hands на смартфоне
  useEffect(() => {
    let active = true;
    let isPoseProcessing = false;
    let isHandsProcessing = false;
    // Счётчик для диагностики: сколько раз onResults вернул 0 ключевых точек подряд
    let zeroLandmarksCount = 0;

    setAiModelStatus('loading');

    // Используем легковесный мобильный профиль (modelComplexity: 0) — исключает WebGL сбои на смартфонах
    createFreshPoseInstance({ modelComplexity: 0, minDetectionConfidence: 0.25, minTrackingConfidence: 0.25 })
      .then((pose) => {
        if (!active) return;
        poseRef.current = pose;
        setAiModelStatus('ready');

        pose.onResults((results) => {
          if (!active) return;
          try {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            if (!canvas || !video) return;

            const vw = video.videoWidth || 1280;
            const vh = video.videoHeight || 720;
            if (canvas.width !== vw || canvas.height !== vh) {
              canvas.width = vw;
              canvas.height = vh;
            }

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const lb = letterboxParamsRef.current;
            const rawLms = results?.poseLandmarks;
            const lmsCount = rawLms?.length || 0;

            // Диагностическое логирование (каждые 30 кадров)
            if (loopFrameCountRef.current % 30 === 0) {
              console.log(`[MoCap Phone] onResults: lms=${lmsCount}, video=${vw}x${vh}, rs=${video.readyState}`);
            }

            if (lmsCount >= 33) {
              zeroLandmarksCount = 0;
              setBodyInFrame(true);

              // Де-нормализация из 1:1 letterbox квадрата обратно в оригинальные пропорции видео
              const unmappedLandmarks = lb ? rawLms.map((p) => ({
                x: ((p.x * lb.targetDim) - lb.padX) / lb.drawW,
                y: ((p.y * lb.targetDim) - lb.padY) / lb.drawH,
                z: p.z * (lb.targetDim / lb.drawW),
                visibility: p.visibility ?? 1.0,
              })) : rawLms;

              const worldLms = results.poseWorldLandmarks || unmappedLandmarks;

              // Биомеханический анализ стойки каратэ
              const metrics = analyzeKarateBiomechanics(unmappedLandmarks, worldLms);
              if (metrics.stanceName) setDetectedStance(metrics.stanceName);

              // Диагностика видимости конечностей
              const warnings = [];
              const lAnkle = unmappedLandmarks[27];
              const rAnkle = unmappedLandmarks[28];
              if ((lAnkle?.visibility ?? 1) < 0.25 && (rAnkle?.visibility ?? 1) < 0.25) {
                warnings.push('⚠ Стопы не полностью в кадре (отойдите назад)');
              }
              const lWrist = unmappedLandmarks[15];
              const rWrist = unmappedLandmarks[16];
              if ((lWrist?.visibility ?? 1) < 0.25 && (rWrist?.visibility ?? 1) < 0.25) {
                warnings.push('⚠ Кисти рук вне поля зрения камеры');
              }
              setLimbWarnings(warnings);

              // Высокоточная биомеханика пальцев (MediaPipe Hands + Pose fallback)
              const aspect = vw / Math.max(1, vh);
              const handsData = detectedHandsRef.current?.length > 0 ? {
                multiHandLandmarks: detectedHandsRef.current.map((h) => h.landmarks),
                multiHandedness: detectedHandsRef.current.map((h) => ({ classification: [{ label: h.handedness }] })),
              } : null;

              const fingers = extractHandBiomechanics(
                unmappedLandmarks,
                worldLms,
                handsData,
                aspect
              );
              const head = estimateHeadOrientation(unmappedLandmarks, worldLms);

              // Отрисовываем неоновый скелет прямо на человеке на экране смартфона!
              if (showSkeletonRef.current) {
                drawNeonKarateSkeleton(ctx, unmappedLandmarks, canvas.width, canvas.height, metrics, {
                  showBody: showBodyRef.current,
                  showHands: showHandsRef.current,
                  showDiagnostics: showDiagnosticsRef.current,
                  hands: detectedHandsRef.current,
                });
              }

              // Отправляем структурированный типизированный поток данных на сайт / ПК Додзё
              if (socketRef.current && socketConnectedRef.current) {
                const streamPacket = {
                  version: 2,
                  format: 'bunkai-stream-packet',
                  roomId: roomIdRef.current,
                  slot: assignedSlotRef.current,
                  deviceId: selectedDeviceId || facingMode,
                  timestamp: Date.now(),
                  trackingLost: false,
                  facingMode,
                  isMirrored: facingMode === 'user',
                  landmarks: unmappedLandmarks,
                  worldLandmarks: worldLms,
                  hands: detectedHandsRef.current,
                  confidence: {
                    overall: metrics.overallScore || 85,
                    head: parseFloat((unmappedLandmarks[0]?.visibility ?? 1.0).toFixed(2)),
                    torso: parseFloat((((unmappedLandmarks[11]?.visibility ?? 1) + (unmappedLandmarks[12]?.visibility ?? 1)) * 0.5).toFixed(2)),
                    leftArm: parseFloat((((unmappedLandmarks[13]?.visibility ?? 1) + (unmappedLandmarks[15]?.visibility ?? 1)) * 0.5).toFixed(2)),
                    rightArm: parseFloat((((unmappedLandmarks[14]?.visibility ?? 1) + (unmappedLandmarks[16]?.visibility ?? 1)) * 0.5).toFixed(2)),
                    leftLeg: parseFloat((((unmappedLandmarks[25]?.visibility ?? 1) + (unmappedLandmarks[27]?.visibility ?? 1)) * 0.5).toFixed(2)),
                    rightLeg: parseFloat((((unmappedLandmarks[26]?.visibility ?? 1) + (unmappedLandmarks[28]?.visibility ?? 1)) * 0.5).toFixed(2)),
                  },
                  metrics,
                  fingers,
                  head,
                  performanceMode: performanceModeRef.current,
                };
                socketRef.current.emit('mocap:landmarks-stream', streamPacket);
                socketRef.current.emit('mocap:landmarks-data', streamPacket);
              }
            } else {
              zeroLandmarksCount++;
              // Логируем каждые 60 кадров пустых результатов
              if (zeroLandmarksCount % 60 === 1) {
                console.warn(`[MoCap Phone] MediaPipe вернул 0 точек ${zeroLandmarksCount} раз. ` +
                  `Видео: ${vw}x${vh} readyState=${video.readyState}. ` +
                  `Убедитесь что вы в кадре, освещение достаточное, лицом к фронтальной камере.`);
              }
              setBodyInFrame(false);
              setLimbWarnings([]);
              // Отправляем trackingLost только если потеря трекинга продолжается более 12 кадров (400мс)
              if (zeroLandmarksCount > 12 && socketRef.current && socketConnectedRef.current) {
                const lostPacket = {
                  version: 2,
                  format: 'bunkai-stream-packet',
                  roomId: roomIdRef.current,
                  slot: assignedSlotRef.current,
                  deviceId: selectedDeviceId || facingMode,
                  timestamp: Date.now(),
                  trackingLost: true,
                  landmarks: null,
                  worldLandmarks: null,
                  confidence: { overall: 0 },
                  performanceMode: performanceModeRef.current,
                };
                socketRef.current.emit('mocap:landmarks-stream', lostPacket);
                socketRef.current.emit('mocap:landmarks-data', lostPacket);
              }
            }
          } catch (err) {
            console.error('Ошибка в pose.onResults:', err);
          }
        });
      })
      .catch((err) => {
        console.warn('Не удалось загрузить MediaPipe Pose на смартфоне:', err);
        if (active) {
          setAiModelStatus('error');
          setAiModelError(err.message || 'Ошибка сети при загрузке модели');
        }
      });

    // Инициализация MediaPipe Hands для точного захвата пальцев
    if (precisionHandModeRef.current) {
      loadMediaPipeHands({ modelComplexity: 0 })
        .then((hands) => {
          if (!active) return;
          handsRef.current = hands;
          hands.onResults((hRes) => {
            if (!active) return;
            if (hRes.multiHandLandmarks && hRes.multiHandLandmarks.length > 0) {
              const list = [];
              hRes.multiHandLandmarks.forEach((lms, idx) => {
                const classification = hRes.multiHandedness?.[idx]?.classification?.[0];
                list.push({
                  landmarks: lms,
                  handedness: classification?.label || (idx === 0 ? 'Right' : 'Left'),
                  score: classification?.score || 0.9,
                });
              });
              detectedHandsRef.current = list;
              setHandsDetectedCount(list.length);
            } else {
              detectedHandsRef.current = [];
              setHandsDetectedCount(0);
            }
          });
        })
        .catch((err) => {
          console.warn('MediaPipe Hands не загружен (будет использован Pose fallback):', err);
        });
    }

    /**
     * Ожидает, пока видео-элемент не будет готов (HAVE_ENOUGH_DATA = readyState 4).
     * Мобильные браузеры медленно инициализируют камеру.
     * Возвращает true когда видео готово, false если active сброшен.
     */
    function waitForVideoReady(videoEl, timeoutMs = 15000) {
      return new Promise((res) => {
        const start = Date.now();
        function check() {
          if (!active) { res(false); return; }
          // readyState >= 2 (HAVE_CURRENT_DATA) с ненулевыми размерами считается достаточным
          if (videoEl.readyState >= 2 && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
            res(true);
            return;
          }
          if (Date.now() - start > timeoutMs) {
            console.warn('[MoCap Phone] Таймаут ожидания видеопотока камеры');
            res(false);
            return;
          }
          setTimeout(check, 100);
        }
        check();
      });
    }

    const loop = async () => {
      if (!active) return;
      const v = videoRef.current;

      if (v && poseRef.current) {
        // Проверяем готовность видео — ждем реальные данные пикселей
        if (v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0 && !v.paused && !v.ended) {
          loopFrameCountRef.current++;
          const frameIdx = loopFrameCountRef.current;

          const perf = performanceModeRef.current;
          const skipPose = perf === 'eco' && frameIdx % 2 !== 0;
          const skipHands = perf === 'eco'
            ? (frameIdx % 4 !== 0)
            : (perf === 'balanced' ? (frameIdx % 2 !== 0) : false);

          // Поток тела: используем 1:1 letterbox оффскрин-холст для максимальной точности анкеров нейросети
          if (!skipPose && !isPoseProcessing) {
            try {
              isPoseProcessing = true;

              if (!offscreenCanvasRef.current) {
                offscreenCanvasRef.current = document.createElement('canvas');
              }
              const offCanvas = offscreenCanvasRef.current;
              const targetDim = 512;
              if (offCanvas.width !== targetDim || offCanvas.height !== targetDim) {
                offCanvas.width = targetDim;
                offCanvas.height = targetDim;
              }
              const offCtx = offCanvas.getContext('2d', { willReadFrequently: false });

              const vw = v.videoWidth;
              const vh = v.videoHeight;
              const maxDim = Math.max(vw, vh);
              const scale = targetDim / maxDim;
              const drawW = vw * scale;
              const drawH = vh * scale;
              const padX = (targetDim - drawW) / 2;
              const padY = (targetDim - drawH) / 2;

              letterboxParamsRef.current = { targetDim, padX, padY, drawW, drawH, vw, vh };

              offCtx.fillStyle = '#000000';
              offCtx.fillRect(0, 0, targetDim, targetDim);
              offCtx.drawImage(v, padX, padY, drawW, drawH);

              await poseRef.current.send({ image: offCanvas });
            } catch (e) {
              console.warn('MediaPipe Pose frame send error:', e);
            } finally {
              isPoseProcessing = false;
            }
          }

          // Поток кистей
          if (!skipHands && precisionHandModeRef.current && handsRef.current && !isHandsProcessing) {
            try {
              isHandsProcessing = true;
              const sendImg = offscreenCanvasRef.current || v;
              await handsRef.current.send({ image: sendImg });
            } catch (e) {
              console.warn('MediaPipe Hands frame send error:', e);
            } finally {
              isHandsProcessing = false;
            }
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    // Небольшая задержка для гарантии инициализации видео перед стартом цикла
    const startDelay = setTimeout(() => {
      if (active) {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    }, 500);

    return () => {
      active = false;
      clearTimeout(startDelay);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Запуск камеры при монтировании или смене объектива
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (peerRef.current) {
        try { peerRef.current.close(); } catch (e) {}
        peerRef.current = null;
      }
    };
  }, [facingMode, selectedDeviceId]);

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

  const handleToggleRecord = () => {
    if ('vibrate' in navigator) navigator.vibrate([100]);
    playBeep(isRecording ? 440 : 880, 0.15);

    const willRecord = !isRecording;
    if (willRecord) {
      recStartTimeRef.current = performance.now();
      setRecordSeconds(0);
      if (localRecTimerRef.current) clearInterval(localRecTimerRef.current);
      localRecTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((performance.now() - recStartTimeRef.current) / 1000);
        setRecordSeconds(elapsed);
      }, 500);
    } else {
      if (localRecTimerRef.current) {
        clearInterval(localRecTimerRef.current);
        localRecTimerRef.current = null;
      }
    }

    if (socketRef.current && socketConnected) {
      socketRef.current.emit('mocap:record-command', {
        roomId,
        action: willRecord ? 'start' : 'stop',
      });
    }
    setIsRecording(willRecord);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="phone-cam-root">
      {/* 1. ПОЛНОЭКРАННЫЙ ВИДОИСКАТЕЛЬ И НЕОНОВЫЙ СКЕЛЕТ НА ЧЕЛОВЕКЕ */}
      <div
        className={`phone-cam-viewport ${isRecording ? 'is-recording' : ''} ${facingMode === 'user' ? 'is-mirrored' : ''}`}
        onClick={!isCameraActive ? () => startCamera() : undefined}
      >
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className="phone-cam-video"
          onTimeUpdate={() => { frameCountRef.current++; }}
        />

        {/* Холст с наложением неонового скелета прямо на тело человека */}
        <canvas
          ref={canvasRef}
          className="phone-cam-canvas"
        />

        {/* HUD-элементы кадрирования */}
        <div className="phone-cam-hud">
          <div className="hud-corner tl" />
          <div className="hud-corner tr" />
          <div className="hud-corner bl" />
          <div className="hud-corner br" />

          {!bodyInFrame && (
            <div className="hud-guide-silhouette">
              <span className="hud-guide-text">
                {assignedSlot === 1 && 'Встаньте лицом к камере в полный рост (Фронт)'}
                {assignedSlot === 2 && 'Встаньте боком для фиксации глубины удара (Бок)'}
                {assignedSlot === 3 && 'Диагональный угол 45° для 3D триангуляции'}
              </span>
              {facingMode === 'environment' && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#fbbf24' }}>
                  📷 Основная (задняя) камера. Если смотрите на экран — переключите на Селфи (кнопка 🔄 внизу).
                </div>
              )}
            </div>
          )}

          {/* Легенда: Реально обнаруженные vs Предсказанные точки */}
          {bodyInFrame && (
            <div className="hud-legend-pill">
              <span className="legend-item"><span className="legend-dot solid" /> Обнаружено</span>
              <span className="legend-item"><span className="legend-dot dashed" /> Предсказано</span>
            </div>
          )}
        </div>

        {/* Бейдж распознанной стойки каратэ в реальном времени */}
        {bodyInFrame && (
          <div className="hud-live-stance-pill">
            <span className="live-stance-dot" />
            <span>🥋 {detectedStance}</span>
          </div>
        )}

        {/* Предупреждения о перекрытиях / выходе конечностей за рамки кадра */}
        {showDiagnostics && limbWarnings.length > 0 && (
          <div className="hud-warnings-box">
            {limbWarnings.map((w, idx) => (
              <div key={idx} className="hud-warning-pill">
                {w}
              </div>
            ))}
          </div>
        )}
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
            {/* Кнопка включения/выключения неонового скелета на экране */}
            <button
              type="button"
              className={`topbar-skeleton-btn ${showSkeleton ? 'on' : 'off'}`}
              onClick={() => setShowSkeleton((s) => !s)}
              title="Переключить отображение неонового скелета"
            >
              🦴 {showSkeleton ? 'Скелет: ВКЛ' : 'Скелет: ВЫКЛ'}
            </button>

            <div
              className={`topbar-status-pill ${aiModelStatus === 'ready' ? 'online' : aiModelStatus === 'loading' ? 'standby' : 'offline'}`}
              title={aiModelError ? `Ошибка нейросети: ${aiModelError}` : 'Статус нейросети MediaPipe Pose'}
            >
              <span className="topbar-status-dot" />
              <span>
                {aiModelStatus === 'ready'
                  ? '🧠 AI: Готов'
                  : aiModelStatus === 'loading'
                  ? '⏳ AI: Загрузка...'
                  : '❌ AI: Ошибка'}
              </span>
            </div>

            <div
              className={`topbar-status-pill ${bodyInFrame ? 'online' : 'standby'}`}
              title="Статус обнаружения человека в кадре камеры"
            >
              <span className="topbar-status-dot" />
              <span>{bodyInFrame ? '🟢 Тело в кадре' : '🟡 Поиск тела'}</span>
            </div>

            <div className={`topbar-status-pill ${peerConnected ? 'online' : socketConnected ? 'standby' : 'offline'}`}>
              <span className="topbar-status-dot" />
              <span>
                {peerConnected
                  ? 'В эфире (ПК)'
                  : socketConnected
                  ? (hostId ? '🟢 Связь с Додзё' : '🟡 Поиск 3D Додзё')
                  : 'Подключение...'}
              </span>
            </div>

            {/* Настройки камеры и профили производительности */}
            <button
              type="button"
              className="topbar-icon-btn"
              onClick={() => { refreshCameraDevices(); setIsCamSettingsOpen(true); }}
              title="Настройки камеры и производительности"
            >
              ⚙️
            </button>

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

        {/* Панель слоев и режимов захвата (Тело, Пальцы, Инфо, Точные кисти, Пинг) */}
        <div className="topbar-layers-row">
          <button
            type="button"
            className={`layer-pill ${showBody ? 'active' : ''}`}
            onClick={() => setShowBody((v) => !v)}
            title="Отображение скелета тела"
          >
            🦴 Тело
          </button>
          <button
            type="button"
            className={`layer-pill ${showHands ? 'active' : ''}`}
            onClick={() => setShowHands((v) => !v)}
            title="Отображение кистей и пальцев"
          >
            🖐 Кисти {handsDetectedCount > 0 ? `(${handsDetectedCount})` : ''}
          </button>
          <button
            type="button"
            className={`layer-pill ${precisionHandMode ? 'active glow-gold' : ''}`}
            onClick={() => setPrecisionHandMode((v) => !v)}
            title="Высокоточное отслеживание всех 21 суставов пальцев нейросетью MediaPipe Hands"
          >
            ⚡ Точные кисти: {precisionHandMode ? 'ВКЛ' : 'ВЫКЛ'}
          </button>
          <button
            type="button"
            className={`layer-pill ${showDiagnostics ? 'active' : ''}`}
            onClick={() => setShowDiagnostics((v) => !v)}
            title="Отображение углов суставов и статуса"
          >
            📊 Инфо
          </button>
          <div className={`ping-pill ${pingMs > 0 && pingMs < 50 ? 'fast' : pingMs < 120 ? 'medium' : 'slow'}`} title="Задержка передачи данных на ПК Додзё">
            📶 {pingMs > 0 ? `${pingMs}ms` : '< 25ms'}
          </div>
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

      {/* 4. ОВЕРЛЕЙ ЗАПУСКА КАМЕРЫ */}
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
          </div>
        </div>
      )}

      {/* 5. НИЖНЯЯ ПАНЕЛЬ ДЕЙСТВИЙ */}
      <footer className="phone-cam-bottom-bar">
        <button type="button" className="ctrl-side-btn" onClick={toggleFacing} title="Сменить камеру (Селфи / Сзади)">
          <span>🔄</span>
          <label>{facingMode === 'environment' ? 'Селфи' : 'Сзади'}</label>
        </button>

        <button
          type="button"
          className="ctrl-side-btn"
          onClick={() => { refreshCameraDevices(); setIsCamSettingsOpen(true); }}
          title="Выбор камеры и параметры"
        >
          <span>📷</span>
          <label>Камеры</label>
        </button>

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

        <button
          type="button"
          className={`ctrl-side-btn ${isCameraActive ? 'active' : ''}`}
          onClick={isCameraActive ? stopCamera : () => startCamera()}
          title={isCameraActive ? 'Приостановить камеру' : 'Запустить камеру'}
        >
          <span>{isCameraActive ? '⏹' : '▶'}</span>
          <label>{isCameraActive ? 'Стоп' : 'Старт'}</label>
        </button>
      </footer>

      {/* 6. МОДАЛЬНОЕ ОКНО НАСТРОЕК КАМЕРЫ И ПРОИЗВОДИТЕЛЬНОСТИ */}
      {isCamSettingsOpen && (
        <div className="cam-settings-overlay" onClick={() => setIsCamSettingsOpen(false)}>
          <div className="cam-settings-card" onClick={(e) => e.stopPropagation()}>
            <div className="cam-settings-header">
              <h3>⚙️ Настройки камеры и MoCap</h3>
              <button
                type="button"
                className="cam-settings-close"
                onClick={() => setIsCamSettingsOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Выбор видеоустройства */}
            <div className="cam-settings-section">
              <span className="cam-settings-label">📷 Выбор камеры</span>
              <div className="cam-devices-list">
                <div
                  className={`cam-device-item ${!selectedDeviceId ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedDeviceId('');
                    startCamera('', facingMode);
                  }}
                >
                  <span>{facingMode === 'environment' ? '🔍 Основная задняя (Авто)' : '🤳 Фронтальная селфи (Авто)'}</span>
                  {!selectedDeviceId && <span>✔</span>}
                </div>
                {videoDevices.map((dev, idx) => (
                  <div
                    key={dev.deviceId || idx}
                    className={`cam-device-item ${selectedDeviceId === dev.deviceId ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedDeviceId(dev.deviceId);
                      startCamera(dev.deviceId, facingMode);
                    }}
                  >
                    <span>{dev.label || `Камера #${idx + 1}`}</span>
                    {selectedDeviceId === dev.deviceId && <span>✔</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Переключение режима ориентации */}
            <div className="cam-settings-section">
              <span className="cam-settings-label">🔄 Ориентация</span>
              <button
                type="button"
                className="starter-btn-main"
                style={{ padding: '8px 12px', fontSize: '0.82rem' }}
                onClick={() => {
                  toggleFacing();
                }}
              >
                {facingMode === 'environment' ? 'Сменить на Селфи (Фронтальная)' : 'Сменить на Основную (Задняя)'}
              </button>
            </div>

            {/* Профиль производительности */}
            <div className="cam-settings-section">
              <span className="cam-settings-label">⚡ Профиль производительности</span>
              <div className="perf-tiers-grid">
                <button
                  type="button"
                  className={`perf-tier-btn ${performanceMode === 'ultra' ? 'active' : ''}`}
                  onClick={() => setPerformanceMode('ultra')}
                >
                  <span className="tier-icon">🚀</span>
                  <span className="tier-name">Ультра</span>
                  <span className="tier-desc">Тело 60, Кисти 30</span>
                </button>
                <button
                  type="button"
                  className={`perf-tier-btn ${performanceMode === 'balanced' ? 'active' : ''}`}
                  onClick={() => setPerformanceMode('balanced')}
                >
                  <span className="tier-icon">⚖️</span>
                  <span className="tier-name">Баланс</span>
                  <span className="tier-desc">Тело 30, Кисти 15</span>
                </button>
                <button
                  type="button"
                  className={`perf-tier-btn ${performanceMode === 'eco' ? 'active' : ''}`}
                  onClick={() => setPerformanceMode('eco')}
                >
                  <span className="tier-icon">🔋</span>
                  <span className="tier-name">Эко</span>
                  <span className="tier-desc">Энергосбережение</span>
                </button>
              </div>
            </div>

            {/* Диагностика сенсора и WebRTC */}
            <div className="cam-settings-section">
              <span className="cam-settings-label">📊 Аппаратная диагностика</span>
              <div className="cam-diagnostics-box">
                <div>Разрешение сенсора: {videoDim.w} × {videoDim.h} px</div>
                <div>Скорость обработки: {fps} FPS</div>
                <div>Задержка сети (RTT): {pingMs > 0 ? `${pingMs} мс` : '< 25 мс'}</div>
                <div>Человек в кадре: {bodyInFrame ? '🟢 Да' : '🔴 Нет'}</div>
                <div>Обнаружено кистей: {handsDetectedCount}</div>
                <div>Зеркалирование: {facingMode === 'user' ? 'ВКЛ (scaleX -1)' : 'ВЫКЛ'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
