/**
 * Bunkai Explorer — AI Motion Capture & Karate Biomechanics Engine
 * 
 * Интеграция алгоритмов захвата движений и биомеханики из Karate Motion Studio:
 * - Адаптивный 1€ (One-Euro) фильтр для устранения высокочастотного дрожания при сохранении резких ударов (Кимэ)
 * - Анатомический клиренс грудной клетки (Torso Clearance) для исключения проваливания рук сквозь ребра
 * - Поддержка захвата движений с 1, 2 или 3 камер смартфонов (0° Фронт, 90° Бок, 45° Угол)
 * - Стереоскопическая 3D-триангуляция и слияние глубины (Front X, Y + Side Z depth)
 * - Пиксель-в-пиксель наложение неонового 2D-скелета на видоискатель
 * - Биомеханический анализ стоек каратэ (Дзэнкуцу, Киба, Кокуцу, Йой) и ударов
 */

import { computePerFingerConfidence, disambiguateHandSide } from './mocapHandRetargeter.js';
import {
  CameraParameters,
  calibrateCameraFromPose,
  SynchronizedFrameBuffer,
  triangulateRays,
  filterOutlierRays,
  MultiCameraMoCapEngine,
} from './mocapMultiCameraEngine.js';

export {
  CameraParameters,
  calibrateCameraFromPose,
  SynchronizedFrameBuffer,
  triangulateRays,
  filterOutlierRays,
  MultiCameraMoCapEngine,
  sharedMultiCameraEngine,
};

export {
  KARATEKA_BONE_HIERARCHY,
  ANATOMICAL_JOINT_LIMITS,
  ContinuousAzimuthTracker,
  constrainKneeJoint,
  constrainElbowJoint,
  FootContactManager,
  DynamicKimePreserver,
  NetworkPlayoutJitterBuffer,
  MasterBiomechanicalRetargeter,
  evaluateThreeSkeletonUtilsRetargeting,
} from './mocapBiomechanicalRetargeter.js';

const sharedMultiCameraEngine = new MultiCameraMoCapEngine();

let poseInstance = null;
let poseLoadPromise = null;

// ============================================================================
// 1. АДАПТИВНЫЙ 1€ (ONE-EURO) ФИЛЬТР (Casiez et al., CHI 2012)
// Точный порт из Karate Motion Studio (core/filters.py)
// ============================================================================

export class LowPassFilter {
  constructor(alpha = 0.5) {
    this.alpha = alpha;
    this.s = null;
    this.y = null;
  }

  filter(value, alpha = null) {
    if (alpha !== null) this.alpha = alpha;
    if (this.s === null) {
      this.s = value;
    } else {
      this.s = this.alpha * value + (1.0 - this.alpha) * this.s;
    }
    this.y = value;
    return this.s;
  }

  reset() {
    this.s = null;
    this.y = null;
  }
}

export class OneEuroFilter {
  /**
   * Адаптивный фильтр 1€:
   * - В покое: низкая частота среза полностью устраняет сенсорный шум и микродрожание
   * - При резком ударе (Кимэ): частота среза расширяется пропорционально скорости (dx),
   *   обеспечивая мгновенный отклик без фазового запаздывания.
   */
  constructor(freq = 30.0, minCutoff = 1.2, beta = 0.08, dCutoff = 1.0) {
    this.freq = Math.max(1e-3, freq);
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;

    this.xFilter = new LowPassFilter(this._alpha(minCutoff));
    this.dxFilter = new LowPassFilter(this._alpha(dCutoff));
    this.lastTime = null;
  }

  _alpha(cutoff) {
    const tau = 1.0 / (2.0 * Math.PI * cutoff);
    const te = 1.0 / this.freq;
    return 1.0 / (1.0 + tau / te);
  }

  filter(x, timestamp = null) {
    if (this.lastTime !== null && timestamp !== null) {
      const dt = (timestamp - this.lastTime) / 1000.0;
      if (dt > 1e-4) {
        this.freq = 1.0 / dt;
      }
    }
    this.lastTime = timestamp;

    const prevX = this.xFilter.y;
    const rawDiff = prevX === null ? 0.0 : Math.abs(x - prevX);
    let dx = prevX === null ? 0.0 : (x - prevX) * this.freq;

    // Подавление зоны нечувствительности для неподвижного бойца (deadband suppression)
    if (rawDiff < 0.006) {
      dx *= 0.15;
    }

    const edx = this.dxFilter.filter(dx, this._alpha(this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xFilter.filter(x, this._alpha(cutoff));
  }

  reset() {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTime = null;
  }
}

export class Vector3DOneEuroFilter {
  constructor(freq = 30.0, minCutoff = 1.2, beta = 0.08, dCutoff = 1.0) {
    this.fx = new OneEuroFilter(freq, minCutoff, beta, dCutoff);
    this.fy = new OneEuroFilter(freq, minCutoff, beta, dCutoff);
    this.fz = new OneEuroFilter(freq, minCutoff, beta, dCutoff);
  }

  filter(pt, timestamp = null) {
    if (!pt) return pt;
    return [
      this.fx.filter(pt[0], timestamp),
      this.fy.filter(pt[1], timestamp),
      this.fz.filter(pt[2], timestamp),
    ];
  }

  reset() {
    this.fx.reset();
    this.fy.reset();
    this.fz.reset();
  }
}

// Банк 1€ фильтров для сглаживания 33 ключевых точек
const landmark3DFilters = Array.from({ length: 33 }, () => new Vector3DOneEuroFilter(30.0, 1.2, 0.08, 1.0));
const landmark2DFilters = Array.from({ length: 33 }, () => new Vector3DOneEuroFilter(30.0, 1.5, 0.06, 1.0));

export function resetMocapFilters() {
  landmark3DFilters.forEach((f) => f.reset());
  landmark2DFilters.forEach((f) => f.reset());
}

// ============================================================================
// 2. АНАТОМИЧЕСКИЙ КЛИРЕНС ГРУДНОЙ КЛЕТКИ (Torso Clearance)
// Порт из Karate Motion Studio (core/mocap_tracker.py, lines 498–555)
// ============================================================================

/**
 * Исключает проваливание рук сквозь ребра и позвоночник при скрещивании рук
 * перед грудью (блоки Агэ-укэ, Дзюдзи-укэ, исходные позиции и удары).
 */
export function applyTorsoClearance(rawPts3D) {
  if (
    !rawPts3D ||
    !rawPts3D.left_shoulder ||
    !rawPts3D.right_shoulder ||
    !rawPts3D.left_hip ||
    !rawPts3D.right_hip
  ) {
    return rawPts3D;
  }

  const l_sh = rawPts3D.left_shoulder;
  const r_sh = rawPts3D.right_shoulder;
  const l_hp = rawPts3D.left_hip;
  const r_hp = rawPts3D.right_hip;

  const mid_sh = [
    (l_sh[0] + r_sh[0]) * 0.5,
    (l_sh[1] + r_sh[1]) * 0.5,
    (l_sh[2] + r_sh[2]) * 0.5,
  ];
  const mid_hp = [
    (l_hp[0] + r_hp[0]) * 0.5,
    (l_hp[1] + r_hp[1]) * 0.5,
    (l_hp[2] + r_hp[2]) * 0.5,
  ];

  const v_spine = [
    mid_sh[0] - mid_hp[0],
    mid_sh[1] - mid_hp[1],
    mid_sh[2] - mid_hp[2],
  ];
  const spine_len_sq =
    v_spine[0] * v_spine[0] + v_spine[1] * v_spine[1] + v_spine[2] * v_spine[2];

  if (spine_len_sq <= 1e-4) return rawPts3D;

  const spine_len = Math.sqrt(spine_len_sq);
  const uy = [v_spine[0] / spine_len, v_spine[1] / spine_len, v_spine[2] / spine_len];

  const v_lat = [l_sh[0] - r_sh[0], l_sh[1] - r_sh[1], l_sh[2] - r_sh[2]];
  const dot_lat_uy = v_lat[0] * uy[0] + v_lat[1] * uy[1] + v_lat[2] * uy[2];
  let ux = [
    v_lat[0] - dot_lat_uy * uy[0],
    v_lat[1] - dot_lat_uy * uy[1],
    v_lat[2] - dot_lat_uy * uy[2],
  ];
  const ux_norm = Math.hypot(ux[0], ux[1], ux[2]);
  if (ux_norm <= 1e-4) return rawPts3D;

  ux = [ux[0] / ux_norm, ux[1] / ux_norm, ux[2] / ux_norm];

  // Нормаль вперед от грудины: uz = ux x uy
  const uz = [
    ux[1] * uy[2] - ux[2] * uy[1],
    ux[2] * uy[0] - ux[0] * uy[2],
    ux[0] * uy[1] - ux[1] * uy[0],
  ];

  const v_lat_norm = Math.hypot(v_lat[0], v_lat[1], v_lat[2]);
  const ribcage_half_width = v_lat_norm * 0.55;

  const armJoints = [
    'left_elbow',
    'left_wrist',
    'right_elbow',
    'right_wrist',
    'left_index',
    'right_index',
  ];

  const out = { ...rawPts3D };

  for (const arm_j of armJoints) {
    if (out[arm_j]) {
      const pt = out[arm_j];
      const v_pt = [pt[0] - mid_hp[0], pt[1] - mid_hp[1], pt[2] - mid_hp[2]];
      const t =
        (v_pt[0] * v_spine[0] + v_pt[1] * v_spine[1] + v_pt[2] * v_spine[2]) /
        spine_len_sq;

      // Применяется только к грудному отделу (t in [0.20, 1.08])
      // Бедра и колени (t < 0.20) остаются свободными для касания руками
      if (t >= 0.2 && t <= 1.08) {
        const spine_center = [
          mid_hp[0] + t * v_spine[0],
          mid_hp[1] + t * v_spine[1],
          mid_hp[2] + t * v_spine[2],
        ];
        const delta = [
          pt[0] - spine_center[0],
          pt[1] - spine_center[1],
          pt[2] - spine_center[2],
        ];
        const dist_lateral = Math.abs(
          delta[0] * ux[0] + delta[1] * ux[1] + delta[2] * ux[2]
        );

        if (dist_lateral < ribcage_half_width) {
          const dist_along_normal =
            delta[0] * uz[0] + delta[1] * uz[1] + delta[2] * uz[2];
          const min_clearance = 0.08; // 8 см перед центральной линией позвоночника
          if (dist_along_normal < min_clearance) {
            const shift = min_clearance - dist_along_normal;
            out[arm_j] = [
              pt[0] + shift * uz[0],
              pt[1] + shift * uz[1],
              pt[2] + shift * uz[2],
            ];
          }
        }
      }
    }
  }

  return out;
}

/**
 * Применяет анатомический клиренс грудины напрямую к массиву 33 точек MediaPipe Pose
 */
export function applyTorsoClearanceToLandmarks(worldLandmarks) {
  if (!worldLandmarks || worldLandmarks.length < 33) return worldLandmarks;

  const rawLS = worldLandmarks[11];
  const rawRS = worldLandmarks[12];
  const rawLH = worldLandmarks[23];
  const rawRH = worldLandmarks[24];

  if (!rawLS || !rawRS || !rawLH || !rawRH) return worldLandmarks;

  // В координатах Three.js: X вправо, Y вверх (-raw.y), Z вперед (-raw.z)
  const l_sh = [rawLS.x, -rawLS.y, -rawLS.z];
  const r_sh = [rawRS.x, -rawRS.y, -rawRS.z];
  const l_hp = [rawLH.x, -rawLH.y, -rawLH.z];
  const r_hp = [rawRH.x, -rawRH.y, -rawRH.z];

  const mid_sh = [(l_sh[0] + r_sh[0]) * 0.5, (l_sh[1] + r_sh[1]) * 0.5, (l_sh[2] + r_sh[2]) * 0.5];
  const mid_hp = [(l_hp[0] + r_hp[0]) * 0.5, (l_hp[1] + r_hp[1]) * 0.5, (l_hp[2] + r_hp[2]) * 0.5];

  const v_spine = [mid_sh[0] - mid_hp[0], mid_sh[1] - mid_hp[1], mid_sh[2] - mid_hp[2]];
  const spine_len_sq = v_spine[0] * v_spine[0] + v_spine[1] * v_spine[1] + v_spine[2] * v_spine[2];
  if (spine_len_sq <= 1e-4) return worldLandmarks;

  const spine_len = Math.sqrt(spine_len_sq);
  const uy = [v_spine[0] / spine_len, v_spine[1] / spine_len, v_spine[2] / spine_len];

  const v_lat = [l_sh[0] - r_sh[0], l_sh[1] - r_sh[1], l_sh[2] - r_sh[2]];
  const dot_lat_uy = v_lat[0] * uy[0] + v_lat[1] * uy[1] + v_lat[2] * uy[2];
  let ux = [v_lat[0] - dot_lat_uy * uy[0], v_lat[1] - dot_lat_uy * uy[1], v_lat[2] - dot_lat_uy * uy[2]];
  const ux_norm = Math.hypot(ux[0], ux[1], ux[2]);
  if (ux_norm <= 1e-4) return worldLandmarks;
  ux = [ux[0] / ux_norm, ux[1] / ux_norm, ux[2] / ux_norm];

  const uz = [
    ux[1] * uy[2] - ux[2] * uy[1],
    ux[2] * uy[0] - ux[0] * uy[2],
    ux[0] * uy[1] - ux[1] * uy[0],
  ];

  const ribcage_half_width = Math.hypot(v_lat[0], v_lat[1], v_lat[2]) * 0.55;
  const out = worldLandmarks.map((p) => ({ ...p }));
  const armIndices = [13, 14, 15, 16, 19, 20];

  for (const idx of armIndices) {
    const raw = out[idx];
    if (!raw) continue;
    const pt = [raw.x, -raw.y, -raw.z];
    const v_pt = [pt[0] - mid_hp[0], pt[1] - mid_hp[1], pt[2] - mid_hp[2]];
    const t = (v_pt[0] * v_spine[0] + v_pt[1] * v_spine[1] + v_pt[2] * v_spine[2]) / spine_len_sq;

    if (t >= 0.20 && t <= 1.08) {
      const spine_center = [
        mid_hp[0] + t * v_spine[0],
        mid_hp[1] + t * v_spine[1],
        mid_hp[2] + t * v_spine[2],
      ];
      const delta = [pt[0] - spine_center[0], pt[1] - spine_center[1], pt[2] - spine_center[2]];
      const dist_lateral = Math.abs(delta[0] * ux[0] + delta[1] * ux[1] + delta[2] * ux[2]);

      if (dist_lateral < ribcage_half_width) {
        const dist_along_normal = delta[0] * uz[0] + delta[1] * uz[1] + delta[2] * uz[2];
        const min_clearance = 0.08;
        if (dist_along_normal < min_clearance) {
          const shift = min_clearance - dist_along_normal;
          const cleared = [pt[0] + shift * uz[0], pt[1] + shift * uz[1], pt[2] + shift * uz[2]];
          out[idx].x = cleared[0];
          out[idx].y = -cleared[1];
          out[idx].z = -cleared[2];
        }
      }
    }
  }

  return out;
}

// ============================================================================
// 3. ЗАГРУЗКА MEDIAPIPE POSE
// ============================================================================

const MEDIAPIPE_POSE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js';

export function loadMediaPipePose() {
  if (poseInstance) return Promise.resolve(poseInstance);
  if (poseLoadPromise) return poseLoadPromise;

  poseLoadPromise = new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Pose) {
      initPose();
      return;
    }

    const script = document.createElement('script');
    script.src = MEDIAPIPE_POSE_CDN;
    script.crossOrigin = 'anonymous';
    script.onload = () => initPose();
    script.onerror = (err) => {
      console.error('Ошибка загрузки MediaPipe Pose CDN:', err);
      poseLoadPromise = null;
      reject(new Error('Не удалось загрузить библиотеку MediaPipe Pose'));
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
        poseLoadPromise = null;
        reject(err);
      }
    }
  });

  return poseLoadPromise;
}

const MEDIAPIPE_HANDS_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js';
let handsInstance = null;
let handsLoadPromise = null;

export function loadMediaPipeHands(options = {}) {
  if (handsInstance) return Promise.resolve(handsInstance);
  if (handsLoadPromise) return handsLoadPromise;

  handsLoadPromise = new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Hands) {
      initHands();
      return;
    }

    const script = document.createElement('script');
    script.src = MEDIAPIPE_HANDS_CDN;
    script.crossOrigin = 'anonymous';
    script.onload = () => initHands();
    script.onerror = (err) => {
      console.error('Ошибка загрузки MediaPipe Hands CDN:', err);
      handsLoadPromise = null;
      reject(new Error('Не удалось загрузить библиотеку MediaPipe Hands'));
    };
    document.head.appendChild(script);

    function initHands() {
      try {
        const hands = new window.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: options.modelComplexity !== undefined ? options.modelComplexity : 0,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        handsInstance = hands;
        resolve(hands);
      } catch (err) {
        handsLoadPromise = null;
        reject(err);
      }
    }
  });

  return handsLoadPromise;
}


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

// ============================================================================
// 4. МУЛЬТИ-КАМЕРНОЕ СЛИЯНИЕ ДЛЯ 1, 2 ИЛИ 3 КАМЕР (С 1€ ФИЛЬТРАЦИЕЙ)
// ============================================================================

export function fuseMultiCameraLandmarks(cameraFeeds = {}, timestamp = null) {
  const c1 = cameraFeeds[1]; // Фронт (0°)
  const c2 = cameraFeeds[2]; // Бок (90°)
  const c3 = cameraFeeds[3]; // Угол (45°)

  const activeSlots = [1, 2, 3].filter(
    (s) => cameraFeeds[s]?.landmarks && cameraFeeds[s].landmarks.length >= 33
  );

  if (activeSlots.length === 0) return null;

  const curTime = timestamp || Date.now();

  let fusedLmsRaw = [];
  let fusedWlmsRaw = [];
  let cameraMode = 'single_front';

  // --- СЛУЧАЙ 1: РОВНО 1 КАМЕРА ---
  if (activeSlots.length === 1) {
    const slot = activeSlots[0];
    const feed = cameraFeeds[slot];
    const lms = feed.landmarks;
    const wlms = feed.worldLandmarks || lms;

    if (slot === 1) {
      // 1 камера: Фронтальная
      fusedLmsRaw = lms;
      fusedWlmsRaw = wlms;
      cameraMode = 'single_front';
    } else if (slot === 2) {
      // 1 камера: Боковая (90°) — разворачиваем X в мировую глубину Z
      const hipX = ((wlms[23]?.x ?? 0) + (wlms[24]?.x ?? 0)) * 0.5;
      cameraMode = 'single_side';

      for (let i = 0; i < 33; i++) {
        const p = lms[i];
        const w = wlms[i];
        const depthZ = (w.x - hipX) * 1.15;
        const lateralX = -(w.z || 0);

        fusedLmsRaw.push({ x: p.x, y: p.y, z: depthZ, visibility: p.visibility ?? 1 });
        fusedWlmsRaw.push({ x: lateralX, y: w.y, z: depthZ, visibility: w.visibility ?? 1 });
      }
    } else if (slot === 3) {
      // 1 камера: Угловая (45°)
      const cos45 = 0.7071;
      const sin45 = 0.7071;
      cameraMode = 'single_angle';

      for (let i = 0; i < 33; i++) {
        const p = lms[i];
        const w = wlms[i];
        const rx = w.x * cos45 + (w.z || 0) * sin45;
        const rz = -w.x * sin45 + (w.z || 0) * cos45;

        fusedLmsRaw.push({ ...p, z: rz });
        fusedWlmsRaw.push({ x: rx, y: w.y, z: rz, visibility: w.visibility ?? 1 });
      }
    }
  } else {
    // --- СЛУЧАЙ 2 И 3: МУЛЬТИ-КАМЕРНЫЙ ЗАХВАТ (2 ИЛИ 3 КАМЕРЫ) ---
    // Подаем пакеты в геометрический движок лучевой триангуляции
    for (const s of activeSlots) {
      const feed = cameraFeeds[s];
      sharedMultiCameraEngine.ingestCameraPacket({
        slot: Number(s),
        timestamp: feed.timestamp || curTime,
        landmarks: feed.landmarks,
        worldLandmarks: feed.worldLandmarks || feed.landmarks,
        fingers: feed.fingers,
        hands: feed.hands,
        head: feed.head,
        trackingLost: feed.trackingLost || false,
      });
    }

    let engineTriangulated = null;
    try {
      engineTriangulated = sharedMultiCameraEngine.reconstructFrame(curTime);
    } catch (e) {
      console.warn('Triangulation fallback:', e);
    }

    if (engineTriangulated && engineTriangulated.worldLandmarks && engineTriangulated.worldLandmarks.length === 33) {
      fusedLmsRaw = engineTriangulated.landmarks;
      fusedWlmsRaw = engineTriangulated.worldLandmarks;
      cameraMode = engineTriangulated.mode;
    } else {
      const hasC1 = Boolean(c1?.landmarks);
      const hasC2 = Boolean(c2?.landmarks);
      const hasC3 = Boolean(c3?.landmarks);

      const c2_w = c2?.worldLandmarks;
      const c2_hipX = c2_w && c2_w[23] && c2_w[24]
        ? (c2_w[23].x + c2_w[24].x) * 0.5
        : 0;

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

        let totalVisY = 0;
        let sumFy = 0;
        let sumWy = 0;
        if (hasC1 && p1) { sumFy += p1.y * Math.max(0.2, vis1); sumWy += w1.y * Math.max(0.2, vis1); totalVisY += Math.max(0.2, vis1); }
        if (hasC2 && p2) { sumFy += p2.y * Math.max(0.2, vis2); sumWy += w2.y * Math.max(0.2, vis2); totalVisY += Math.max(0.2, vis2); }
        if (hasC3 && p3) { sumFy += p3.y * Math.max(0.2, vis3); sumWy += w3.y * Math.max(0.2, vis3); totalVisY += Math.max(0.2, vis3); }

        const fy = totalVisY > 0 ? sumFy / totalVisY : (p1?.y ?? p2?.y ?? p3?.y ?? 0.5);
        const wy = totalVisY > 0 ? sumWy / totalVisY : (w1?.y ?? w2?.y ?? w3?.y ?? 0.0);

        let fz = 0.0;
        let wz = 0.0;
        if (hasC2 && vis2 >= 0.28) {
          const physicalDepthZ = (w2.x - c2_hipX) * 1.15;
          wz = (hasC1 && vis1 > 0.5) ? (physicalDepthZ * 0.85 + w1.z * 0.15) : physicalDepthZ;
          fz = wz;
        } else if (hasC3 && vis3 >= 0.38) {
          const angleDepthZ = (-w3.x + (w3.z || 0)) * 0.7071;
          wz = (hasC1 && vis1 > 0.45) ? (angleDepthZ * 0.65 + w1.z * 0.35) : angleDepthZ;
          fz = wz;
        } else if (hasC1) {
          fz = p1.z || 0;
          wz = w1.z || 0;
        }

        const maxVis = Math.max(vis1, vis2, vis3);
        fusedLmsRaw.push({ x: fx, y: fy, z: fz, visibility: maxVis });
        fusedWlmsRaw.push({ x: wx, y: wy, z: wz, visibility: maxVis });
      }

      cameraMode = activeSlots.length === 3
        ? 'triangulation_3cam'
        : (activeSlots.includes(1) && activeSlots.includes(2))
          ? 'stereo_front_side'
          : (activeSlots.includes(1) && activeSlots.includes(3))
            ? 'stereo_front_angle'
            : 'stereo_side_angle';
    }
  }

  // --- 4. ПРИМЕНЕНИЕ АДАПТИВНОГО 1€ ФИЛЬТРА КО ВСЕМ ТОЧКАМ ---
  const filteredLms = [];
  const filteredWlms = [];

  for (let i = 0; i < 33; i++) {
    const p2 = fusedLmsRaw[i];
    const p3 = fusedWlmsRaw[i];

    // Фильтруем 2D экранные координаты
    const f2 = landmark2DFilters[i].filter([p2.x, p2.y, p2.z || 0], curTime);
    filteredLms.push({
      x: f2[0],
      y: f2[1],
      z: f2[2],
      visibility: p2.visibility ?? 1,
    });

    // Фильтруем 3D мировые координаты
    const f3 = landmark3DFilters[i].filter([p3.x, p3.y, p3.z || 0], curTime);
    filteredWlms.push({
      x: f3[0],
      y: f3[1],
      z: f3[2],
      visibility: p3.visibility ?? 1,
    });
  }

  // Применяем анатомический клиренс грудины (руки не проваливаются сквозь ребра)
  const clearedWlms = applyTorsoClearanceToLandmarks(filteredWlms);

  // Слияние кинематики кистей и пальцев:
  // При наличии данных из движка триангуляции используем его выбор ракурса с наивысшей уверенностью
  let fusedFingers = engineTriangulated?.fingers || null;
  let fusedHands = engineTriangulated?.hands || null;
  let fusedHead = engineTriangulated?.head || null;

  if (!fusedFingers) {
    for (const s of [1, 3, 2]) {
      const feed = cameraFeeds[s];
      if (feed?.fingers && (feed.fingers.left?.detected || feed.fingers.right?.detected)) {
        if (!fusedFingers) {
          fusedFingers = { ...feed.fingers };
        } else {
          if (!fusedFingers.left?.detected && feed.fingers.left?.detected) {
            fusedFingers.left = feed.fingers.left;
          }
          if (!fusedFingers.right?.detected && feed.fingers.right?.detected) {
            fusedFingers.right = feed.fingers.right;
          }
        }
      }
      if (feed?.hands && Array.isArray(feed.hands) && feed.hands.length > 0) {
        if (!fusedHands) fusedHands = feed.hands;
      }
    }
  }

  // Слияние ориентации взгляда Мэцукэ
  if (!fusedHead) {
    for (const s of [1, 3, 2]) {
      if (cameraFeeds[s]?.head) {
        fusedHead = cameraFeeds[s].head;
        break;
      }
    }
  }

  return {
    landmarks: filteredLms,
    worldLandmarks: clearedWlms,
    fused: activeSlots.length > 1,
    cameraMode,
    activeCameras: activeSlots,
    fingers: fusedFingers,
    hands: fusedHands,
    head: fusedHead,
    syncHealth: engineTriangulated?.syncHealth || 'perfect',
    maxDriftMs: engineTriangulated?.maxDriftMs || 0,
    reprojectionErrorAvg: engineTriangulated?.reprojectionErrorAvg || 0.0,
  };
}

// ============================================================================
// 5. БИОМЕХАНИЧЕСКИЙ АНАЛИЗ И СТОЙКИ КАРАТЭ
// ============================================================================

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

  const kneeL = calculateAngle3D(lh, lk, la);
  const kneeR = calculateAngle3D(rh, rk, ra);
  const elbowL = calculateAngle3D(ls, le, lw);
  const elbowR = calculateAngle3D(rs, re, rw);

  const hipWidth = Math.abs(lh.x - rh.x) || 0.3;
  const ankleWidth = Math.abs(la.x - ra.x) || 0.3;
  const stanceWidthRatio = ankleWidth / hipWidth;

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

  let actionTitle = 'Базовая позиция';
  let detectedAction = detectedStance;

  const isLeftHikite = elbowL < 105 && Math.abs(lw.y - lh.y) < 0.25;
  const isRightHikite = elbowR < 105 && Math.abs(rw.y - rh.y) < 0.25;

  let hikiteScore = 75;
  if (isLeftHikite || isRightHikite) hikiteScore = 95;

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

  if (lk.y < lh.y + 0.1 || rk.y < rh.y + 0.1) {
    if (kneeL > 135 && lk.y < lh.y + 0.15) {
      actionTitle = 'Левый Маэ-гэри (Mae-geri)';
      detectedAction = 'mae_geri';
    } else if (kneeR > 135 && rk.y < rh.y + 0.15) {
      actionTitle = 'Правый Маэ-гэри (Mae-geri)';
      detectedAction = 'mae_geri';
    }
  }

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

// ============================================================================
// 6. ПРЕОБРАЗОВАНИЕ ДАННЫХ В 3D ДЛЯ THREE.JS
// ============================================================================

export function build3DSkeletonData(worldLandmarks, landmarks, options = {}) {
  const pts = worldLandmarks || landmarks;
  if (!pts || pts.length < 33) return null;

  const scale = options.scale || 1.35;
  const mirrorX = options.mirrorX !== undefined ? options.mirrorX : false;

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

  const isYUp = (rawNeck.y || 0) > (rawLA.y || 0);
  const lowestFootY = isYUp
    ? Math.min(
        rawLA.y,
        rawRA.y,
        rawLToe?.y !== undefined ? rawLToe.y : rawLA.y,
        rawRToe?.y !== undefined ? rawRToe.y : rawRA.y
      )
    : Math.max(
        rawLA.y,
        rawRA.y,
        rawLToe?.y !== undefined ? rawLToe.y : rawLA.y,
        rawRToe?.y !== undefined ? rawRToe.y : rawRA.y
      );

  const toThreeCoords = (p) => {
    if (!p) return { x: 0, y: 0, z: 0, visibility: 0 };
    const yThree = isYUp ? (p.y - lowestFootY) * scale : (lowestFootY - p.y) * scale;
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

  return {
    joints,
    centerOfMass: {
      x: joints.hipsMid.x,
      y: joints.hipsMid.y * 0.85,
      z: joints.hipsMid.z,
    },
    scale,
  };
}

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

  const lElbowAngleDeg = calculateAngle3D(ls, le, lw);
  const rElbowAngleDeg = calculateAngle3D(rs, re, rw);
  const lKneeAngleDeg = calculateAngle3D(lh, lk, la);
  const rKneeAngleDeg = calculateAngle3D(rh, rk, ra);

  const lElbowFlex = Math.max(0, (180 - lElbowAngleDeg) * (Math.PI / 180));
  const rElbowFlex = Math.max(0, (180 - rElbowAngleDeg) * (Math.PI / 180));
  const lKneeFlex = Math.max(0, (180 - lKneeAngleDeg) * (Math.PI / 180));
  const rKneeFlex = Math.max(0, (180 - rKneeAngleDeg) * (Math.PI / 180));

  const lArmVec = { x: le.x - ls.x, y: -(le.y - ls.y), z: -((le.z || 0) - (ls.z || 0)) };
  const rArmVec = { x: re.x - rs.x, y: -(re.y - rs.y), z: -((re.z || 0) - (rs.z || 0)) };

  const lArmPitch = Math.atan2(lArmVec.y, Math.hypot(lArmVec.x, lArmVec.z));
  const rArmPitch = Math.atan2(rArmVec.y, Math.hypot(rArmVec.x, rArmVec.z));
  const lArmYaw = Math.atan2(lArmVec.z, lArmVec.x || 1e-4);
  const rArmYaw = Math.atan2(rArmVec.z, rArmVec.x || 1e-4);

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

// ============================================================================
// 7. ТОЧНАЯ ОТРИСОВКА НЕОНОВОГО СКЕЛЕТА И КИСТЕЙ 1:1 НА ВИДОИСКАТЕЛЕ
// Стилистика и цветовая гамма из Karate Motion Studio (gui/video_panel.py & draw_utils.py)
// ============================================================================

/**
 * Отрисовка неонового скелета кисти (21 ключевая точка, 5 пальцев)
 */
export function drawNeonHandSkeleton(ctx, handLandmarks, handednessLabel = 'Right', width = 1280, height = 720, options = {}) {
  if (!ctx || !handLandmarks || handLandmarks.length < 21) return;
  const w = width;
  const h = height;

  const pts = handLandmarks.map((lm) => ({
    x: lm.x * w,
    y: lm.y * h,
  }));

  const FINGER_COLORS = {
    thumb: { main: '#f59e0b', glow: '#d97706' },  // Янтарный (Большой палец)
    index: { main: '#06b6d4', glow: '#0891b2' },  // Кибер-Циан (Указательный)
    middle: { main: '#10b981', glow: '#059669' }, // Изумруд (Средний)
    ring: { main: '#3b82f6', glow: '#2563eb' },   // Электрик-Синий (Безымянный)
    pinky: { main: '#a855f7', glow: '#9333ea' },  // Неоновый Пурпур (Мизинец)
    palm: { main: '#fbbf24', glow: '#d97706' },   // Золото (Ладонь)
  };

  const drawSegment = (i1, i2, color, glowColor, lineWidth = 2.4) => {
    const p1 = pts[i1];
    const p2 = pts[i2];
    if (!p1 || !p2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 6;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, lineWidth * 0.4);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    ctx.restore();
  };

  const drawJoint = (idx, color = '#fbbf24', radius = 3.5) => {
    const p = pts[idx];
    if (!p) return;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // 1. Пястье и ладонь
  drawSegment(0, 1, FINGER_COLORS.thumb.main, FINGER_COLORS.thumb.glow, 2.6);
  drawSegment(0, 5, FINGER_COLORS.palm.main, FINGER_COLORS.palm.glow, 2.4);
  drawSegment(0, 17, FINGER_COLORS.palm.main, FINGER_COLORS.palm.glow, 2.4);
  drawSegment(5, 9, FINGER_COLORS.palm.main, FINGER_COLORS.palm.glow, 2.0);
  drawSegment(9, 13, FINGER_COLORS.palm.main, FINGER_COLORS.palm.glow, 2.0);
  drawSegment(13, 17, FINGER_COLORS.palm.main, FINGER_COLORS.palm.glow, 2.0);

  // 2. Большой палец (CMC -> MCP -> IP -> TIP)
  drawSegment(1, 2, FINGER_COLORS.thumb.main, FINGER_COLORS.thumb.glow, 2.5);
  drawSegment(2, 3, FINGER_COLORS.thumb.main, FINGER_COLORS.thumb.glow, 2.2);
  drawSegment(3, 4, FINGER_COLORS.thumb.main, FINGER_COLORS.thumb.glow, 2.0);

  // 3. Указательный палец
  drawSegment(5, 6, FINGER_COLORS.index.main, FINGER_COLORS.index.glow, 2.5);
  drawSegment(6, 7, FINGER_COLORS.index.main, FINGER_COLORS.index.glow, 2.2);
  drawSegment(7, 8, FINGER_COLORS.index.main, FINGER_COLORS.index.glow, 2.0);

  // 4. Средний палец
  drawSegment(9, 10, FINGER_COLORS.middle.main, FINGER_COLORS.middle.glow, 2.5);
  drawSegment(10, 11, FINGER_COLORS.middle.main, FINGER_COLORS.middle.glow, 2.2);
  drawSegment(11, 12, FINGER_COLORS.middle.main, FINGER_COLORS.middle.glow, 2.0);

  // 5. Безымянный палец
  drawSegment(13, 14, FINGER_COLORS.ring.main, FINGER_COLORS.ring.glow, 2.5);
  drawSegment(14, 15, FINGER_COLORS.ring.main, FINGER_COLORS.ring.glow, 2.2);
  drawSegment(15, 16, FINGER_COLORS.ring.main, FINGER_COLORS.ring.glow, 2.0);

  // 6. Мизинец
  drawSegment(17, 18, FINGER_COLORS.pinky.main, FINGER_COLORS.pinky.glow, 2.5);
  drawSegment(18, 19, FINGER_COLORS.pinky.main, FINGER_COLORS.pinky.glow, 2.2);
  drawSegment(19, 20, FINGER_COLORS.pinky.main, FINGER_COLORS.pinky.glow, 2.0);

  // 7. Все 21 сустав кисти
  for (let i = 0; i <= 20; i++) {
    const isTip = [4, 8, 12, 16, 20].includes(i);
    const col = i === 0 ? '#ffffff' : (i <= 4 ? '#f59e0b' : i <= 8 ? '#06b6d4' : i <= 12 ? '#10b981' : i <= 16 ? '#3b82f6' : '#a855f7');
    drawJoint(i, col, isTip ? 4.5 : 3.0);
  }

  // Бейдж кисти
  if (pts[0]) {
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(212, 162, 76, 0.65)';
    ctx.lineWidth = 1;
    const isL = handednessLabel === 'Left' || handednessLabel === 'left';
    const tag = isL ? '🥋 Кисть L' : '🥋 Кисть R';
    const tagW = ctx.measureText(tag).width + 12;
    if (ctx.roundRect) ctx.roundRect(pts[0].x - tagW / 2, pts[0].y - 20, tagW, 16, 4);
    else ctx.rect(pts[0].x - tagW / 2, pts[0].y - 20, tagW, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isL ? '#06b6d4' : '#ef4444';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText(tag, pts[0].x - tagW / 2 + 6, pts[0].y - 8);
    ctx.restore();
  }
}

export function drawNeonKarateSkeleton(ctx, landmarks, width, height, biomechanics, options = {}) {
  if (!ctx || !landmarks || landmarks.length < 33) return;

  const w = width;
  const h = height;

  const showBody = options.showBody !== false;
  const showHands = options.showHands !== false;
  const showDiagnostics = options.showDiagnostics !== false;

  const toPx = (lm) => {
    if (!lm) return null;
    return {
      x: lm.x * w,
      y: lm.y * h,
      v: lm.visibility !== undefined ? lm.visibility : 1,
    };
  };

  const pts = landmarks.map(toPx);
  const minVis = options.minConfidence !== undefined ? options.minConfidence : 0.20;

  // Отрисовка кости с разделением реально обнаруженных и предсказанных сегментов
  const drawSegment = (i1, i2, color, lineWidth = 3.5, glowColor = null) => {
    const p1 = pts[i1];
    const p2 = pts[i2];
    if (!p1 || !p2 || p1.v < minVis || p2.v < minVis) return;

    // Точка считается реально обнаруженной при visibility >= 0.55, иначе — предсказанная/интерполированная
    const isPredicted = p1.v < 0.55 || p2.v < 0.55;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isPredicted) {
      // Предсказанный сегмент: пунктир и пониженная непрозрачность
      ctx.setLineDash([5, 4]);
      ctx.globalAlpha = 0.65;
      ctx.shadowColor = glowColor || color;
      ctx.shadowBlur = 4;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    } else {
      // Реально обнаруженный сегмент: плотный неоновый луч с яркой белой сердцевиной
      ctx.shadowColor = glowColor || color;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, lineWidth * 0.35);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    ctx.restore();
  };

  // Отрисовка сустава (шарнира) с различием: Плотный (Measured) vs Полый кольцевой (Predicted)
  const drawJoint = (idx, color = '#fbbf24', radius = 5, highlight = false) => {
    const p = pts[idx];
    if (!p || p.v < minVis) return;

    const isPredicted = p.v < 0.55;
    ctx.save();
    const r = highlight ? radius * 1.3 : radius;

    if (isPredicted) {
      // Полый шарнир (Hollow Ring) для предсказанных/перекрытых суставов
      ctx.shadowColor = color;
      ctx.shadowBlur = 5;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Реально обнаруженный сустав: яркое сплошное неоновое свечение + белая сердцевина
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  };

  if (showBody) {
    // 1. Торс (Плечевой и тазовый пояс) — цвет Золотой Янтарь
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
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(midShX, midShY);
      ctx.lineTo(midHpX, midHpY);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Голова и шея
    drawSegment(0, 11, 'rgba(240, 240, 245, 0.8)', 2.5);
    drawSegment(0, 12, 'rgba(240, 240, 245, 0.8)', 2.5);

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

    // 7. Суставы
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
  }

  // 9. Отрисовка кистей (если переданы)
  if (showHands && options.hands && Array.isArray(options.hands)) {
    options.hands.forEach((hObj) => {
      if (hObj.landmarks) {
        drawNeonHandSkeleton(ctx, hObj.landmarks, hObj.handedness || 'Right', w, h);
      }
    });
  }

  // 10. Диагностика и статус
  if (showDiagnostics) {
    ctx.save();
    ctx.fillStyle = 'rgba(15, 11, 8, 0.88)';
    ctx.strokeStyle = 'rgba(212, 162, 76, 0.55)';
    ctx.lineWidth = 1;
    const badgeH = 26;
    if (ctx.roundRect) ctx.roundRect(10, 10, w - 20, badgeH, 6);
    else ctx.rect(10, 10, w - 20, badgeH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('⚡ AI MOCAP SKELETON (1:1 АНАТОМИЯ)', 20, 27);

    if (biomechanics?.overallScore) {
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 11px sans-serif';
      const scoreText = `МАСТЕРСТВО: ${biomechanics.overallScore}%`;
      const tw = ctx.measureText(scoreText).width;
      ctx.fillText(scoreText, w - tw - 20, 27);
    }

    // Предупреждения о перекрытии конечностей
    let warnY = 48;
    const drawWarning = (text) => {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.fillRect(10, warnY, ctx.measureText(text).width + 16, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(text, 18, warnY + 14);
      warnY += 24;
    };

    if (pts[27]?.v < 0.20 && pts[28]?.v < 0.20) {
      drawWarning('⚠ Стопы не полностью в кадре (отойдите назад)');
    }
    if (pts[15]?.v < 0.20 && pts[16]?.v < 0.20) {
      drawWarning('⚠ Кисти рук вне поля зрения камеры');
    }
    ctx.restore();
  }

  // 11. Угловые бейджи коленей
  if (biomechanics && pts[25]?.v > minVis) {
    const lk = pts[25];
    ctx.fillStyle = 'rgba(16, 185, 129, 0.90)';
    ctx.fillRect(lk.x + 8, lk.y - 10, 48, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(`${biomechanics.kneeAngleL}° L`, lk.x + 12, lk.y + 3);
  }

  if (biomechanics && pts[26]?.v > minVis) {
    const rk = pts[26];
    ctx.fillStyle = 'rgba(239, 68, 68, 0.90)';
    ctx.fillRect(rk.x + 8, rk.y - 10, 48, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(`${biomechanics.kneeAngleR}° R`, rk.x + 12, rk.y + 3);
  }
}

// ============================================================================
// 8. БИОМЕХАНИКА КИСТЕЙ И ПАЛЬЦЕВ (5 ПАЛЬЦЕВ, 3 ФАЛАНГИ НА КАЖДЫЙ)
// Порт кинематики из Karate Motion Studio (core/mocap_tracker.py & viewer_template.html)
// ============================================================================

export function calcFingerCurl(mcp, pip, dip, tip, wrist = null) {
  if (!mcp || !pip || !dip || !tip) return 0.15;
  const v1 = [pip[0] - mcp[0], pip[1] - mcp[1], (pip[2] || 0) - (mcp[2] || 0)];
  const v2 = [dip[0] - pip[0], dip[1] - pip[1], (dip[2] || 0) - (pip[2] || 0)];
  const v3 = [tip[0] - dip[0], tip[1] - dip[1], (tip[2] || 0) - (dip[2] || 0)];

  const n1 = Math.hypot(v1[0], v1[1], v1[2]);
  const n2 = Math.hypot(v2[0], v2[1], v2[2]);
  const n3 = Math.hypot(v3[0], v3[1], v3[2]);
  if (n1 < 1e-6 || n2 < 1e-6 || n3 < 1e-6) return 0.15;

  const dot1 = Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / (n1 * n2)));
  const ang1 = (Math.acos(dot1) * 180) / Math.PI;

  const dot2 = Math.max(-1, Math.min(1, (v2[0] * v3[0] + v2[1] * v3[1] + v2[2] * v3[2]) / (n2 * n3)));
  const ang2 = (Math.acos(dot2) * 180) / Math.PI;

  let totalAng = 0;
  if (wrist) {
    const v0 = [mcp[0] - wrist[0], mcp[1] - wrist[1], (mcp[2] || 0) - (wrist[2] || 0)];
    const n0 = Math.hypot(v0[0], v0[1], v0[2]);
    const dot0 = Math.max(-1, Math.min(1, (v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2]) / (n0 * n1 + 1e-6)));
    const ang0 = (Math.acos(dot0) * 180) / Math.PI;
    totalAng = ang0 * 0.40 + ang1 * 0.85 + ang2 * 0.80;
  } else {
    totalAng = ang1 * 0.90 + ang2 * 0.90;
  }

  const fingerLen = n1 + n2 + n3;
  const distTipMcp = Math.hypot(tip[0] - mcp[0], tip[1] - mcp[1], (tip[2] || 0) - (mcp[2] || 0));
  const distCurl = 1.0 - Math.max(0, Math.min(1, distTipMcp / (fingerLen * 0.82 + 1e-6)));

  const angCurl = Math.max(0, Math.min(1, totalAng / 135.0));
  const rawCurl = 0.5 * angCurl + 0.5 * distCurl;

  let curl = Math.pow(rawCurl, 0.85);
  if (curl > 0.55) {
    curl = 0.55 + (curl - 0.55) * 1.55;
  }
  return parseFloat(Math.max(0.0, Math.min(1.0, curl)).toFixed(2));
}

export function calcThumbCurl(cmc, mcp, ip, tip, wrist, indexMcp = null) {
  if (!cmc || !mcp || !ip || !tip) return 0.15;
  const v1 = [mcp[0] - cmc[0], mcp[1] - cmc[1], (mcp[2] || 0) - (cmc[2] || 0)];
  const v2 = [tip[0] - ip[0], tip[1] - ip[1], (tip[2] || 0) - (ip[2] || 0)];
  const n1 = Math.hypot(v1[0], v1[1], v1[2]);
  const n2 = Math.hypot(v2[0], v2[1], v2[2]);
  if (n1 < 1e-6 || n2 < 1e-6) return 0.15;

  const dot = Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / (n1 * n2)));
  const angle = (Math.acos(dot) * 180) / Math.PI;
  const angCurl = Math.max(0, Math.min(1, angle / 75.0));

  let curl = angCurl;
  if (indexMcp) {
    const thumbLen = n1 + Math.hypot(ip[0] - mcp[0], ip[1] - mcp[1], (ip[2] || 0) - (mcp[2] || 0)) + n2;
    const distToIndex = Math.hypot(tip[0] - indexMcp[0], tip[1] - indexMcp[1], (tip[2] || 0) - (indexMcp[2] || 0));
    const adductCurl = 1.0 - Math.max(0, Math.min(1, distToIndex / (thumbLen * 1.2 + 1e-6)));
    curl = 0.45 * angCurl + 0.55 * adductCurl;
  }

  if (curl > 0.50) {
    curl = 0.50 + (curl - 0.50) * 1.6;
  }
  return parseFloat(Math.max(0.0, Math.min(1.0, curl)).toFixed(2));
}

export function calcPhalanxAngles(mcp, pip, dip, tip, wrist, uAcross) {
  const v0 = [mcp[0] - wrist[0], mcp[1] - wrist[1], (mcp[2] || 0) - (wrist[2] || 0)];
  const v1 = [pip[0] - mcp[0], pip[1] - mcp[1], (pip[2] || 0) - (mcp[2] || 0)];
  const v2 = [dip[0] - pip[0], dip[1] - pip[1], (dip[2] || 0) - (pip[2] || 0)];
  const v3 = [tip[0] - dip[0], tip[1] - dip[1], (tip[2] || 0) - (dip[2] || 0)];

  const angle = (a, b) => {
    const na = Math.hypot(a[0], a[1], a[2]);
    const nb = Math.hypot(b[0], b[1], b[2]);
    if (na < 1e-6 || nb < 1e-6) return 0.0;
    const dot = Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (na * nb)));
    return Math.acos(dot);
  };

  const flexMcp = parseFloat(angle(v0, v1).toFixed(3));
  const flexPip = parseFloat(angle(v1, v2).toFixed(3));
  const flexDip = parseFloat(angle(v2, v3).toFixed(3));

  const nv1 = Math.hypot(v1[0], v1[1], v1[2]);
  let abd = 0.0;
  if (nv1 > 1e-6 && uAcross) {
    const v1Dir = [v1[0] / nv1, v1[1] / nv1, v1[2] / nv1];
    abd = parseFloat((v1Dir[0] * uAcross[0] + v1Dir[1] * uAcross[1] + v1Dir[2] * uAcross[2]).toFixed(3));
  }

  return { angles: [flexMcp, flexPip, flexDip], abduction: abd };
}

export function calcThumbPhalanxAngles(cmc, mcp, ip, tip, wrist, indexMcp) {
  const v0 = [cmc[0] - wrist[0], cmc[1] - wrist[1], (cmc[2] || 0) - (wrist[2] || 0)];
  const v1 = [mcp[0] - cmc[0], mcp[1] - cmc[1], (mcp[2] || 0) - (cmc[2] || 0)];
  const v2 = [ip[0] - mcp[0], ip[1] - mcp[1], (ip[2] || 0) - (mcp[2] || 0)];
  const v3 = [tip[0] - ip[0], tip[1] - ip[1], (tip[2] || 0) - (ip[2] || 0)];

  const angle = (a, b) => {
    const na = Math.hypot(a[0], a[1], a[2]);
    const nb = Math.hypot(b[0], b[1], b[2]);
    if (na < 1e-6 || nb < 1e-6) return 0.0;
    const dot = Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (na * nb)));
    return Math.acos(dot);
  };

  const flexCmc = parseFloat(angle(v0, v1).toFixed(3));
  const flexMcp = parseFloat(angle(v1, v2).toFixed(3));
  const flexIp = parseFloat(angle(v2, v3).toFixed(3));

  let opp = 0.0;
  if (indexMcp) {
    const dThumbIndex = Math.hypot(tip[0] - indexMcp[0], tip[1] - indexMcp[1], (tip[2] || 0) - (indexMcp[2] || 0));
    opp = parseFloat(Math.max(0, Math.min(1.0, 1.0 - dThumbIndex * 4.5)).toFixed(3));
  }

  return { angles: [flexCmc, flexMcp, flexIp], opposition: opp };
}

/**
 * Расчет биомеханики кистей и пальцев обеих рук (Thumb, Index, Middle, Ring, Pinky 1..3)
 * Поддерживает как высокоточную модель MediaPipe Hands (21 точка на кисть),
 * так и отказоустойчивый расчет по Pose при работе на дистанции.
 */
export function extractHandBiomechanics(landmarks, worldLandmarks, handsResults = null, aspect = 1.0) {
  const pts = worldLandmarks || landmarks;

  const fallbackHand = (sideKey) => ({
    thumb: 0.15, index: 0.15, middle: 0.15, ring: 0.15, pinky: 0.15, general_curl: 0.15,
    phalanges: {
      thumb: [0.15, 0.15, 0.15],
      index: [0.20, 0.25, 0.20],
      middle: [0.20, 0.25, 0.20],
      ring: [0.20, 0.25, 0.20],
      pinky: [0.20, 0.25, 0.20],
    },
    abduction: { thumb: 0.05, index: 0.0, middle: 0.0, ring: 0.0, pinky: 0.0 },
    palm_normal: [0, 0, 1],
    hand_direction: [0, 1, 0],
    detected: false,
    fistScore: 15,
  });

  const res = {
    left: fallbackHand('L'),
    right: fallbackHand('R'),
  };

  if (!pts || pts.length < 33) return res;

  // 1. Попытка высокоточного извлечения через MediaPipe Hands (21 точка)
  if (handsResults && handsResults.multiHandLandmarks && handsResults.multiHandLandmarks.length > 0) {
    const handsList = handsResults.multiHandLandmarks;
    const handednessList = handsResults.multiHandedness || [];

    for (let hIdx = 0; hIdx < handsList.length; hIdx++) {
      const hLms = handsList[hIdx];
      const hClass = handednessList[hIdx]?.classification?.[0];
      const rawLabel = hClass?.label || (hIdx === 0 ? 'Right' : 'Left');

      // Сопоставляем руку по положению запястья и локтя человека с защитой от инверсии
      const side = disambiguateHandSide(hLms[0], landmarks) || (rawLabel === 'Left' ? 'right' : 'left');

      const hPts = hLms.map((p) => [p.x * aspect, p.y, (p.z || 0) * aspect]);
      const confidence = computePerFingerConfidence(hPts);

      const cThumb = calcThumbCurl(hPts[1], hPts[2], hPts[3], hPts[4], hPts[0], hPts[5]);
      const cIndex = calcFingerCurl(hPts[5], hPts[6], hPts[7], hPts[8], hPts[0]);
      const cMiddle = calcFingerCurl(hPts[9], hPts[10], hPts[11], hPts[12], hPts[0]);
      const cRing = calcFingerCurl(hPts[13], hPts[14], hPts[15], hPts[16], hPts[0]);
      const cPinky = calcFingerCurl(hPts[17], hPts[18], hPts[19], hPts[20], hPts[0]);

      // Three.js координаты для нормалей: X вправо, Y вверх (-y), Z вперед (-z)
      const wPt = [hPts[0][0], -hPts[0][1], -hPts[0][2]];
      const mPt = [hPts[9][0], -hPts[9][1], -hPts[9][2]];
      const iPt = [hPts[5][0], -hPts[5][1], -hPts[5][2]];
      const pPt = [hPts[17][0], -hPts[17][1], -hPts[17][2]];

      let vFwd = [mPt[0] - wPt[0], mPt[1] - wPt[1], mPt[2] - wPt[2]];
      const nFwd = Math.hypot(vFwd[0], vFwd[1], vFwd[2]);
      vFwd = nFwd > 1e-4 ? [vFwd[0] / nFwd, vFwd[1] / nFwd, vFwd[2] / nFwd] : [0, 1, 0];

      let vAcross = side === 'left'
        ? [pPt[0] - iPt[0], pPt[1] - iPt[1], pPt[2] - iPt[2]]
        : [iPt[0] - pPt[0], iPt[1] - pPt[1], iPt[2] - pPt[2]];
      const nAcross = Math.hypot(vAcross[0], vAcross[1], vAcross[2]);
      vAcross = nAcross > 1e-4 ? [vAcross[0] / nAcross, vAcross[1] / nAcross, vAcross[2] / nAcross] : [1, 0, 0];

      const vNorm = [
        vAcross[1] * vFwd[2] - vAcross[2] * vFwd[1],
        vAcross[2] * vFwd[0] - vAcross[0] * vFwd[2],
        vAcross[0] * vFwd[1] - vAcross[1] * vFwd[0],
      ];
      const nNorm = Math.hypot(vNorm[0], vNorm[1], vNorm[2]);
      const palmNormal = nNorm > 1e-4 ? [vNorm[0] / nNorm, vNorm[1] / nNorm, vNorm[2] / nNorm] : [0, 0, 1];

      const uAcrossHand = side === 'left'
        ? [hPts[17][0] - hPts[5][0], hPts[17][1] - hPts[5][1], hPts[17][2] - hPts[5][2]]
        : [hPts[5][0] - hPts[17][0], hPts[5][1] - hPts[17][1], hPts[5][2] - hPts[17][2]];
      const nAc = Math.hypot(uAcrossHand[0], uAcrossHand[1], uAcrossHand[2]);
      const uAc = nAc > 1e-6 ? [uAcrossHand[0] / nAc, uAcrossHand[1] / nAc, uAcrossHand[2] / nAc] : [1, 0, 0];

      const pIdx = calcPhalanxAngles(hPts[5], hPts[6], hPts[7], hPts[8], hPts[0], uAc);
      const pMid = calcPhalanxAngles(hPts[9], hPts[10], hPts[11], hPts[12], hPts[0], uAc);
      const pRng = calcPhalanxAngles(hPts[13], hPts[14], hPts[15], hPts[16], hPts[0], uAc);
      const pPnk = calcPhalanxAngles(hPts[17], hPts[18], hPts[19], hPts[20], hPts[0], uAc);
      const pThb = calcThumbPhalanxAngles(hPts[1], hPts[2], hPts[3], hPts[4], hPts[0], hPts[5]);

      const avgCurl = (cThumb + cIndex + cMiddle + cRing + cPinky) / 5.0;

      res[side] = {
        thumb: cThumb,
        index: cIndex,
        middle: cMiddle,
        ring: cRing,
        pinky: cPinky,
        general_curl: parseFloat(avgCurl.toFixed(2)),
        confidence,
        phalanges: {
          thumb: pThb.angles,
          index: pIdx.angles,
          middle: pMid.angles,
          ring: pRng.angles,
          pinky: pPnk.angles,
        },
        abduction: {
          thumb: pThb.opposition,
          index: pIdx.abduction,
          middle: 0.0,
          ring: pRng.abduction,
          pinky: pPnk.abduction,
        },
        palm_normal: [parseFloat(palmNormal[0].toFixed(3)), parseFloat(palmNormal[1].toFixed(3)), parseFloat(palmNormal[2].toFixed(3))],
        hand_direction: [parseFloat(vFwd[0].toFixed(3)), parseFloat(vFwd[1].toFixed(3)), parseFloat(vFwd[2].toFixed(3))],
        detected: true,
        isDedicatedHands: true,
        fistScore: Math.round(avgCurl * 100),
      };
    }
  }

  // 2. Фолбэк на Pose-кинематику для сторон, где dedicated Hands не обнаружены
  const computePoseHand = (idxElbow, idxWrist, idxPinky, idxIndex, idxThumb, sideKey) => {
    const el = pts[idxElbow];
    const wr = pts[idxWrist];
    const pk = pts[idxPinky];
    const ix = pts[idxIndex];
    const tb = pts[idxThumb];

    if (!wr || !ix || !el) return fallbackHand(sideKey);

    const pW = [wr.x, -wr.y, -(wr.z || 0)];
    const pE = [el.x, -el.y, -(el.z || 0)];
    const pI = [ix.x, -ix.y, -(ix.z || 0)];
    const pP = pk ? [pk.x, -pk.y, -(pk.z || 0)] : [pW[0] + 0.05, pW[1], pW[2]];
    const pT = tb ? [tb.x, -tb.y, -(tb.z || 0)] : [pW[0] - 0.04, pW[1], pW[2]];

    const dHand = Math.hypot(pI[0] - pW[0], pI[1] - pW[1], pI[2] - pW[2]);
    const dArm = Math.max(1e-4, Math.hypot(pW[0] - pE[0], pW[1] - pE[1], pW[2] - pE[2]));
    const ratio = dHand / dArm;

    let rawCurl = (0.64 - ratio) / (0.64 - 0.38);
    rawCurl = Math.max(0.0, Math.min(1.0, rawCurl));
    const baseCurl = rawCurl > 0.40 ? rawCurl : Math.max(0.12, rawCurl);

    const dThumbIndex = Math.hypot(pT[0] - pI[0], pT[1] - pI[1], pT[2] - pI[2]);
    const thumbCurl = Math.max(0.15, Math.min(1.0, 1.0 - (dThumbIndex / (dHand * 0.9 + 1e-4))));
    const pinkyCurl = Math.max(0.15, Math.min(1.0, baseCurl * 1.08));
    const indexCurl = baseCurl;
    const middleCurl = Math.max(0.15, Math.min(1.0, baseCurl * 1.04));
    const ringCurl = Math.max(0.15, Math.min(1.0, baseCurl * 1.06));

    const midKnuckle = [(pI[0] + pP[0]) * 0.5, (pI[1] + pP[1]) * 0.5, (pI[2] + pP[2]) * 0.5];
    let vFwd = [midKnuckle[0] - pW[0], midKnuckle[1] - pW[1], midKnuckle[2] - pW[2]];
    const nFwd = Math.hypot(vFwd[0], vFwd[1], vFwd[2]);
    vFwd = nFwd > 1e-4 ? [vFwd[0] / nFwd, vFwd[1] / nFwd, vFwd[2] / nFwd] : [0, 1, 0];

    let vAcross = sideKey === 'L'
      ? [pP[0] - iPt?.[0] || (pP[0] - pI[0]), pP[1] - pI[1], pP[2] - pI[2]]
      : [pI[0] - pP[0], pI[1] - pP[1], pI[2] - pP[2]];
    const nAcross = Math.hypot(vAcross[0], vAcross[1], vAcross[2]);
    vAcross = nAcross > 1e-4 ? [vAcross[0] / nAcross, vAcross[1] / nAcross, vAcross[2] / nAcross] : [1, 0, 0];

    const vNorm = [
      vAcross[1] * vFwd[2] - vAcross[2] * vFwd[1],
      vAcross[2] * vFwd[0] - vAcross[0] * vFwd[2],
      vAcross[0] * vFwd[1] - vAcross[1] * vFwd[0],
    ];
    const nNorm = Math.hypot(vNorm[0], vNorm[1], vNorm[2]);
    const palmNormal = nNorm > 1e-4 ? [vNorm[0] / nNorm, vNorm[1] / nNorm, vNorm[2] / nNorm] : [0, 0, 1];

    const toPhalanges = (c) => [
      parseFloat((c * 1.40).toFixed(3)),
      parseFloat((c * 1.65).toFixed(3)),
      parseFloat((c * 1.30).toFixed(3)),
    ];

    return {
      thumb: parseFloat(thumbCurl.toFixed(2)),
      index: parseFloat(indexCurl.toFixed(2)),
      middle: parseFloat(middleCurl.toFixed(2)),
      ring: parseFloat(ringCurl.toFixed(2)),
      pinky: parseFloat(pinkyCurl.toFixed(2)),
      general_curl: parseFloat(baseCurl.toFixed(2)),
      phalanges: {
        thumb: [
          parseFloat((thumbCurl * 0.95).toFixed(3)),
          parseFloat((thumbCurl * 1.20).toFixed(3)),
          parseFloat((thumbCurl * 1.10).toFixed(3)),
        ],
        index: toPhalanges(indexCurl),
        middle: toPhalanges(middleCurl),
        ring: toPhalanges(ringCurl),
        pinky: toPhalanges(pinkyCurl),
      },
      abduction: {
        thumb: parseFloat((thumbCurl * 0.45).toFixed(3)),
        index: parseFloat((baseCurl * 0.15).toFixed(3)),
        middle: 0.0,
        ring: parseFloat((-baseCurl * 0.08).toFixed(3)),
        pinky: parseFloat((-baseCurl * 0.20).toFixed(3)),
      },
      palm_normal: [parseFloat(palmNormal[0].toFixed(3)), parseFloat(palmNormal[1].toFixed(3)), parseFloat(palmNormal[2].toFixed(3))],
      hand_direction: [parseFloat(vFwd[0].toFixed(3)), parseFloat(vFwd[1].toFixed(3)), parseFloat(vFwd[2].toFixed(3))],
      confidence: { thumb: 0.65, index: 0.65, middle: 0.65, ring: 0.60, pinky: 0.60 },
      detected: true,
      isDedicatedHands: false,
      fistScore: Math.round(baseCurl * 100),
    };
  };

  if (!res.left.detected) {
    res.left = computePoseHand(13, 15, 17, 19, 21, 'L');
  }
  if (!res.right.detected) {
    res.right = computePoseHand(14, 16, 18, 20, 22, 'R');
  }

  return res;
}


/**
 * Оценка ориентации головы (Взгляд Мэцукэ)
 */
export function estimateHeadOrientation(landmarks, worldLandmarks) {
  const pts = worldLandmarks || landmarks;
  if (!pts || pts.length < 33) return { yaw: 0, pitch: 0, roll: 0 };

  const nose = pts[0];
  const lEar = pts[7];
  const rEar = pts[8];

  if (!nose || !lEar || !rEar) return { yaw: 0, pitch: 0, roll: 0 };

  const midEar = [
    (lEar.x + rEar.x) * 0.5,
    (-lEar.y + -rEar.y) * 0.5,
    (-(lEar.z || 0) + -(rEar.z || 0)) * 0.5,
  ];

  const nose3D = [nose.x, -nose.y, -(nose.z || 0)];
  const faceFwd = [nose3D[0] - midEar[0], nose3D[1] - midEar[1], nose3D[2] - midEar[2]];

  const yaw = Math.atan2(faceFwd[0], Math.max(0.01, faceFwd[2]));
  const pitch = Math.atan2(faceFwd[1], Math.max(0.01, faceFwd[2]));
  const roll = Math.atan2(-lEar.y - (-rEar.y), Math.max(0.05, Math.abs(lEar.x - rEar.x)));

  return {
    yaw: parseFloat(yaw.toFixed(3)),
    pitch: parseFloat(pitch.toFixed(3)),
    roll: parseFloat(roll.toFixed(3)),
  };
}

// ============================================================================
// 9. ОФФЛАЙН ОБРАБОТКА ВИДЕОФАЙЛОВ (РЕЖИМ A)
// Покадровый захват с генерацией полного проекта Bunkai MoCap
// ============================================================================

export async function processOfflineVideo(videoFile, onProgress = null, options = {}) {
  const pose = await loadMediaPipePose();
  if (!pose) throw new Error('Не удалось инициализировать нейросеть MediaPipe Pose');

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoFile);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const targetFps = options.fps || 30.0;
    const capturedFrames = [];
    let isCancelled = false;

    video.onloadedmetadata = async () => {
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const duration = video.duration || 1.0;
      const totalFrames = Math.max(1, Math.floor(duration * targetFps));

      resetMocapFilters();

      let currentFrameIdx = 0;

      const processNextFrame = async () => {
        if (isCancelled || currentFrameIdx >= totalFrames) {
          URL.revokeObjectURL(video.src);
          resolve({
            format: 'bunkai-capture-json',
            version: 1,
            name: videoFile.name.replace(/\.[^/.]+$/, ''),
            duration,
            fps: targetFps,
            frameCount: capturedFrames.length,
            frames: capturedFrames,
          });
          return;
        }

        const currentTime = currentFrameIdx / targetFps;
        video.currentTime = currentTime;

        video.onseeked = async () => {
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Обработка кадра нейросетью
            let poseResult = null;
            const onPoseResult = (res) => {
              poseResult = res;
            };

            pose.onResults(onPoseResult);
            await pose.send({ image: canvas });

            if (poseResult && poseResult.poseLandmarks && poseResult.poseLandmarks.length >= 33) {
              const lms = poseResult.poseLandmarks;
              const wlms = poseResult.poseWorldLandmarks || lms;
              const clearedWlms = applyTorsoClearanceToLandmarks(wlms);

              const biomechanics = analyzeKarateBiomechanics(lms, clearedWlms);
              const fingers = extractHandBiomechanics(lms, clearedWlms);
              const head = estimateHeadOrientation(lms, clearedWlms);

              // 3D суставы в метрах
              const joints3D = {};
              const conf = {};
              const jointNames = [
                'nose', 'left_eye_inner', 'left_eye', 'left_eye_outer', 'right_eye_inner', 'right_eye', 'right_eye_outer',
                'left_ear', 'right_ear', 'mouth_left', 'mouth_right',
                'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist',
                'left_pinky', 'right_pinky', 'left_index', 'right_index', 'left_thumb', 'right_thumb',
                'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
                'left_heel', 'right_heel', 'left_foot_index', 'right_foot_index'
              ];

              for (let i = 0; i < 33; i++) {
                const jName = jointNames[i] || `joint_${i}`;
                const w = clearedWlms[i];
                joints3D[jName] = [
                  parseFloat(w.x.toFixed(4)),
                  parseFloat((-w.y).toFixed(4)),
                  parseFloat((-w.z).toFixed(4)),
                ];
                conf[jName] = parseFloat((lms[i].visibility ?? 1.0).toFixed(2));
              }

              // Вычисление положения корня (Центр таза)
              const rootPos = [
                parseFloat(((joints3D.left_hip[0] + joints3D.right_hip[0]) * 0.5).toFixed(4)),
                parseFloat(((joints3D.left_hip[1] + joints3D.right_hip[1]) * 0.5 + 0.90).toFixed(4)),
                parseFloat(((joints3D.left_hip[2] + joints3D.right_hip[2]) * 0.5).toFixed(4)),
              ];

              capturedFrames.push({
                frame: currentFrameIdx,
                time: parseFloat(currentTime.toFixed(3)),
                rootPosition: rootPos,
                joints: joints3D,
                confidence: conf,
                landmarks: lms,
                worldLandmarks: clearedWlms,
                head,
                fingers,
                biomechanics,
                tracking_loss: false,
              });
            } else {
              // Кадр с потерей трекинга
              capturedFrames.push({
                frame: currentFrameIdx,
                time: parseFloat(currentTime.toFixed(3)),
                rootPosition: [0, 0.9, 0],
                joints: {},
                confidence: {},
                tracking_loss: true,
              });
            }

            if (onProgress) {
              onProgress({
                currentFrame: currentFrameIdx + 1,
                totalFrames,
                percentage: Math.round(((currentFrameIdx + 1) / totalFrames) * 100),
                currentTime,
                duration,
              });
            }

            currentFrameIdx++;
            setTimeout(processNextFrame, 0);
          } catch (err) {
            console.error('Ошибка анализа кадра видео:', err);
            currentFrameIdx++;
            setTimeout(processNextFrame, 0);
          }
        };
      };

      processNextFrame();
    };

    video.onerror = (e) => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Не удалось загрузить видеофайл для анализа'));
    };
  });
}

// ============================================================================
// 10. СТАНДАРТИЗИРОВАННЫЙ ЭКСПОРТ И ИМПОРТ JSON
// Форматы bunkai-capture-json и bunkai-retargeted-animation
// ============================================================================

export function exportCaptureJson(projectData, metadata = {}) {
  const exportObj = {
    format: 'bunkai-capture-json',
    version: 1,
    technique: metadata.technique || projectData.name || 'karate_technique',
    name: metadata.name || projectData.name || `bunkai_mocap_${Date.now()}`,
    tags: metadata.tags || ['shotokan', 'mocap', 'bunkai_explorer'],
    fps: projectData.fps || 30.0,
    duration: projectData.duration || 0,
    frameCount: projectData.frameCount || (projectData.frames ? projectData.frames.length : 0),
    coordinateSystem: {
      handedness: 'right-handed',
      upAxis: 'Y',
      forwardAxis: 'Z',
      units: 'meters',
      description: 'Three.js compatible world coordinates: X right, Y up, Z forward',
    },
    frames: (projectData.frames || []).map((f) => ({
      frame: f.frame,
      time: f.time,
      rootPosition: f.rootPosition || [0, 0.9, 0],
      joints: f.joints || {},
      confidence: f.confidence || {},
      head: f.head || { yaw: 0, pitch: 0, roll: 0 },
      fingers: f.fingers || {
        left: { thumb: 0.15, index: 0.15, middle: 0.15, ring: 0.15, pinky: 0.15, detected: true },
        right: { thumb: 0.15, index: 0.15, middle: 0.15, ring: 0.15, pinky: 0.15, detected: true },
      },
      biomechanics: f.biomechanics || {},
      tracking_loss: Boolean(f.tracking_loss),
    })),
  };

  return JSON.stringify(exportObj, null, 2);
}

export function exportRetargetedJson(projectData, metadata = {}) {
  const exportObj = {
    format: 'bunkai-retargeted-animation',
    version: 1,
    technique: metadata.technique || projectData.name || 'karate_technique',
    name: metadata.name || projectData.name || `bunkai_retargeted_${Date.now()}`,
    tags: metadata.tags || ['shotokan', 'retargeted', 'Karateka_Armature'],
    targetRig: 'Karateka_Armature',
    fps: projectData.fps || 30.0,
    duration: projectData.duration || 0,
    frameCount: projectData.frameCount || (projectData.frames ? projectData.frames.length : 0),
    frames: (projectData.frames || []).map((f) => {
      // Преобразуем суставы в локальные вращения костей
      const bones = {};
      if (f.bones) {
        Object.assign(bones, f.bones);
      }
      return {
        frame: f.frame,
        time: f.time,
        rootPosition: f.rootPosition || [0, 0.9, 0],
        bones,
        fingers: f.fingers,
      };
    }),
  };

  return JSON.stringify(exportObj, null, 2);
}

export function parseBunkaiMocapJson(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (!data.format || (!data.format.includes('bunkai') && !data.format.includes('karate'))) {
      throw new Error('Неизвестный формат файла анимации.');
    }
    return {
      success: true,
      data,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}

