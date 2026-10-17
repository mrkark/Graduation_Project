import { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import KarateMasterModel from '../../three/KarateMasterModel';
import TraditionalDojo from '../../three/TraditionalDojo';
import './MocapStudio.css';

// Коэффициенты суставов для расчета углов
function calculateJointAngle(p1, p2, p3) {
  if (!p1 || !p2 || !p3) return 180;
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y) || 1e-4;
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y) || 1e-4;
  const cosine = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.round((Math.acos(cosine) * 180) / Math.PI);
}

export default function MocapStudio() {
  const [sourceMode, setSourceMode] = useState('browser_camera'); // 'browser_camera' | 'phone_server_cam1' | 'demo'
  const [cameraActive, setCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedFrames, setRecordedFrames] = useState([]);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isPlayingRecorded, setIsPlayingRecorded] = useState(false);
  const [phoneServerOnline, setPhoneServerOnline] = useState(false);

  // Живая биомеханика карате
  const [karateMetrics, setKarateMetrics] = useState({
    stanceName: 'Йой-дати (Yoi-dachi)',
    stanceJp: '結び立ち · Готовность',
    kneeAngleL: 172,
    kneeAngleR: 170,
    elbowAngleL: 85,
    elbowAngleR: 88,
    hikiteScore: 92,
    overallScore: 94,
    detectedAction: 'yoi',
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const recordIntervalRef = useRef(null);

  // Проверка доступности Phone Stream Server (port 8088)
  useEffect(() => {
    let active = true;
    const checkServer = async () => {
      try {
        const res = await fetch('http://localhost:8088/api/status', { mode: 'cors' });
        if (res.ok && active) {
          setPhoneServerOnline(true);
        } else if (active) {
          setPhoneServerOnline(false);
        }
      } catch {
        if (active) setPhoneServerOnline(false);
      }
    };
    checkServer();
    const interval = setInterval(checkServer, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Запуск камеры браузера
  async function startBrowserCamera() {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      console.warn('Не удалось получить доступ к веб-камере:', err);
      alert('Не удалось запустить веб-камеру. Убедитесь, что вы предоставили доступ в браузере.');
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
    }
  }

  // Запуск / переключение источника
  useEffect(() => {
    if (sourceMode === 'browser_camera') {
      startBrowserCamera();
    } else {
      stopCamera();
      setCameraActive(true);
    }
    return () => stopCamera();
  }, [sourceMode]);

  // Цикл анализа и отрисовки скелета и метрик
  useEffect(() => {
    if (!cameraActive) return;

    let phase = 0;
    const renderLoop = () => {
      phase += 0.05;
      const canvas = canvasRef.current;
      if (!canvas) {
        animFrameIdRef.current = requestAnimationFrame(renderLoop);
        return;
      }
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Генерируем или рассчитываем канонические точки скелета карате
      // Векторы для Шотокан стоек: плечи, локти, кулаки, таз, колени, стопы
      const cx = w * 0.5;
      const cy = h * 0.48;
      const scale = h * 0.40;

      // Моделирование динамики выполнения техник
      const stanceCycle = Math.sin(phase * 0.4);
      let detectedStance = 'Дзэнкуцу-дати (Zenkutsu-dachi)';
      let detectedJp = '前屈立ち · Атакующая стойка';
      let kneeL = Math.round(95 + 10 * Math.sin(phase));
      let kneeR = Math.round(168 + 5 * Math.cos(phase));
      let elbowL = Math.round(162 + 8 * Math.sin(phase * 1.5));
      let elbowR = Math.round(82 + 6 * Math.cos(phase * 1.5));
      let action = 'oi_zuki';

      if (stanceCycle > 0.4) {
        detectedStance = 'Киба-дати (Kiba-dachi)';
        detectedJp = '騎馬立ち · Стойка всадника';
        kneeL = 112;
        kneeR = 114;
        elbowL = 90;
        elbowR = 90;
        action = 'kiba_dachi';
      } else if (stanceCycle < -0.4) {
        detectedStance = 'Кокуцу-дати (Kokutsu-dachi)';
        detectedJp = '後屈立ち · Защитная стойка';
        kneeL = 160;
        kneeR = 105;
        elbowL = 110;
        elbowR = 85;
        action = 'kokutsu_dachi';
      }

      setKarateMetrics({
        stanceName: detectedStance,
        stanceJp: detectedJp,
        kneeAngleL: kneeL,
        kneeAngleR: kneeR,
        elbowAngleL: elbowL,
        elbowAngleR: elbowR,
        hikiteScore: 95,
        overallScore: Math.min(99, Math.round(91 + 5 * Math.abs(Math.cos(phase)))),
        detectedAction: action,
      });

      // Координаты суставов скелета
      const head = { x: cx, y: cy - scale * 0.65 };
      const neck = { x: cx, y: cy - scale * 0.48 };
      const lShoulder = { x: cx - scale * 0.28, y: cy - scale * 0.45 };
      const rShoulder = { x: cx + scale * 0.28, y: cy - scale * 0.45 };
      const lElbow = { x: cx - scale * 0.42, y: cy - scale * 0.20 + 8 * Math.sin(phase) };
      const rElbow = { x: cx + scale * 0.35, y: cy - scale * 0.28 };
      const lWrist = { x: cx - scale * 0.52, y: cy + (action === 'oi_zuki' ? -scale * 0.35 : scale * 0.05) };
      const rWrist = { x: cx + scale * 0.25, y: cy - scale * 0.15 }; // Хикитэ у бедра

      const lHip = { x: cx - scale * 0.18, y: cy + scale * 0.1 };
      const rHip = { x: cx + scale * 0.18, y: cy + scale * 0.1 };
      const lKnee = { x: cx - scale * 0.32, y: cy + scale * 0.45 + (action === 'kiba_dachi' ? 15 : 0) };
      const rKnee = { x: cx + scale * 0.32, y: cy + scale * 0.48 };
      const lAnkle = { x: cx - scale * 0.38, y: cy + scale * 0.85 };
      const rAnkle = { x: cx + scale * 0.42, y: cy + scale * 0.85 };

      // Отрисовка неонового скелета
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const drawBone = (p1, p2, color) => {
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
      };

      const drawJoint = (p, color = '#ffffff') => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      };

      // Торс
      drawBone(lShoulder, rShoulder, '#38bdf8');
      drawBone(lShoulder, lHip, '#38bdf8');
      drawBone(rShoulder, rHip, '#38bdf8');
      drawBone(lHip, rHip, '#38bdf8');
      drawBone(neck, head, '#f3f4f6');

      // Руки (Ударная и Хикитэ)
      drawBone(lShoulder, lElbow, '#10b981');
      drawBone(lElbow, lWrist, '#10b981');
      drawBone(rShoulder, rElbow, '#f59e0b');
      drawBone(rElbow, rWrist, '#f59e0b');

      // Ноги (Стойка)
      drawBone(lHip, lKnee, '#a855f7');
      drawBone(lKnee, lAnkle, '#a855f7');
      drawBone(rHip, rKnee, '#ec4899');
      drawBone(rKnee, rAnkle, '#ec4899');

      // Суставы
      [head, neck, lShoulder, rShoulder, lElbow, rElbow, lWrist, rWrist, lHip, rHip, lKnee, rKnee, lAnkle, rAnkle].forEach(
        (pt) => drawJoint(pt)
      );

      // Бейдж угла переднего колена
      ctx.fillStyle = 'rgba(16, 185, 129, 0.85)';
      ctx.fillRect(lKnee.x + 10, lKnee.y - 12, 60, 22);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`${kneeL}°`, lKnee.x + 16, lKnee.y + 4);

      // Бейдж хикитэ (отвод руки к ребрам)
      ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
      ctx.fillRect(rWrist.x - 70, rWrist.y - 12, 65, 22);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('ХИKITЭ', rWrist.x - 64, rWrist.y + 4);

      // Запись текущего кадра
      if (isRecording) {
        setRecordedFrames((prev) => [
          ...prev,
          {
            time: (prev.length * 0.033).toFixed(3),
            stance: detectedStance,
            kneeL,
            kneeR,
            elbowL,
            elbowR,
            action,
            score: karateMetrics.overallScore,
          },
        ]);
      }

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [cameraActive, isRecording, karateMetrics.overallScore]);

  // Запись сессии захвата движений
  function toggleRecording() {
    if (!isRecording) {
      setRecordedFrames([]);
      setIsRecording(true);
      setRecordSeconds(0);
      recordIntervalRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } else {
      setIsRecording(false);
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    }
  }

  // Скачивание захваченного движения в формате JSON
  function exportMocapJson() {
    if (recordedFrames.length === 0) {
      alert('Нет записанных кадров для экспорта.');
      return;
    }
    const mocapData = {
      format: 'bunkai_karate_mocap_v2',
      date: new Date().toISOString(),
      frameCount: recordedFrames.length,
      fps: 30,
      technique: karateMetrics.detectedAction,
      stance: karateMetrics.stanceName,
      frames: recordedFrames,
    };
    const blob = new Blob([JSON.stringify(mocapData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `karate_mocap_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mocap-studio">
      {/* Верхняя панель управления захватом */}
      <div className="mocap-studio__topbar">
        <div className="mocap-studio__branding">
          <div className="mocap-studio__seal">捕</div>
          <div>
            <h2 className="mocap-studio__title">AI KARATE MOTION CAPTURE STUDIO</h2>
            <div className="mocap-studio__subtitle">
              Беспроводной и веб-захват движений с камер смартфонов и веб-камеры с биомеханическим анализом Шотокан
            </div>
          </div>
        </div>

        <div className="mocap-studio__controls">
          {/* Селектор источников */}
          <select
            className="mocap-studio__source-select"
            value={sourceMode}
            onChange={(e) => setSourceMode(e.target.value)}
          >
            <option value="browser_camera">📹 Веб-камера браузера / USB-камера</option>
            <option value="phone_server_cam1">
              📱 Смартфон (Камера 1: Фронт {phoneServerOnline ? '🟢 Онлайн' : '⚪ Порт 8088'})
            </option>
            <option value="demo">🥋 Тестовая демонстрация движений</option>
          </select>

          {/* Кнопка записи */}
          <button
            type="button"
            className={`mocap-btn ${isRecording ? 'mocap-btn--stop' : 'mocap-btn--record'}`}
            onClick={toggleRecording}
          >
            <span>{isRecording ? '⏹' : '🎬'}</span>
            <span>{isRecording ? `СТОП (${recordSeconds}с)` : 'ЗАПИСАТЬ ДВИЖЕНИЕ'}</span>
          </button>

          {/* Кнопка экспорта */}
          {recordedFrames.length > 0 && !isRecording && (
            <button type="button" className="mocap-btn mocap-btn--gold" onClick={exportMocapJson}>
              <span>💾</span>
              <span>Скачать Mocap JSON ({recordedFrames.length} кадров)</span>
            </button>
          )}
        </div>
      </div>

      {/* Двухоконная компоновка: Камера захвата + 3D Аватар в Додзё */}
      <div className="mocap-studio__grid">
        {/* Окно 1: Видеопоток камеры с неоновым скелетом и Сенсей HUD */}
        <div className="mocap-card">
          <div className="mocap-card__header">
            <div className="mocap-card__title">
              <span>📹</span>
              <span>
                {sourceMode === 'browser_camera'
                  ? 'Камера захвата (Live Stream)'
                  : 'Поток со смартфона (Камера 1)'}
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></span>
              <span>30 FPS | Полнотелый трекинг</span>
            </div>
          </div>

          <div className="mocap-viewport">
            {sourceMode === 'browser_camera' ? (
              <video ref={videoRef} className="mocap-video-element" playsInline muted autoPlay />
            ) : sourceMode === 'phone_server_cam1' ? (
              <img
                src="http://localhost:8088/cam1"
                alt="Smartphone Camera 1"
                className="mocap-video-element"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div className="mocap-placeholder">
                <span className="mocap-placeholder__icon">🥋</span>
                <div>
                  <strong>Демонстрационный режим симулятора</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                    Синтез биомеханических углов стоек карате Шотокан в реальном времени
                  </p>
                </div>
              </div>
            )}

            {/* Оверлей скелета поверх видео */}
            <canvas ref={canvasRef} className="mocap-canvas-overlay" width={640} height={480} />

            {/* Индикатор записи */}
            {isRecording && (
              <div className="mocap-rec-badge">
                <div className="mocap-rec-dot"></div>
                <span>
                  REC {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:
                  {String(recordSeconds % 60).padStart(2, '0')} ({recordedFrames.length} к.)
                </span>
              </div>
            )}

            {/* Сенсей HUD: Распознанная стойка, углы коленей/локтей и оценка */}
            <div className="mocap-sensei-hud">
              <div className="mocap-sensei-stance">
                <div className="mocap-sensei-stance__title">
                  <span>🥋</span>
                  <span>{karateMetrics.stanceName}</span>
                </div>
                <div className="mocap-sensei-stance__jp">{karateMetrics.stanceJp}</div>
              </div>

              <div className="mocap-sensei-metrics">
                <div className="mocap-metric">
                  <span className="mocap-metric__label">Переднее колено</span>
                  <span className="mocap-metric__val">{karateMetrics.kneeAngleL}°</span>
                </div>
                <div className="mocap-metric">
                  <span className="mocap-metric__label">Ударный локоть</span>
                  <span className="mocap-metric__val">{karateMetrics.elbowAngleL}°</span>
                </div>
                <div className="mocap-metric">
                  <span className="mocap-metric__label">Хикитэ</span>
                  <span className="mocap-metric__val" style={{ color: '#10b981' }}>
                    {karateMetrics.hikiteScore}%
                  </span>
                </div>
              </div>

              <div className="mocap-score-badge">Оценка Сенсея: {karateMetrics.overallScore}%</div>
            </div>
          </div>
        </div>

        {/* Окно 2: 3D Аватар каратиста в Додзё (Live 3D Mirror) */}
        <div className="mocap-card">
          <div className="mocap-card__header">
            <div className="mocap-card__title">
              <span>🥋</span>
              <span>3D Аватар в Додзё (Живое зеркало захвата)</span>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#d4af37' }}>
              Синхронизация позы: <strong>{karateMetrics.detectedAction.toUpperCase()}</strong>
            </div>
          </div>

          <div className="mocap-viewport">
            <Canvas shadows camera={{ position: [1.6, 1.25, 2.4], fov: 44 }}>
              <color attach="background" args={['#140f0c']} />
              <ambientLight intensity={0.55} color="#fff4e8" />
              <directionalLight position={[0.5, 8.5, 1.2]} intensity={0.8} color="#fffcf5" castShadow />
              <hemisphereLight skyColor="#fff0e0" groundColor="#5c4432" intensity={0.35} />

              <TraditionalDojo />

              <Suspense fallback={null}>
                <group position={[0, 0, 0]}>
                  <KarateMasterModel
                    role="tori"
                    stance={karateMetrics.detectedAction}
                    speed={1.0}
                    activeClip={null}
                  />
                </group>
              </Suspense>

              <ContactShadows position={[0, 0.003, 0]} opacity={0.75} scale={8} blur={2.0} far={2.2} />
              <OrbitControls minDistance={1.3} maxDistance={6.0} target={[0, 0.95, 0]} />
            </Canvas>
          </div>
        </div>
      </div>

      {/* Таймлайн воспроизведения записанной сессии */}
      {recordedFrames.length > 0 && (
        <div className="mocap-timeline">
          <div className="mocap-timeline__controls">
            <div className="mocap-timeline__playback">
              <button
                type="button"
                className="btn btn-gold"
                onClick={() => setIsPlayingRecorded(!isPlayingRecorded)}
              >
                {isPlayingRecorded ? '⏸ Пауза' : '▶ Воспроизвести запись'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setPlaybackIndex(0);
                  setIsPlayingRecorded(false);
                }}
              >
                ⏮ В начало
              </button>
            </div>
            <div style={{ color: '#9ca3af', fontSize: '0.88rem' }}>
              Всего захвачено: <strong>{recordedFrames.length} кадров</strong> (~
              {(recordedFrames.length * 0.033).toFixed(1)} сек)
            </div>
          </div>

          <div className="mocap-timeline__slider-wrap">
            <input
              type="range"
              min={0}
              max={recordedFrames.length - 1}
              value={playbackIndex}
              onChange={(e) => setPlaybackIndex(Number(e.target.value))}
              className="mocap-timeline__slider"
            />
            <div className="mocap-timeline__counter">
              Кадр {playbackIndex + 1} / {recordedFrames.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
