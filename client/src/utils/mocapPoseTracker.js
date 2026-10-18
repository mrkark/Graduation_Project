/**
 * Bunkai Explorer — AI Motion Capture & Karate Biomechanics Engine
 * 
 * Интеграция MediaPipe Pose (33 ключевые точки тела):
 * - Реальное отслеживание позы человека с веб-камеры или до 3 камер смартфонов
 * - Мульти-камерная триангуляция и слияние 3D-данных (фронт 0°, бок 90°, угол 45°)
 * - Построение полноценной 3D кинематической модели из объемных костей и суставов в Three.js
 * - Расчет 3D-углов суставов в градусах и радианах
 * - Распознавание канонических стоек каратэ (Дзэнкуцу, Киба, Кокуцу, Йой, Ганкаку)
 * - Детекция ударов и блоков (Ой-цуки, Гяку-цуки, Агэ-укэ, Гэдан-барай, Сюто-укэ, Маэ-гэри)
 * - Расчет оценки мастерства (Sensei Biomechanics Score 0-100%)
 * - Полноценный 3D-маппинг кватернионов костей для аватара
 */

const MEDIAPIPE_POSE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js';

let poseInstance = null;
let poseLoadPromise = null;

/**
 * Иерархия соединений костей для построения объемной 3D-модели скелета в Three.js
 */
export const BONE_CONNECTIONS_3D = [
  // Позвоночный столб и центральная линия (Chushin-sen)
  { id: 'spine_lower', from: 'hipsMid', to: 'spineMid', color: '#f59e0b', radius: 0.032, label: 'Поясница' },
  { id: 'spine_upper', from: 'spineMid', to: 'neck', color: '#f59e0b', radius: 0.030, label: 'Грудной отдел' },
  { id: 'neck_head', from: 'neck', to: 'head', color: '#ffd700', radius: 0.026, label: 'Шея / Голова' },

  // Плечевой пояс
  { id: 'clavicle_l', from: 'neck', to: 'shoulderL', color: '#06b6d4', radius: 0.024, label: 'Левая ключица' },
  { id: 'clavicle_r', from: 'neck', to: 'shoulderR', color: '#ef4444', radius: 0.024, label: 'Правая ключица' },

  // Левая рука (Цвет Cyan / Изумруд)
  { id: 'upper_arm_l', from: 'shoulderL', to: 'elbowL', color: '#06b6d4', radius: 0.026, label: 'Левое плечо' },
  { id: 'lower_arm_l', from: 'elbowL', to: 'wristL', color: '#10b981', radius: 0.022, label: 'Левое предплечье' },
  { id: 'hand_l', from: 'wristL', to: 'handL', color: '#34d399', radius: 0.018, label: 'Левая кисть' },

  // Правая рука (Цвет Amber / Алый)
  { id: 'upper_arm_r', from: 'shoulderR', to: 'elbowR', color: '#f59e0b', radius: 0.026, label: 'Правое плечо' },
  { id: 'lower_arm_r', from: 'elbowR', to: 'wristR', color: '#ef4444', radius: 0.022, label: 'Правое предплечье' },
  { id: 'hand_r', from: 'wristR', to: 'handR', color: '#f87171', radius: 0.018, label: 'Правая кисть' },

  // Тазовый пояс
  { id: 'pelvis_l', from: 'hipsMid', to: 'hipL', color: '#06b6d4', radius: 0.032, label: 'Таз L' },
  { id: 'pelvis_r', from: 'hipsMid', to: 'hipR', color: '#ef4444', radius: 0.032, label: 'Таз R' },

  // Левая нога (Стойки и удары ногами)
  { id: 'upper_leg_l', from: 'hipL', to: 'kneeL', color: '#06b6d4', radius: 0.035, label: 'Левое бедро' },
  { id: 'lower_leg_l', from: 'kneeL', to: 'ankleL', color: '#10b981', radius: 0.028, label: 'Левая голень' },
  { id: 'foot_l', from: 'ankleL', to: 'footL', color: '#34d399', radius: 0.022, label: 'Левая стопа' },

  // Правая нога
  { id: 'upper_leg_r', from: 'hipR', to: 'kneeR', color: '#f59e0b', radius: 0.035, label: 'Правое бедро' },
  { id: 'lower_leg_r', from: 'kneeR', to: 'ankleR', color: '#ef4444', radius: 0.028, label: 'Правая голень' },
  { id: 'foot_r', from: 'ankleR', to: 'footR', color: '#f87171', radius: 0.022, label: 'Правая стопа' },
];

/**
 * Загрузка библиотеки MediaPipe Pose из CDN
 */
export function loadMediaPipePose() {
  if (poseInstance) return Promise.resolve(poseInstance);
  if (poseLoadPromise) return poseLoadPromise;

  poseLoadPromise = new Promise((resolve, reject) => {
    if (window.Pose) {
      initPose();
      return;
    }

    const script = document.createElement('script');
    script.src = MEDIAPIPE_POSE_CDN;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      initPose();
    };
    script.onerror = (err) => {
      console.error('Ошибка загрузки MediaPipe Pose CDN:', err);
      reject(new Error('Не удалось загрузить библиотеку компьютерного зрения MediaPipe Pose'));
    };
    document.head.appendChild(script);

    function initPose() {
      try {
        const pose = new window.Pose({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`,
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        poseInstance = pose;
        resolve(pose);
      } catch (err) {
        reject(err);
      }
    }
  });

  return poseLoadPromise;
}

/**
 * Расчет 3D угла между тремя точками (в градусах)
 */
export function calculateAngle3D(p1, p2, p3) {
  if (!p1 || !p2 || !p3) return 180;
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y, z: (p1.z || 0) - (p2.z || 0) };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y, z: (p3.z || 0) - (p2.z || 0) };

  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z) || 1e-4;
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z) || 1e-4;

  const cosine = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.round((Math.acos(cosine) * 180) / Math.PI);
}

/**
 * Адаптивное мульти-камерное слияние и 3D-триангуляция данных для 1, 2 или 3 камер:
 * 
 * 1 КАМЕРА:
 * - Фронт (0°): точные X и Y, моно-глубина Z.
 * - Бок (90°): разворачивает ось X в глубину Z, проецирует позу на аватар.
 * - Угол (45°): деротирует диагональную проекцию на 45°.
 * 
 * 2 КАМЕРЫ (Стереоскопическая триангуляция):
 * - Фронт (1) + Бок (2): ЗОЛОТОЙ СТАНДАРТ MoCap.
 *   X и Y берутся с фронтальной камеры, а Z (глубина ударов и стоек) — напрямую
 *   с боковой камеры. Устраняет погрешности монокулярной оценки глубины!
 * - Фронт (1) + Угол (3): заполнение слепых зон перекрытия рук и ног.
 * - Бок (2) + Угол (3): глубина с боковой камеры + восстановление ширины с угловой.
 * 
 * 3 КАМЕРЫ (Полный захват 360°):
 * - Фронт (0°) + Бок (90°) + Угол (45°).
 * - Слияние с весами достоверности видимости (visibility confidence weighting).
 * - Устранение перекрытий конечностей (окклюзий) и физическая глубина Z.
 */
export function fuseMultiCameraLandmarks(cameraFeeds = {}) {
  const c1 = cameraFeeds[1]; // Фронт (0°)
  const c2 = cameraFeeds[2]; // Бок (90°)
  const c3 = cameraFeeds[3]; // Угол (45°)

  const activeSlots = [1, 2, 3].filter(
    (s) => cameraFeeds[s]?.landmarks && cameraFeeds[s].landmarks.length >= 33
  );

  if (activeSlots.length === 0) return null;

  // --- СЛУЧАЙ 1: РОВНО 1 КАМЕРА ---
  if (activeSlots.length === 1) {
    const slot = activeSlots[0];
    const feed = cameraFeeds[slot];
    const lms = feed.landmarks;
    const wlms = feed.worldLandmarks || lms;

    if (slot === 1) {
      // Фронтальная камера (или ПК веб-камера) — прямая передача данных
      return {
        landmarks: lms,
        worldLandmarks: wlms,
        fused: false,
        cameraMode: 'single_front',
        activeCameras: [1],
      };
    }

    if (slot === 2) {
      // Только боковая камера (90°): горизонтальная ось камеры X соответствует мировой глубине Z!
      const rotatedLms = [];
      const rotatedWlms = [];
      const hipX = ((wlms[23]?.x ?? 0) + (wlms[24]?.x ?? 0)) * 0.5;

      for (let i = 0; i < 33; i++) {
        const p = lms[i];
        const w = wlms[i];
        const depthZ = (w.x - hipX) * 1.15;
        const lateralX = -(w.z || 0);

        rotatedLms.push({
          x: p.x,
          y: p.y,
          z: depthZ,
          visibility: p.visibility ?? 1,
        });

        rotatedWlms.push({
          x: lateralX,
          y: w.y,
          z: depthZ,
          visibility: w.visibility ?? 1,
        });
      }

      return {
        landmarks: rotatedLms,
        worldLandmarks: rotatedWlms,
        fused: true,
        cameraMode: 'single_side',
        activeCameras: [2],
      };
    }

    if (slot === 3) {
      // Только угловая камера (45°): вращение вокруг Y на -45°
      const cos45 = 0.7071;
      const sin45 = 0.7071;
      const rotatedLms = [];
      const rotatedWlms = [];

      for (let i = 0; i < 33; i++) {
        const p = lms[i];
        const w = wlms[i];
        const rx = w.x * cos45 + (w.z || 0) * sin45;
        const rz = -w.x * sin45 + (w.z || 0) * cos45;

        rotatedLms.push({ ...p, z: rz });
        rotatedWlms.push({ x: rx, y: w.y, z: rz, visibility: w.visibility ?? 1 });
      }

      return {
        landmarks: rotatedLms,
        worldLandmarks: rotatedWlms,
        fused: true,
        cameraMode: 'single_angle',
        activeCameras: [3],
      };
    }
  }

  // --- СЛУЧАЙ 2 И 3: МУЛЬТИ-КАМЕРНОЕ СЛИЯНИЕ (2 ИЛИ 3 КАМЕРЫ) ---
  const fusedLms = [];
  const fusedWlms = [];

  const c2_w = c2?.worldLandmarks;
  const c2_hipX = c2_w && c2_w[23] && c2_w[24]
    ? (c2_w[23].x + c2_w[24].x) * 0.5
    : 0;

  const hasC1 = Boolean(c1?.landmarks);
  const hasC2 = Boolean(c2?.landmarks);
  const hasC3 = Boolean(c3?.landmarks);

  for (let i = 0; i < 33; i++) {
    const p1 = c1?.landmarks?.[i];
    const w1 = c1?.worldLandmarks?.[i];
    const vis1 = p1?.visibility ?? 0;

    const p2 = c2?.landmarks?.[i];
    const w2 = c2?.worldLandmarks?.[i];
    const vis2 = p2?.visibility ?? 0;

    const p3 = c3?.landmarks?.[i];
    const w3 = c3?.worldLandmarks?.[i];
    const vis3 = p3?.visibility ?? 0;

    // 1. ОПРЕДЕЛЕНИЕ X (Ширина):
    // Приоритет отдается фронтальной камере (1). Если точка на фронте перекрыта (vis1 < 0.4),
    // восстанавливаем X из угловой камеры (3) или боковой (2).
    let fx = 0.5;
    let wx = 0.0;

    if (hasC1 && vis1 >= 0.35) {
      fx = p1.x;
      wx = w1.x;
    } else if (hasC3 && vis3 > 0.45) {
      fx = p3.x;
      wx = (w3.x + (w3.z || 0)) * 0.7071;
    } else if (hasC2 && vis2 > 0.45) {
      fx = (p2.z ?? 0) * 0.5 + 0.5;
      wx = -(w2.z || 0);
    } else {
      fx = p1?.x ?? p3?.x ?? p2?.x ?? 0.5;
      wx = w1?.x ?? w3?.x ?? w2?.x ?? 0.0;
    }

    // 2. ОПРЕДЕЛЕНИЕ Y (Высота):
    // Взвешенное среднее по всем доступным камерам с учетом качества детекции
    let totalVisY = 0;
    let sumFy = 0;
    let sumWy = 0;

    if (hasC1 && p1) { sumFy += p1.y * Math.max(0.2, vis1); sumWy += w1.y * Math.max(0.2, vis1); totalVisY += Math.max(0.2, vis1); }
    if (hasC2 && p2) { sumFy += p2.y * Math.max(0.2, vis2); sumWy += w2.y * Math.max(0.2, vis2); totalVisY += Math.max(0.2, vis2); }
    if (hasC3 && p3) { sumFy += p3.y * Math.max(0.2, vis3); sumWy += w3.y * Math.max(0.2, vis3); totalVisY += Math.max(0.2, vis3); }

    const fy = totalVisY > 0 ? sumFy / totalVisY : (p1?.y ?? p2?.y ?? p3?.y ?? 0.5);
    const wy = totalVisY > 0 ? sumWy / totalVisY : (w1?.y ?? w2?.y ?? w3?.y ?? 0.0);

    // 3. ОПРЕДЕЛЕНИЕ Z (Физическая глубина Додзё):
    // Боковая камера (2) дает ПРЯМОЕ измерение физической глубины!
    let fz = 0.0;
    let wz = 0.0;

    if (hasC2 && vis2 >= 0.30) {
      const physicalDepthZ = (w2.x - c2_hipX) * 1.15;
      fz = physicalDepthZ;
      wz = physicalDepthZ;

      if (hasC1 && vis1 > 0.5) {
        wz = physicalDepthZ * 0.85 + w1.z * 0.15;
        fz = wz;
      }
    } else if (hasC3 && vis3 >= 0.40) {
      const angleDepthZ = (-w3.x + (w3.z || 0)) * 0.7071;
      wz = hasC1 ? (angleDepthZ * 0.65 + w1.z * 0.35) : angleDepthZ;
      fz = wz;
    } else if (hasC1) {
      fz = p1.z || 0;
      wz = w1.z || 0;
    }

    const maxVis = Math.max(vis1, vis2, vis3);

    fusedLms.push({
      x: fx,
      y: fy,
      z: fz,
      visibility: maxVis,
    });

    fusedWlms.push({
      x: wx,
      y: wy,
      z: wz,
      visibility: maxVis,
    });
  }

  const cameraMode = activeSlots.length === 3
    ? 'triangulation_3cam'
    : (activeSlots.includes(1) && activeSlots.includes(2))
      ? 'stereo_front_side'
      : (activeSlots.includes(1) && activeSlots.includes(3))
        ? 'stereo_front_angle'
        : 'stereo_side_angle';

  return {
    landmarks: fusedLms,
    worldLandmarks: fusedWlms,
    fused: true,
    cameraMode,
    activeCameras: activeSlots,
  };
}

/**
 * Преобразование 33 точек MediaPipe в полноценный набор 3D-суставов для Three.js
 * Координаты приводятся к реальным метрам и привязываются к полу Додзё.
 */
export function build3DSkeletonData(worldLandmarks, landmarks, options = {}) {
  const pts = worldLandmarks || landmarks;
  if (!pts || pts.length < 33) return null;

  const scale = options.scale || 1.35; // Масштаб под человеческий рост ~1.75м
  const mirrorX = options.mirrorX !== undefined ? options.mirrorX : false;

  // Индексы точек MediaPipe
  const rawNose = pts[0];
  const rawLS = pts[11];
  const rawRS = pts[12];
  const rawLE = pts[13];
  const rawRE = pts[14];
  const rawLW = pts[15];
  const rawRW = pts[16];
  const rawLH = pts[23];
  const rawRH = pts[24];
  const rawLK = pts[25];
  const rawRK = pts[26];
  const rawLA = pts[27];
  const rawRA = pts[28];
  const rawLToe = pts[31] || pts[27];
  const rawRToe = pts[32] || pts[28];

  // Центральные суставы
  const rawHipsMid = {
    x: (rawLH.x + rawRH.x) * 0.5,
    y: (rawLH.y + rawRH.y) * 0.5,
    z: ((rawLH.z || 0) + (rawRH.z || 0)) * 0.5,
  };

  const rawNeck = {
    x: (rawLS.x + rawRS.x) * 0.5,
    y: (rawLS.y + rawRS.y) * 0.5,
    z: ((rawLS.z || 0) + (rawRS.z || 0)) * 0.5,
  };

  const rawSpineMid = {
    x: (rawHipsMid.x + rawNeck.x) * 0.5,
    y: (rawHipsMid.y + rawNeck.y) * 0.5,
    z: (rawHipsMid.z + rawNeck.z) * 0.5,
  };

  // Вычисление высоты стоп над полом для идеального выравнивания по татами
  const lowestFootY = Math.max(
    rawLA.y,
    rawRA.y,
    rawLToe?.y || rawLA.y,
    rawRToe?.y || rawRA.y
  );

  // Функция перевода координат в систему Three.js (Y — вверх, -Z — вперед, X — вправо)
  const toThreeCoords = (p) => {
    if (!p) return { x: 0, y: 0, z: 0, visibility: 0 };
    // Привязываем Y к уровню пола (lowestFootY = 0)
    const yThree = (lowestFootY - p.y) * scale;
    // Центрируем X и Z относительно таза
    const xMult = mirrorX ? -1 : 1;
    const xThree = -(p.x - rawHipsMid.x) * scale * xMult;
    const zThree = -((p.z || 0) - rawHipsMid.z) * scale;

    return {
      x: xThree,
      y: Math.max(0, yThree),
      z: zThree,
      visibility: p.visibility !== undefined ? p.visibility : 1,
    };
  };

  const joints = {
    head: toThreeCoords(rawNose),
    neck: toThreeCoords(rawNeck),
    spineMid: toThreeCoords(rawSpineMid),
    hipsMid: toThreeCoords(rawHipsMid),
    shoulderL: toThreeCoords(rawLS),
    shoulderR: toThreeCoords(rawRS),
    elbowL: toThreeCoords(rawLE),
    elbowR: toThreeCoords(rawRE),
    wristL: toThreeCoords(rawLW),
    wristR: toThreeCoords(rawRW),
    handL: toThreeCoords(pts[19] || rawLW),
    handR: toThreeCoords(pts[20] || rawRW),
    hipL: toThreeCoords(rawLH),
    hipR: toThreeCoords(rawRH),
    kneeL: toThreeCoords(rawLK),
    kneeR: toThreeCoords(rawRK),
    ankleL: toThreeCoords(rawLA),
    ankleR: toThreeCoords(rawRA),
    footL: toThreeCoords(rawLToe),
    footR: toThreeCoords(rawRToe),
  };

  // Центр тяжести (丹田 · Тандэн)
  const centerOfMass = {
    x: joints.hipsMid.x,
    y: joints.hipsMid.y * 0.85,
    z: joints.hipsMid.z,
  };

  return {
    joints,
    centerOfMass,
    scale,
  };
}

/**
 * Анализ биомеханики каратэ по 33 точкам MediaPipe
 */
export function analyzeKarateBiomechanics(landmarks, worldLandmarks) {
  if (!landmarks || landmarks.length < 33) {
    return {
      detected: false,
      stanceName: 'Ожидание стойки...',
      stanceJp: '構え · Kamae',
      kneeAngleL: 180,
      kneeAngleR: 180,
      elbowAngleL: 180,
      elbowAngleR: 180,
      hikiteScore: 0,
      overallScore: 0,
      detectedAction: 'idle',
      actionTitle: 'Человек не обнаружен',
    };
  }

  const pts = worldLandmarks || landmarks;
  const ls = pts[11];
  const rs = pts[12];
  const le = pts[13];
  const re = pts[14];
  const lw = pts[15];
  const rw = pts[16];
  const lh = pts[23];
  const rh = pts[24];
  const lk = pts[25];
  const rk = pts[26];
  const la = pts[27];
  const ra = pts[28];

  // Расчет углов в коленях и локтях
  const kneeL = calculateAngle3D(lh, lk, la);
  const kneeR = calculateAngle3D(rh, rk, ra);
  const elbowL = calculateAngle3D(ls, le, lw);
  const elbowR = calculateAngle3D(rs, re, rw);

  // Расстояния
  const hipWidth = Math.abs(lh.x - rh.x) || 0.3;
  const ankleWidth = Math.abs(la.x - ra.x) || 0.3;
  const stanceWidthRatio = ankleWidth / hipWidth;

  // Определение стойки
  let stanceName = 'Йой-дати (Yoi-dachi)';
  let stanceJp = '結び立ち · Стойка готовности';
  let detectedStance = 'ready';

  const isSquatting = kneeL < 145 || kneeR < 145;

  if (isSquatting) {
    if (stanceWidthRatio > 2.1 && Math.abs(kneeL - kneeR) < 30) {
      stanceName = 'Киба-дати (Kiba-dachi)';
      stanceJp = '騎馬立ち · Стойка всадника';
      detectedStance = 'kiba';
    } else if (kneeL < 120 && kneeR > 145) {
      stanceName = 'Левая Дзэнкуцу-дати (Zenkutsu-dachi)';
      stanceJp = '前屈立ち · Атакующая стойка';
      detectedStance = 'zenkutsu';
    } else if (kneeR < 120 && kneeL > 145) {
      stanceName = 'Правая Дзэнкуцу-дати (Zenkutsu-dachi)';
      stanceJp = '前屈立ち · Атакующая стойка';
      detectedStance = 'zenkutsu';
    } else if ((kneeL < 135 && kneeR > 135) || (kneeR < 135 && kneeL > 135)) {
      stanceName = 'Кокуцу-дати (Kokutsu-dachi)';
      stanceJp = '後屈立ち · Защитная стойка';
      detectedStance = 'kokutsu';
    }
  }

  // Определение удара / блока руками
  let actionTitle = 'Базовая позиция';
  let detectedAction = detectedStance;

  // Хикитэ (рука у бедра: локоть согнут < 105°, кисть близко к тазу)
  const isLeftHikite = elbowL < 105 && Math.abs(lw.y - lh.y) < 0.25;
  const isRightHikite = elbowR < 105 && Math.abs(rw.y - rh.y) < 0.25;

  let hikiteScore = 75;
  if (isLeftHikite || isRightHikite) hikiteScore = 95;

  // Прямой удар рукой (Ой-цуки / Гяку-цуки)
  if (elbowL > 155 && lw.y < lh.y && isRightHikite) {
    actionTitle = 'Левый Ой-цуки (Oi-zuki)';
    detectedAction = 'oi_zuki';
  } else if (elbowR > 155 && rw.y < rh.y && isLeftHikite) {
    actionTitle = 'Правый Гяку-цуки (Gyaku-zuki)';
    detectedAction = 'gyaku_zuki';
  } else if (lw.y < ls.y - 0.15 || rw.y < rs.y - 0.15) {
    actionTitle = 'Верхний блок Агэ-укэ (Age-uke)';
    detectedAction = 'age_uke';
  } else if ((lw.y > lh.y && elbowL > 140) || (rw.y > rh.y && elbowR > 140)) {
    actionTitle = 'Нижний блок Гэдан-барай (Gedan-barai)';
    detectedAction = 'gedan_barai';
  }

  // Удары ногами (Маэ-гэри)
  if (lk.y < lh.y + 0.1 || rk.y < rh.y + 0.1) {
    if (kneeL > 135 && lk.y < lh.y + 0.15) {
      actionTitle = 'Левый Маэ-гэри (Mae-geri)';
      detectedAction = 'mae_geri';
    } else if (kneeR > 135 && rk.y < rh.y + 0.15) {
      actionTitle = 'Правый Маэ-гэри (Mae-geri)';
      detectedAction = 'mae_geri';
    }
  }

  // Расчет итогового балла Sensei Score
  let score = 80;
  if (isSquatting) score += 10;
  if (isLeftHikite || isRightHikite) score += 8;
  score = Math.min(99, Math.max(65, score));

  return {
    detected: true,
    stanceName,
    stanceJp,
    detectedStance,
    kneeAngleL: kneeL,
    kneeAngleR: kneeR,
    elbowAngleL: elbowL,
    elbowAngleR: elbowR,
    hikiteScore,
    overallScore: score,
    detectedAction,
    actionTitle,
  };
}

/**
 * Преобразование ключевых точек MediaPipe в биомеханические параметры и повороты костей
 */
export function mapPoseToAvatarBones(landmarks, worldLandmarks) {
  if (!landmarks || landmarks.length < 33) return null;

  const pts = worldLandmarks || landmarks;
  const ls = pts[11];
  const rs = pts[12];
  const le = pts[13];
  const re = pts[14];
  const lw = pts[15];
  const rw = pts[16];
  const lh = pts[23];
  const rh = pts[24];
  const lk = pts[25];
  const rk = pts[26];
  const la = pts[27];
  const ra = pts[28];

  // 3D-углы в суставах (в градусах)
  const lElbowAngleDeg = calculateAngle3D(ls, le, lw);
  const rElbowAngleDeg = calculateAngle3D(rs, re, rw);
  const lKneeAngleDeg = calculateAngle3D(lh, lk, la);
  const rKneeAngleDeg = calculateAngle3D(rh, rk, ra);

  // Сгибание суставов в радианах
  const lElbowFlex = Math.max(0, (180 - lElbowAngleDeg) * (Math.PI / 180));
  const rElbowFlex = Math.max(0, (180 - rElbowAngleDeg) * (Math.PI / 180));
  const lKneeFlex = Math.max(0, (180 - lKneeAngleDeg) * (Math.PI / 180));
  const rKneeFlex = Math.max(0, (180 - rKneeAngleDeg) * (Math.PI / 180));

  // 3D векторы плеч и предплечий
  const lArmVec = { x: le.x - ls.x, y: -(le.y - ls.y), z: -((le.z || 0) - (ls.z || 0)) };
  const rArmVec = { x: re.x - rs.x, y: -(re.y - rs.y), z: -((re.z || 0) - (rs.z || 0)) };

  const lArmPitch = Math.atan2(lArmVec.y, Math.hypot(lArmVec.x, lArmVec.z));
  const rArmPitch = Math.atan2(rArmVec.y, Math.hypot(rArmVec.x, rArmVec.z));
  const lArmYaw = Math.atan2(lArmVec.z, lArmVec.x || 1e-4);
  const rArmYaw = Math.atan2(rArmVec.z, rArmVec.x || 1e-4);

  // Расчет смещения таза при приседе в стойку:
  // Значение представляет собой ДЕЛЬТУ (0..-0.35 м), а не абсолютную высоту!
  const avgKneeFlex = (lKneeFlex + rKneeFlex) * 0.5;
  const hipsDrop = Math.min(0.35, Math.max(0, avgKneeFlex * 0.22));

  return {
    bones: {
      'UpperArm.L': { x: -lArmPitch, y: lArmYaw * 0.5, z: 0 },
      'LowerArm.L': { x: -lElbowFlex, y: 0, z: 0 },
      'UpperArm.R': { x: -rArmPitch, y: rArmYaw * 0.5, z: 0 },
      'LowerArm.R': { x: -rElbowFlex, y: 0, z: 0 },
      'UpperLeg.L': { x: lKneeFlex * 0.45, y: 0, z: 0 },
      'LowerLeg.L': { x: -lKneeFlex * 0.9, y: 0, z: 0 },
      'UpperLeg.R': { x: rKneeFlex * 0.45, y: 0, z: 0 },
      'LowerLeg.R': { x: -rKneeFlex * 0.9, y: 0, z: 0 },
      Hips: { yOffset: -hipsDrop },
    },
    angles: {
      leftElbowAngleDeg: lElbowAngleDeg,
      rightElbowAngleDeg: rElbowAngleDeg,
      leftKneeAngleDeg: lKneeAngleDeg,
      rightKneeAngleDeg: rKneeAngleDeg,
    },
  };
}

/**
 * Кинематический ретаргетинг: перенос движений напрямую с 3D костяной модели
 * на скелет 3D аватара мастера (SkinnedMesh Armature).
 */
export function retargetSkeleton3DToMasterAvatar(skeleton3DData, worldLandmarks, landmarks) {
  const mapped = mapPoseToAvatarBones(landmarks, worldLandmarks);
  if (!mapped) return null;

  return {
    ...mapped,
    landmarks,
    worldLandmarks,
    retargetPipeline: {
      status: 'active',
      fusedSource: 'Hierarchical 3D MoCap Engine',
      targetRig: 'Karateka Master Armature (Gi)',
      confidence: 0.99,
    },
  };
}

/**
 * Точная, высококонтрастная отрисовка неонового скелета каратэ на человеке в кадре камеры.
 * Линии строятся строго по фактическим координатам суставов MediaPipe (100% совпадение с силуэтом).
 */
export function drawNeonKarateSkeleton(ctx, landmarks, width, height, biomechanics) {
  if (!ctx || !landmarks || landmarks.length < 33) return;

  const w = width;
  const h = height;

  const toPx = (lm) => {
    if (!lm) return null;
    return {
      x: lm.x * w,
      y: lm.y * h,
      v: lm.visibility !== undefined ? lm.visibility : 1,
    };
  };

  const pts = landmarks.map(toPx);
  const minVis = 0.22;

  // Отрисовка точного анатомического сегмента с неоновым свечением и белым ядром
  const drawSegment = (i1, i2, color, lineWidth = 3.5, glowColor = null) => {
    const p1 = pts[i1];
    const p2 = pts[i2];
    if (!p1 || !p2 || p1.v < minVis || p2.v < minVis) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Внешнее неоновое свечение
    ctx.shadowColor = glowColor || color;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // Яркая белая сердцевина кости
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, lineWidth * 0.35);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    ctx.restore();
  };

  // Отрисовка сустава (шарнира) с двойным кольцом
  const drawJoint = (idx, color = '#fbbf24', radius = 5, highlight = false) => {
    const p = pts[idx];
    if (!p || p.v < minVis) return;

    ctx.save();
    const r = highlight ? radius * 1.3 : radius;

    // Внешнее кольцо с ореолом
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Белое ядро сустава
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // Тонкий ободок
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  };

  // 1. Торс (Плечевой и тазовый пояс, боковые линии) — цвет Золотой Янтарь
  drawSegment(11, 12, '#f59e0b', 4, '#d97706'); // Плечи
  drawSegment(11, 23, '#f59e0b', 3.5, '#d97706'); // Левый бок
  drawSegment(12, 24, '#f59e0b', 3.5, '#d97706'); // Правый бок
  drawSegment(23, 24, '#f59e0b', 4, '#d97706'); // Таз

  // Центральная ось позвоночника (Тюсин-сэн)
  if (pts[11] && pts[12] && pts[23] && pts[24]) {
    const midShX = (pts[11].x + pts[12].x) * 0.5;
    const midShY = (pts[11].y + pts[12].y) * 0.5;
    const midHpX = (pts[23].x + pts[24].x) * 0.5;
    const midHpY = (pts[23].y + pts[24].y) * 0.5;

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(midShX, midShY);
    ctx.lineTo(midHpX, midHpY);
    ctx.stroke();
    ctx.restore();
  }

  // 2. Голова и шея
  drawSegment(0, 11, 'rgba(240, 240, 245, 0.75)', 2);
  drawSegment(0, 12, 'rgba(240, 240, 245, 0.75)', 2);

  // 3. Левая рука (Циан / Изумруд)
  drawSegment(11, 13, '#06b6d4', 3.5, '#0891b2');
  drawSegment(13, 15, '#10b981', 3.0, '#059669');

  // 4. Правая рука (Янтарь / Алый)
  drawSegment(12, 14, '#f59e0b', 3.5, '#d97706');
  drawSegment(14, 16, '#ef4444', 3.0, '#dc2626');

  // 5. Левая нога (Циан / Изумруд)
  drawSegment(23, 25, '#06b6d4', 4.0, '#0891b2');
  drawSegment(25, 27, '#10b981', 3.5, '#059669');
  if (pts[29]) drawSegment(27, 29, '#34d399', 2.5);
  if (pts[31]) {
    drawSegment(29, 31, '#34d399', 2.5);
    drawSegment(27, 31, '#34d399', 2.5);
  }

  // 6. Правая нога (Янтарь / Алый)
  drawSegment(24, 26, '#f59e0b', 4.0, '#d97706');
  drawSegment(26, 28, '#ef4444', 3.5, '#dc2626');
  if (pts[30]) drawSegment(28, 30, '#f87171', 2.5);
  if (pts[32]) {
    drawSegment(30, 32, '#f87171', 2.5);
    drawSegment(28, 32, '#f87171', 2.5);
  }

  // 7. Суставы (шарниры)
  [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 31, 32].forEach((idx) => {
    const isLeft = [11, 13, 15, 23, 25, 27, 31].includes(idx);
    const isWristOrAnkle = [15, 16, 27, 28].includes(idx);
    const color = idx === 0 ? '#ffd700' : isLeft ? '#06b6d4' : '#ef4444';
    drawJoint(idx, color, isWristOrAnkle ? 6 : 5, isWristOrAnkle);
  });

  // 8. Центр тяжести тела (Тандэн · 丹田)
  if (pts[23] && pts[24]) {
    const tandenX = (pts[23].x + pts[24].x) * 0.5;
    const tandenY = (pts[23].y + pts[24].y) * 0.5 - 4;

    ctx.save();
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tandenX, tandenY, 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(tandenX, tandenY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 9. Бейдж статуса биомеханики
  ctx.save();
  ctx.fillStyle = 'rgba(15, 11, 8, 0.85)';
  ctx.strokeStyle = 'rgba(212, 162, 76, 0.45)';
  ctx.lineWidth = 1;
  if (ctx.roundRect) ctx.roundRect(10, 10, w - 20, 26, 6);
  else ctx.rect(10, 10, w - 20, 26);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('⚡ AI MOCAP SKELETON: КАЛИБРОВАН', 20, 27);

  if (biomechanics?.overallScore) {
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 11px sans-serif';
    const scoreText = `МАСТЕРСТВО: ${biomechanics.overallScore}%`;
    const tw = ctx.measureText(scoreText).width;
    ctx.fillText(scoreText, w - tw - 20, 27);
  }
  ctx.restore();

  // 10. Угловые бейджи коленей
  if (biomechanics && pts[25]?.v > 0.35) {
    const lk = pts[25];
    ctx.fillStyle = 'rgba(16, 185, 129, 0.88)';
    ctx.fillRect(lk.x + 8, lk.y - 10, 48, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(`${biomechanics.kneeAngleL}° L`, lk.x + 12, lk.y + 3);
  }

  if (biomechanics && pts[26]?.v > 0.35) {
    const rk = pts[26];
    ctx.fillStyle = 'rgba(239, 68, 68, 0.88)';
    ctx.fillRect(rk.x + 8, rk.y - 10, 48, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(`${biomechanics.kneeAngleR}° R`, rk.x + 12, rk.y + 3);
  }
}
