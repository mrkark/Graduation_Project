import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import io from 'socket.io-client';
import QRCode from '../../utils/qrCodeStandalone';
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
  resetMocapFilters,
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

  // Раскладка рабочей области: 'split' (50/50), 'camFocus' (70/30), 'dojoFocus' (30/70)
  const [workspaceLayout, setWorkspaceLayout] = useState('split');
  const [isViewfinderFullscreen, setIsViewfinderFullscreen] = useState(false);

  // Параметры видеопотока для точного 1:1 наложения холста на видео (без искажений и обрезки)
  const [streamAspect, setStreamAspect] = useState('16 / 9');
  const [streamResolution, setStreamResolution] = useState({ width: 1280, height: 720 });

  // Состояние WebRTC и подключения смартфонов (до 3 телефонов)
  const [roomId] = useState(() => 'DOJO-' + Math.floor(1000 + Math.random() * 9000));
  const [connectedCameras, setConnectedCameras] = useState([]); // [{ peerId, slot, label }]
  const [activeCameraSlot, setActiveCameraSlot] = useState(1); // 1, 2, 3 или 'fusion'
  const [multiCameraFusion, setMultiCameraFusion] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedQrSlot, setSelectedQrSlot] = useState(1);

  // Режим подключения смартфонов: 'local' (локальная сеть Wi-Fi) по умолчанию!
  const [connectionMode, setConnectionMode] = useState('local');
  const [httpsGatewayUrl, setHttpsGatewayUrl] = useState('https://192.168.100.6:8443');
  const [tunnelUrl, setTunnelUrl] = useState('');
  const [tunnelActive, setTunnelActive] = useState(false);
  const [tunnelLoading, setTunnelLoading] = useState(false);

  // Настройка сетевого IP для QR-кода телефона (активный Wi-Fi 192.168.100.6)
  const defaultNetworkHost = typeof window !== 'undefined'
    ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? '192.168.100.6' : window.location.hostname)
    : '192.168.100.6';
  const [networkHost, setNetworkHost] = useState(defaultNetworkHost);
  const [availableIps, setAvailableIps] = useState([
    { name: 'Wi-Fi (Активный LAN)', ip: '192.168.100.6', isPrimary: true },
    { name: 'Localhost (ПК)', ip: '127.0.0.1', isPrimary: false },
  ]);
  const [networkPort, setNetworkPort] = useState('8443');
  const [useHttpsForPhone, setUseHttpsForPhone] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrGenerating, setQrGenerating] = useState(false);
  const [qrError, setQrError] = useState(null);

  const fetchTunnelStatus = useCallback(async () => {
    try {
      setTunnelLoading(true);
      const res = await fetch('/api/mocap/tunnel');
      if (res.ok) {
        const json = await res.json();
        const activeHttps = json?.data?.httpsUrl || json?.data?.url;
        if (activeHttps) {
          setHttpsGatewayUrl(activeHttps);
          setTunnelUrl(activeHttps);
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
      console.warn('Не удалось запросить статус HTTPS шлюза:', e);
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
  const [mirrorMode, setMirrorMode] = useState(true);
  const latestPoseRef = useRef(null);

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
  const latestLandmarksBySlot = useRef({}); // slot -> { landmarks, worldLandmarks, timestamp }
  const processingSlotRef = useRef(1); // Текущий слот, обрабатываемый нейросетью MediaPipe
  const cameraCycleIndexRef = useRef(0); // Счетчик кругового переключения камер (Round-Robin)

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

  // Определение активного элемента <video>
  const getActiveVideoElement = useCallback(() => {
    if (sourceMode === 'webcam') return videoRef.current;
    if (activeCameraSlot === 1) return phoneVideo1Ref.current;
    if (activeCameraSlot === 2) return phoneVideo2Ref.current;
    if (activeCameraSlot === 3) return phoneVideo3Ref.current;
    return phoneVideo1Ref.current || videoRef.current;
  }, [sourceMode, activeCameraSlot]);

  const updateStreamDimensions = useCallback((videoElement) => {
    if (!videoElement) return;
    const vw = videoElement.videoWidth;
    const vh = videoElement.videoHeight;
    if (vw > 0 && vh > 0) {
      setStreamResolution({ width: vw, height: vh });
      setStreamAspect(`${vw} / ${vh}`);
      const canvas = canvasRef.current;
      if (canvas && (canvas.width !== vw || canvas.height !== vh)) {
        canvas.width = vw;
        canvas.height = vh;
      }
    }
  }, []);

  // 2. Обработка результатов компьютерного зрения MediaPipe (1, 2 или 3 камеры)
  const onPoseResults = useCallback((results) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Синхронизируем физическое разрешение холста с активным видеопотоком
    const v = getActiveVideoElement();
    if (v && v.videoWidth > 0 && v.videoHeight > 0) {
      if (canvas.width !== v.videoWidth || canvas.height !== v.videoHeight) {
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        setStreamResolution({ width: v.videoWidth, height: v.videoHeight });
        setStreamAspect(`${v.videoWidth} / ${v.videoHeight}`);
      }
    }

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    const currentSlot = processingSlotRef.current || activeCameraSlot || 1;

    if (results.poseLandmarks && results.poseLandmarks.length >= 33) {
      setBodyDetected(true);

      // Сохраняем последние ключевые точки обработанного слота
      latestLandmarksBySlot.current[currentSlot] = {
        landmarks: results.poseLandmarks,
        worldLandmarks: results.poseWorldLandmarks,
        slot: currentSlot,
        timestamp: Date.now(),
      };

      // Очищаем слоты, которые не обновлялись более 2.5 сек (выключенная камера)
      const now = Date.now();
      for (const s of Object.keys(latestLandmarksBySlot.current)) {
        if (now - (latestLandmarksBySlot.current[s]?.timestamp || 0) > 2500) {
          delete latestLandmarksBySlot.current[s];
        }
      }

      // Выполняем адаптивное слияние камер (1, 2 или 3 камеры) с 1€ фильтром и анатомическим клиренсом
      const fused = fuseMultiCameraLandmarks(latestLandmarksBySlot.current, now);

      const finalLandmarks = fused?.landmarks || results.poseLandmarks;
      const finalWorldLandmarks = fused?.worldLandmarks || results.poseWorldLandmarks;

      // Анализ биомеханики каратэ
      const metrics = analyzeKarateBiomechanics(finalLandmarks, finalWorldLandmarks);
      setKarateMetrics(metrics);

      // На холсте видоискателя ПК отображаем скелет для текущего выбранного ракурса (1:1 наложение)
      ctx.clearRect(0, 0, w, h);
      const displayLandmarks = (latestLandmarksBySlot.current[activeCameraSlot]?.landmarks) || finalLandmarks;
      drawNeonKarateSkeleton(ctx, displayLandmarks, w, h, metrics);

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

      // Сохраняем актуальные 3D координаты позы для прямого ретаргетинга аватара (60 FPS)
      latestPoseRef.current = {
        landmarks: finalLandmarks,
        worldLandmarks: finalWorldLandmarks,
      };

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
            bones: retargeted?.bones || null,
          },
        ]);
      }
    } else {
      if (latestLandmarksBySlot.current[currentSlot]) {
        delete latestLandmarksBySlot.current[currentSlot];
      }
      if (Object.keys(latestLandmarksBySlot.current).length === 0) {
        setBodyDetected(false);
        setBoneRotations(null);
        latestPoseRef.current = null;
        ctx.clearRect(0, 0, w, h);
      }
    }
  }, [isRecording, activeCameraSlot, getActiveVideoElement]);

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

  // 7. Основной цикл захвата кадров и передачи в нейросеть MediaPipe Pose (1, 2 или 3 камеры)
  useEffect(() => {
    if (!cameraActive) return;

    let isProcessing = false;

    const frameLoop = async () => {
      const pose = poseInstanceRef.current;

      // Собираем все готовые видеопотоки
      const activeVideos = [];
      if (sourceMode === 'webcam') {
        if (videoRef.current && videoRef.current.readyState >= 2) {
          activeVideos.push({ slot: 1, video: videoRef.current });
        }
      } else {
        if (phoneVideo1Ref.current && phoneVideo1Ref.current.readyState >= 2) {
          activeVideos.push({ slot: 1, video: phoneVideo1Ref.current });
        }
        if (phoneVideo2Ref.current && phoneVideo2Ref.current.readyState >= 2) {
          activeVideos.push({ slot: 2, video: phoneVideo2Ref.current });
        }
        if (phoneVideo3Ref.current && phoneVideo3Ref.current.readyState >= 2) {
          activeVideos.push({ slot: 3, video: phoneVideo3Ref.current });
        }
      }

      if (activeVideos.length > 0 && pose && !isProcessing) {
        // Round-Robin переключение между активными камерами:
        // Если подключена 1 камера — она обрабатывается каждый кадр (60 Гц)
        // Если подключены 2 камеры — чередуются по кадрам (30 Гц на каждую)
        // Если подключены 3 камеры — чередуются по кадрам (20 Гц на каждую)
        const target = activeVideos[cameraCycleIndexRef.current % activeVideos.length];
        cameraCycleIndexRef.current = (cameraCycleIndexRef.current + 1) % activeVideos.length;

        try {
          isProcessing = true;
          processingSlotRef.current = target.slot;
          await pose.send({ image: target.video });
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
  }, [cameraActive, sourceMode]);

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

  const getPhoneConnectUrl = useCallback((slotNum = selectedQrSlot) => {
    const host = networkHost || '192.168.100.6';
    if (useHttpsForPhone) {
      const port = networkPort || '8443';
      return `https://${host}:${port}/phone-camera?room=${roomId}&slot=${slotNum}`;
    }
    return `http://${host}:5173/phone-camera?room=${roomId}&slot=${slotNum}`;
  }, [networkHost, networkPort, useHttpsForPhone, roomId, selectedQrSlot]);

  // Динамическая генерация QR-кода на клиенте без внешних облачных API
  useEffect(() => {
    let isCancelled = false;
    const url = getPhoneConnectUrl(selectedQrSlot);
    setQrGenerating(true);
    setQrError(null);

    QRCode.toDataURL(url, {
      width: 260,
      margin: 2,
      color: {
        dark: '#0a0a0c',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((dataUri) => {
        if (!isCancelled) {
          setQrDataUrl(dataUri);
          setQrGenerating(false);
        }
      })
      .catch((err) => {
        console.error('Ошибка создания динамического QR-кода:', err);
        if (!isCancelled) {
          setQrError('Не удалось создать QR-код');
          setQrGenerating(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [getPhoneConnectUrl, selectedQrSlot]);

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

      {/* ПАНЕЛЬ ПЕРЕКЛЮЧЕНИЯ РАСКЛАДКИ РАБОЧЕЙ ОБЛАСТИ (СТУДИЙНЫЙ 50/50 / ФОКУС НА КАМЕРЕ) */}
      <div className="mocap-layout-toolbar">
        <div className="layout-btn-group">
          <button
            type="button"
            className={`layout-pill ${workspaceLayout === 'split' ? 'active' : ''}`}
            onClick={() => setWorkspaceLayout('split')}
            title="Студийный режим Karate Motion Studio: 50% 3D Додзё, 50% Камера"
          >
            ⚖️ Студия (50 / 50)
          </button>
          <button
            type="button"
            className={`layout-pill ${workspaceLayout === 'camFocus' ? 'active' : ''}`}
            onClick={() => setWorkspaceLayout('camFocus')}
            title="Фокус на камере: 70% ширина видоискателя для кадрирования бойца во весь рост"
          >
            📱 Фокус: Камера (70%)
          </button>
          <button
            type="button"
            className={`layout-pill ${workspaceLayout === 'dojoFocus' ? 'active' : ''}`}
            onClick={() => setWorkspaceLayout('dojoFocus')}
            title="Фокус на 3D Додзё: детальный 3D-разбор движений мастера"
          >
            🥋 Фокус: 3D Додзё
          </button>
          <button
            type="button"
            className={`layout-pill ${isViewfinderFullscreen ? 'active' : ''}`}
            onClick={() => setIsViewfinderFullscreen(!isViewfinderFullscreen)}
            title="Полноэкранный видоискатель для съемки с расстояния 2-3 метра"
          >
            {isViewfinderFullscreen ? '✖ Свернуть видоискатель' : '⛶ Во весь экран'}
          </button>
        </div>
      </div>

      <div className={`mocap-workspace layout-${workspaceLayout}`}>
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
                poseDataRef={latestPoseRef}
                mirrorMode={mirrorMode}
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

              {/* Переключатель зеркального отображения движений */}
              <button
                type="button"
                className={`hud-mode-pill ${mirrorMode ? 'is-active' : ''}`}
                onClick={() => setMirrorMode((m) => !m)}
                title="Переключить режим отражения аватара (зеркало Додзё)"
              >
                {mirrorMode ? '🪞 Зеркало (Вкл)' : '🎯 Прямой режим'}
              </button>
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

              {/* Индикатор и переключатель слияния камер (1, 2 или 3 смартфона) */}
              <div className="multi-cam-fusion-bar">
                <div className="fusion-status-badge">
                  <span className="fusion-status-text">
                    {activePhoneCount === 1
                      ? '🟢 1 камера (Моно-захват)'
                      : activePhoneCount === 2
                      ? '⚡ 2 камеры (Стерео 3D-триангуляция)'
                      : activePhoneCount === 3
                      ? '🔥 3 камеры (Полный MoCap 360°)'
                      : '⚪ Ожидание подключения'}
                  </span>
                </div>
                <label className="fusion-toggle-label">
                  <input
                    type="checkbox"
                    checked={multiCameraFusion}
                    onChange={(e) => setMultiCameraFusion(e.target.checked)}
                  />
                  <span>Авто-триангуляция и слияние глубины Z</span>
                </label>
              </div>
            </div>
          )}

          <div className={`viewfinder-card ${isViewfinderFullscreen ? 'is-fullscreen' : ''}`}>
            <div className="viewfinder-header">
              <div className="viewfinder-title">
                <span className={`status-dot ${cameraActive ? (bodyDetected ? 'online' : 'standby') : 'offline'}`} />
                <span>
                  {sourceMode === 'webcam'
                    ? 'Веб-камера компьютера'
                    : `Камера #${activeCameraSlot} · ${
                        activeCameraSlot === 1 ? 'Фронт (0°)' : activeCameraSlot === 2 ? 'Бок (90°)' : 'Угол (45°)'
                      }`}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--gold)',
                    background: 'rgba(0,0,0,0.5)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid rgba(212,162,76,0.3)',
                    fontFamily: 'monospace',
                  }}
                >
                  {streamResolution.width}×{streamResolution.height}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setIsViewfinderFullscreen((f) => !f)}
                  title={isViewfinderFullscreen ? 'Выйти из полноэкранного режима' : 'Развернуть видоискатель во весь экран'}
                  style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                >
                  {isViewfinderFullscreen ? '✖ Свернуть' : '⛶ Во весь экран'}
                </button>

                {sourceMode === 'phone' && (
                  <button
                    type="button"
                    className="btn btn-sm btn-gold"
                    onClick={() => setShowQrModal(true)}
                  >
                    📱 QR-код
                  </button>
                )}
              </div>
            </div>

            {/* Видеопотоки и наложение неонового холста: точное соотношение 1:1 без обрезки */}
            <div className="viewfinder-media">
              <div
                className="viewfinder-stream-wrapper"
                style={{ aspectRatio: streamAspect }}
              >
                {/* Локальная веб-камера */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  onLoadedMetadata={(e) => updateStreamDimensions(e.target)}
                  onResize={(e) => updateStreamDimensions(e.target)}
                  className={`viewfinder-video ${sourceMode === 'webcam' ? 'active' : 'hidden'}`}
                />

                {/* Видеопоток телефона 1 (Фронт) */}
                <video
                  ref={phoneVideo1Ref}
                  playsInline
                  autoPlay
                  muted
                  onLoadedMetadata={(e) => updateStreamDimensions(e.target)}
                  onResize={(e) => updateStreamDimensions(e.target)}
                  className={`viewfinder-video ${sourceMode === 'phone' && activeCameraSlot === 1 ? 'active' : 'hidden'}`}
                />

                {/* Видеопоток телефона 2 (Бок 90°) */}
                <video
                  ref={phoneVideo2Ref}
                  playsInline
                  autoPlay
                  muted
                  onLoadedMetadata={(e) => updateStreamDimensions(e.target)}
                  onResize={(e) => updateStreamDimensions(e.target)}
                  className={`viewfinder-video ${sourceMode === 'phone' && activeCameraSlot === 2 ? 'active' : 'hidden'}`}
                />

                {/* Видеопоток телефона 3 (Угол 45°) */}
                <video
                  ref={phoneVideo3Ref}
                  playsInline
                  autoPlay
                  muted
                  onLoadedMetadata={(e) => updateStreamDimensions(e.target)}
                  onResize={(e) => updateStreamDimensions(e.target)}
                  className={`viewfinder-video ${sourceMode === 'phone' && activeCameraSlot === 3 ? 'active' : 'hidden'}`}
                />

                {/* Холст с неоновым скелетом каратэ — точно совпадающий по пикселям */}
                <canvas
                  ref={canvasRef}
                  width={streamResolution.width}
                  height={streamResolution.height}
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
              Отсканируйте QR-код смартфоном в сети Wi-Fi для мгновенного захвата движений. Доступно до 3 телефонов одновременно.
            </p>

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

            {/* Переключатель протокола: HTTPS шлюз vs Прямой HTTP */}
            <div className="qr-proto-switcher">
              <button
                type="button"
                className={`qr-proto-btn ${useHttpsForPhone ? 'active' : ''}`}
                onClick={() => setUseHttpsForPhone(true)}
              >
                <span className="proto-icon">🔒</span>
                <span className="proto-name">HTTPS (:8443)</span>
                <span className="proto-tag rec">Рекомендуется</span>
              </button>
              <button
                type="button"
                className={`qr-proto-btn ${!useHttpsForPhone ? 'active' : ''}`}
                onClick={() => setUseHttpsForPhone(false)}
              >
                <span className="proto-icon">⚡</span>
                <span className="proto-name">Прямой HTTP (:5173)</span>
                <span className="proto-tag alt">Если SSL блокируется</span>
              </button>
            </div>

            {/* Динамический QR-код, сгенерированный в памяти браузера без внешних серверов */}
            <div className="qr-image-wrap">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR код для подключения ${PHONE_CONFIGS[selectedQrSlot - 1].label}`}
                  className="qr-image"
                />
              ) : (
                <div className="qr-generating-box">
                  <span className="qr-spinner" />
                  <span>{qrError || 'Генерация динамического QR-кода...'}</span>
                </div>
              )}
            </div>

            <div className="qr-room-box">
              <span>Додзё-комната: <strong>{roomId}</strong></span>
              <span className="qr-target-tag">{PHONE_CONFIGS[selectedQrSlot - 1].label}</span>
            </div>

            {/* Инструкция подключения */}
            <div className="qr-guide-box">
              <div className="qr-guide-step">
                <span className="step-badge">1</span>
                <span>Подключите телефон и компьютер к <strong>одной сети Wi-Fi</strong>.</span>
              </div>
              <div className="qr-guide-step">
                <span className="step-badge">2</span>
                <span>Отсканируйте динамический QR-код камерой телефона.</span>
              </div>
              <div className="qr-guide-step">
                <span className="step-badge">3</span>
                <span>
                  {useHttpsForPhone ? (
                    <>При первом открытии по HTTPS нажмите <strong>«Дополнительно» ➔ «Перейти на сайт (небезопасно)»</strong> для подтверждения локального сертификата. Камера включится сразу!</>
                  ) : (
                    <>Разрешите доступ к камере в браузере мобильного устройства.</>
                  )}
                </span>
              </div>
            </div>

            {availableIps.length > 0 && (
              <div className="qr-adapter-row">
                <span className="qr-adapter-label">IP компьютера в сети:</span>
                {availableIps.map((adapter) => (
                  <button
                    key={adapter.ip}
                    type="button"
                    className={`btn btn-xs ${networkHost === adapter.ip ? 'btn-gold' : 'btn-subtle'}`}
                    onClick={() => {
                      setNetworkHost(adapter.ip);
                      setHttpsGatewayUrl(`https://${adapter.ip}:8443`);
                    }}
                    title={`Выбрать IP ${adapter.ip}`}
                  >
                    {adapter.isPrimary ? '★ ' : ''}{adapter.name}: {adapter.ip}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
