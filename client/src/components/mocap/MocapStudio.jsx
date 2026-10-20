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
  retargetSkeleton3DToMasterAvatar,
  drawNeonKarateSkeleton,
  build3DSkeletonData,
  fuseMultiCameraLandmarks,
  resetMocapFilters,
  extractHandBiomechanics,
  estimateHeadOrientation,
  processOfflineVideo,
  exportCaptureJson,
  exportRetargetedJson,
  parseBunkaiMocapJson,
  calibrateCameraFromPose,
  sharedMultiCameraEngine,
  NetworkPlayoutJitterBuffer,
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
  // Режим источника: 'phone' (до 3 смартфонов) | 'webcam' (камера ПК) | 'video' (Режим A: оффлайн видеофайл)
  const [sourceMode, setSourceMode] = useState('phone');
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  // Раскладка рабочей области: 'split' (50/50), 'camFocus' (70/30), 'dojoFocus' (30/70)
  const [workspaceLayout, setWorkspaceLayout] = useState('split');
  const [isViewfinderFullscreen, setIsViewfinderFullscreen] = useState(false);

  // Параметры видеопотока для точного 1:1 наложения холста на видео
  const [streamAspect, setStreamAspect] = useState('16 / 9');
  const [streamResolution, setStreamResolution] = useState({ width: 1280, height: 720 });

  // Состояние WebRTC и подключения смартфонов (до 3 телефонов)
  const [roomId, setRoomId] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.get('room') || 'MOCAP-DOJO';
    }
    return 'MOCAP-DOJO';
  });
  const [connectedCameras, setConnectedCameras] = useState([]); // [{ peerId, slot, label }]
  const [activeCameraSlot, setActiveCameraSlot] = useState(1); // 1, 2, 3 или 'fusion'
  const [multiCameraFusion, setMultiCameraFusion] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedQrSlot, setSelectedQrSlot] = useState(1);

  // Сетевой IP и QR-код для телефона
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

  // 3D-модель костей и повороты суставов для Three.js
  const [skeleton3DData, setSkeleton3DData] = useState(null);
  const [boneRotations, setBoneRotations] = useState(null);
  const [mirrorMode, setMirrorMode] = useState(true);
  const latestPoseRef = useRef(null);

  // ==========================================================================
  // РЕЖИМ A: ОФФЛАЙН АНАЛИЗ ВИДЕОФАЙЛОВ И ТАЙМЛАЙН
  // ==========================================================================
  const [offlineVideoFile, setOfflineVideoFile] = useState(null);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [videoProcessProgress, setVideoProcessProgress] = useState(0);
  const [videoProcessStatus, setVideoProcessStatus] = useState('');
  const [playbackFrames, setPlaybackFrames] = useState([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const playbackTimerRef = useRef(null);
  const videoInputRef = useRef(null);
  const jsonInputRef = useRef(null);

  // ==========================================================================
  // МНОГОПОЛЬЗОВАТЕЛЬСКИЙ РЕЖИМ (БУНКАЙ / СПАРИНГ): ТОРИ И УКЭ
  // ==========================================================================
  const [performerMode, setPerformerMode] = useState('tori'); // 'tori' | 'uke' | 'dual'

  // ==========================================================================
  // КАЛИБРОВКА КАМЕР И ТОЧНАЯ ПОДСТРОЙКА
  // ==========================================================================
  const [calibrationActive, setCalibrationActive] = useState(false);
  const [calibrationMessage, setCalibrationMessage] = useState(null);
  const [rootYOffset, setRootYOffset] = useState(0.0);
  const [headPitchOffset, setHeadPitchOffset] = useState(0.0);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [multiCamStats, setMultiCamStats] = useState({
    mode: 'monocular',
    activeCount: 1,
    syncHealth: 'perfect',
    driftMs: 0,
    reprojErr: 0,
  });
  const jitterBufferRef = useRef(null);
  if (!jitterBufferRef.current) {
    jitterBufferRef.current = new NetworkPlayoutJitterBuffer(60);
  }
  const [networkTelemetry, setNetworkTelemetry] = useState({
    renderFps: 60,
    packetRate: 30,
    jitterMs: 0,
    latencyMs: 60,
    packetLossCount: 0,
    trackingLost: false,
  });

  // Запись сессии MoCap
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedFrames, setRecordedFrames] = useState([]);

  const activeCameraSlotRef = useRef(activeCameraSlot);
  useEffect(() => { activeCameraSlotRef.current = activeCameraSlot; }, [activeCameraSlot]);
  const isRecordingRef = useRef(isRecording);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  const recordedFramesRef = useRef(recordedFrames);
  useEffect(() => { recordedFramesRef.current = recordedFrames; }, [recordedFrames]);

  // Ссылки на элементы DOM и WebRTC
  const videoRef = useRef(null);
  const phoneVideo1Ref = useRef(null);
  const phoneVideo2Ref = useRef(null);
  const phoneVideo3Ref = useRef(null);
  const canvasRef = useRef(null);

  const localStreamRef = useRef(null);
  const socketRef = useRef(null);
  const peersRef = useRef(new Map());
  const phoneStreamsRef = useRef(new Map());
  const latestLandmarksBySlot = useRef({});
  const processingSlotRef = useRef(1);
  const cameraCycleIndexRef = useRef(0);

  const poseInstanceRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const recordTimerRef = useRef(null);

  // Запрос сетевых адаптеров
  const fetchTunnelStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/mocap/tunnel');
      if (res.ok) {
        const json = await res.json();
        if (json?.data?.localIp) {
          setNetworkHost(json.data.localIp);
        }
        if (Array.isArray(json?.data?.localIps) && json.data.localIps.length > 0) {
          setAvailableIps(json.data.localIps);
        }
      }
    } catch (e) {
      console.warn('Не удалось запросить статус сети:', e);
    }
  }, []);

  useEffect(() => {
    fetchTunnelStatus();
  }, [fetchTunnelStatus]);

  // 1. Инициализация MediaPipe Pose
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

  // 2. Обработка результатов компьютерного зрения
  const onPoseResults = useCallback((results) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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

      latestLandmarksBySlot.current[currentSlot] = {
        landmarks: results.poseLandmarks,
        worldLandmarks: results.poseWorldLandmarks,
        slot: currentSlot,
        timestamp: Date.now(),
      };

      const now = Date.now();
      for (const s of Object.keys(latestLandmarksBySlot.current)) {
        if (now - (latestLandmarksBySlot.current[s]?.timestamp || 0) > 2500) {
          delete latestLandmarksBySlot.current[s];
        }
      }

      // Стереоскопическое слияние камер (1..3 камеры)
      const fused = fuseMultiCameraLandmarks(latestLandmarksBySlot.current, now);
      if (fused) {
        setMultiCamStats({
          mode: fused.cameraMode || 'single',
          activeCount: fused.activeCameras?.length || 1,
          syncHealth: fused.syncHealth || 'perfect',
          driftMs: fused.maxDriftMs || 0,
          reprojErr: fused.reprojectionErrorAvg || 0,
        });
      }
      const finalLandmarks = fused?.landmarks || results.poseLandmarks;
      const finalWorldLandmarks = fused?.worldLandmarks || results.poseWorldLandmarks;

      // Биомеханический анализ каратэ
      const metrics = analyzeKarateBiomechanics(finalLandmarks, finalWorldLandmarks);
      setKarateMetrics(metrics);

      // Биомеханика кистей и пальцев + ориентация головы
      const fingers = extractHandBiomechanics(finalLandmarks, finalWorldLandmarks);
      const head = estimateHeadOrientation(finalLandmarks, finalWorldLandmarks);

      // Наложение неонового скелета каратэ на видоискатель
      ctx.clearRect(0, 0, w, h);
      const displayLandmarks = (latestLandmarksBySlot.current[activeCameraSlot]?.landmarks) || finalLandmarks;
      drawNeonKarateSkeleton(ctx, displayLandmarks, w, h, metrics);

      const s3d = build3DSkeletonData(finalWorldLandmarks, finalLandmarks, { scale: 1.35 });
      if (s3d) setSkeleton3DData(s3d);

      const retargeted = retargetSkeleton3DToMasterAvatar(s3d, finalWorldLandmarks, finalLandmarks);
      if (retargeted) setBoneRotations(retargeted.bones);

      // Сохраняем актуальную позу для прямого ретаргетинга 3D-аватара (60 FPS)
      latestPoseRef.current = {
        landmarks: finalLandmarks,
        worldLandmarks: finalWorldLandmarks,
        fingers,
        head,
      };

      if (isRecording) {
        setRecordedFrames((prev) => [
          ...prev,
          {
            timestamp: Date.now(),
            frame: prev.length,
            landmarks: finalLandmarks,
            worldLandmarks: finalWorldLandmarks,
            fingers,
            head,
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

  // Получение списка веб-камер
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

  // Запуск веб-камеры ПК
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
      console.error('Ошибка веб-камеры:', err);
      setCameraActive(false);
      setCameraError(`Не удалось запустить камеру: ${err.message || 'Ошибка устройства'}`);
    }
  }, [selectedDeviceId]);

  // Остановка веб-камеры
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

  // WebRTC соединение для смартфонов
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

    return peer;
  }, [roomId]);

  // Socket.IO подключение к шлюзу MoCap (/mocap)
  useEffect(() => {
    if (sourceMode !== 'phone') return;

    const socket = io(`${SOCKET_URL}/mocap`, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 20,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('mocap:join-room', { roomId, role: 'host' }, (res) => {
        if (res?.cameras) {
          setConnectedCameras(res.cameras);
        }
      });
    });

    socket.on('mocap:cameras-updated', ({ cameras }) => {
      if (Array.isArray(cameras)) {
        setConnectedCameras(cameras);
        if (cameras.length > 0) {
          if (sourceMode === 'phone') setCameraActive(true);
          if (!cameras.some((c) => c.slot === activeCameraSlot)) {
            setActiveCameraSlot(cameras[0].slot);
          }
        }
      }
    });

    socket.on('mocap:camera-joined', (cameraInfo) => {
      setConnectedCameras((prev) => {
        const filtered = prev.filter((c) => c.slot !== cameraInfo.slot && c.peerId !== cameraInfo.peerId);
        return [...filtered, cameraInfo];
      });
      if (sourceMode === 'phone') setCameraActive(true);
    });

    // Прием потока ключевых точек напрямую от смартфонов (поддержка обоих имён событий)
    const handleIncomingLandmarks = (payload) => {
      try {
        const { slot, landmarks, worldLandmarks, metrics, fingers: incomingFingers, head: incomingHead, hands: incomingHands, trackingLost } = payload || {};
        
        if (payload && jitterBufferRef.current) {
          jitterBufferRef.current.ingestPacket(payload);
          setNetworkTelemetry(jitterBufferRef.current.getTelemetry());
        }

        if (slot && trackingLost) {
          const prev = latestLandmarksBySlot.current[slot];
          if (prev) {
            prev.trackingLost = true;
            // Удержание позы в течение 800мс при временной потере детектора (предотвращает мигание T-pose)
            if (Date.now() - (prev.lastValidTimestamp || prev.timestamp || 0) > 800) {
              delete latestLandmarksBySlot.current[slot];
              if (Object.keys(latestLandmarksBySlot.current).length === 0) {
                setBodyDetected(false);
              }
            }
          }
          return;
        }

        if (slot && landmarks && landmarks.length >= 33) {
          setCameraActive(true);
          setBodyDetected(true);

          latestLandmarksBySlot.current[slot] = {
            landmarks,
            worldLandmarks: worldLandmarks || landmarks,
            slot,
            timestamp: Date.now(),
            lastValidTimestamp: Date.now(),
            fingers: incomingFingers,
            head: incomingHead,
            hands: incomingHands,
            trackingLost: false,
          };

          const now = Date.now();
          for (const s of Object.keys(latestLandmarksBySlot.current)) {
            if (now - (latestLandmarksBySlot.current[s]?.lastValidTimestamp || latestLandmarksBySlot.current[s]?.timestamp || 0) > 2500) {
              delete latestLandmarksBySlot.current[s];
            }
          }

          const fused = fuseMultiCameraLandmarks(latestLandmarksBySlot.current, now);
          if (fused) {
            setMultiCamStats({
              mode: fused.cameraMode || 'single',
              activeCount: fused.activeCameras?.length || 1,
              syncHealth: fused.syncHealth || 'perfect',
              driftMs: fused.maxDriftMs || 0,
              reprojErr: fused.reprojectionErrorAvg || 0,
            });
          }
          const finalLandmarks = fused?.landmarks || landmarks;
          const finalWorldLandmarks = fused?.worldLandmarks || worldLandmarks || landmarks;

          const calculatedMetrics = metrics || analyzeKarateBiomechanics(finalLandmarks, finalWorldLandmarks);
          setKarateMetrics(calculatedMetrics);

          const fingers = fused?.fingers || incomingFingers || extractHandBiomechanics(finalLandmarks, finalWorldLandmarks);
          const head = fused?.head || incomingHead || estimateHeadOrientation(finalLandmarks, finalWorldLandmarks);
          const displayHands = fused?.hands || incomingHands || (latestLandmarksBySlot.current[activeCameraSlotRef.current]?.hands);

          const s3d = build3DSkeletonData(finalWorldLandmarks, finalLandmarks, { scale: 1.35 });
          if (s3d) setSkeleton3DData(s3d);

          const retargeted = retargetSkeleton3DToMasterAvatar(s3d, finalWorldLandmarks, finalLandmarks);
          if (retargeted) setBoneRotations(retargeted.bones);

          latestPoseRef.current = {
            landmarks: finalLandmarks,
            worldLandmarks: finalWorldLandmarks,
            fingers,
            head,
          };

          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            const displayLms = (latestLandmarksBySlot.current[activeCameraSlotRef.current]?.landmarks) || finalLandmarks;
            drawNeonKarateSkeleton(ctx, displayLms, canvas.width, canvas.height, calculatedMetrics, {
              hands: displayHands,
            });
          }

          if (isRecordingRef.current) {
            setRecordedFrames((prev) => [
              ...prev,
              {
                timestamp: Date.now(),
                frame: prev.length,
                landmarks: finalLandmarks,
                worldLandmarks: finalWorldLandmarks,
                fingers,
                head,
                skeleton3D: s3d,
                metrics: calculatedMetrics,
                bones: retargeted?.bones || null,
              },
            ]);
          }
        }
      } catch (err) {
        console.error('Ошибка обработки mocap:landmarks-data:', err);
      }
    };

    socket.on('mocap:landmarks-data', handleIncomingLandmarks);
    socket.on('mocap:landmarks-stream', handleIncomingLandmarks);

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

    socket.on('mocap:candidate', async ({ candidate, senderId }) => {
      try {
        const peer = peersRef.current.get(senderId);
        if (peer && candidate) {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {}
    });

    socket.on('mocap:record-command', ({ action }) => {
      if (action === 'start') setIsRecording(true);
      else if (action === 'stop') setIsRecording(false);
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
        try { peer.close(); } catch (e) {}
      });
      peersRef.current.clear();
    };
  }, [sourceMode, roomId, getOrCreateHostPeer]);

  // Переключение источников
  useEffect(() => {
    if (sourceMode === 'webcam') {
      startWebcam();
    } else {
      stopWebcam();
    }
  }, [sourceMode, startWebcam, stopWebcam]);

  // Цикл захвата кадров и нейросетевого распознавания
  useEffect(() => {
    if (!cameraActive || sourceMode === 'video') return;

    let isProcessing = false;

    const frameLoop = async () => {
      const pose = poseInstanceRef.current;
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
        const target = activeVideos[cameraCycleIndexRef.current % activeVideos.length];
        cameraCycleIndexRef.current = (cameraCycleIndexRef.current + 1) % activeVideos.length;

        try {
          isProcessing = true;
          processingSlotRef.current = target.slot;
          await pose.send({ image: target.video });
        } catch (e) {
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

  // ==========================================================================
  // РЕЖИМ A: ТАЙМЛАЙН И ВОСПРОИЗВЕДЕНИЕ КАДРОВ
  // ==========================================================================
  useEffect(() => {
    if (isPlaying && playbackFrames.length > 0) {
      const intervalMs = (1000 / 30) / playbackSpeed;
      playbackTimerRef.current = setInterval(() => {
        setCurrentFrameIndex((prev) => {
          if (prev >= playbackFrames.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, intervalMs);
    } else {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    }
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, playbackFrames.length, playbackSpeed]);

  // Обновление 3D-аватара при смене кадра таймлайна
  useEffect(() => {
    if ((sourceMode === 'video' || playbackFrames.length > 0) && playbackFrames[currentFrameIndex]) {
      const frame = playbackFrames[currentFrameIndex];
      if (frame.landmarks || frame.worldLandmarks) {
        latestPoseRef.current = {
          landmarks: frame.landmarks,
          worldLandmarks: frame.worldLandmarks,
          fingers: frame.fingers,
          head: frame.head,
          rootPosition: frame.rootPosition,
        };
        setBodyDetected(true);
      }
      if (frame.bones) {
        setBoneRotations(frame.bones);
      }
      if (frame.biomechanics) {
        setKarateMetrics(frame.biomechanics);
      }
    }
  }, [currentFrameIndex, playbackFrames, sourceMode]);

  // Обработка оффлайн видеофайла
  const handleVideoUpload = async (file) => {
    if (!file) return;
    setOfflineVideoFile(file);
    setIsProcessingVideo(true);
    setVideoProcessProgress(0);
    setVideoProcessStatus('Инициализация нейросети MediaPipe Pose...');

    try {
      const result = await processOfflineVideo(file, (progress) => {
        setVideoProcessProgress(progress.percentage);
        setVideoProcessStatus(`Покадровый захват: кадр ${progress.currentFrame} из ${progress.totalFrames} (${progress.percentage}%)`);
      }, { fps: 30 });

      if (result && result.frames && result.frames.length > 0) {
        setPlaybackFrames(result.frames);
        setCurrentFrameIndex(0);
        setIsPlaying(true);
        setVideoProcessStatus(`Готово! Захвачено ${result.frames.length} кадров биомеханики.`);
      }
    } catch (err) {
      console.error('Ошибка анализа видеофайла:', err);
      alert(`Ошибка анализа видеофайла: ${err.message}`);
      setVideoProcessStatus('Ошибка обработки видеофайла');
    } finally {
      setIsProcessingVideo(false);
    }
  };

  // Импорт 3D JSON (bunkai-capture-json или bunkai-retargeted-animation)
  const handleJsonImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const res = parseBunkaiMocapJson(text);
        if (!res.success) {
          alert('Ошибка чтения файла: ' + res.error);
          return;
        }
        const data = res.data;
        if (Array.isArray(data.frames) && data.frames.length > 0) {
          setPlaybackFrames(data.frames);
          setCurrentFrameIndex(0);
          setSourceMode('video');
          setIsPlaying(true);
          alert(`Успешно загружено ${data.frames.length} кадров 3D анимации (${data.technique || data.name || 'каратэ'}).`);
        } else {
          alert('В файле нет кадров анимации.');
        }
      } catch (err) {
        alert('Не удалось разобрать JSON файл: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Экспорт стандартизированного 3D JSON
  const handleExportJson = (format = 'capture') => {
    const framesToExport = (sourceMode === 'video' && playbackFrames.length > 0)
      ? playbackFrames
      : recordedFrames;

    if (framesToExport.length === 0) {
      alert('Нет записанных или обработанных кадров для экспорта.');
      return;
    }

    const projectData = {
      name: offlineVideoFile ? offlineVideoFile.name.replace(/\.[^/.]+$/, '') : `karate_mocap_${Date.now()}`,
      fps: 30.0,
      duration: framesToExport.length / 30.0,
      frameCount: framesToExport.length,
      frames: framesToExport,
    };

    let jsonStr = '';
    let fileName = '';
    if (format === 'retargeted') {
      jsonStr = exportRetargetedJson(projectData);
      fileName = `${projectData.name}_retargeted.json`;
    } else {
      jsonStr = exportCaptureJson(projectData);
      fileName = `${projectData.name}_capture.json`;
    }

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(jsonStr);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', fileName);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setExportModalOpen(false);
  };

  // Калибровка камер
  const handleCalibrateCameras = () => {
    resetMocapFilters();
    setCalibrationActive(true);
    setCalibrationMessage('🎯 Калибровка: примите базовую стойку ожидания (Камаэ / Шидзэнтай)...');

    if (socketRef.current && sourceMode === 'phone') {
      socketRef.current.emit('mocap:calibrate', { roomId });
    }

    const calibResults = [];
    for (const [slotStr, feed] of Object.entries(latestLandmarksBySlot.current)) {
      if (feed?.landmarks && feed.landmarks.length >= 33) {
        const slotNum = Number(slotStr);
        const calibratedCam = calibrateCameraFromPose(slotNum, feed.landmarks, feed.worldLandmarks);
        if (calibratedCam) {
          sharedMultiCameraEngine.setCameraCalibration(slotNum, calibratedCam);
          calibResults.push(`Слот #${slotNum}: невязка ${(calibratedCam.calibrationError * 100).toFixed(1)}%`);
        }
      }
    }

    setTimeout(() => {
      const detailStr = calibResults.length > 0 ? ` [${calibResults.join(' · ')}]` : '';
      setCalibrationMessage(`✅ Калибровка завершена! Камеры согласованы в едином базисе${detailStr}`);
      setTimeout(() => {
        setCalibrationActive(false);
        setCalibrationMessage(null);
      }, 4000);
    }, 1200);
  };

  // Таймер записи
  useEffect(() => {
    if (isRecording) {
      setRecordSeconds(0);
      setRecordedFrames([]);
      if (socketRef.current) {
        socketRef.current.emit('mocap:recording-state', {
          roomId,
          isRecording: true,
          duration: 0,
          frameCount: 0,
        });
      }
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          const nextSec = s + 1;
          if (socketRef.current) {
            socketRef.current.emit('mocap:recording-state', {
              roomId,
              isRecording: true,
              duration: nextSec,
              frameCount: recordedFramesRef.current ? recordedFramesRef.current.length : 0,
            });
          }
          return nextSec;
        });
      }, 1000);
    } else {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (socketRef.current) {
        socketRef.current.emit('mocap:recording-state', {
          roomId,
          isRecording: false,
          duration: 0,
          frameCount: recordedFramesRef.current ? recordedFramesRef.current.length : 0,
        });
      }
    }
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, [isRecording, roomId]);

  const getPhoneConnectUrl = useCallback((slotNum = selectedQrSlot) => {
    const host = networkHost || '192.168.100.6';
    if (useHttpsForPhone) {
      const port = networkPort || '8443';
      return `https://${host}:${port}/phone-camera?room=${roomId}&slot=${slotNum}`;
    }
    return `http://${host}:5173/phone-camera?room=${roomId}&slot=${slotNum}`;
  }, [networkHost, networkPort, useHttpsForPhone, roomId, selectedQrSlot]);

  // Генерация динамического QR-кода
  useEffect(() => {
    let isCancelled = false;
    const url = getPhoneConnectUrl(selectedQrSlot);
    setQrGenerating(true);
    setQrError(null);

    QRCode.toDataURL(url, {
      width: 260,
      margin: 2,
      color: { dark: '#0a0a0c', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((dataUri) => {
        if (!isCancelled) {
          setQrDataUrl(dataUri);
          setQrGenerating(false);
        }
      })
      .catch((err) => {
        console.error('Ошибка QR-кода:', err);
        if (!isCancelled) {
          setQrError('Не удалось создать QR-код');
          setQrGenerating(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [getPhoneConnectUrl, selectedQrSlot]);

  return (
    <div className="mocap-studio">
      {/* 1. ШАПКА AIMOKAP ДОДЗЁ */}
      <header className="mocap-header">
        <div className="mocap-title-group">
          <div className="mocap-kanji-stamp">捕</div>
          <div>
            <h2 className="mocap-title">AI MoCap Додзё (Aimokap)</h2>
            <p className="mocap-subtitle">
              Захват 3D-движений Шотокан · Режим A (Видео) & Режим B (1-3 Камеры) · Бункай спаринг (Тори + Укэ)
            </p>
          </div>
        </div>

        {/* Выбор режима источника: Видеофайл (A), Смартфоны (B1), Веб-камера (B2) */}
        <div className="mocap-header-controls">
          <div className="mocap-source-switcher">
            <button
              type="button"
              className={`source-tab-btn ${sourceMode === 'video' ? 'active' : ''}`}
              onClick={() => setSourceMode('video')}
            >
              🎬 Видеофайл (Режим A)
            </button>
            <button
              type="button"
              className={`source-tab-btn ${sourceMode === 'phone' ? 'active' : ''}`}
              onClick={() => setSourceMode('phone')}
            >
              📱 Смартфоны (до 3 шт)
            </button>
            <button
              type="button"
              className={`source-tab-btn ${sourceMode === 'webcam' ? 'active' : ''}`}
              onClick={() => setSourceMode('webcam')}
            >
              📹 Веб-камера ПК
            </button>
          </div>
        </div>
      </header>

      {/* Сообщения калибровки и алерты */}
      {calibrationMessage && (
        <div className="mocap-alert mocap-alert--info">
          <span>{calibrationMessage}</span>
        </div>
      )}

      {cameraError && (
        <div className="mocap-alert mocap-alert--error">
          <span>⚠️ {cameraError}</span>
          <button type="button" className="btn btn-sm btn-subtle" onClick={() => setCameraError(null)}>
            Закрыть
          </button>
        </div>
      )}

      {/* 2. ПАНЕЛЬ ПЕРЕКЛЮЧЕНИЯ РАСКЛАДКИ РАБОЧЕЙ ОБЛАСТИ */}
      <div className="mocap-layout-toolbar">
        <div className="layout-btn-group">
          <button
            type="button"
            className={`layout-pill ${workspaceLayout === 'split' ? 'active' : ''}`}
            onClick={() => setWorkspaceLayout('split')}
            title="Сбалансированный вид: 3D Додзё и видео видоискателя 50/50"
          >
            ⚖️ Баланс (50/50)
          </button>
          <button
            type="button"
            className={`layout-pill ${workspaceLayout === 'camFocus' ? 'active' : ''}`}
            onClick={() => setWorkspaceLayout('camFocus')}
            title="Фокус на камере: увеличенный видоискатель для точной калибровки стоек"
          >
            📹 Фокус: Камера
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

      {/* 2. РАБОЧАЯ ОБЛАСТЬ: 3D ДОДЗЁ + ВИДОИСКАТЕЛЬ/ТАЙМЛАЙН */}
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

              {sourceMode === 'phone' && (
                <div className="hud-badge telemetry" title={`Джиттер: ±${networkTelemetry.jitterMs}мс, сетевая задержка: ${networkTelemetry.latencyMs}мс`}>
                  <span className="hud-badge__jp">同期 · Синхронизация</span>
                  <strong className="hud-badge__val">
                    {networkTelemetry.renderFps} FPS · {networkTelemetry.latencyMs}мс (±{networkTelemetry.jitterMs}мс)
                  </strong>
                </div>
              )}

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

        {/* ПРАВАЯ КОЛОНКА: РЕЖИМ A (ВИДЕО) ИЛИ РЕЖИМ B (КАМЕРЫ) */}
        <aside className="mocap-viewfinder-panel">
          <div className="viewfinder-inner">
            {/* РЕЖИМ A: ОФФЛАЙН АНАЛИЗ ВИДЕОФАЙЛА */}
            {sourceMode === 'video' ? (
              <div className="video-mode-container">
                <div className="video-dropzone-header">
                  <h3>🎬 Покадровый анализ видеозаписи каратэ (Режим A)</h3>
                  <p>Загрузите видеофайл техники (ката, кихон, бункай) для покадрового захвата движений.</p>
                </div>

                {isProcessingVideo ? (
                  <div className="video-processing-card">
                    <div className="processing-spinner" />
                    <h4>Обработка нейросетью MediaPipe Pose...</h4>
                    <div className="processing-bar-wrap">
                      <div className="processing-bar-fill" style={{ width: `${videoProcessProgress}%` }} />
                    </div>
                    <span className="processing-text">{videoProcessStatus}</span>
                  </div>
                ) : playbackFrames.length > 0 ? (
                  <div className="video-playback-card">
                    <div className="timeline-viewfinder-preview">
                      <div className="timeline-meta-badge">
                        <span>Кадр: <strong>{currentFrameIndex + 1}</strong> / {playbackFrames.length}</span>
                        <span>Время: <strong>{(currentFrameIndex / 30).toFixed(2)}</strong> сек</span>
                      </div>
                    </div>

                    {/* Интерактивный таймлайн-скруббер */}
                    <div className="mocap-timeline-box">
                      <div className="timeline-slider-wrap">
                        <input
                          type="range"
                          min="0"
                          max={Math.max(0, playbackFrames.length - 1)}
                          value={currentFrameIndex}
                          onChange={(e) => {
                            setIsPlaying(false);
                            setCurrentFrameIndex(parseInt(e.target.value, 10));
                          }}
                          className="timeline-range-slider"
                        />
                      </div>

                      <div className="timeline-controls-row">
                        <div className="timeline-btn-group">
                          <button
                            type="button"
                            className="btn btn-sm btn-subtle"
                            onClick={() => {
                              setIsPlaying(false);
                              setCurrentFrameIndex((prev) => Math.max(0, prev - 1));
                            }}
                            title="Предыдущий кадр"
                          >
                            ◀ -1 кадр
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${isPlaying ? 'btn-danger' : 'btn-gold'}`}
                            onClick={() => setIsPlaying((p) => !p)}
                          >
                            {isPlaying ? '⏸ Пауза' : '▶ Воспроизведение'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-subtle"
                            onClick={() => {
                              setIsPlaying(false);
                              setCurrentFrameIndex((prev) => Math.min(playbackFrames.length - 1, prev + 1));
                            }}
                            title="Следующий кадр"
                          >
                            +1 кадр ▶
                          </button>
                        </div>

                        {/* Скорость воспроизведения */}
                        <div className="playback-speed-pills">
                          {[0.25, 0.5, 1.0].map((spd) => (
                            <button
                              key={spd}
                              type="button"
                              className={`speed-pill ${playbackSpeed === spd ? 'active' : ''}`}
                              onClick={() => setPlaybackSpeed(spd)}
                            >
                              {spd}x
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="video-dropzone"
                    onClick={() => videoInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files?.[0]) handleVideoUpload(e.dataTransfer.files[0]);
                    }}
                  >
                    <span className="dropzone-icon">📥</span>
                    <h4>Перетащите видеофайл сюда или нажмите для выбора</h4>
                    <p>Поддерживаются форматы MP4, WebM, MOV с четким видом бойца</p>
                    <button type="button" className="btn btn-gold btn-sm">
                      Выбрать видеофайл
                    </button>
                  </div>
                )}

                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleVideoUpload(e.target.files[0]);
                  }}
                />
              </div>
            ) : (
              /* РЕЖИМ B: ОНЛАЙН ЗАХВАТ С КАМЕР (СМАРТФОНЫ ИЛИ ВЕБ-КАМЕРА) */
              <>
                <div className="viewfinder-topbar">
                  <div className="viewfinder-status-badge">
                    <span className={`status-led ${cameraActive && bodyDetected ? 'online' : 'seeking'}`} />
                    <span className="status-label">
                      {!cameraActive
                        ? 'Камера выключена'
                        : bodyDetected
                        ? multiCamStats.activeCount >= 2
                          ? `🎯 Мульти-захват (${multiCamStats.activeCount} кам. · ${multiCamStats.syncHealth === 'perfect' ? 'Синхронно' : `Дрейф ${multiCamStats.driftMs}мс`})`
                          : `3D Захват (${sourceMode === 'phone' ? `Слот #${activeCameraSlot}` : 'Веб-камера'})`
                        : 'Поиск бойца в кадре...'}
                    </span>
                  </div>

                  <div className="viewfinder-topbar-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-subtle"
                      onClick={handleCalibrateCameras}
                      disabled={calibrationActive}
                      title="Сброс сенсорного шума и привязка к базовой стойке Камаэ"
                    >
                      🎯 Калибровка
                    </button>
                    {sourceMode === 'phone' && (
                      <button
                        type="button"
                        className="btn btn-sm btn-gold"
                        onClick={() => setShowQrModal(true)}
                      >
                        📱 QR-код ({connectedCameras.length}/3)
                      </button>
                    )}
                  </div>
                </div>

                {/* Селектор активных камер смартфонов (до 3 устройств) */}
                {sourceMode === 'phone' && (
                  <div className="cam-slots-bar">
                    {PHONE_CONFIGS.map((cfg) => {
                      const isConnected = connectedCameras.some((c) => c.slot === cfg.slot);
                      const isSelected = activeCameraSlot === cfg.slot;
                      const feed = latestLandmarksBySlot.current[cfg.slot];
                      const hasRecentData = feed && (Date.now() - (feed.timestamp || 0) < 1800);
                      const isTrackingLost = feed?.trackingLost;

                      let statusText = '⚪ Ожидание';
                      let statusClass = 'is-empty';
                      if (isConnected) {
                        if (isTrackingLost) {
                          statusText = '⚠️ Вне кадра';
                          statusClass = 'is-warning';
                        } else if (hasRecentData) {
                          statusText = '🟢 В эфире (30 FPS)';
                          statusClass = 'is-connected';
                        } else {
                          statusText = '🟡 Подключен';
                          statusClass = 'is-idle';
                        }
                      }

                      return (
                        <div
                          key={cfg.slot}
                          className={`cam-slot-card ${isSelected ? 'is-selected' : ''} ${statusClass}`}
                          onClick={() => setActiveCameraSlot(cfg.slot)}
                          title={`Камера #${cfg.slot}: ${cfg.desc}`}
                        >
                          <div className="slot-card-header">
                            <span className="slot-card-num">#{cfg.slot}</span>
                            <span className="slot-card-angle">{cfg.angle}</span>
                          </div>
                          <span className="slot-card-name">{cfg.slot === 1 ? 'Фронт (0°)' : cfg.slot === 2 ? 'Бок (90°)' : 'Угол (45°)'}</span>
                          <span className="slot-card-status">{statusText}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Видеопоток и пиксельное наложение неонового скелета */}
                <div className="viewfinder-media">
                  <div className="viewfinder-stream-wrapper" style={{ aspectRatio: streamAspect }}>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      onLoadedMetadata={(e) => updateStreamDimensions(e.target)}
                      className={`viewfinder-video ${sourceMode === 'webcam' ? 'active' : 'hidden'}`}
                    />
                    <video
                      ref={phoneVideo1Ref}
                      playsInline
                      autoPlay
                      muted
                      onLoadedMetadata={(e) => updateStreamDimensions(e.target)}
                      className={`viewfinder-video ${sourceMode === 'phone' && activeCameraSlot === 1 ? 'active' : 'hidden'}`}
                    />
                    <video
                      ref={phoneVideo2Ref}
                      playsInline
                      autoPlay
                      muted
                      onLoadedMetadata={(e) => updateStreamDimensions(e.target)}
                      className={`viewfinder-video ${sourceMode === 'phone' && activeCameraSlot === 2 ? 'active' : 'hidden'}`}
                    />
                    <video
                      ref={phoneVideo3Ref}
                      playsInline
                      autoPlay
                      muted
                      onLoadedMetadata={(e) => updateStreamDimensions(e.target)}
                      className={`viewfinder-video ${sourceMode === 'phone' && activeCameraSlot === 3 ? 'active' : 'hidden'}`}
                    />
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
                            <p>Веб-камера выключена</p>
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
              </>
            )}

            {/* ТЕЛЕМЕТРИЯ СУСТАВОВ И УГЛОВ */}
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

            {/* РУЧНЫЕ ПОДСТРОЙКИ БИОМЕХАНИКИ */}
            <div className="biomechanics-tuning-box">
              <div className="tuning-row">
                <span className="tuning-label">Высота таза (Root Y): {(rootYOffset).toFixed(2)}м</span>
                <input
                  type="range"
                  min="-0.25"
                  max="0.25"
                  step="0.01"
                  value={rootYOffset}
                  onChange={(e) => setRootYOffset(parseFloat(e.target.value))}
                  className="tuning-slider"
                />
              </div>
            </div>

            {/* КНОПКИ ЗАПИСИ И ЭКСПОРТА 3D JSON */}
            <div className="mocap-recorder-box">
              <div className="recorder-status">
                {isRecording ? (
                  <span className="rec-active">
                    <span className="rec-dot" /> Запись 3D: {recordSeconds} сек ({recordedFrames.length} кадров)
                  </span>
                ) : (
                  <span className="rec-idle">
                    {sourceMode === 'video'
                      ? `Загружено: ${playbackFrames.length} кадров биомеханики`
                      : recordedFrames.length > 0
                      ? `Записано: ${recordedFrames.length} 3D-кадров`
                      : 'Готов к захвату движений'}
                  </span>
                )}
              </div>

              <div className="recorder-actions">
                {sourceMode !== 'video' && (
                  !isRecording ? (
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
                  )
                )}

                {(recordedFrames.length > 0 || playbackFrames.length > 0) && !isRecording && (
                  <div className="export-btn-group">
                    <button
                      type="button"
                      className="btn btn-gold"
                      onClick={() => handleExportJson('capture')}
                      title="Экспорт сырых 3D координат суставов и биомеханики"
                    >
                      💾 Экспорт Capture JSON
                    </button>
                    <button
                      type="button"
                      className="btn btn-subtle"
                      onClick={() => handleExportJson('retargeted')}
                      title="Экспорт локальных поворотов костей Karateka_Armature"
                    >
                      💾 Экспорт Retargeted JSON
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-subtle"
                  onClick={() => jsonInputRef.current?.click()}
                  title="Импорт файла bunkai-capture-json или bunkai-retargeted-animation"
                >
                  📂 Загрузить 3D JSON
                </button>
                <input
                  ref={jsonInputRef}
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={handleJsonImport}
                />
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* 3. МОДАЛЬНОЕ ОКНО ПОДКЛЮЧЕНИЯ СМАРТФОНОВ */}
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
              Отсканируйте динамический QR-код камерой смартфона в локальной сети Wi-Fi.
            </p>

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
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR код для ${PHONE_CONFIGS[selectedQrSlot - 1].label}`}
                  className="qr-image"
                />
              ) : (
                <div className="qr-generating-box">
                  <span className="qr-spinner" />
                  <span>{qrError || 'Генерация QR-кода...'}</span>
                </div>
              )}
            </div>

            <div className="qr-room-box">
              <span>Додзё-комната: <strong>{roomId}</strong></span>
              <span className="qr-target-tag">{PHONE_CONFIGS[selectedQrSlot - 1].label}</span>
            </div>

            {/* Выделенный блок прямой ссылки для перехода на телефоне */}
            <div className="qr-direct-link-card">
              <div className="direct-link-header">
                <span className="direct-link-badge">
                  {useHttpsForPhone ? '🔒 HTTPS ШЛЮЗ (SSL)' : '🌐 HTTP ПРЯМОЙ'}
                </span>
                <span className="direct-link-hint">Порт: {useHttpsForPhone ? networkPort : '5173'}</span>
              </div>
              <div className="direct-link-url-box">
                <a
                  href={getPhoneConnectUrl(selectedQrSlot)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="direct-link-anchor"
                >
                  {getPhoneConnectUrl(selectedQrSlot)}
                </a>
              </div>
              <div className="direct-link-btn-row">
                <button
                  type="button"
                  className="btn btn-sm btn-gold direct-link-copy-btn"
                  onClick={() => {
                    const url = getPhoneConnectUrl(selectedQrSlot);
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(url);
                      alert('Ссылка скопирована в буфер обмена:\n' + url);
                    } else {
                      prompt('Скопируйте ссылку:', url);
                    }
                  }}
                >
                  📋 Скопировать ссылку
                </button>
                <a
                  href={getPhoneConnectUrl(selectedQrSlot)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-subtle direct-link-open-btn"
                >
                  ↗ Открыть
                </a>
              </div>
            </div>

            {/* Переключатель режимов подключения (HTTPS / HTTP) */}
            <div className="qr-net-mode-switch">
              <button
                type="button"
                className={`qr-net-mode-btn ${useHttpsForPhone ? 'active' : ''}`}
                style={useHttpsForPhone ? { borderColor: '#d4af37', background: 'rgba(212, 175, 55, 0.18)', color: '#fff' } : {}}
                onClick={() => setUseHttpsForPhone(true)}
              >
                <span>🔒 HTTPS (8443)</span>
                <small style={{ fontSize: '0.72rem', opacity: 0.85 }}>Включает камеру смартфона</small>
              </button>
              <button
                type="button"
                className={`qr-net-mode-btn ${!useHttpsForPhone ? 'active' : ''}`}
                style={!useHttpsForPhone ? { borderColor: '#d4af37', background: 'rgba(212, 175, 55, 0.18)', color: '#fff' } : {}}
                onClick={() => setUseHttpsForPhone(false)}
              >
                <span>🌐 HTTP (5173)</span>
                <small style={{ fontSize: '0.72rem', opacity: 0.85 }}>Прямое подключение к UI</small>
              </button>
            </div>

            {/* Ручной ввод и селектор сетевого IP */}
            <div style={{ width: '100%', marginBottom: '1rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--washi-dim)', whiteSpace: 'nowrap' }}>IP компьютера:</span>
                <input
                  type="text"
                  value={networkHost}
                  onChange={(e) => setNetworkHost(e.target.value.trim())}
                  style={{
                    flex: 1,
                    background: '#0e1015',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: '#fff',
                    fontFamily: 'monospace',
                    fontSize: '0.88rem'
                  }}
                  placeholder="192.168.x.x"
                />
              </div>
              {availableIps.length > 0 && (
                <div className="qr-adapter-row" style={{ marginTop: '4px' }}>
                  {availableIps.map((adapter) => (
                    <button
                      key={adapter.ip}
                      type="button"
                      className={`btn btn-xs ${networkHost === adapter.ip ? 'btn-gold' : 'btn-subtle'}`}
                      onClick={() => setNetworkHost(adapter.ip)}
                      title={`Выбрать IP ${adapter.ip}`}
                    >
                      {adapter.isPrimary ? '★ ' : ''}{adapter.name}: {adapter.ip}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="qr-guide-box">
              <div className="qr-guide-step">
                <span className="step-badge">1</span>
                <span>Подключите телефон и ПК к <strong>одной сети Wi-Fi</strong>.</span>
              </div>
              <div className="qr-guide-step">
                <span className="step-badge">2</span>
                <span>Отсканируйте динамический QR-код камерой телефона.</span>
              </div>
              <div className="qr-guide-step">
                <span className="step-badge">3</span>
                <span>
                  {useHttpsForPhone ? (
                    <>При открытии нажмите <strong>«Дополнительно» ➔ «Перейти на сайт (небезопасно)»</strong>. Камера запустится сразу!</>
                  ) : (
                    <>Разрешите доступ к камере в браузере смартфона.</>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
