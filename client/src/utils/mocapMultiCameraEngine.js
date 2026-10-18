/**
 * Bunkai Explorer — High-Precision Multi-Camera MoCap & Triangulation Engine (Stage 4)
 * 
 * Комплексная система пространственной калибровки и геометрической триангуляции
 * для 1, 2 или 3 смартфонов (0° Фронт, 90° Бок, 45° Угол):
 * 1. Калибровка камер (Intrinsics + Extrinsics) и общая система координат татами (X, Y, Z)
 * 2. Анализ временной синхронизации (Sync Offset & Stale Packet Detection)
 * 3. Лучевая триангуляция методом наименьших квадратов (Ray-based Least Squares Triangulation)
 * 4. Обнаружение и отбрасывание противоречивых измерений (Epipolar Outlier Rejection)
 * 5. Временное восстановление скрытых суставов с сохранением анатомической длины костей
 * 6. Интеллектуальное слияние мелкой моторики кистей и пальцев
 * 7. Монокулярный режим (1 камера) с явной оценкой неопределенности глубины
 */

import * as THREE from 'three';

// ============================================================================
// 1. ПАРАМЕТРЫ КАМЕР И КАЛИБРОВОЧНЫЕ СТРУКТУРЫ (INTRINSICS & EXTRINSICS)
// ============================================================================

export const CAMERA_SLOTS = {
  1: { slot: 1, id: 'cam_front', label: 'Фронтальная камера (0°)', nominalYaw: 0.0, defaultPos: [0.0, 1.25, 2.50] },
  2: { slot: 2, id: 'cam_side', label: 'Боковая камера (90°)', nominalYaw: Math.PI / 2, defaultPos: [2.50, 1.25, 0.0] },
  3: { slot: 3, id: 'cam_angle', label: 'Угловая камера (45°)', nominalYaw: Math.PI / 4, defaultPos: [1.75, 1.25, 1.75] },
};

export class CameraParameters {
  constructor(slot = 1, options = {}) {
    this.slot = slot;
    this.label = CAMERA_SLOTS[slot]?.label || `Камера ${slot}`;
    this.deviceId = options.deviceId || `device_slot_${slot}`;
    
    // Внутренние параметры (Intrinsics): FOV ~68° по горизонтали (типичный широкоугольный сенсор)
    this.hfov = options.hfov || (68.0 * Math.PI) / 180.0;
    this.aspect = options.aspect || (16.0 / 9.0);
    this.updateIntrinsics();

    // Внешние параметры (Extrinsics): положение и ориентация в мировых координатах татами
    const defaultPos = CAMERA_SLOTS[slot]?.defaultPos || [0, 1.25, 2.5];
    const defaultYaw = CAMERA_SLOTS[slot]?.nominalYaw || 0.0;

    this.position = new THREE.Vector3(...(options.position || defaultPos));
    this.rotationEuler = new THREE.Euler(
      options.pitch || 0.0,
      options.yaw !== undefined ? options.yaw : defaultYaw,
      options.roll || 0.0,
      'YXZ'
    );
    this.rotationMatrix = new THREE.Matrix4().makeRotationFromEuler(this.rotationEuler);

    // Метрики качества калибровки
    this.isCalibrated = options.isCalibrated || false;
    this.calibrationError = options.calibrationError || 0.0; // Среднеквадратическая ошибка репроекции
    this.lastCalibrationTimestamp = options.lastCalibrationTimestamp || null;
  }

  updateIntrinsics(aspect = this.aspect, hfov = this.hfov) {
    this.aspect = aspect;
    this.hfov = hfov;
    this.fx = 1.0 / (2.0 * Math.tan(this.hfov / 2.0));
    this.fy = this.fx * this.aspect;
    this.cx = 0.5;
    this.cy = 0.5;
  }

  /**
   * Восстанавливает 3D-луч в мировых координатах из 2D нормализованной точки экрана
   */
  unprojectToRay(normalizedX, normalizedY) {
    // Вектор луча в локальной системе координат камеры (Z вперед = -1)
    const xCam = (normalizedX - this.cx) / this.fx;
    const yCam = -(normalizedY - this.cy) / this.fy; // инверсия Y для декартовой системы (вверх = +Y)
    const zCam = -1.0;

    const rayDirCam = new THREE.Vector3(xCam, yCam, zCam).normalize();

    // Преобразуем луч в мировую систему координат через матрицу вращения
    const rayDirWorld = rayDirCam.applyMatrix4(this.rotationMatrix).normalize();
    const rayOriginWorld = this.position.clone();

    return {
      origin: rayOriginWorld,
      direction: rayDirWorld,
    };
  }

  /**
   * Проецирует мировую 3D-точку обратно на 2D-экран камеры (Репроекция)
   */
  projectWorldToScreen(worldPoint) {
    // Смещение относительно позиции камеры
    const pRel = worldPoint.clone().sub(this.position);
    // Обратное вращение (из мира в камеру)
    const invRot = this.rotationMatrix.clone().invert();
    const pCam = pRel.applyMatrix4(invRot);

    // Точка позади сенсора
    if (pCam.z >= -0.05) {
      return { x: 0.5, y: 0.5, inFront: false, depth: -pCam.z };
    }

    const normX = this.cx + (pCam.x / -pCam.z) * this.fx;
    const normY = this.cy - (pCam.y / -pCam.z) * this.fy;

    return {
      x: normX,
      y: normY,
      inFront: true,
      depth: -pCam.z,
    };
  }
}

// ============================================================================
// 2. АВТОМАТИЧЕСКАЯ ПРОСТРАНСТВЕННАЯ КАЛИБРОВКА (SPATIAL POSE CALIBRATION)
// ============================================================================

/**
 * Оценивает положение и угол камеры относительно центра татами по базовой стойке каратиста (Kamae / Shizentai)
 */
export function calibrateCameraFromPose(slot, landmarks, worldLandmarks, options = {}) {
  if (!landmarks || landmarks.length < 33) return null;

  const targetHeight = options.targetHeight || 1.75; // Рост спортсмена в метрах
  const lAnkle = landmarks[27];
  const rAnkle = landmarks[28];
  const nose = landmarks[0];
  const lHip = landmarks[23];
  const rHip = landmarks[24];
  const lShoulder = landmarks[11];
  const rShoulder = landmarks[12];

  if (!lAnkle || !rAnkle || !nose || !lHip || !rHip) return null;

  // 1. Оценка расстояния до человека по высоте силуэта в кадре
  const footY = (lAnkle.y + rAnkle.y) * 0.5;
  const headY = nose.y;
  const screenHeightFraction = Math.abs(footY - headY);

  const cam = new CameraParameters(slot);
  // Расстояние Z = (H_real * fy) / H_screen
  const estimatedDist = Math.max(1.2, Math.min(4.5, (targetHeight * cam.fy * 0.85) / Math.max(0.2, screenHeightFraction)));

  // 2. Оценка смещения по горизонтали и вертикали
  const midHipX = (lHip.x + rHip.x) * 0.5;
  const midHipY = (lHip.y + rHip.y) * 0.5;

  const offsetX = (midHipX - 0.5) * estimatedDist;
  const offsetY = -(midHipY - 0.5) * estimatedDist + (targetHeight * 0.5);

  // 3. Расчет угла рыскания (Yaw) в зависимости от заданного слота
  let yaw = 0.0;
  let posX = 0.0;
  let posZ = estimatedDist;

  if (slot === 1) {
    // Фронт (0°)
    yaw = 0.0;
    posX = -offsetX;
    posZ = estimatedDist;
  } else if (slot === 2) {
    // Бок (90°)
    yaw = Math.PI / 2.0;
    posX = estimatedDist;
    posZ = offsetX;
  } else if (slot === 3) {
    // Угол (45°)
    yaw = Math.PI / 4.0;
    posX = estimatedDist * 0.7071 - offsetX * 0.7071;
    posZ = estimatedDist * 0.7071 + offsetX * 0.7071;
  }

  cam.position.set(posX, 1.25, posZ);
  cam.rotationEuler.set(0.0, yaw, 0.0, 'YXZ');
  cam.rotationMatrix.makeRotationFromEuler(cam.rotationEuler);
  cam.isCalibrated = true;
  cam.lastCalibrationTimestamp = Date.now();

  // 4. Оценка ошибки репроекции на контрольных точках таза и плеч
  let totalReprojErr = 0;
  let checkCount = 0;
  const checkIndices = [11, 12, 23, 24];

  checkIndices.forEach((idx) => {
    if (worldLandmarks && worldLandmarks[idx] && landmarks[idx]) {
      const wPt = new THREE.Vector3(worldLandmarks[idx].x, -worldLandmarks[idx].y + targetHeight * 0.5, -(worldLandmarks[idx].z || 0));
      const proj = cam.projectWorldToScreen(wPt);
      if (proj.inFront) {
        const err = Math.hypot(proj.x - landmarks[idx].x, proj.y - landmarks[idx].y);
        totalReprojErr += err;
        checkCount++;
      }
    }
  });

  cam.calibrationError = checkCount > 0 ? parseFloat((totalReprojErr / checkCount).toFixed(4)) : 0.025;
  return cam;
}

// ============================================================================
// 3. БУФЕР ВРЕМЕННОЙ СИНХРОНИЗАЦИИ (TIME-SYNC SLIDING WINDOW)
// ============================================================================

export class SynchronizedFrameBuffer {
  constructor(maxSyncDriftMs = 75, maxPacketAgeMs = 250) {
    this.maxSyncDriftMs = maxSyncDriftMs;
    this.maxPacketAgeMs = maxPacketAgeMs;
    this.slotBuffers = { 1: [], 2: [], 3: [] };
    this.syncStats = {
      drift12: 0,
      drift13: 0,
      staleDrops: 0,
      matchedFrames: 0,
      syncHealth: 'perfect', // 'perfect' (<33ms), 'acceptable' (<75ms), 'desynchronized' (>75ms)
    };
  }

  addPacket(packet) {
    if (!packet || !packet.slot) return;
    const slot = packet.slot;
    if (!this.slotBuffers[slot]) this.slotBuffers[slot] = [];

    const now = Date.now();
    const packetTime = packet.timestamp || now;

    // Отбрасываем безнадежно устаревшие пакеты (> maxPacketAgeMs)
    if (now - packetTime > this.maxPacketAgeMs) {
      this.syncStats.staleDrops++;
      return;
    }

    this.slotBuffers[slot].push({
      ...packet,
      receivedAt: now,
    });

    // Ограничиваем глубину буфера последними 10 пакетами
    if (this.slotBuffers[slot].length > 10) {
      this.slotBuffers[slot].shift();
    }
  }

  /**
   * Находит согласованный по времени набор наблюдений от активных камер
   */
  getSynchronizedCluster(targetTimestamp = null) {
    const now = Date.now();
    const tTarget = targetTimestamp || now;

    const matched = {};
    const activeSlots = [];

    let maxObservedDrift = 0;
    for (const s of [1, 2, 3]) {
      const buf = this.slotBuffers[s];
      // Очищаем старые кадры
      while (buf.length > 0 && (now - buf[0].receivedAt > this.maxPacketAgeMs)) {
        buf.shift();
      }

      if (buf.length > 0) {
        // Ищем кадр с минимальной временной дельтой к целевому
        let bestFrame = buf[0];
        let minDiff = Math.abs((bestFrame.timestamp || bestFrame.receivedAt) - tTarget);

        for (let i = 1; i < buf.length; i++) {
          const diff = Math.abs((buf[i].timestamp || buf[i].receivedAt) - tTarget);
          if (diff < minDiff) {
            minDiff = diff;
            bestFrame = buf[i];
          }
        }

        if (minDiff > maxObservedDrift) {
          maxObservedDrift = minDiff;
        }

        if (minDiff <= this.maxSyncDriftMs) {
          matched[s] = bestFrame;
          activeSlots.push(s);
        }
      }
    }

    // Расчет метрик синхронизации
    if (matched[1] && matched[2]) {
      this.syncStats.drift12 = Math.abs(matched[1].timestamp - matched[2].timestamp);
    }
    if (matched[1] && matched[3]) {
      this.syncStats.drift13 = Math.abs(matched[1].timestamp - matched[3].timestamp);
    }

    const maxDrift = Math.max(maxObservedDrift, this.syncStats.drift12, this.syncStats.drift13);
    if (maxDrift < 35) this.syncStats.syncHealth = 'perfect';
    else if (maxDrift < 75) this.syncStats.syncHealth = 'acceptable';
    else this.syncStats.syncHealth = 'desynchronized';

    if (activeSlots.length > 0) this.syncStats.matchedFrames++;

    return {
      activeSlots,
      matched,
      syncHealth: this.syncStats.syncHealth,
      maxDriftMs: maxDrift,
    };
  }

  reset() {
    this.slotBuffers = { 1: [], 2: [], 3: [] };
    this.syncStats = { drift12: 0, drift13: 0, staleDrops: 0, matchedFrames: 0, syncHealth: 'perfect' };
  }
}

// ============================================================================
// 4. ГЕОМЕТРИЧЕСКАЯ ТРИАНГУЛЯЦИЯ МЕТОДОМ НАИМЕНЬШИХ КВАДРАТОВ (RAY INTERSECTION)
// ============================================================================

/**
 * Находит 3D-точку пересечения пространственных лучей от 2 или 3 камер
 * Решает замкнутую линейную систему наименьших квадратов:
 * ( sum w_i * (I - d_i * d_i^T) ) * P = sum w_i * (I - d_i * d_i^T) * O_i
 */
export function triangulateRays(rays, weights = null) {
  if (!rays || rays.length === 0) return null;
  if (rays.length === 1) {
    // При одном луче возвращаем точку на луче на номинальной глубине 2.0 м
    const r = rays[0];
    return r.origin.clone().add(r.direction.clone().multiplyScalar(2.0));
  }

  const wList = weights || rays.map(() => 1.0);

  // Матрица 3x3: A = sum w_i * (I - d_i * d_i^T)
  // Вектор 3x1:  b = sum w_i * (I - d_i * d_i^T) * O_i
  let a00 = 0, a01 = 0, a02 = 0;
  let a10 = 0, a11 = 0, a12 = 0;
  let a20 = 0, a21 = 0, a22 = 0;
  let b0 = 0, b1 = 0, b2 = 0;

  for (let i = 0; i < rays.length; i++) {
    const ray = rays[i];
    const w = Math.max(0.05, wList[i]);
    const dx = ray.direction.x;
    const dy = ray.direction.y;
    const dz = ray.direction.z;
    const ox = ray.origin.x;
    const oy = ray.origin.y;
    const oz = ray.origin.z;

    // Матрица проекции на плоскость, перпендикулярную лучу: M = I - d * d^T
    const m00 = 1.0 - dx * dx;
    const m01 = -dx * dy;
    const m02 = -dx * dz;
    const m10 = -dy * dx;
    const m11 = 1.0 - dy * dy;
    const m12 = -dy * dz;
    const m20 = -dz * dx;
    const m21 = -dz * dy;
    const m22 = 1.0 - dz * dz;

    a00 += w * m00; a01 += w * m01; a02 += w * m02;
    a10 += w * m10; a11 += w * m11; a12 += w * m12;
    a20 += w * m20; a21 += w * m21; a22 += w * m22;

    b0 += w * (m00 * ox + m01 * oy + m02 * oz);
    b1 += w * (m10 * ox + m11 * oy + m12 * oz);
    b2 += w * (m20 * ox + m21 * oy + m22 * oz);
  }

  // Обращение матрицы 3x3 через определитель (Правило Крамера)
  const det =
    a00 * (a11 * a22 - a12 * a21) -
    a01 * (a10 * a22 - a12 * a20) +
    a02 * (a10 * a21 - a11 * a20);

  if (Math.abs(det) < 1e-6) {
    // Лучи почти параллельны — берем среднюю точку середин лучей
    return rays[0].origin.clone().add(rays[0].direction.clone().multiplyScalar(2.2));
  }

  const invDet = 1.0 / det;

  const inv00 = (a11 * a22 - a12 * a21) * invDet;
  const inv01 = (a02 * a21 - a01 * a22) * invDet;
  const inv02 = (a01 * a12 - a02 * a11) * invDet;
  const inv10 = (a12 * a20 - a10 * a22) * invDet;
  const inv11 = (a00 * a22 - a02 * a20) * invDet;
  const inv12 = (a02 * a10 - a00 * a12) * invDet;
  const inv20 = (a10 * a21 - a11 * a20) * invDet;
  const inv21 = (a01 * a20 - a00 * a21) * invDet;
  const inv22 = (a00 * a11 - a01 * a10) * invDet;

  const px = inv00 * b0 + inv01 * b1 + inv02 * b2;
  const py = inv10 * b0 + inv11 * b1 + inv12 * b2;
  const pz = inv20 * b0 + inv21 * b1 + inv22 * b2;

  return new THREE.Vector3(px, py, pz);
}

/**
 * Проверяет согласованность лучей (расстояние невязки лучей / Epipolar Residual Distance)
 * Исключает лучи с выбросами (например, если одна камера видит перекрытый сустав со сбоем)
 */
export function filterOutlierRays(rays, weights, maxResidualDistance = 0.28) {
  if (rays.length <= 2) return { filteredRays: rays, filteredWeights: weights };

  const candidateP = triangulateRays(rays, weights);
  if (!candidateP) return { filteredRays: rays, filteredWeights: weights };

  const validRays = [];
  const validWeights = [];

  for (let i = 0; i < rays.length; i++) {
    const ray = rays[i];
    // Расстояние от найденной точки до луча: || (P - O) x d ||
    const v = candidateP.clone().sub(ray.origin);
    const distToRay = v.clone().cross(ray.direction).length();

    if (distToRay <= maxResidualDistance) {
      validRays.push(ray);
      validWeights.push(weights[i]);
    }
  }

  // Если отбросили слишком много, возвращаем два наиболее уверенных луча
  if (validRays.length < 2) {
    const sortedIndices = weights.map((w, idx) => ({ w, idx })).sort((a, b) => b.w - a.w);
    return {
      filteredRays: [rays[sortedIndices[0].idx], rays[sortedIndices[1].idx]],
      filteredWeights: [weights[sortedIndices[0].idx], weights[sortedIndices[1].idx]],
    };
  }

  return { filteredRays: validRays, filteredWeights: validWeights };
}

// ============================================================================
// 5. ДВИЖОК МНОГОКАМЕРНОЙ РЕКОНСТРУКЦИИ (MULTICAMERA RECONSTRUCTION ENGINE)
// ============================================================================

export class MultiCameraMoCapEngine {
  constructor() {
    this.cameras = {
      1: new CameraParameters(1),
      2: new CameraParameters(2),
      3: new CameraParameters(3),
    };
    this.syncBuffer = new SynchronizedFrameBuffer();
    this.boneLengthHistory = {}; // Сохраненные анатомические длины костей пользователя
    this.previousJointPositions = new Map();
  }

  setCameraCalibration(slot, calibParams) {
    if (this.cameras[slot] && calibParams) {
      Object.assign(this.cameras[slot], calibParams);
    }
  }

  ingestCameraPacket(packet) {
    this.syncBuffer.addPacket(packet);
  }

  /**
   * Главный конвейер реконструкции скелета по данным 1, 2 или 3 камер
   */
  reconstructFrame(targetTimestamp = null) {
    const cluster = this.syncBuffer.getSynchronizedCluster(targetTimestamp);
    const activeSlots = cluster.activeSlots;

    if (activeSlots.length === 0) return null;

    const matchedFeeds = cluster.matched;
    const reconstructed3DLandmarks = [];
    const fusedScreenLandmarks = [];
    const confidenceByJoint = [];

    // --- СЦЕНАРИЙ 1: МОНОКУЛЯРНАЯ ОЦЕНКА (РОВНО 1 КАМЕРА) ---
    if (activeSlots.length === 1) {
      const slot = activeSlots[0];
      const feed = matchedFeeds[slot];
      const cam = this.cameras[slot];
      const lms = feed.landmarks || [];
      const wlms = feed.worldLandmarks || lms;

      for (let i = 0; i < 33; i++) {
        const p2 = lms[i] || { x: 0.5, y: 0.5, z: 0, visibility: 0 };
        const w3 = wlms[i] || { x: 0, y: 0, z: 0, visibility: 0 };
        const vis = p2.visibility ?? w3.visibility ?? 0.8;

        // Монокулярная неопределенность глубины Z (сигма вырастает при слабой уверенности)
        const depthUncertainty = parseFloat((0.25 * (1.0 - Math.min(1.0, vis))).toFixed(3));

        // Позиционируем точку на луче камеры с учетом локальной глубины MediaPipe
        const ray = cam.unprojectToRay(p2.x, p2.y);
        const nominalDist = 2.4 - (w3.z || 0.0);
        const ptWorld = ray.origin.clone().add(ray.direction.clone().multiplyScalar(nominalDist));

        reconstructed3DLandmarks.push({
          x: ptWorld.x,
          y: ptWorld.y,
          z: ptWorld.z,
          visibility: vis,
          uncertaintyZ: depthUncertainty,
        });

        fusedScreenLandmarks.push({
          x: p2.x,
          y: p2.y,
          z: p2.z || 0,
          visibility: vis,
        });

        confidenceByJoint.push(vis);
      }

      return {
        mode: `monocular_slot_${slot}`,
        activeCameras: activeSlots,
        syncHealth: cluster.syncHealth,
        maxDriftMs: cluster.maxDriftMs,
        landmarks: fusedScreenLandmarks,
        worldLandmarks: reconstructed3DLandmarks,
        fingers: feed.fingers || null,
        hands: feed.hands || null,
        head: feed.head || null,
        reprojectionErrorAvg: 0.0,
      };
    }

    // --- СЦЕНАРИЙ 2 И 3: МНОГОКАМЕРНАЯ ТРИАНГУЛЯЦИЯ (2 ИЛИ 3 КАМЕРЫ) ---
    let totalReprojErr = 0;
    let reprojCount = 0;

    for (let jIdx = 0; jIdx < 33; jIdx++) {
      const rays = [];
      const weights = [];
      let maxVis = 0.0;

      for (const s of activeSlots) {
        const feed = matchedFeeds[s];
        const p = feed.landmarks?.[jIdx];
        if (p) {
          const vis = p.visibility ?? 0.7;
          if (vis > maxVis) maxVis = vis;
          const cam = this.cameras[s];
          const ray = cam.unprojectToRay(p.x, p.y);
          rays.push(ray);
          weights.push(Math.max(0.1, vis));
        }
      }

      // Фильтрация лучей с сильной невязкой
      const { filteredRays, filteredWeights } = filterOutlierRays(rays, weights);
      const triangulatedPt = triangulateRays(filteredRays, filteredWeights);

      if (triangulatedPt) {
        // Контроль анатомической длины костей (Kinematic Bone Length Constraint)
        this.enforceBoneLengthConstraint(jIdx, triangulatedPt);

        reconstructed3DLandmarks.push({
          x: triangulatedPt.x,
          y: triangulatedPt.y,
          z: triangulatedPt.z,
          visibility: maxVis,
        });

        // 2D экранные координаты проецируются на фронтальную камеру для видоискателя
        const frontCam = this.cameras[1];
        const projFront = frontCam.projectWorldToScreen(triangulatedPt);
        fusedScreenLandmarks.push({
          x: Math.max(0, Math.min(1, projFront.x)),
          y: Math.max(0, Math.min(1, projFront.y)),
          z: triangulatedPt.z,
          visibility: maxVis,
        });

        // Замер репроекционной ошибки по всем задействованным камерам
        for (const s of activeSlots) {
          const feed = matchedFeeds[s];
          const rawP = feed.landmarks?.[jIdx];
          if (rawP) {
            const cam = this.cameras[s];
            const pr = cam.projectWorldToScreen(triangulatedPt);
            const err = Math.hypot(pr.x - rawP.x, pr.y - rawP.y);
            totalReprojErr += err;
            reprojCount++;
          }
        }
      } else {
        // Фолбэк на предыдущую известную позицию сустава
        const prev = this.previousJointPositions.get(jIdx) || new THREE.Vector3(0, 1.0, 0);
        reconstructed3DLandmarks.push({ x: prev.x, y: prev.y, z: prev.z, visibility: 0.3 });
        fusedScreenLandmarks.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.3 });
      }

      this.previousJointPositions.set(jIdx, triangulatedPt);
      confidenceByJoint.push(maxVis);
    }

    // Слияние кистей и пальцев: берем ракурс камеры с наивысшей уверенностью пальцев
    let bestFingers = null;
    let maxFingerScore = -1;
    let bestHands = null;

    for (const s of activeSlots) {
      const feed = matchedFeeds[s];
      if (feed?.fingers) {
        let confScore = 0;
        for (const side of ['left', 'right']) {
          const fSide = feed.fingers[side];
          if (fSide && fSide.detected) {
            confScore += 1.0;
            if (fSide.confidence) {
              const vals = Object.values(fSide.confidence);
              if (vals.length > 0) confScore += (vals.reduce((a, b) => a + b, 0) / vals.length) * 2.0;
            }
          }
        }
        if (confScore > maxFingerScore) {
          maxFingerScore = confScore;
          bestFingers = feed.fingers;
        }
      }
      if (feed?.hands && feed.hands.length > 0 && !bestHands) {
        bestHands = feed.hands;
      }
    }

    // Оценка ориентации взгляда
    let bestHead = null;
    for (const s of [1, 3, 2]) {
      if (matchedFeeds[s]?.head) {
        bestHead = matchedFeeds[s].head;
        break;
      }
    }

    const avgReprojErr = reprojCount > 0 ? parseFloat((totalReprojErr / reprojCount).toFixed(4)) : 0.02;

    return {
      mode: activeSlots.length === 3 ? 'triangulation_3cam' : 'stereo_2cam',
      activeCameras: activeSlots,
      syncHealth: cluster.syncHealth,
      maxDriftMs: cluster.maxDriftMs,
      landmarks: fusedScreenLandmarks,
      worldLandmarks: reconstructed3DLandmarks,
      fingers: bestFingers,
      hands: bestHands,
      head: bestHead,
      reprojectionErrorAvg: avgReprojErr,
    };
  }

  /**
   * Ограничивает деформацию суставов в допустимых анатомических пределах длин костей
   */
  enforceBoneLengthConstraint(jointIdx, pt) {
    const parentMap = {
      13: 11, 14: 12, // Локти от плеч
      15: 13, 16: 14, // Запястья от локтей
      25: 23, 26: 24, // Колени от бедер
      27: 25, 28: 26, // Лодыжки от коленей
    };

    const parentIdx = parentMap[jointIdx];
    if (parentIdx === undefined) return;

    const parentPt = this.previousJointPositions.get(parentIdx);
    if (!parentPt) return;

    const currentLen = pt.distanceTo(parentPt);
    const nominalKey = `${parentIdx}_${jointIdx}`;
    let nominalLen = this.boneLengthHistory[nominalKey];

    if (!nominalLen) {
      if (currentLen > 0.15 && currentLen < 0.65) {
        this.boneLengthHistory[nominalKey] = currentLen;
      }
      return;
    }

    // Допускаем растяжение/сжатие не более +-15% от анатомической нормы
    const minLen = nominalLen * 0.85;
    const maxLen = nominalLen * 1.15;

    if (currentLen < minLen || currentLen > maxLen) {
      const clampedLen = Math.max(minLen, Math.min(maxLen, currentLen));
      const dir = pt.clone().sub(parentPt).normalize();
      pt.copy(parentPt.clone().add(dir.multiplyScalar(clampedLen)));
    }
  }
}
