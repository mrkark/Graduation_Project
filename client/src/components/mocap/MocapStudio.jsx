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
  retargetSkeleton3DToMasterAvatar,
  drawNeonKarateSkeleton,
  build3DSkeletonData,
  fuseMultiCameraLandmarks,
} from '../../utils/mocapPoseTracker';
import './MocapStudio.css';

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
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
};

const PHONE_CONFIGS = [
  { slot: 1, label: 'Телефон 1 (Фронт / 0°)', angle: '0°', desc: 'Фронтальная плоскость: ширина X и высота Y' },
  { slot: 2, label: 'Телефон 2 (Сбоку / 90°)', angle: '90°', desc: 'Профиль: точная 3D глубина Z ударов и стоек' },
  { slot: 3, label: 'Телефон 3 (Угол / 45°)', angle: '45°', desc: 'Диагональ: компенсация перекрытий конечностей' },
];

export default function MocapStudio() {
  // Режим источника: 'phone' (до 3 смартфонов по WebRTC) | 'webcam' (камера ПК)
  const [sourceMode, setSourceMode] = useState('phone');
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  // Состояние WebRTC и подключения смартфонов (до 3 телефонов)
  const [roomId] = useState(() => 'DOJO-' + Math.floor(1000 + Math.random() * 9000));
  const [connectedCameras, setConnectedCameras] = useState([]); // [{ peerId, slot, label }]
  const [activeCameraSlot, setActiveCameraSlot] = useState(1); // 1, 2, 3 или 'fusion'
  const [multiCameraFusion, setMultiCameraFusion] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedQrSlot, setSelectedQrSlot] = useState(1);
  const [copiedLink, setCopiedLink] = useState(false);

  // Режим подключения смартфонов: 'local' (локальная сеть Wi-Fi по умолчанию) | 'tunnel' (HTTPS через интернет/4G)
  const [connectionMode, setConnectionMode] = useState('local');
  const [tunnelUrl, setTunnelUrl] = useState(() => {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      return window.location.origin;
    }
    return '';
  });
  const [tunnelActive, setTunnelActive] = useState(() => {
    return typeof window !== 'undefined' && window.location.protocol === 'https:';
  });
  const [tunnelLoading, setTunnelLoading] = useState(false);

  // Настройка сетевого IP для QR-кода телефона
  const defaultNetworkHost = typeof window !== 'undefined'
    ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? '192.168.100.28' : window.location.hostname)
    : 'localhost';
  const [networkHost, setNetworkHost] = useState(defaultNetworkHost);
  const [availableIps, setAvailableIps] = useState([
    { name: 'Ethernet (LAN)', ip: '192.168.100.28', isPrimary: true },
    { name: 'Wi-Fi IP', ip: '192.168.100.6', isPrimary: false },
  ]);
  const [networkPort, setNetworkPort] = useState(() => (typeof window !== 'undefined' ? window.location.port || '5173' : '5173'));
  const [useHttpsForPhone, setUseHttpsForPhone] = useState(false);

  const fetchTunnelStatus = useCallback(async () => {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      setTunnelUrl(window.location.origin);
      setTunnelActive(true);
      return;
    }
    try {
      setTunnelLoading(true);
      const res = await fetch('/api/mocap/tunnel');
      if (res.ok) {
        const json = await res.json();
        if (json?.data?.url) {
          setTunnelUrl(json.data.url);
          setTunnelActive(Boolean(json.data.active));
        }
        if (json?.data?.localIp) {
          setNetworkHost(json.data.localIp);
        }
        if (Array.isArray(json?.data?.localIps) && json.data.localIps.length > 0) {
          setAvailableIps(json.data.localIps);
        }
      }
    } catch (e) {
      console.warn('Не удалось запросить статус HTTPS туннеля:', e);
    } finally {
      setTunnelLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTunnelStatus();
  }, [fetchTunnelStatus]);

  useEffect(() => {
    if (showQrModal) {
      fetchTunnelStatus();
    }
  }, [showQrModal, fetchTunnelStatus]);

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

  // Данные для полноценной 3D-модели костей (Three.js Mocap3DSkeleton)
  const [skeleton3DData, setSkeleton3DData] = useState(null);

  // Повороты костей для классического SkinnedMesh аватара
  const [boneRotations, setBoneRotations] = useState(null);

  // Запись сессии MoCap
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedFrames, setRecordedFrames] = useState([]);

  // Ссылки на элементы DOM и WebRTC
  const videoRef = useRef(null); // Веб-камера ПК
  const phoneVideo1Ref = useRef(null); // Смартфон 1 (Фронт)
  const phoneVideo2Ref = useRef(null); // Смартфон 2 (Бок)
  const phoneVideo3Ref = useRef(null); // Смартфон 3 (Угол)
  const canvasRef = useRef(null);

  const localStreamRef = useRef(null);
  const socketRef = useRef(null);
  const peersRef = useRef(new Map()); // peerId -> RTCPeerConnection
  const phoneStreamsRef = useRef(new Map()); // slot -> MediaStream
  const latestLandmarksBySlot = useRef({}); // slot -> { landmarks, worldLandmarks }

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

      // Сохраняем последние ключевые точки активного слота
      latestLandmarksBySlot.current[activeCameraSlot] = {
        landmarks: results.poseLandmarks,
        worldLandmarks: results.poseWorldLandmarks,
      };

      // Если включено мульти-камерное слияние (до 3 телефонов), выполняем триангуляцию данных
      let finalLandmarks = results.poseLandmarks;
      let finalWorldLandmarks = results.poseWorldLandmarks;

      if (multiCameraFusion && Object.keys(latestLandmarksBySlot.current).length > 1) {
        const fused = fuseMultiCameraLandmarks(latestLandmarksBySlot.current);
        if (fused) {
          finalLandmarks = fused.landmarks;
          finalWorldLandmarks = fused.worldLandmarks;
        }
      }

      // Анализ биомеханики каратэ
      const metrics = analyzeKarateBiomechanics(finalLandmarks, finalWorldLandmarks);
      setKarateMetrics(metrics);

      // Отрисовываем неоновый скелет на холсте видоискателя
      drawNeonKarateSkeleton(ctx, finalLandmarks, w, h, metrics);

      // 3D КОСТИ: Строим объемную трехмерную модель суставов и костей для Three.js!
      const s3d = build3DSkeletonData(finalWorldLandmarks, finalLandmarks, { scale: 1.35 });
      if (s3d) {
        setSkeleton3DData(s3d);
      }

      // КИНЕМАТИЧЕСКИЙ РЕТАРГЕТИНГ: перенос движений напрямую с 3D костяной модели на 3D модель мастера!
      const retargeted = retargetSkeleton3DToMasterAvatar(s3d, finalWorldLandmarks, finalLandmarks);
      if (retargeted) {
        setBoneRotations(retargeted.bones);
      }

      // Сохраняем кадр в запись
      if (isRecording) {
        setRecordedFrames((prev) => [
          ...prev,
          {
            timestamp: Date.now(),
            landmarks: finalLandmarks,
            worldLandmarks: finalWorldLandmarks,
            skeleton3D: s3d,
            metrics,
            bones: mappedBones?.bones || null,
          },
        ]);
      }
    } else {
      setBodyDetected(false);
      setBoneRotations(null);
    }
  }, [isRecording, activeCameraSlot, multiCameraFusion]);

  // 3. Получение списка веб-камер ПК
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
      } else {
        setCameraError(`Не удалось запустить камеру: ${err.message || 'Ошибка устройства'}`);
      }
    }
  }, [selectedDeviceId]);

  // 5. Остановка веб-камеры
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
    setSkeleton3DData(null);
  }, []);

  // Создание или получение WebRTC Peer Connection для конкретного телефона (peerId)
  const getOrCreateHostPeer = useCallback((peerId, slot = 1) => {
    if (peersRef.current.has(peerId)) {
      const existing = peersRef.current.get(peerId);
      if (existing.connectionState !== 'closed') {
        return existing;
      }
    }

    const peer = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current.set(peerId, peer);

    peer.ontrack = (event) => {
      const stream = event.streams[0];
      phoneStreamsRef.current.set(slot, stream);

      // Привязываем видеопоток к соответствующему <video> элементу смартфона (слот 1, 2 или 3)
      let targetVideo = null;
      if (slot === 1) targetVideo = phoneVideo1Ref.current;
      else if (slot === 2) targetVideo = phoneVideo2Ref.current;
      else if (slot === 3) targetVideo = phoneVideo3Ref.current;

      if (targetVideo) {
        targetVideo.srcObject = stream;
        targetVideo.muted = true;
        targetVideo.defaultMuted = true;
        targetVideo.playsInline = true;
        targetVideo.setAttribute('playsinline', 'true');
        targetVideo.setAttribute('webkit-playsinline', 'true');
        targetVideo.setAttribute('autoplay', 'true');
        targetVideo.setAttribute('muted', 'true');

        const playStream = () => {
          targetVideo.play().catch((e) => console.warn('Autoplay предупреждение:', e));
          setCameraActive(true);
        };
        targetVideo.onloadedmetadata = playStream;
        targetVideo.oncanplay = playStream;
        playStream();
      }
    };

    peer.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        socketRef.current.emit('mocap:candidate', {
          roomId,
          candidate: e.candidate,
          targetId: peerId,
          slot,
        });
      }
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        setCameraActive(true);
      } else if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') {
        phoneStreamsRef.current.delete(slot);
        delete latestLandmarksBySlot.current[slot];
      }
    };

    return peer;
  }, [roomId]);

  // 6. Подключение WebRTC сигналинга для смартфонов (до 3 устройств)
  useEffect(() => {
    if (sourceMode !== 'phone') return;

    const socket = io(`${SOCKET_URL}/mocap`, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('mocap:join-room', { roomId, role: 'host' }, (res) => {
        if (res?.cameras) {
          setConnectedCameras(res.cameras);
        }
      });
    });

    // Обновление реестра подключенных камер (до 3 смартфонов)
    socket.on('mocap:cameras-updated', ({ cameras }) => {
      if (Array.isArray(cameras)) {
        setConnectedCameras(cameras);
        if (cameras.length > 0) {
          // Если текущий выбранный слот пуст, переключаем на первый доступный
          const hasActive = cameras.some((c) => c.slot === activeCameraSlot);
          if (!hasActive) {
            setActiveCameraSlot(cameras[0].slot);
          }
        }
      }
    });

    // Обработка входящего WebRTC Offer от смартфона
    socket.on('mocap:offer', async ({ sdp, senderId, slot }) => {
      try {
        const assignedSlot = slot || 1;
        const peer = getOrCreateHostPeer(senderId, assignedSlot);
        await peer.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        socket.emit('mocap:answer', {
          roomId,
          sdp: answer,
          targetId: senderId,
          slot: assignedSlot,
        });
      } catch (err) {
        console.error('Ошибка обработки Offer со смартфона:', err);
      }
    });

    // Обработка Answer от смартфона
    socket.on('mocap:answer', async ({ sdp, senderId }) => {
      try {
        const peer = peersRef.current.get(senderId);
        if (peer) {
          await peer.setRemoteDescription(new RTCSessionDescription(sdp));
        }
      } catch (err) {
        console.error('Ошибка установки Answer:', err);
      }
    });

    // Обработка ICE кандидатов от смартфона
    socket.on('mocap:candidate', async ({ candidate, senderId }) => {
      try {
        const peer = peersRef.current.get(senderId);
        if (peer && candidate) {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('Ошибка добавления ICE кандидата:', err);
      }
    });

    // Резервный поток телеметрии ключевых точек
    socket.on('mocap:landmarks-data', ({ slot, landmarks, worldLandmarks }) => {
      if (slot && landmarks) {
        latestLandmarksBySlot.current[slot] = { landmarks, worldLandmarks };
      }
    });

    // Удаленная команда записи со смартфона
    socket.on('mocap:record-command', ({ action }) => {
      if (action === 'start') {
        setIsRecording(true);
      } else if (action === 'stop') {
        setIsRecording(false);
      }
    });

    socket.on('mocap:camera-left', ({ peerId, slot }) => {
      if (peersRef.current.has(peerId)) {
        try {
          peersRef.current.get(peerId).close();
        } catch (e) {}
        peersRef.current.delete(peerId);
      }
      phoneStreamsRef.current.delete(slot);
      delete latestLandmarksBySlot.current[slot];
    });

    return () => {
      socket.disconnect();
      peersRef.current.forEach((peer) => {
        try {
          peer.close();
        } catch (e) {}
      });
      peersRef.current.clear();
    };
  }, [sourceMode, roomId, getOrCreateHostPeer, activeCameraSlot]);

  // Переключение между локальной веб-камерой и смартфонами
  useEffect(() => {
    if (sourceMode === 'webcam') {
      startWebcam();
    } else {
      stopWebcam();
    }
  }, [sourceMode, startWebcam, stopWebcam]);

  // 7. Основной цикл захвата кадров и передачи в нейросеть MediaPipe Pose
  useEffect(() => {
    if (!cameraActive) return;

    let isProcessing = false;

    const frameLoop = async () => {
      const pose = poseInstanceRef.current;

      // Выбираем активное видео для обработки
      let video = null;
      if (sourceMode === 'webcam') {
        video = videoRef.current;
      } else {
        if (activeCameraSlot === 1) video = phoneVideo1Ref.current;
        else if (activeCameraSlot === 2) video = phoneVideo2Ref.current;
        else if (activeCameraSlot === 3) video = phoneVideo3Ref.current;

        // Если выбранное видео не готово, ищем любое активное видео телефона
        if (!video || video.readyState < 2) {
          if (phoneVideo1Ref.current && phoneVideo1Ref.current.readyState >= 2) video = phoneVideo1Ref.current;
          else if (phoneVideo2Ref.current && phoneVideo2Ref.current.readyState >= 2) video = phoneVideo2Ref.current;
          else if (phoneVideo3Ref.current && phoneVideo3Ref.current.readyState >= 2) video = phoneVideo3Ref.current;
        }
      }

      if (video && video.readyState >= 2 && pose && !isProcessing) {
        try {
          isProcessing = true;
          await pose.send({ image: video });
        } catch (e) {
          // Пропуск кадра при задержке
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
  }, [cameraActive, sourceMode, activeCameraSlot]);

  // 8. Таймер записи сессии MoCap
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

  // Трансляция статуса записи на все подключенные смартфоны
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
    downloadAnchor.setAttribute('download', `bunkai_3d_mocap_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getPhoneConnectUrl = (slotNum = 1) => {
    if (connectionMode === 'tunnel' && tunnelUrl) {
      const cleanUrl = tunnelUrl.replace(/\/+$/, '');
      return `${cleanUrl}/phone-camera?room=${roomId}&slot=${slotNum}`;
    }
    const proto = useHttpsForPhone ? 'https:' : (typeof window !== 'undefined' ? window.location.protocol : 'http:');
    return `${proto}//${networkHost}:${networkPort}/phone-camera?room=${roomId}&slot=${slotNum}`;
  };

  const copyPhoneUrl = (slotNum = 1) => {
    navigator.clipboard.writeText(getPhoneConnectUrl(slotNum)).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const activePhoneCount = connectedCameras.length;

  return (
    <div className="mocap-studio">
      {/* 1. ВЕРХНЯЯ ПАНЕЛЬ СТОЛПА AIMOKAP */}
      <header className="mocap-header">
        <div className="mocap-title-group">
          <div className="mocap-kanji-stamp">捕</div>
          <div>
            <h2 className="mocap-title">AI MoCap Додзё (Aimokap)</h2>
            <p className="mocap-subtitle">
              Захват 3D-движений · Поддержка до 3 телефонов (мульти-ракурс) · 3D-модель мастера в Додзё
            </p>
          </div>
        </div>

        {/* Выбор источника видеопотока */}
        <div className="mocap-header-controls">
          <div className="mocap-source-switcher">
            <button
              type="button"
              className={`source-tab-btn ${sourceMode === 'phone' ? 'active' : ''}`}
              onClick={() => {
                setSourceMode('phone');
                setShowQrModal(true);
              }}
            >
              📱 Мульти-смартфон ({activePhoneCount}/3) {activePhoneCount > 0 && '🟢'}
            </button>
            <button
              type="button"
              className={`source-tab-btn ${sourceMode === 'webcam' ? 'active' : ''}`}
              onClick={() => setSourceMode('webcam')}
            >
              💻 Веб-камера ПК
            </button>
          </div>

          {sourceMode === 'phone' && (
            <button
              type="button"
              className="btn btn-gold btn-sm"
              onClick={() => setShowQrModal(true)}
            >
              📱 QR для подключения (+{3 - activePhoneCount} тел.)
            </button>
          )}
        </div>
      </header>

      {/* ПАНЕЛЬ ПРЕДУПРЕЖДЕНИЙ */}
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
          <span>⌛ Загрузка 3D-модели нейросети MediaPipe Pose... Пожалуйста, подождите.</span>
        </div>
      )}

      {/* 2. РАБОЧАЯ ОБЛАСТЬ: 3D ДОДЗЁ + ВИДЕОИСКАТЕЛЬ */}
      {/* ПАЙПЛАЙН: ТЕЛЕФОНЫ (ЛОКАЛЬНАЯ СЕТЬ) -> AI АНАЛИЗ -> 3D МОДЕЛЬ МАСТЕРА */}
      <div className="mocap-pipeline-strip">
        <div className="pipeline-step">
          <span className="step-num">1</span>
          <span className="step-icon">📱</span>
          <div className="step-body">
            <span className="step-title">Камеры (до 3 тел.)</span>
            <span className="step-desc">Локальная сеть Wi-Fi / 0°, 90°, 45°</span>
          </div>
        </div>
        <span className="pipeline-arrow">➔</span>
        <div className="pipeline-step active-gold">
          <span className="step-num">2</span>
          <span className="step-icon">🧠</span>
          <div className="step-body">
            <span className="step-title">AI Анализ движений</span>
            <span className="step-desc">MediaPipe 3D компьютерное зрение</span>
          </div>
        </div>
        <span className="pipeline-arrow">➔</span>
        <div className="pipeline-step active-emerald">
          <span className="step-num">3</span>
          <span className="step-icon">🥋</span>
          <div className="step-body">
            <span className="step-title">3D Модель мастера</span>
            <span className="step-desc">Синхронный аватар мастера в Додзё</span>
          </div>
        </div>
      </div>

      <div className="mocap-workspace">
        {/* ГЛАВНАЯ 3D АРЕНА (THREE.JS): ТОЛЬКО 3D МОДЕЛЬ МАСТЕРА В ДОДЗЁ */}
        <div className="mocap-3d-stage">
          <Canvas
            shadows
            camera={{ position: [0, 1.4, 3.4], fov: 42 }}
            style={{ width: '100%', height: '100%', background: '#0a0807' }}
          >
            <ambientLight intensity={0.7} />
            <directionalLight
              position={[4, 7, 5]}
              intensity={1.2}
              castShadow
              shadow-mapSize={[1024, 1024]}
            />
            <pointLight position={[-3, 2, -2]} intensity={0.5} color="#e8c57b" />

            <Suspense fallback={null}>
              <TraditionalDojo />

              {/* 3D МОДЕЛЬ МАСТЕРА В ДОДЗЁ */}
              <MocapPuppetAvatar
                boneRotations={boneRotations}
                detectedStance={karateMetrics.detectedStance}
                position={[0, 0, 0]}
                rotation={[0, 0, 0]}
                xrayMode={false}
              />

              <ContactShadows opacity={0.7} scale={6} blur={1.5} far={4} color="#000000" />
            </Suspense>

            <OrbitControls
              makeDefault
              minDistance={1.0}
              maxDistance={7}
              maxPolarAngle={Math.PI / 2 - 0.05}
              target={[0, 0.9, 0]}
            />
          </Canvas>

          {/* HUD ТЕЛЕМЕТРИИ В 3D СЦЕНЕ */}
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

        {/* ПРАВАЯ ПАНЕЛЬ: МУЛЬТИ-КАМЕРА (ДО 3 ТЕЛЕФОНОВ) + ВИДОИСКАТЕЛЬ */}
        <aside className="mocap-cam-sidebar">
          {/* СЕКЦИЯ МУЛЬТИ-КАМЕРЫ ДО 3 ТЕЛЕФОНОВ */}
          {sourceMode === 'phone' && (
            <div className="mocap-multi-cam-panel">
              <div className="multi-cam-head">
                <span className="multi-cam-title">📱 Мульти-захват (до 3 телефонов)</span>
                <span className="multi-cam-count">{activePhoneCount} из 3 активны</span>
              </div>

              {/* Сетка слотов 3 телефонов */}
              <div className="multi-cam-grid">
                {PHONE_CONFIGS.map((cfg) => {
                  const isConnected = connectedCameras.some((c) => c.slot === cfg.slot);
                  const isActiveSlot = activeCameraSlot === cfg.slot;

                  return (
                    <div
                      key={cfg.slot}
                      className={`cam-slot-card ${isConnected ? 'is-connected' : 'is-empty'} ${
                        isActiveSlot ? 'is-selected' : ''
                      }`}
                      onClick={() => isConnected && setActiveCameraSlot(cfg.slot)}
                    >
                      <div className="slot-card-header">
                        <span className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
                        <strong className="slot-card-num">#{cfg.slot}</strong>
                        <span className="slot-card-angle">{cfg.angle}</span>
                      </div>
                      <span className="slot-card-name">
                        {cfg.slot === 1 ? 'Фронтальная' : cfg.slot === 2 ? 'Боковая (90°)' : 'Угол (45°)'}
                      </span>
                      <span className="slot-card-status">
                        {isConnected ? '🟢 Передает видео' : '⚪ Нажмите QR'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Переключатель слияния камер */}
              <div className="multi-cam-fusion-bar">
                <label className="fusion-toggle-label">
                  <input
                    type="checkbox"
                    checked={multiCameraFusion}
                    onChange={(e) => setMultiCameraFusion(e.target.checked)}
                  />
                  <span>Триангуляция и слияние 3 камер (Depth Z)</span>
                </label>
              </div>
            </div>
          )}

          <div className="viewfinder-card">
            <div className="viewfinder-header">
              <div className="viewfinder-title">
                <span className={`status-dot ${cameraActive ? (bodyDetected ? 'online' : 'standby') : 'offline'}`} />
                <span>
                  {sourceMode === 'webcam'
                    ? 'Веб-камера компьютера'
                    : `Камера #${activeCameraSlot} · ${
                        activeCameraSlot === 1 ? 'Фронт' : activeCameraSlot === 2 ? 'Бок 90°' : 'Угол 45°'
                      }`}
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

            {/* Видеопотоки и наложение неонового холста */}
            <div className="viewfinder-media">
              {/* Локальная веб-камера */}
              <video
                ref={videoRef}
                playsInline
                muted
                className={`viewfinder-video ${sourceMode === 'webcam' ? 'active' : 'hidden'}`}
              />

              {/* Видеопоток телефона 1 (Фронт) */}
              <video
                ref={phoneVideo1Ref}
                playsInline
                autoPlay
                muted
                className={`viewfinder-video ${sourceMode === 'phone' && activeCameraSlot === 1 ? 'active' : 'hidden'}`}
              />

              {/* Видеопоток телефона 2 (Бок 90°) */}
              <video
                ref={phoneVideo2Ref}
                playsInline
                autoPlay
                muted
                className={`viewfinder-video ${sourceMode === 'phone' && activeCameraSlot === 2 ? 'active' : 'hidden'}`}
              />

              {/* Видеопоток телефона 3 (Угол 45°) */}
              <video
                ref={phoneVideo3Ref}
                playsInline
                autoPlay
                muted
                className={`viewfinder-video ${sourceMode === 'phone' && activeCameraSlot === 3 ? 'active' : 'hidden'}`}
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
                        Включить веб-камеру
                      </button>
                    </div>
                  ) : (
                    <div>
                      <span className="placeholder-icon">📱</span>
                      <p>Подключите до 3 телефонов по QR</p>
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

            {/* Кнопки управления записью 3D MoCap */}
            <div className="mocap-recorder-box">
              <div className="recorder-status">
                {isRecording ? (
                  <span className="rec-active">
                    <span className="rec-dot" /> Запись 3D: {recordSeconds} сек ({recordedFrames.length} кадров)
                  </span>
                ) : (
                  <span className="rec-idle">
                    {recordedFrames.length > 0
                      ? `Записано: ${recordedFrames.length} 3D-кадров`
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
                    ⏺ Записать 3D MoCap
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
                    💾 Скачать 3D JSON
                  </button>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* 3. МОДАЛЬНОЕ ОКНО ПОДКЛЮЧЕНИЯ ДО 3 ТЕЛЕФОНОВ */}
      {showQrModal && (
        <div className="qr-modal-backdrop" onClick={() => setShowQrModal(false)}>
          <div className="qr-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="qr-modal-head">
              <h3>📱 Подключение камер смартфонов (до 3 устройств)</h3>
              <button
                type="button"
                className="qr-close-btn"
                onClick={() => setShowQrModal(false)}
              >
                ✕
              </button>
            </div>

            <p className="qr-modal-desc">
              Отсканируйте QR-код смартфоном для мгновенного захвата движений. Доступно до 3 телефонов одновременно.
            </p>

            {/* Переключатель режимов подключения: Локальная сеть (Wi-Fi) или Внешний интернет (HTTPS) */}
            <div className="qr-net-mode-switch">
              <button
                type="button"
                className={`qr-net-mode-btn ${connectionMode === 'local' ? 'active' : ''}`}
                onClick={() => setConnectionMode('local')}
              >
                <span className="net-mode-icon">🏠</span>
                <span className="net-mode-title">Локальная сеть (Wi-Fi)</span>
                <span className="net-mode-tag">Один роутер / Домашняя сеть</span>
              </button>
              <button
                type="button"
                className={`qr-net-mode-btn ${connectionMode === 'tunnel' ? 'active' : ''}`}
                onClick={() => setConnectionMode('tunnel')}
              >
                <span className="net-mode-icon">🌍</span>
                <span className="net-mode-title">Внешний интернет / 4G (HTTPS)</span>
                <span className="net-mode-tag gold">Без флагов и настроек</span>
              </button>
            </div>

            {/* Вкладки выбора телефона 1, 2 или 3 */}
            <div className="qr-slot-tabs">
              {PHONE_CONFIGS.map((cfg) => {
                const isOnline = connectedCameras.some((c) => c.slot === cfg.slot);
                return (
                  <button
                    key={cfg.slot}
                    type="button"
                    className={`qr-slot-tab ${selectedQrSlot === cfg.slot ? 'active' : ''}`}
                    onClick={() => setSelectedQrSlot(cfg.slot)}
                  >
                    <span className="qr-tab-num">#{cfg.slot}</span>
                    <span className="qr-tab-txt">{cfg.slot === 1 ? 'Фронт (0°)' : cfg.slot === 2 ? 'Бок (90°)' : 'Угол (45°)'}</span>
                    <span className={`qr-tab-badge ${isOnline ? 'online' : 'waiting'}`}>
                      {isOnline ? 'Подключен 🟢' : 'Свободен ⚪'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="qr-image-wrap">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  getPhoneConnectUrl(selectedQrSlot)
                )}`}
                alt={`QR код для подключения ${PHONE_CONFIGS[selectedQrSlot - 1].label}`}
                className="qr-image"
              />
            </div>

            <div className="qr-room-box">
              <span>Додзё-комната: <strong>{roomId}</strong></span>
              <span className="qr-target-tag">{PHONE_CONFIGS[selectedQrSlot - 1].label}</span>
            </div>

            <div className="qr-link-input-wrap">
              <input
                type="text"
                readOnly
                value={getPhoneConnectUrl(selectedQrSlot)}
                className="qr-link-input"
              />
              <button type="button" className="btn btn-gold" onClick={() => copyPhoneUrl(selectedQrSlot)}>
                {copiedLink ? 'Скопировано! ✔' : 'Копировать'}
              </button>
            </div>

            {/* Конфигурация в зависимости от выбранного режима */}
            {connectionMode === 'tunnel' ? (
              <div className="qr-tunnel-config">
                <div className="qr-tunnel-header">
                  <div className="qr-tunnel-status">
                    <span className={`status-dot ${tunnelActive ? 'online' : 'standby'}`} />
                    <span>
                      {tunnelActive ? 'Публичный HTTPS туннель активен' : 'Ожидание запуска туннеля...'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-xs btn-subtle"
                    onClick={fetchTunnelStatus}
                    disabled={tunnelLoading}
                  >
                    {tunnelLoading ? '...' : '🔄 Обновить'}
                  </button>
                </div>

                <div className="qr-tunnel-input-row">
                  <input
                    type="text"
                    value={tunnelUrl}
                    onChange={(e) => {
                      setTunnelUrl(e.target.value.trim());
                      setTunnelActive(Boolean(e.target.value.trim()));
                    }}
                    placeholder="https://xxxx.lhr.life"
                    className="qr-tunnel-input"
                  />
                </div>

                <div className="qr-https-perks">
                  <div className="perk-row">
                    <span>✨</span>
                    <span><strong>Любая сеть:</strong> Компьютер и смартфон могут быть в совершенно разных сетях (телефон на 4G/LTE/моб. интернете, ПК дома).</span>
                  </div>
                  <div className="perk-row">
                    <span>🔒</span>
                    <span><strong>Чистый HTTPS:</strong> Камера на телефоне включается сразу в 1 клик без предупреждений безопасности и флагов <code>chrome://flags</code>.</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="qr-ip-config">
                <label className="qr-ip-label">Сетевой IP компьютера (для доступа внутри локального Wi-Fi):</label>
                <div className="qr-ip-row" style={{ flexWrap: 'wrap', gap: '8px' }}>
                  <input
                    type="text"
                    value={networkHost}
                    onChange={(e) => setNetworkHost(e.target.value.trim())}
                    placeholder="192.168.100.28"
                    className="qr-ip-input"
                    style={{ minWidth: '160px' }}
                  />
                  {availableIps.map((adapter) => (
                    <button
                      key={adapter.ip}
                      type="button"
                      className={`btn btn-sm ${networkHost === adapter.ip ? 'btn-gold' : 'btn-subtle'}`}
                      onClick={() => setNetworkHost(adapter.ip)}
                      title={`Выбрать IP ${adapter.ip}`}
                    >
                      {adapter.isPrimary ? '★ ' : ''}{adapter.name}: {adapter.ip}
                    </button>
                  ))}
                </div>
                <div className="qr-perm-notice" style={{ marginTop: '10px' }}>
                  <div><strong>⚠️ Если на телефоне пишет «Не удается получить доступ к сайту»:</strong></div>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '0.82rem', lineHeight: '1.4' }}>
                    <li>Убедитесь, что телефон подключен к тому же Wi-Fi роутеру, что и компьютер.</li>
                    <li>Если компьютер подключен по кабелю, выберите кнопку <strong>Ethernet: 192.168.100.28</strong> выше.</li>
                    <li>Либо переключитесь на вкладку выше <strong>«Внешний интернет / 4G (HTTPS)»</strong> — она работает на любом телефоне без настроек сети!</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
