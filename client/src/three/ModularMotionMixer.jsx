import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import KaratekaLowpolyModel, {
  synthesizeModularClip,
  registerCustomClip,
} from './KaratekaLowpolyModel';
import TraditionalDojo from './TraditionalDojo';
import {
  loadCustomLayers,
  saveCustomLayer,
  deleteCustomLayer,
  buildClipFromPoseKeyframes,
  buildClipFromRecordedFrames,
} from './customMotionManager';
import {
  loadMediaPipePose,
  mapPoseToAvatarBones,
  calculateAngle3D,
} from '../utils/mocapPoseTracker';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Copy,
  Check,
  Layers,
  Sliders,
  Compass,
  Camera,
  Video,
  Trash2,
  Plus,
  Square,
  Sparkles,
  Save,
  BookOpen,
  Zap,
  Shield,
  Radio,
} from 'lucide-react';
import './modularMotionMixer.css';

// Пресеты нижнего слоя: Стойки и шаги Шотокан (In-Place)
export const MODULAR_STANCE_PRESETS = [
  { id: 'zenkutsu_dachi_left', name: 'Дзэнкуцу-дати (Левая)', type: 'stance', desc: 'Вес 70/30 на передней ноге, колено над пальцами' },
  { id: 'zenkutsu_dachi_right', name: 'Дзэнкуцу-дати (Правая)', type: 'stance', desc: 'Правосторонняя атакующая стойка' },
  { id: 'kokutsu_dachi_left', name: 'Кокуцу-дати (Защитная)', type: 'stance', desc: 'Вес 30/70 на задней ноге, пятки на одной линии' },
  { id: 'kiba_dachi', name: 'Киба-дати (Всадник)', type: 'stance', desc: 'Низкая устойчивая стойка, колени разведены' },
  { id: 'fudo_dachi', name: 'Фудо-дати (Боевая)', type: 'stance', desc: 'Прочная стойка корней дерева (Сотин)' },
  { id: 'idle_shizentai', name: 'Сидзэнтай (Естественная)', type: 'stance', desc: 'Стойка ожидания и готовности Йой' },
  { id: 'step_forward', name: 'Шаг вперед (Аюми-аси)', type: 'movement', desc: 'Плавный перенос центра тяжести вперед' },
  { id: 'heiko_dachi', name: 'Хэйко-дати (Параллельная)', type: 'stance', desc: 'Стопы на ширине плеч параллельно' },
];

// Пресеты верхнего слоя: Техники рук (удары, блоки, секущие)
export const MODULAR_TECHNIQUE_PRESETS = [
  { id: 'tech_gedan_barai_left', name: 'Гэдан-барай (Нижний блок)', type: 'block', desc: 'Смет нападающего удара в пах/живот (Ханми 45°)' },
  { id: 'tech_oi_zuki_right', name: 'Ой-цуки (Прямой выпад)', type: 'punch', desc: 'Мощный прямой удар кулаком на шаге (Сёмен 0°)' },
  { id: 'gyaku_zuki_right', name: 'Гяку-цуки (Реверсивный контрудар)', type: 'punch', desc: 'Удар противоположной от передней ноги рукой с доворотом таза' },
  { id: 'tech_age_uke_left', name: 'Агэ-укэ (Верхний блок)', type: 'block', desc: 'Защита головы и шеи предплечьем снизу вверх' },
  { id: 'tech_soto_uke_left', name: 'Сото-укэ (Блок снаружи-внутрь)', type: 'block', desc: 'Отбивающий блок круговым движением снаружи' },
  { id: 'tech_uchi_uke_left', name: 'Ути-укэ (Блок изнутри-наружу)', type: 'block', desc: 'Выбивание атакующей руки наружу от бедра' },
  { id: 'tech_shuto_uke_left', name: 'Сюто-укэ (Блок ребром ладони)', type: 'block', desc: 'Классическая защита ребром ладони в Кокуцу-дати' },
  { id: 'tech_uraken_right', name: 'Уракэн-ути (Хлесткий тыльный удар)', type: 'strike', desc: 'Хлесткий щелчок тыльной стороной кулака' },
  { id: 'tech_mae_empi_right', name: 'Маэ-эмпи (Удар локтем вперед)', type: 'strike', desc: 'Сокрушающий таранный удар локтем' },
  { id: 'tech_morote_zuki_right', name: 'Моротэ-цуки (Двойной удар)', type: 'punch', desc: 'Синхронный удар обоими кулаками' },
];

// Пресеты разворотов эмбусэн
export const MODULAR_TURN_PRESETS = [
  { deg: 0, label: '0° (Вперед)' },
  { deg: 90, label: '90° (Влево)' },
  { deg: -90, label: '-90° (Вправо)' },
  { deg: 180, label: '180° (Кругом)' },
  { deg: 270, label: '270° (Разворот назад-вправо)' },
];

export default function ModularMotionMixer() {
  // Активный режим студии: 'mixer' | 'recorder' | 'creator' | 'library'
  const [activeTab, setActiveTab] = useState('mixer');

  // Пользовательские сохраненные слои
  const [customLayers, setCustomLayers] = useState(() => loadCustomLayers());

  // Выбранные слои в микшере
  const [selectedStance, setSelectedStance] = useState('zenkutsu_dachi_left');
  const [selectedTechnique, setSelectedTechnique] = useState('tech_gedan_barai_left');
  const [selectedTurn, setSelectedTurn] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [isLooping, setIsLooping] = useState(true);
  const [replayTrigger, setReplayTrigger] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);

  // Тонкая настройка биомеханики слоев (в реальном времени)
  const [layerAdjustments, setLayerAdjustments] = useState({
    hipsHeight: 0, // см (-15 до +10)
    torsoTwist: 0, // градусов (-45 до +45)
  });
  const [isPlayingCreatorAnimation, setIsPlayingCreatorAnimation] = useState(false);

  // При монтировании регистрируем все кастомные слои в глобальном движке Three.js
  useEffect(() => {
    customLayers.forEach((layer) => {
      if (layer.clipJson) {
        try {
          const parsed = THREE.AnimationClip.parse(layer.clipJson);
          registerCustomClip(layer.id, parsed);
        } catch (err) {
          console.warn('Ошибка инициализации кастомного клипа:', err);
        }
      }
    });
  }, [customLayers]);

  // Общий список стоек (стандартные + созданные пользователем)
  const allStances = useMemo(() => {
    const customStances = customLayers
      .filter((l) => l.layerType === 'lower')
      .map((l) => ({
        id: l.id,
        name: l.name,
        type: 'custom',
        desc: `Пользовательская стойка (${l.source === 'camera' ? 'Запись с камеры' : 'Конструктор поз'})`,
      }));
    return [...MODULAR_STANCE_PRESETS, ...customStances];
  }, [customLayers]);

  // Общий список техник (стандартные + созданные пользователем)
  const allTechniques = useMemo(() => {
    const customTechs = customLayers
      .filter((l) => l.layerType === 'upper')
      .map((l) => ({
        id: l.id,
        name: l.name,
        type: 'custom',
        desc: `Пользовательская техника (${l.source === 'camera' ? 'Запись с камеры' : 'Конструктор поз'})`,
      }));
    return [...MODULAR_TECHNIQUE_PRESETS, ...customTechs];
  }, [customLayers]);

  const stanceObj = useMemo(
    () => allStances.find((s) => s.id === selectedStance) || allStances[0],
    [selectedStance, allStances]
  );

  const techObj = useMemo(
    () => allTechniques.find((t) => t.id === selectedTechnique) || allTechniques[0],
    [selectedTechnique, allTechniques]
  );

  const handleReplay = () => {
    setReplayTrigger((prev) => prev + 1);
  };

  const copyKataStepJson = () => {
    const stepCode = {
      description: `${techObj.name} в стойке ${stanceObj.name}`,
      stance: selectedStance,
      technique: selectedTechnique,
      turnAngleDeg: selectedTurn,
      modularExecution: true,
      displacement: [0, 0, selectedStance.includes('step') ? 1.2 : 0],
    };
    navigator.clipboard?.writeText(JSON.stringify(stepCode, null, 2));
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // =========================================================================
  // СОСТОЯНИЕ РЕЖИМА 1: ЗАПИСЬ С КАМЕРЫ (AI MOCAP RECORDER)
  // =========================================================================
  const [recorderLayerType, setRecorderLayerType] = useState('upper'); // 'upper' | 'lower' | 'full'
  const [camActive, setCamActive] = useState(false);
  const [camStatus, setCamStatus] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [recordProgress, setRecordProgress] = useState(0);
  const [newLayerName, setNewLayerName] = useState('');
  const [recordedPreviewClip, setRecordedPreviewClip] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const poseInstanceRef = useRef(null);
  const capturedFramesRef = useRef([]);
  const recordStartRef = useRef(0);
  const animFrameIdRef = useRef(null);

  // Остановка камеры
  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCamActive(false);
    setIsRecording(false);
    setCountdown(0);
    setCamStatus('');
  }, []);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Запуск камеры и подключение MediaPipe Pose
  const startCamera = async () => {
    try {
      setCamStatus('Инициализация веб-камеры и AI нейросети...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCamStatus('Загрузка MediaPipe Pose...');
      const pose = await loadMediaPipePose();
      poseInstanceRef.current = pose;

      pose.onResults((results) => {
        // Отрисовка скелета на канвасе
        const cvs = canvasRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        ctx.clearRect(0, 0, cvs.width, cvs.height);

        const lms = results.poseLandmarks;
        if (lms && lms.length >= 33) {
          // Отрисовка ключевых линий скелета
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 3;

          const connections = [
            [11, 12], [11, 13], [13, 15], // Левая рука
            [12, 14], [14, 16],           // Правая рука
            [11, 23], [12, 24], [23, 24], // Торс
            [23, 25], [25, 27],           // Левая нога
            [24, 26], [26, 28],           // Правая нога
          ];

          for (const [i, j] of connections) {
            const p1 = lms[i];
            const p2 = lms[j];
            if (p1 && p2 && (p1.visibility ?? 1) > 0.4 && (p2.visibility ?? 1) > 0.4) {
              ctx.beginPath();
              ctx.moveTo(p1.x * cvs.width, p1.y * cvs.height);
              ctx.lineTo(p2.x * cvs.width, p2.y * cvs.height);
              ctx.stroke();
            }
          }

          // Точки суставов
          ctx.fillStyle = '#ffd700';
          for (let idx of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
            const pt = lms[idx];
            if (pt && (pt.visibility ?? 1) > 0.4) {
              ctx.beginPath();
              ctx.arc(pt.x * cvs.width, pt.y * cvs.height, 4, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Если идет запись — накапливаем кадры суставов
          if (capturedFramesRef.current && isRecording) {
            const mapped = mapPoseToAvatarBones(lms, results.poseWorldLandmarks || lms);
            if (mapped && mapped.bones) {
              const t = (Date.now() - recordStartRef.current) / 1000;
              capturedFramesRef.current.push({ t, bones: mapped.bones });
            }
          }
        }
      });

      // Цикл передачи кадров в MediaPipe
      const processFrame = async () => {
        if (videoRef.current && videoRef.current.readyState >= 2 && poseInstanceRef.current) {
          try {
            await poseInstanceRef.current.send({ image: videoRef.current });
          } catch {}
        }
        animFrameIdRef.current = requestAnimationFrame(processFrame);
      };

      setCamActive(true);
      setCamStatus('Камера активна. Займите исходную боевую позицию.');
      animFrameIdRef.current = requestAnimationFrame(processFrame);
    } catch (err) {
      console.error('Ошибка активации камеры:', err);
      setCamStatus(`Ошибка доступа к камере: ${err.message || 'Не удалось получить поток'}`);
      setCamActive(false);
    }
  };

  // Старт записи с обратным отсчетом 3.. 2.. 1..
  const triggerRecording = () => {
    setCountdown(3);
    const countTimer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countTimer);
          startActualCapture();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startActualCapture = () => {
    capturedFramesRef.current = [];
    recordStartRef.current = Date.now();
    setIsRecording(true);
    setRecordProgress(0);

    const maxDuration = 4000; // 4 секунды на технику
    const stepInterval = 100;
    let elapsed = 0;

    const progTimer = setInterval(() => {
      elapsed += stepInterval;
      setRecordProgress(Math.min(100, Math.round((elapsed / maxDuration) * 100)));

      if (elapsed >= maxDuration) {
        clearInterval(progTimer);
        stopActualCapture();
      }
    }, stepInterval);
  };

  const stopActualCapture = () => {
    setIsRecording(false);
    const frames = capturedFramesRef.current || [];
    if (frames.length < 5) {
      setCamStatus('Недостаточно кадров для генерации анимации. Попробуйте еще раз.');
      return;
    }

    const totalDur = (Date.now() - recordStartRef.current) / 1000;
    const clipName = `custom_cam_${Date.now()}`;
    const clip = buildClipFromRecordedFrames({
      name: clipName,
      layerType: recorderLayerType,
      recordedFrames: frames,
      totalDuration: totalDur,
    });

    if (clip) {
      registerCustomClip(clipName, clip);
      setRecordedPreviewClip(clip);
      setNewLayerName(`Запись ${recorderLayerType === 'upper' ? 'удара' : 'стойки'} #${frames.length}`);
      setCamStatus(`Запись завершена! Получено ${frames.length} кадров (${totalDur.toFixed(1)}с). Введите название.`);

      // Сразу активируем в 3D для предпросмотра
      if (recorderLayerType === 'upper') {
        setSelectedTechnique(clipName);
      } else {
        setSelectedStance(clipName);
      }
    }
  };

  const handleSaveRecordedLayer = () => {
    if (!recordedPreviewClip) return;
    const layerId = recordedPreviewClip.name;
    const layer = {
      id: layerId,
      name: newLayerName.trim() || `Кастомная техника (${layerId.slice(-4)})`,
      layerType: recorderLayerType,
      source: 'camera',
      duration: recordedPreviewClip.duration,
      createdAt: new Date().toISOString(),
      clipJson: recordedPreviewClip.toJSON(),
    };

    saveCustomLayer(layer);
    setCustomLayers(loadCustomLayers());
    setRecordedPreviewClip(null);
    setCamStatus('Слой сохранен в вашей библиотеке!');
    setActiveTab('mixer');
  };

  // =========================================================================
  // СОСТОЯНИЕ РЕЖИМА 2: ИНТЕРАКТИВНЫЙ КОНСТРУКТОР ПОЗ И ФАЗ
  // =========================================================================
  const [creatorLayerType, setCreatorLayerType] = useState('upper'); // 'upper' | 'lower'
  const [activePhaseIdx, setActivePhaseIdx] = useState(1); // 0: Start, 1: Peak/Impact, 2: Return

  // Ключевые фазы движения
  const [keyframes, setKeyframes] = useState([
    {
      time: 0.0,
      label: '1. Замах / Камаэ',
      pose: {
        hanmiAngle: 30,
        torsoPitch: 0,
        leftShoulderPitch: -20,
        leftShoulderAbduct: 20,
        leftElbowFlex: 90,
        leftForearmTwist: 0,
        rightShoulderPitch: -30,
        rightShoulderAbduct: 15,
        rightElbowFlex: 95,
        rightForearmTwist: 0,
        leftHipPitch: 20,
        leftHipSpread: 10,
        leftKneeFlex: 30,
        rightHipPitch: -15,
        rightHipSpread: 10,
        rightKneeFlex: 20,
        hipsDrop: -10,
      },
    },
    {
      time: 0.5,
      label: '2. Кимэ / Кульминация',
      pose: {
        hanmiAngle: 0,
        torsoPitch: -5,
        leftShoulderPitch: 10,
        leftShoulderAbduct: 15,
        leftElbowFlex: 20,
        leftForearmTwist: 180,
        rightShoulderPitch: -45,
        rightShoulderAbduct: 10,
        rightElbowFlex: 120,
        rightForearmTwist: -90,
        leftHipPitch: 35,
        leftHipSpread: 12,
        leftKneeFlex: 60,
        rightHipPitch: -25,
        rightHipSpread: 12,
        rightKneeFlex: 15,
        hipsDrop: -25,
      },
    },
    {
      time: 1.0,
      label: '3. Фиксация / Дзансин',
      pose: {
        hanmiAngle: 15,
        torsoPitch: 0,
        leftShoulderPitch: 5,
        leftShoulderAbduct: 15,
        leftElbowFlex: 30,
        leftForearmTwist: 180,
        rightShoulderPitch: -40,
        rightShoulderAbduct: 10,
        rightElbowFlex: 110,
        rightForearmTwist: -90,
        leftHipPitch: 30,
        leftHipSpread: 10,
        leftKneeFlex: 50,
        rightHipPitch: -20,
        rightHipSpread: 10,
        rightKneeFlex: 20,
        hipsDrop: -20,
      },
    },
  ]);

  const [creatorClipName, setCreatorClipName] = useState('Мой особый контрудар');

  // Мгновенное обновление слайдера в активной фазе (Live Pose Editing)
  const updateActivePhasePose = (key, val) => {
    if (isPlayingCreatorAnimation) {
      setIsPlayingCreatorAnimation(false);
    }
    const num = parseFloat(val);
    const nextKeyframes = [...keyframes];
    nextKeyframes[activePhaseIdx] = {
      ...nextKeyframes[activePhaseIdx],
      pose: {
        ...nextKeyframes[activePhaseIdx].pose,
        [key]: isNaN(num) ? 0 : num,
      },
    };
    setKeyframes(nextKeyframes);
  };

  // Переключение воспроизведения анимационного теста ключевых кадров
  const handleToggleCreatorAnimation = () => {
    if (isPlayingCreatorAnimation) {
      setIsPlayingCreatorAnimation(false);
    } else {
      const previewName = `creator_test_${Date.now()}`;
      const previewClip = buildClipFromPoseKeyframes({
        name: previewName,
        layerType: creatorLayerType,
        keyframes,
        duration: 1.2,
      });
      if (previewClip) {
        registerCustomClip(previewName, previewClip);
        if (creatorLayerType === 'upper') {
          setSelectedTechnique(previewName);
        } else {
          setSelectedStance(previewName);
        }
        setIsPlayingCreatorAnimation(true);
        setReplayTrigger((prev) => prev + 1);
      }
    }
  };

  // Сброс позы текущей фазы к нейтральным значениям
  const handleResetActivePhasePose = () => {
    setIsPlayingCreatorAnimation(false);
    const nextKeyframes = [...keyframes];
    nextKeyframes[activePhaseIdx] = {
      ...nextKeyframes[activePhaseIdx],
      pose: creatorLayerType === 'upper'
        ? { hanmiAngle: 0, torsoPitch: 0, leftShoulderPitch: 0, leftElbowFlex: 60, rightShoulderPitch: 0, rightElbowFlex: 60 }
        : { hipsDrop: 0, leftKneeFlex: 30, rightKneeFlex: 20 },
    };
    setKeyframes(nextKeyframes);
  };

  const handleSaveCreatedLayer = () => {
    const clipId = `custom_pose_${Date.now()}`;
    const clip = buildClipFromPoseKeyframes({
      name: clipId,
      layerType: creatorLayerType,
      keyframes,
      duration: 1.2,
    });

    if (clip) {
      registerCustomClip(clipId, clip);
      const layer = {
        id: clipId,
        name: creatorClipName.trim() || `Кастомная техника (${clipId.slice(-4)})`,
        layerType: creatorLayerType,
        source: 'creator',
        duration: 1.2,
        createdAt: new Date().toISOString(),
        clipJson: clip.toJSON(),
      };

      saveCustomLayer(layer);
      setCustomLayers(loadCustomLayers());

      if (creatorLayerType === 'upper') {
        setSelectedTechnique(clipId);
      } else {
        setSelectedStance(clipId);
      }
      setIsPlayingCreatorAnimation(false);
      setActiveTab('mixer');
    }
  };

  const currentPose = keyframes[activePhaseIdx]?.pose || {};

  // Удаление кастомного слоя
  const handleDeleteCustomLayer = (id) => {
    deleteCustomLayer(id);
    setCustomLayers(loadCustomLayers());
    if (selectedStance === id) setSelectedStance('zenkutsu_dachi_left');
    if (selectedTechnique === id) setSelectedTechnique('tech_gedan_barai_left');
  };

  // Экспорт JSON слоя
  const handleExportCustomLayerJson = (layer) => {
    const blob = new Blob([JSON.stringify(layer, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${layer.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modular-mixer-container">
      {/* 3D Вьюпорт Додзё */}
      <div className="modular-mixer-viewport">
        <Canvas camera={{ position: [0, 1.35, 3.2], fov: 42 }} shadows>
          <color attach="background" args={['#0e0d0c']} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[4, 6, 3]} intensity={1.3} castShadow shadow-mapSize={1024} />
          <directionalLight position={[-3, 4, -2]} intensity={0.4} color="#ffd4a3" />

          <TraditionalDojo />

          <group position={[0, 0, 0]}>
            <KaratekaLowpolyModel
              role="tori"
              modularLowerClip={selectedStance}
              modularUpperClip={selectedTechnique}
              modularTurn={selectedTurn}
              modularLoop={isLooping}
              speed={speed}
              replayTrigger={replayTrigger}
              layerAdjustments={layerAdjustments}
              creatorPose={activeTab === 'creator' ? currentPose : null}
              creatorLayerType={creatorLayerType}
              isPlayingCreatorAnimation={isPlayingCreatorAnimation}
            />
          </group>

          <ContactShadows position={[0, 0.01, 0]} opacity={0.65} scale={8} blur={1.5} far={4} />
          <OrbitControls
            target={[0, 0.85, 0]}
            maxPolarAngle={Math.PI / 2 - 0.02}
            minDistance={1.2}
            maxDistance={6.0}
            enableDamping
          />
        </Canvas>

        {/* Наложение подсказки */}
        <div className="modular-viewport-badge">
          <Layers size={14} />
          <span>
            Модульный синтез: <strong>{stanceObj.name}</strong> + <strong>{techObj.name}</strong>
          </span>
        </div>
      </div>

      {/* Панель управления модулями и студией */}
      <div className="modular-mixer-controls">
        {/* Вкладки переключения студии */}
        <div className="modular-tabs">
          <button
            type="button"
            className={`modular-tab-btn ${activeTab === 'mixer' ? 'active' : ''}`}
            onClick={() => { setActiveTab('mixer'); setIsPlayingCreatorAnimation(false); }}
          >
            <Sliders size={14} />
            <span>Микшер слоев</span>
          </button>
          <button
            type="button"
            className={`modular-tab-btn ${activeTab === 'recorder' ? 'active' : ''}`}
            onClick={() => { setActiveTab('recorder'); setIsPlayingCreatorAnimation(false); }}
          >
            <Camera size={14} />
            <span>Запись с камеры</span>
          </button>
          <button
            type="button"
            className={`modular-tab-btn ${activeTab === 'creator' ? 'active' : ''}`}
            onClick={() => { setActiveTab('creator'); setIsPlayingCreatorAnimation(false); }}
          >
            <Sparkles size={14} />
            <span>Конструктор поз</span>
          </button>
          <button
            type="button"
            className={`modular-tab-btn ${activeTab === 'library' ? 'active' : ''}`}
            onClick={() => { setActiveTab('library'); setIsPlayingCreatorAnimation(false); }}
          >
            <BookOpen size={14} />
            <span>Мои слои ({customLayers.length})</span>
          </button>
        </div>

        {/* ================================================================= */}
        {/* ВКЛАДКА 1: МИКШЕР СЛОЕВ (СБОРКА ГОТОВЫХ И ПОЛЬЗОВАТЕЛЬСКИХ)       */}
        {/* ================================================================= */}
        {activeTab === 'mixer' && (
          <>
            <div className="modular-controls-header">
              <h3>
                <Sliders size={18} />
                <span>Модульный конструктор Шотокан</span>
              </h3>
              <p className="modular-controls-subtitle">
                Комбинируйте стандартные стойки и техники или подключайте созданные вами слои
              </p>
            </div>

            {/* Секция 1: Нижний слой (Стойка / Перемещение) */}
            <div className="modular-section">
              <label className="modular-section-label">
                <span className="badge-tag badge-tag--lower">НИЖНИЙ СЛОЙ</span>
                <span>Стойка / Шаг (Таз + Ноги In-Place)</span>
              </label>
              <div className="modular-presets-grid">
                {allStances.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`modular-preset-btn ${selectedStance === s.id ? 'active' : ''} ${s.type === 'custom' ? 'modular-preset-btn--custom' : ''}`}
                    onClick={() => setSelectedStance(s.id)}
                    title={s.desc}
                  >
                    <span className="modular-preset-title">{s.name}</span>
                    <span className="modular-preset-type">
                      {s.type === 'custom' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Sparkles size={10} color="var(--gold, #bfa15f)" /> Мой слой
                        </span>
                      ) : s.type === 'movement' ? (
                        'Шаг'
                      ) : (
                        'Стойка'
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Секция 2: Верхний слой (Техника рук / Блок) */}
            <div className="modular-section">
              <label className="modular-section-label">
                <span className="badge-tag badge-tag--upper">ВЕРХНИЙ СЛОЙ</span>
                <span>Техника рук (Удары, Блоки, Скручивание)</span>
              </label>
              <div className="modular-presets-grid">
                {allTechniques.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`modular-preset-btn ${selectedTechnique === t.id ? 'active' : ''} ${t.type === 'custom' ? 'modular-preset-btn--custom' : ''}`}
                    onClick={() => setSelectedTechnique(t.id)}
                    title={t.desc}
                  >
                    <span className="modular-preset-title">{t.name}</span>
                    <span className="modular-preset-type">
                      {t.type === 'custom' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Sparkles size={10} color="var(--gold, #bfa15f)" /> Мой слой
                        </span>
                      ) : t.type === 'block' ? (
                        'Блок'
                      ) : (
                        'Удар'
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Секция 3: Разворот эмбусэн */}
            <div className="modular-section">
              <label className="modular-section-label">
                <Compass size={14} />
                <span>Ориентация / Разворот эмбусэн (Root Yaw)</span>
              </label>
              <div className="modular-turn-selector">
                {MODULAR_TURN_PRESETS.map((turn) => (
                  <button
                    key={turn.deg}
                    type="button"
                    className={`modular-turn-btn ${selectedTurn === turn.deg ? 'active' : ''}`}
                    onClick={() => setSelectedTurn(turn.deg)}
                  >
                    {turn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Секция 4: Тонкая настройка слоев (Высота стойки и доворот корпуса в реальном времени) */}
            <div className="modular-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="modular-section-label" style={{ marginBottom: 0 }}>
                  <Sliders size={14} />
                  <span>Тонкая настройка биомеханики слоёв</span>
                </label>
                {(layerAdjustments.hipsHeight !== 0 || layerAdjustments.torsoTwist !== 0) && (
                  <button
                    type="button"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--gold, #bfa15f)',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                      padding: '2px 6px',
                    }}
                    onClick={() => setLayerAdjustments({ hipsHeight: 0, torsoTwist: 0 })}
                  >
                    Сбросить
                  </button>
                )}
              </div>
              <div className="pose-slider-group" style={{ marginTop: '0.45rem' }}>
                <div className="pose-slider-row">
                  <div className="pose-slider-header">
                    <span>Высота таза / Глубина стойки:</span>
                    <strong>{layerAdjustments.hipsHeight > 0 ? `+${layerAdjustments.hipsHeight}` : layerAdjustments.hipsHeight} см</strong>
                  </div>
                  <input
                    type="range"
                    min="-15"
                    max="10"
                    step="1"
                    value={layerAdjustments.hipsHeight}
                    onChange={(e) => setLayerAdjustments(prev => ({ ...prev, hipsHeight: parseFloat(e.target.value) }))}
                    className="pose-range-input"
                  />
                </div>

                <div className="pose-slider-row">
                  <div className="pose-slider-header">
                    <span>Доворот корпуса (Ханми 45° / Сёмен 0°):</span>
                    <strong>{layerAdjustments.torsoTwist > 0 ? `+${layerAdjustments.torsoTwist}` : layerAdjustments.torsoTwist}°</strong>
                  </div>
                  <input
                    type="range"
                    min="-45"
                    max="45"
                    step="5"
                    value={layerAdjustments.torsoTwist}
                    onChange={(e) => setLayerAdjustments(prev => ({ ...prev, torsoTwist: parseFloat(e.target.value) }))}
                    className="pose-range-input"
                  />
                </div>
              </div>
            </div>

            {/* Секция 5: Плеер и скорость */}
            <div className="modular-player-toolbar">
              <button type="button" className="btn btn-primary modular-play-btn" onClick={handleReplay}>
                <RotateCcw size={15} />
                <span>Перезапуск</span>
              </button>

              <label className="modular-checkbox-label">
                <input
                  type="checkbox"
                  checked={isLooping}
                  onChange={(e) => setIsLooping(e.target.checked)}
                />
                <span>Зациклить</span>
              </label>

              <div className="modular-speed-pills">
                {[0.5, 0.75, 1.0, 1.25].map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    className={`modular-speed-pill ${speed === sp ? 'active' : ''}`}
                    onClick={() => setSpeed(sp)}
                  >
                    {sp}x
                  </button>
                ))}
              </div>
            </div>

            {/* Кнопки интеграции и копирования кода */}
            <div className="modular-export-actions">
              <button
                type="button"
                className="btn btn-secondary modular-action-btn"
                onClick={copyKataStepJson}
              >
                {copiedCode ? <Check size={15} color="#2ed573" /> : <Copy size={15} />}
                <span>{copiedCode ? 'Скопировано в буфер!' : 'Копировать JSON для Ката'}</span>
              </button>
            </div>
          </>
        )}

        {/* ================================================================= */}
        {/* ВКЛАДКА 2: ЗАПИСЬ С КАМЕРЫ (AI MOCAP LAYER RECORDER)             */}
        {/* ================================================================= */}
        {activeTab === 'recorder' && (
          <div className="mocap-recorder-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0, color: 'var(--gold, #bfa15f)', fontSize: '0.98rem' }}>
                  Запись слоя с веб-камеры в реальном времени
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary, #999)' }}>
                  Захват движений через нейросеть MediaPipe Pose прямо в браузере
                </p>
              </div>
              {camActive && (
                <button type="button" className="btn btn-danger" onClick={stopCamera} style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                  Отключить камеру
                </button>
              )}
            </div>

            {/* Выбор записываемого слоя */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className={`modular-preset-btn ${recorderLayerType === 'upper' ? 'active' : ''}`}
                onClick={() => setRecorderLayerType('upper')}
              >
                <span className="modular-preset-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={14} color="var(--gold, #bfa15f)" />
                  <span>Только Верхний слой</span>
                </span>
                <span className="modular-preset-type">Руки и корпус (ноги в стойке)</span>
              </button>
              <button
                type="button"
                className={`modular-preset-btn ${recorderLayerType === 'lower' ? 'active' : ''}`}
                onClick={() => setRecorderLayerType('lower')}
              >
                <span className="modular-preset-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={14} color="var(--gold, #bfa15f)" />
                  <span>Только Нижний слой</span>
                </span>
                <span className="modular-preset-type">Стойка и шаги (In-Place)</span>
              </button>
            </div>

            {/* Окно камеры и оверлея скелета */}
            <div className="recorder-cam-wrapper">
              <video ref={videoRef} className="recorder-video" playsInline muted />
              <canvas ref={canvasRef} width={640} height={480} className="recorder-canvas-overlay" />

              {!camActive && (
                <div style={{ textAlign: 'center', padding: '1rem', zIndex: 2 }}>
                  <Camera size={36} color="var(--gold)" style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: '0.86rem', color: '#fff', marginBottom: 10 }}>Веб-камера выключена</div>
                  <button type="button" className="btn btn-primary" onClick={startCamera}>
                    Включить веб-камеру
                  </button>
                </div>
              )}

              {/* Обратный отсчет 3.. 2.. 1.. */}
              {countdown > 0 && (
                <div className="countdown-overlay">
                  <div className="countdown-num">{countdown}</div>
                  <div style={{ color: '#fff', fontSize: '0.9rem' }}>Приготовьтесь к выполнению техники!</div>
                </div>
              )}

              {/* Индикатор записи */}
              {isRecording && (
                <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.7)', padding: '4px 10px', borderRadius: 4, zIndex: 10 }}>
                  <div className="record-pulse-dot" />
                  <span style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 700 }}>ИДЕТ ЗАПИСЬ ({recordProgress}%)</span>
                </div>
              )}
            </div>

            {camStatus && (
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: 4 }}>
                {camStatus}
              </div>
            )}

            {/* Кнопки управления записью */}
            {camActive && !recordedPreviewClip && (
              <div style={{ display: 'flex', gap: '8px' }}>
                {!isRecording ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={triggerRecording}
                    disabled={countdown > 0}
                  >
                    <Radio size={16} color="#ef4444" />
                    <span>Начать запись (обратный отсчет 3с)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ flex: 1, padding: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={stopActualCapture}
                  >
                    <Square size={14} color="#fff" />
                    <span>Завершить запись досрочно</span>
                  </button>
                )}
              </div>
            )}

            {/* Сохранение после записи */}
            {recordedPreviewClip && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '12px', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <strong style={{ color: '#10b981', fontSize: '0.88rem' }}>✓ Запись успешно преобразована в 3D клип!</strong>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#d1d5db' }}>
                  Движение сейчас проигрывается на 3D аватаре Тори слева. Введите название и сохраните в свою библиотеку.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={newLayerName}
                    onChange={(e) => setNewLayerName(e.target.value)}
                    placeholder="Например: Мой блок уракэн"
                    style={{ flex: 1, background: '#111', border: '1px solid #374151', borderRadius: 4, padding: '6px 10px', color: '#fff', fontSize: '0.82rem' }}
                  />
                  <button type="button" className="btn btn-gold" onClick={handleSaveRecordedLayer}>
                    <Save size={14} />
                    <span>Сохранить в Мои слои</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* ВКЛАДКА 3: ИНТЕРАКТИВНЫЙ КОНСТРУКТОР ПОЗ И ФАЗ                   */}
        {/* ================================================================= */}
        {activeTab === 'creator' && (
          <div className="pose-creator-box">
            <div>
              <h4 style={{ margin: 0, color: 'var(--gold, #bfa15f)', fontSize: '0.98rem' }}>
                Конструктор поз и фаз по частям
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary, #999)' }}>
                Настраивайте суставы покадрово — Three.js автоматически интерполирует движение
              </p>
            </div>

            {/* Выбор типа слоя */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className={`modular-preset-btn ${creatorLayerType === 'upper' ? 'active' : ''}`}
                onClick={() => {
                  setCreatorLayerType('upper');
                  setIsPlayingCreatorAnimation(false);
                }}
              >
                <span className="modular-preset-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={14} color="var(--gold, #bfa15f)" />
                  <span>Верхний слой</span>
                </span>
                <span className="modular-preset-type">Удар / Блок / Руки</span>
              </button>
              <button
                type="button"
                className={`modular-preset-btn ${creatorLayerType === 'lower' ? 'active' : ''}`}
                onClick={() => {
                  setCreatorLayerType('lower');
                  setIsPlayingCreatorAnimation(false);
                }}
              >
                <span className="modular-preset-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={14} color="var(--gold, #bfa15f)" />
                  <span>Нижний слой</span>
                </span>
                <span className="modular-preset-type">Стойка / Таз In-Place</span>
              </button>
            </div>

            {/* Выбор активной фазы */}
            <div className="pose-phase-tabs">
              {keyframes.map((kf, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`pose-phase-btn ${activePhaseIdx === idx ? 'active' : ''}`}
                  onClick={() => {
                    setActivePhaseIdx(idx);
                    setIsPlayingCreatorAnimation(false);
                  }}
                >
                  {kf.label}
                </button>
              ))}
            </div>

            {/* Слайдеры суставов для Верхнего слоя */}
            {creatorLayerType === 'upper' && (
              <div className="pose-slider-group">
                <div className="pose-slider-row">
                  <div className="pose-slider-header">
                    <span>Скручивание корпуса (Ханми / Сёмен):</span>
                    <strong>{currentPose.hanmiAngle || 0}°</strong>
                  </div>
                  <input
                    type="range"
                    min="-45"
                    max="45"
                    step="5"
                    value={currentPose.hanmiAngle || 0}
                    onChange={(e) => updateActivePhasePose('hanmiAngle', e.target.value)}
                    className="pose-range-input"
                  />
                </div>

                <div className="pose-slider-row">
                  <div className="pose-slider-header">
                    <span>Левое плечо (Подъем / Вынос):</span>
                    <strong>{currentPose.leftShoulderPitch || 0}°</strong>
                  </div>
                  <input
                    type="range"
                    min="-90"
                    max="60"
                    step="5"
                    value={currentPose.leftShoulderPitch || 0}
                    onChange={(e) => updateActivePhasePose('leftShoulderPitch', e.target.value)}
                    className="pose-range-input"
                  />
                </div>

                <div className="pose-slider-row">
                  <div className="pose-slider-header">
                    <span>Левый локоть (Сгиб блока/удара):</span>
                    <strong>{currentPose.leftElbowFlex || 0}°</strong>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="140"
                    step="5"
                    value={currentPose.leftElbowFlex || 60}
                    onChange={(e) => updateActivePhasePose('leftElbowFlex', e.target.value)}
                    className="pose-range-input"
                  />
                </div>

                <div className="pose-slider-row">
                  <div className="pose-slider-header">
                    <span>Правое плечо (Удар кулаком / Реверс):</span>
                    <strong>{currentPose.rightShoulderPitch || 0}°</strong>
                  </div>
                  <input
                    type="range"
                    min="-90"
                    max="60"
                    step="5"
                    value={currentPose.rightShoulderPitch || 0}
                    onChange={(e) => updateActivePhasePose('rightShoulderPitch', e.target.value)}
                    className="pose-range-input"
                  />
                </div>

                <div className="pose-slider-row">
                  <div className="pose-slider-header">
                    <span>Правый локоть (Сгиб):</span>
                    <strong>{currentPose.rightElbowFlex || 0}°</strong>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="140"
                    step="5"
                    value={currentPose.rightElbowFlex || 60}
                    onChange={(e) => updateActivePhasePose('rightElbowFlex', e.target.value)}
                    className="pose-range-input"
                  />
                </div>
              </div>
            )}

            {/* Слайдеры суставов для Нижнего слоя */}
            {creatorLayerType === 'lower' && (
              <div className="pose-slider-group">
                <div className="pose-slider-row">
                  <div className="pose-slider-header">
                    <span>Снижение таза / Глубина стойки:</span>
                    <strong>{currentPose.hipsDrop || 0} см</strong>
                  </div>
                  <input
                    type="range"
                    min="-30"
                    max="0"
                    step="2"
                    value={currentPose.hipsDrop ?? -10}
                    onChange={(e) => updateActivePhasePose('hipsDrop', e.target.value)}
                    className="pose-range-input"
                  />
                </div>

                <div className="pose-slider-row">
                  <div className="pose-slider-header">
                    <span>Левое колено (Сгиб опорной ноги):</span>
                    <strong>{currentPose.leftKneeFlex || 0}°</strong>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    step="5"
                    value={currentPose.leftKneeFlex || 30}
                    onChange={(e) => updateActivePhasePose('leftKneeFlex', e.target.value)}
                    className="pose-range-input"
                  />
                </div>

                <div className="pose-slider-row">
                  <div className="pose-slider-header">
                    <span>Правое колено (Сгиб задней ноги):</span>
                    <strong>{currentPose.rightKneeFlex || 0}°</strong>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    step="5"
                    value={currentPose.rightKneeFlex || 20}
                    onChange={(e) => updateActivePhasePose('rightKneeFlex', e.target.value)}
                    className="pose-range-input"
                  />
                </div>
              </div>
            )}

            {/* Управление тестом движения и сбросом */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={`btn ${isPlayingCreatorAnimation ? 'btn-danger' : 'btn-secondary'}`}
                style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.8rem' }}
                onClick={handleToggleCreatorAnimation}
              >
                {isPlayingCreatorAnimation ? <Square size={14} color="#ef4444" /> : <Play size={14} />}
                <span>{isPlayingCreatorAnimation ? 'Остановить тест (режим позы)' : 'Тест движения (Фазы 1 → 2 → 3)'}</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                title="Сбросить позу текущей фазы"
                onClick={handleResetActivePhasePose}
              >
                <RotateCcw size={14} />
                <span>Сброс</span>
              </button>
            </div>

            {/* Сохранение позы */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={creatorClipName}
                onChange={(e) => setCreatorClipName(e.target.value)}
                placeholder="Название созданной техники..."
                style={{ flex: 1, background: '#111', border: '1px solid #374151', borderRadius: 4, padding: '8px 10px', color: '#fff', fontSize: '0.82rem' }}
              />
              <button type="button" className="btn btn-gold" onClick={handleSaveCreatedLayer}>
                <Sparkles size={14} />
                <span>Синтезировать и сохранить</span>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* ВКЛАДКА 4: МОИ СОХРАНЕННЫЕ СЛОИ (БИБЛИОТЕКА)                      */}
        {/* ================================================================= */}
        {activeTab === 'library' && (
          <div>
            <div className="modular-controls-header">
              <h3>
                <BookOpen size={18} />
                <span>Библиотека моих слоев</span>
              </h3>
              <p className="modular-controls-subtitle">
                Все записанные с камеры и смоделированные вручную части анимации
              </p>
            </div>

            {customLayers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 6, border: '1px dashed #374151', color: 'var(--text-secondary)' }}>
                <p style={{ margin: 0, fontSize: '0.86rem' }}>У вас пока нет сохраненных слоев.</p>
                <div style={{ marginTop: '0.8rem', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button type="button" className="btn btn-primary" onClick={() => setActiveTab('recorder')}>
                    <Camera size={13} />
                    <span>Записать с камеры</span>
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('creator')}>
                    <Sparkles size={13} />
                    <span>Создать по частям</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="custom-layers-list">
                {customLayers.map((layer) => (
                  <div key={layer.id} className="custom-layer-card">
                    <div className="custom-layer-meta">
                      <strong>{layer.name}</strong>
                      <div className="custom-layer-sub">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {layer.layerType === 'upper' ? (
                            <Shield size={12} color="var(--gold, #bfa15f)" />
                          ) : (
                            <Zap size={12} color="var(--gold, #bfa15f)" />
                          )}
                          {layer.layerType === 'upper' ? 'Верхний слой' : 'Нижний слой'}
                        </span>
                        <span>•</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {layer.source === 'camera' ? (
                            <Camera size={12} color="#10b981" />
                          ) : (
                            <Sliders size={12} color="#60a5fa" />
                          )}
                          {layer.source === 'camera' ? 'Запись с камеры' : 'Конструктор поз'}
                        </span>
                      </div>
                    </div>

                    <div className="custom-layer-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                        onClick={() => {
                          if (layer.layerType === 'upper') {
                            setSelectedTechnique(layer.id);
                          } else {
                            setSelectedStance(layer.id);
                          }
                          setActiveTab('mixer');
                        }}
                      >
                        Применить в 3D
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: '5px 8px' }}
                        title="Скачать JSON"
                        onClick={() => handleExportCustomLayerJson(layer)}
                      >
                        <Download size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '5px 8px' }}
                        title="Удалить"
                        onClick={() => handleDeleteCustomLayer(layer.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
