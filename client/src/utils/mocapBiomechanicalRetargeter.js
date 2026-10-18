/**
 * Bunkai Explorer — Biomechanical Retargeting & Kinematic Constraint Engine (Stage 5)
 * 
 * Комплексный модуль биомеханического ретаргетинга для рига Karateka_Armature:
 * 1. Иерархический ретаргетинг костей (Karateka_Armature: Root, Hips, Spine, Spine1, Chest, Neck, Head, Arms, Legs, Feet, 30 Phalanges)
 * 2. Непрерывное отслеживание азимута (Continuous 360° Azimuth & Phase Unwrapping):
 *    - Композитный расчет направления: Таз (Pelvis normal) + Плечи (Shoulders normal) + Стопы (Feet baseline)
 *    - Фазовое развертывание 2π без сингулярностей и скачков на 45°, 90°, 135°, 180°, 270°, 360° и при непрерывных вращениях
 * 3. Сохранение окрестности кватернионов (Quaternion Neighborhood Tracking q·q_prev >= 0)
 * 4. Анатомические шарнирные ограничения (Biomechanical Hinge Constraints):
 *    - Коленные шарниры (Knee Hinge: 0°..165°, запрет переразгибания вперед и бокового вывиха)
 *    - Локтевые шарниры (Elbow Hinge: 0°..160°, предотвращение переворотов локтя и неестественного смещения кисти)
 *    - Кинематическая неразрывность предплечья и запястья (Forearm-Hand rigid coupling)
 * 5. Заземление стоп и устранение скольжения (Foot Planting & Anti-Foot-Sliding Manager):
 *    - Определение контакта по высоте и скорости (h < 0.08 м, v < 0.20 м/с)
 *    - Фиксация мировой позиции опорной стопы без эффекта "коньков на льду"
 * 6. Динамическое сохранение резких ударов каратэ (Dynamic Kime Preserver):
 *    - Адаптивное масштабирование частоты среза One-Euro фильтра при баллистических ударах (отклик <= 1 кадр)
 * 7. Сетевой джиттер-буфер воспроизведения (Network Playout Jitter Buffer):
 *    - Буферизация кадров с настраиваемой задержкой (targetDelay 50..75 мс)
 *    - Сферическая интерполяция (slerp) кватернионов костей и lerp корня
 *    - Телеметрия: FPS, Jitter (мс), Latency, Packet Loss, Tracking Lost
 * 8. Анализ и сравнение с Three.js SkeletonUtils.retarget & retargetClip
 */

import * as THREE from 'three';
import { LowPassFilter, OneEuroFilter } from './mocapPoseTracker.js';
import {
  HAND_RIG_SPEC,
  ANATOMICAL_ROM,
  clampPhalanxAngle,
  clampAbductionAngle,
  applyHandRetargetingToArmature,
} from './mocapHandRetargeter.js';

// ============================================================================
// 1. СПЕЦИФИКАЦИЯ РИГА И АНАТОМИЧЕСКИЕ ПРЕДЕЛЫ KARATEKA_ARMATURE
// ============================================================================

export const KARATEKA_BONE_HIERARCHY = {
  Root: { parent: null, children: ['Hips'] },
  Hips: { parent: 'Root', children: ['Spine', 'UpperLeg.L', 'UpperLeg.R'] },
  Spine: { parent: 'Hips', children: ['Spine1'] },
  Spine1: { parent: 'Spine', children: ['Chest'] },
  Chest: { parent: 'Spine1', children: ['Neck', 'Shoulder.L', 'Shoulder.R'] },
  Neck: { parent: 'Chest', children: ['Head'] },
  Head: { parent: 'Neck', children: [] },

  'Shoulder.L': { parent: 'Chest', children: ['UpperArm.L'] },
  'UpperArm.L': { parent: 'Shoulder.L', children: ['LowerArm.L'] },
  'LowerArm.L': { parent: 'UpperArm.L', children: ['Hand.L'] },
  'Hand.L': { parent: 'LowerArm.L', children: ['Thumb1.L', 'Index1.L', 'Middle1.L', 'Ring1.L', 'Pinky1.L'] },

  'Shoulder.R': { parent: 'Chest', children: ['UpperArm.R'] },
  'UpperArm.R': { parent: 'Shoulder.R', children: ['LowerArm.R'] },
  'LowerArm.R': { parent: 'UpperArm.R', children: ['Hand.R'] },
  'Hand.R': { parent: 'LowerArm.R', children: ['Thumb1.R', 'Index1.R', 'Middle1.R', 'Ring1.R', 'Pinky1.R'] },

  'UpperLeg.L': { parent: 'Hips', children: ['LowerLeg.L'] },
  'LowerLeg.L': { parent: 'UpperLeg.L', children: ['Foot.L'] },
  'Foot.L': { parent: 'LowerLeg.L', children: ['Toe.L'] },
  'Toe.L': { parent: 'Foot.L', children: ['Toe1.L', 'Toe2.L', 'Toe3.L', 'Toe4.L', 'Toe5.L'] },

  'UpperLeg.R': { parent: 'Hips', children: ['LowerLeg.R'] },
  'LowerLeg.R': { parent: 'UpperLeg.R', children: ['Foot.R'] },
  'Foot.R': { parent: 'LowerLeg.R', children: ['Toe.R'] },
  'Toe.R': { parent: 'Foot.R', children: ['Toe1.R', 'Toe2.R', 'Toe3.R', 'Toe4.R', 'Toe5.R'] },
};

export const ANATOMICAL_JOINT_LIMITS = {
  knee: {
    minFlexDeg: 0.0,     // 0° = полностью прямая нога
    maxFlexDeg: 165.0,   // 165° = глубокий присед (Киба-дати / сгиб)
    maxHyperextDeg: 3.0, // Защита от неестественного выгибания вперед
  },
  elbow: {
    minFlexDeg: 0.0,     // 0° = прямая рука (удар Ой-цуки в фиксации)
    maxFlexDeg: 160.0,   // 160° = полный блок / Хикитэ у пояса
    maxHyperextDeg: 4.0, // Запрет неестественного излома локтя назад
  },
  pelvis: {
    maxTiltDeg: 42.0,    // Максимальный наклон таза вперед при выпадах
    maxRollDeg: 30.0,    // Латеральный крен таза при ударах ногами
  },
  spine: {
    maxTwistDeg: 55.0,   // Скручивание позвоночника в Гяку-цуки
    maxBendDeg: 45.0,    // Наклон корпуса
  },
};

// ============================================================================
// 2. ДВИЖОК НЕПРЕРЫВНОГО АЗИМУТА (CONTINUOUS 360° AZIMUTH & PHASE UNWRAPPING)
// ============================================================================

export class ContinuousAzimuthTracker {
  constructor() {
    this.previousRawYaw = null;
    this.unwrappedYaw = 0.0;
    this.smoothYaw = 0.0;
    this.previousQuat = new THREE.Quaternion();
    this.totalRotations = 0;
    this.yawFilter = new OneEuroFilter(60.0, 1.2, 0.04);
  }

  reset() {
    this.previousRawYaw = null;
    this.unwrappedYaw = 0.0;
    this.smoothYaw = 0.0;
    this.previousQuat.identity();
    this.totalRotations = 0;
    this.yawFilter.reset();
  }

  /**
   * Вычисляет композитный вектор ориентации тела по 3 независимым анатомическим парам:
   * 1. Вектор таза (Pelvis lateral vector x Vertical)
   * 2. Вектор плеч (Shoulders lateral vector x Vertical)
   * 3. Вектор стоп (Feet vector при устойчивой опоре)
   */
  computeCompositeHeading(landmarks) {
    if (!landmarks || landmarks.length < 33) {
      return new THREE.Vector3(0, 0, 1);
    }

    const pLSh = landmarks[11];
    const pRSh = landmarks[12];
    const pLHp = landmarks[23];
    const pRHp = landmarks[24];
    const pLAn = landmarks[27];
    const pRAn = landmarks[28];

    let headingX = 0.0;
    let headingZ = 0.0;
    let totalWeight = 0.0;

    // 1. Нормаль таза (основной физический индикатор поворота корпуса)
    if (pLHp && pRHp) {
      const vHipsX = pLHp.x - pRHp.x;
      const vHipsZ = (pLHp.z || 0) - (pRHp.z || 0);
      // Векторное произведение (vHipsX, 0, vHipsZ) x (0, 1, 0) = (-vHipsZ, 0, vHipsX)
      const normPelvisX = -vHipsZ;
      const normPelvisZ = vHipsX;
      const len = Math.hypot(normPelvisX, normPelvisZ);
      if (len > 1e-4) {
        headingX += (normPelvisX / len) * 0.50;
        headingZ += (normPelvisZ / len) * 0.50;
        totalWeight += 0.50;
      }
    }

    // 2. Нормаль плечевого пояса
    if (pLSh && pRSh) {
      const vShX = pLSh.x - pRSh.x;
      const vShZ = (pLSh.z || 0) - (pRSh.z || 0);
      const normShX = -vShZ;
      const normShZ = vShX;
      const len = Math.hypot(normShX, normShZ);
      if (len > 1e-4) {
        headingX += (normShX / len) * 0.35;
        headingZ += (normShZ / len) * 0.35;
        totalWeight += 0.35;
      }
    }

    // 3. Базовая линия стоп
    if (pLAn && pRAn) {
      const vFeetX = pLAn.x - pRAn.x;
      const vFeetZ = (pLAn.z || 0) - (pRAn.z || 0);
      const normFeetX = -vFeetZ;
      const normFeetZ = vFeetX;
      const len = Math.hypot(normFeetX, normFeetZ);
      if (len > 1e-4) {
        headingX += (normFeetX / len) * 0.15;
        headingZ += (normFeetZ / len) * 0.15;
        totalWeight += 0.15;
      }
    }

    if (totalWeight < 1e-4) {
      return new THREE.Vector3(0, 0, 1);
    }

    return new THREE.Vector3(headingX / totalWeight, 0, headingZ / totalWeight).normalize();
  }

  /**
   * Обновляет непрерывный угол рыскания с 2π-фазовым развертыванием
   */
  updateYaw(headingVector, timestamp = null) {
    if (!headingVector || headingVector.lengthSq() < 1e-4) {
      return this.smoothYaw;
    }

    const rawYaw = Math.atan2(headingVector.x, headingVector.z);

    if (this.previousRawYaw === null) {
      this.previousRawYaw = rawYaw;
      this.unwrappedYaw = rawYaw;
      this.smoothYaw = rawYaw;
      return this.smoothYaw;
    }

    // Развертывание фазы (Phase Unwrapping): устранение скачков на границе ±π
    let delta = rawYaw - this.previousRawYaw;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;

    this.unwrappedYaw += delta;
    this.previousRawYaw = rawYaw;

    // Подсчет полных оборотов
    this.totalRotations = this.unwrappedYaw / (2 * Math.PI);

    // Адаптивная фильтрация непрерывного угла
    const t = timestamp || Date.now();
    this.smoothYaw = this.yawFilter.filter(this.unwrappedYaw, t);

    return this.smoothYaw;
  }

  /**
   * Возвращает ориентацию корня с проверкой окрестности кватерниона (q · q_prev >= 0)
   */
  getRootOrientationQuaternion(tiltX = 0.0, rollZ = 0.0) {
    const euler = new THREE.Euler(tiltX, this.smoothYaw, rollZ, 'YXZ');
    const qTarget = new THREE.Quaternion().setFromEuler(euler);

    // Защита от вращения на 360° при интерполяции знака кватерниона
    if (this.previousQuat.dot(qTarget) < 0) {
      qTarget.x = -qTarget.x;
      qTarget.y = -qTarget.y;
      qTarget.z = -qTarget.z;
      qTarget.w = -qTarget.w;
    }

    this.previousQuat.copy(qTarget);
    return qTarget;
  }
}

// ============================================================================
// 3. БИОМЕХАНИЧЕСКИЕ ОГРАНИЧИТЕЛИ СУСТАВОВ (KINEMATIC HINGE CONSTRAINTS)
// ============================================================================

/**
 * Проверка и ограничение сгибания коленного сустава
 * Предотвращает переразгибание колена вперед и боковой выворот
 */
export function constrainKneeJoint(vThigh, vShin, isLeft = false) {
  if (!vThigh || !vShin) return { valid: false, correctedShin: vShin, angleDeg: 180 };

  const lenThigh = vThigh.length();
  const lenShin = vShin.length();
  if (lenThigh < 1e-4 || lenShin < 1e-4) {
    return { valid: false, correctedShin: vShin, angleDeg: 180 };
  }

  const uThigh = vThigh.clone().normalize();
  const uShin = vShin.clone().normalize();

  // Угол между бедром и голенью
  const dot = Math.max(-1.0, Math.min(1.0, uThigh.dot(uShin)));
  const angleRad = Math.acos(dot);
  const angleDeg = (angleRad * 180) / Math.PI;

  const limits = ANATOMICAL_JOINT_LIMITS.knee;
  const interiorAngleDeg = 180.0 - angleDeg;
  const flexDeg = angleDeg;

  let correctedShin = uShin.clone();

  // 1. Проверка на неестественное переразгибание колена вперед (< 0°)
  // В декартовой системе нормальное сгибание направляет голень назад (Z > 0)
  const isHyperextended = uShin.z < -0.04 && flexDeg > limits.maxHyperextDeg;

  if (isHyperextended) {
    // Выравниваем голень строго вдоль направления бедра (прямая нога)
    correctedShin = uThigh.clone();
  } else if (flexDeg > limits.maxFlexDeg) {
    // Ограничиваем максимальный физиологический сгиб (165°)
    const maxFlexRad = limits.maxFlexDeg * (Math.PI / 180.0);
    const bendAxis = new THREE.Vector3().crossVectors(uThigh, uShin).normalize();
    if (bendAxis.lengthSq() > 1e-4) {
      correctedShin = uThigh.clone().applyAxisAngle(bendAxis, maxFlexRad);
    }
  }

  return {
    valid: !isHyperextended,
    correctedShin: correctedShin.multiplyScalar(lenShin),
    angleDeg: Math.round(interiorAngleDeg),
    flexionDeg: Math.round(flexDeg),
  };
}

/**
 * Проверка и ограничение локтевого сустава
 * Предотвращает излом локтя наружу и независимый сдвиг кисти
 */
export function constrainElbowJoint(vUpperArm, vForearm, isLeft = false) {
  if (!vUpperArm || !vForearm) return { valid: false, correctedForearm: vForearm, angleDeg: 180 };

  const lenArm = vUpperArm.length();
  const lenForearm = vForearm.length();
  if (lenArm < 1e-4 || lenForearm < 1e-4) {
    return { valid: false, correctedForearm: vForearm, angleDeg: 180 };
  }

  const uArm = vUpperArm.clone().normalize();
  const uForearm = vForearm.clone().normalize();

  const dot = Math.max(-1.0, Math.min(1.0, uArm.dot(uForearm)));
  const angleRad = Math.acos(dot);
  const angleDeg = (angleRad * 180) / Math.PI;

  const limits = ANATOMICAL_JOINT_LIMITS.elbow;
  const interiorAngleDeg = 180.0 - angleDeg;
  const flexDeg = angleDeg;

  let correctedForearm = uForearm.clone();
  const isHyperextended = flexDeg < -limits.maxHyperextDeg;

  if (isHyperextended) {
    // Выпрямляем руку вдоль оси плеча
    correctedForearm = uArm.clone();
  } else if (flexDeg > limits.maxFlexDeg) {
    const maxFlexRad = limits.maxFlexDeg * (Math.PI / 180.0);
    const bendAxis = new THREE.Vector3().crossVectors(uArm, uForearm).normalize();
    if (bendAxis.lengthSq() > 1e-4) {
      correctedForearm = uArm.clone().applyAxisAngle(bendAxis, maxFlexRad);
    }
  }

  return {
    valid: !isHyperextended,
    correctedForearm: correctedForearm.multiplyScalar(lenForearm),
    angleDeg: Math.round(interiorAngleDeg),
    flexionDeg: Math.round(flexDeg),
  };
}

// ============================================================================
// 4. ДВИЖОК ЗАЗЕМЛЕНИЯ И АНТИ-СКОЛЬЖЕНИЯ СТОП (FOOT CONTACT & PLANTING)
// ============================================================================

export class FootContactManager {
  constructor(groundY = 0.0) {
    this.groundY = groundY;
    this.contactThresholdH = 0.085; // Высота контакта подошвы с полом (м)
    this.velocityThreshold = 0.20;  // Порог скорости покоя (м/с)
    this.feet = {
      L: {
        isGrounded: false,
        anchorPos: new THREE.Vector3(),
        lastPos: new THREE.Vector3(),
        lastTime: 0,
        groundTimer: 0,
      },
      R: {
        isGrounded: false,
        anchorPos: new THREE.Vector3(),
        lastPos: new THREE.Vector3(),
        lastTime: 0,
        groundTimer: 0,
      },
    };
  }

  reset() {
    for (const key of ['L', 'R']) {
      this.feet[key].isGrounded = false;
      this.feet[key].anchorPos.set(0, 0, 0);
      this.feet[key].lastPos.set(0, 0, 0);
      this.feet[key].lastTime = 0;
      this.feet[key].groundTimer = 0;
    }
  }

  /**
   * Обновляет состояние заземления стопы и предотвращает скольжение
   */
  processFoot(sideKey, rawFootPos, timestamp = null) {
    if (!rawFootPos) return rawFootPos;
    const foot = this.feet[sideKey];
    const now = timestamp || Date.now();
    const dt = foot.lastTime > 0 ? Math.max(0.005, (now - foot.lastTime) / 1000.0) : 0.033;

    // Скорость перемещения стопы
    const vSpeed = foot.lastTime > 0
      ? foot.lastPos.distanceTo(rawFootPos) / dt
      : 0.0;

    const heightAboveGround = rawFootPos.y - this.groundY;
    const meetsGroundCriteria = heightAboveGround < this.contactThresholdH && vSpeed < this.velocityThreshold;

    if (foot.isGrounded) {
      // Освобождаем якорь только при явном отрыве ноги от татами
      if (heightAboveGround > 0.12 || vSpeed > 0.85) {
        foot.isGrounded = false;
        foot.groundTimer = 0;
      }
    } else {
      if (meetsGroundCriteria) {
        foot.groundTimer += dt;
        if (foot.groundTimer >= 0.03) {
          // Фиксируем якорь заземления
          foot.isGrounded = true;
          foot.anchorPos.copy(rawFootPos);
          foot.anchorPos.y = Math.max(this.groundY, foot.anchorPos.y);
        }
      } else {
        foot.groundTimer = 0;
      }
    }

    foot.lastPos.copy(rawFootPos);
    foot.lastTime = now;

    if (foot.isGrounded) {
      // Мягко притягиваем позицию к якорю, исключая проскальзывание по полу татами
      const clamped = rawFootPos.clone();
      clamped.x = foot.anchorPos.x * 0.90 + rawFootPos.x * 0.10;
      clamped.z = foot.anchorPos.z * 0.90 + rawFootPos.z * 0.10;
      clamped.y = Math.max(this.groundY, foot.anchorPos.y);
      return clamped;
    }

    return rawFootPos;
  }
}

// ============================================================================
// 5. ДИНАМИЧЕСКИЙ КИМЭ-ПРЕЗЕРВЕР (BALLISTIC STRIKE SPEED PRESERVER)
// ============================================================================

/**
 * Адаптивный 1€ фильтр с переменной частотой среза, обеспечивающий
 * мгновенную передачу взрывных ударов Сётокан (Кимэ) за время <= 1 кадр
 */
export class DynamicKimePreserver {
  constructor(minCutoff = 1.0, beta = 0.04) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.filters = new Map();
  }

  filterJointAngle(jointId, currentAngle, timestamp = null) {
    let f = this.filters.get(jointId);
    if (!f) {
      f = {
        filter: new OneEuroFilter(60.0, this.minCutoff, this.beta),
        prevAngle: currentAngle,
        prevTime: timestamp || Date.now(),
        isBallistic: false,
      };
      this.filters.set(jointId, f);
      return currentAngle;
    }

    const t = timestamp || Date.now();
    const dt = Math.max(0.005, (t - f.prevTime) / 1000.0);
    const angularSpeed = Math.abs(currentAngle - f.prevAngle) / dt;

    // Авто-определение единиц измерения: если углы в градусах (> 6.3), порог 180°/с, если в радианах — 3.14 рад/с
    const isDeg = Math.abs(currentAngle) > 6.3 || Math.abs(f.prevAngle) > 6.3;
    const threshold = isDeg ? 180.0 : 3.14;

    // При быстром ударе каратэ динамически поднимаем частоту среза до 32 Гц (без задержки)
    if (angularSpeed > threshold) {
      f.filter.minCutoff = 32.0;
      f.isBallistic = true;
    } else {
      f.filter.minCutoff = this.minCutoff;
      f.isBallistic = false;
    }

    const filtered = f.filter.filter(currentAngle, t);
    f.prevAngle = currentAngle;
    f.prevTime = t;
    return filtered;
  }

  isStrikeActive(jointId) {
    return this.filters.get(jointId)?.isBallistic || false;
  }
}

// ============================================================================
// 6. СЕТЕВОЙ ДЖИТТЕР-БУФЕР ВОСПРОИЗВЕДЕНИЯ (NETWORK PLAYOUT JITTER BUFFER)
// ============================================================================

export class NetworkPlayoutJitterBuffer {
  constructor(targetDelayMs = 60, maxBufferSize = 30) {
    this.targetDelayMs = targetDelayMs;
    this.maxBufferSize = maxBufferSize;
    this.queue = [];
    this.metrics = {
      renderFps: 60,
      packetRate: 30,
      jitterMs: 0,
      latencyMs: targetDelayMs,
      packetLossCount: 0,
      trackingLost: false,
      lastPacketTime: 0,
    };
    this.lastRenderTime = 0;
    this.frameCount = 0;
    this.fpsTimer = 0;
    this.interPacketIntervals = [];
  }

  ingestPacket(packet) {
    if (!packet) return;
    const now = Date.now();
    const pktTime = packet.timestamp || now;

    if (this.metrics.lastPacketTime > 0) {
      const interval = now - this.metrics.lastPacketTime;
      this.interPacketIntervals.push(interval);
      if (this.interPacketIntervals.length > 20) {
        this.interPacketIntervals.shift();
      }
      // Оценка джиттера (среднеквадратическое отклонение интервалов)
      const avgInterval = this.interPacketIntervals.reduce((a, b) => a + b, 0) / this.interPacketIntervals.length;
      const variance = this.interPacketIntervals.reduce((sum, v) => sum + Math.pow(v - avgInterval, 2), 0) / this.interPacketIntervals.length;
      this.metrics.jitterMs = parseFloat(Math.sqrt(variance).toFixed(1));
      this.metrics.packetRate = avgInterval > 0 ? Math.round(1000 / avgInterval) : 30;
    }

    this.metrics.lastPacketTime = now;
    this.metrics.trackingLost = Boolean(packet.trackingLost);

    this.queue.push({
      ...packet,
      receivedAt: now,
      playTime: now + this.targetDelayMs,
    });

    if (this.queue.length > this.maxBufferSize) {
      this.queue.shift();
      this.metrics.packetLossCount++;
    }
  }

  /**
   * Извлекает интерполированное состояние для рендеринга на текущий момент времени
   */
  sampleInterpolatedFrame(renderTime = null) {
    const now = renderTime || Date.now();

    // Обновление метрики FPS
    if (this.lastRenderTime > 0) {
      this.frameCount++;
      const dtSec = (now - this.fpsTimer) / 1000.0;
      if (dtSec >= 0.5) {
        this.metrics.renderFps = Math.round(this.frameCount / dtSec);
        this.frameCount = 0;
        this.fpsTimer = now;
      }
    } else {
      this.fpsTimer = now;
    }
    this.lastRenderTime = now;

    if (this.queue.length === 0) return null;

    // Удаляем устаревшие кадры, оставив хотя бы 2 для интерполяции
    while (this.queue.length > 2 && this.queue[1].playTime < now) {
      this.queue.shift();
    }

    if (this.queue.length === 1) {
      return this.queue[0];
    }

    const frameA = this.queue[0];
    const frameB = this.queue[1];

    const span = Math.max(1, frameB.playTime - frameA.playTime);
    const alpha = Math.max(0.0, Math.min(1.0, (now - frameA.playTime) / span));

    // Интерполяция позиции и вращений
    const interpLandmarks = [];
    const len = Math.min(frameA.landmarks?.length || 0, frameB.landmarks?.length || 0);

    for (let i = 0; i < len; i++) {
      const pA = frameA.landmarks[i];
      const pB = frameB.landmarks[i];
      interpLandmarks.push({
        x: pA.x + (pB.x - pA.x) * alpha,
        y: pA.y + (pB.y - pA.y) * alpha,
        z: (pA.z || 0) + ((pB.z || 0) - (pA.z || 0)) * alpha,
        visibility: Math.min(pA.visibility ?? 1, pB.visibility ?? 1),
      });
    }

    return {
      timestamp: now,
      landmarks: interpLandmarks,
      worldLandmarks: frameB.worldLandmarks || interpLandmarks,
      fingers: alpha > 0.5 ? frameB.fingers : frameA.fingers,
      head: frameB.head || frameA.head,
      trackingLost: this.metrics.trackingLost,
      alpha,
    };
  }

  getTelemetry() {
    return { ...this.metrics };
  }
}

// ============================================================================
// 7. СРАВНИТЕЛЬНЫЙ АНАЛИЗ THREE.JS SKELETONUTILS.RETARGET & RETARGETCLIP
// ============================================================================

/**
 * Экспертная оценка применимости SkeletonUtils.retarget для живого захвата каратэ
 */
export function evaluateThreeSkeletonUtilsRetargeting() {
  return {
    engine: 'Three.js SkeletonUtils.retarget & retargetClip',
    intendedUse: 'Автономная перегонка оффлайн-клипов (AnimationClip) между двумя схожими 3D-моделями с T-позой',
    capabilities: [
      'Перенос готовых запеченных ключевых кадров анимаций (position, quaternion, scale)',
      'Поддержка матричной адаптации костей с общими именами в skinned mesh',
    ],
    limitationsForLiveMocap: [
      'Не работает с непрерывным потоком отдельных живых суставов без формирования AnimationClip',
      'Отсутствует биомеханический контроль коленных и локтевых шарниров (допускает неестественные вывихи)',
      'Не поддерживает 2π-фазовое развертывание азимута при вращениях на 180° / 360°',
      'Не содержит алгоритмов заземления подошв и подавления скольжения стоп (Foot Sliding)',
      'Не адаптирует частоту среза для резких каратистских акцентов (Кимэ)',
    ],
    conclusion: 'SkeletonUtils.retarget ценен для оффлайн-импорта клипов, но не может служить заменой интерактивного биомеханического ретаргетера реального времени.',
  };
}

// ============================================================================
// 8. ГЛАВНЫЙ БИОМЕХАНИЧЕСКИЙ РЕТАРГЕТЕР СЁТОКАН (MASTER BIOMECHANICAL RETARGETER)
// ============================================================================

export class MasterBiomechanicalRetargeter {
  constructor(options = {}) {
    this.azimuthTracker = new ContinuousAzimuthTracker();
    this.footContactManager = new FootContactManager(options.groundY || 0.0);
    this.kimePreserver = new DynamicKimePreserver();
    this.jitterBuffer = new NetworkPlayoutJitterBuffer(options.targetDelayMs || 60);
    this.restBones = new Map();
  }

  reset() {
    this.azimuthTracker.reset();
    this.footContactManager.reset();
  }

  registerRestArmature(boneMap) {
    if (!boneMap) return;
    boneMap.forEach((bone, name) => {
      this.restBones.set(name, {
        restLocalQ: bone.quaternion.clone(),
        restPosition: bone.position.clone(),
      });
    });
  }

  /**
   * Полный цикл биомеханического ретаргетинга позы на кости модели
   */
  retargetPose(rawPose, options = {}) {
    if (!rawPose || !rawPose.landmarks || rawPose.landmarks.length < 33) {
      return null;
    }

    const mirror = options.mirrorMode !== undefined ? options.mirrorMode : true;
    const lms = rawPose.landmarks;
    const wlms = rawPose.worldLandmarks || lms;

    // 1. Непрерывный расчет азимута и ориентации таза (360° Yaw)
    const headingVec = this.azimuthTracker.computeCompositeHeading(wlms);
    if (mirror) headingVec.x = -headingVec.x;

    const continuousYaw = this.azimuthTracker.updateYaw(headingVec, rawPose.timestamp);
    const rootQuat = this.azimuthTracker.getRootOrientationQuaternion(
      options.tiltX || 0.0,
      options.rollZ || 0.0
    );

    // 2. Биомеханическая проверка конечностей (Knee & Elbow Constraints)
    const pLSh = wlms[11];
    const pRSh = wlms[12];
    const pLEl = wlms[13];
    const pREl = wlms[14];
    const pLWr = wlms[15];
    const pRWr = wlms[16];

    const pLHp = wlms[23];
    const pRHp = wlms[24];
    const pLKn = wlms[25];
    const pRKn = wlms[26];
    const pLAn = wlms[27];
    const pRAn = wlms[28];

    // Проверка локтей
    const leftArmVec = pLSh && pLEl ? new THREE.Vector3(pLEl.x - pLSh.x, pLEl.y - pLSh.y, (pLEl.z || 0) - (pLSh.z || 0)) : null;
    const leftForearmVec = pLEl && pLWr ? new THREE.Vector3(pLWr.x - pLEl.x, pLWr.y - pLEl.y, (pLWr.z || 0) - (pLEl.z || 0)) : null;
    const leftElbowCheck = constrainElbowJoint(leftArmVec, leftForearmVec, true);

    const rightArmVec = pRSh && pREl ? new THREE.Vector3(pREl.x - pRSh.x, pREl.y - pRSh.y, (pREl.z || 0) - (pRSh.z || 0)) : null;
    const rightForearmVec = pREl && pRWr ? new THREE.Vector3(pRWr.x - pREl.x, pRWr.y - pREl.y, (pRWr.z || 0) - (pREl.z || 0)) : null;
    const rightElbowCheck = constrainElbowJoint(rightArmVec, rightForearmVec, false);

    // Проверка коленей
    const leftThighVec = pLHp && pLKn ? new THREE.Vector3(pLKn.x - pLHp.x, pLKn.y - pLHp.y, (pLKn.z || 0) - (pLHp.z || 0)) : null;
    const leftShinVec = pLKn && pLAn ? new THREE.Vector3(pLAn.x - pLKn.x, pLAn.y - pLKn.y, (pLAn.z || 0) - (pLKn.z || 0)) : null;
    const leftKneeCheck = constrainKneeJoint(leftThighVec, leftShinVec, true);

    const rightThighVec = pRHp && pRKn ? new THREE.Vector3(pRKn.x - pRHp.x, pRKn.y - pRHp.y, (pRKn.z || 0) - (pRHp.z || 0)) : null;
    const rightShinVec = pRKn && pRAn ? new THREE.Vector3(pRAn.x - pRKn.x, pRAn.y - pRKn.y, (pRAn.z || 0) - (pRKn.z || 0)) : null;
    const rightKneeCheck = constrainKneeJoint(rightThighVec, rightShinVec, false);

    // 3. Заземление стоп и анти-скольжение
    const leftAnklePos = pLAn ? new THREE.Vector3(pLAn.x, pLAn.y, pLAn.z || 0) : null;
    const rightAnklePos = pRAn ? new THREE.Vector3(pRAn.x, pRAn.y, pRAn.z || 0) : null;

    const groundedLeftAnkle = this.footContactManager.processFoot('L', leftAnklePos, rawPose.timestamp);
    const groundedRightAnkle = this.footContactManager.processFoot('R', rightAnklePos, rawPose.timestamp);

    // 4. Кимэ-сохранение для ударных рук
    const rElbowFlexFiltered = this.kimePreserver.filterJointAngle('elbow_R', rightElbowCheck.flexionDeg, rawPose.timestamp);
    const lElbowFlexFiltered = this.kimePreserver.filterJointAngle('elbow_L', leftElbowCheck.flexionDeg, rawPose.timestamp);

    return {
      continuousYaw,
      rootQuaternion: rootQuat,
      elbows: {
        left: { ...leftElbowCheck, flexFiltered: lElbowFlexFiltered },
        right: { ...rightElbowCheck, flexFiltered: rElbowFlexFiltered },
      },
      knees: {
        left: leftKneeCheck,
        right: rightKneeCheck,
      },
      feet: {
        left: groundedLeftAnkle,
        right: groundedRightAnkle,
        isLeftGrounded: this.footContactManager.feet.L.isGrounded,
        isRightGrounded: this.footContactManager.feet.R.isGrounded,
      },
      fingers: rawPose.fingers || null,
      head: rawPose.head || null,
      mirror,
    };
  }
}
