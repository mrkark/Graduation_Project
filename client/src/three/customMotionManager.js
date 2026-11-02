/**
 * ============================================================================
 * CUSTOM MOTION MANAGER — Управление созданием и записью анимаций по частям
 * ============================================================================
 * 
 * Предоставляет функционал для:
 * 1. Генерации Three.js AnimationClip из интерактивных поз (Keyframe Pose Studio)
 * 2. Преобразования кадров живого веб-мокапа с камеры в модульные слои (MoCap Layer Recorder)
 * 3. Локального сохранения и управления библиотекой кастомных частей (My Custom Layers)
 * 4. Экспорта в JSON и регистрации в кэше Three.js
 */

import * as THREE from 'three';

// Карта алиасов костей для совместимости с любыми ригами (Mixamo / Blender / Shotokan)
export const BONE_ALIASES = {
  'UpperArm.L': ['UpperArm.L', 'UpperArmL', 'mixamorigLeftArm'],
  'LowerArm.L': ['LowerArm.L', 'LowerArmL', 'mixamorigLeftForeArm'],
  'Hand.L': ['Hand.L', 'HandL', 'mixamorigLeftHand'],
  'UpperArm.R': ['UpperArm.R', 'UpperArmR', 'mixamorigRightArm'],
  'LowerArm.R': ['LowerArm.R', 'LowerArmR', 'mixamorigRightForeArm'],
  'Hand.R': ['Hand.R', 'HandR', 'mixamorigRightHand'],
  'Spine': ['Spine', 'mixamorigSpine'],
  'Chest': ['Chest', 'mixamorigSpine2', 'Spine1', 'mixamorigSpine1'],
  'Neck': ['Neck', 'mixamorigNeck'],
  'Head': ['Head', 'mixamorigHead'],
  'UpperLeg.L': ['UpperLeg.L', 'UpperLegL', 'mixamorigLeftUpLeg'],
  'LowerLeg.L': ['LowerLeg.L', 'LowerLegL', 'mixamorigLeftLeg'],
  'Foot.L': ['Foot.L', 'FootL', 'mixamorigLeftFoot'],
  'UpperLeg.R': ['UpperLeg.R', 'UpperLegR', 'mixamorigRightUpLeg'],
  'LowerLeg.R': ['LowerLeg.R', 'LowerLegR', 'mixamorigRightLeg'],
  'Foot.R': ['Foot.R', 'FootR', 'mixamorigRightFoot'],
  'Hips': ['Hips', 'mixamorigHips'],
};

const STORAGE_KEY = 'bunkai_custom_motion_layers';

/**
 * Загрузить сохраненные пользователем кастомные слои из LocalStorage
 */
export function loadCustomLayers() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Ошибка загрузки кастомных слоев анимации:', err);
    return [];
  }
}

/**
 * Сохранить новый кастомный слой в LocalStorage
 */
export function saveCustomLayer(layer) {
  if (!layer || !layer.id) return false;
  try {
    const existing = loadCustomLayers();
    const updated = [layer, ...existing.filter((item) => item.id !== layer.id)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (err) {
    console.error('Ошибка сохранения кастомного слоя анимации:', err);
    return false;
  }
}

/**
 * Удалить кастомный слой по ID
 */
export function deleteCustomLayer(id) {
  try {
    const existing = loadCustomLayers();
    const updated = existing.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (err) {
    console.error('Ошибка удаления кастомного слоя:', err);
    return false;
  }
}

/**
 * Построить THREE.AnimationClip из ключевых фаз интерактивного конструктора поз
 * 
 * @param {Object} params
 * @param {string} params.name - Уникальное имя клипа
 * @param {'upper'|'lower'} params.layerType - Тип создаваемого слоя
 * @param {Array<Object>} params.keyframes - Массив фаз: [{ time: 0, pose: {...} }, ...]
 * @param {number} params.duration - Общая длительность клипа в секундах
 * @returns {THREE.AnimationClip}
 */
export function buildClipFromPoseKeyframes({ name, layerType, keyframes, duration = 1.0 }) {
  if (!keyframes || keyframes.length === 0) return null;

  const tracks = [];
  const times = keyframes.map((k) => k.time);

  // Вспомогательный расчет кватерниона из углов в градусах
  const deg2rad = Math.PI / 180;

  if (layerType === 'upper') {
    // ВЕРХНИЙ СЛОЙ: Торс, Плечи, Локти, Запястья
    const boneDef = [
      {
        bone: 'Spine',
        getEuler: (p) => new THREE.Euler(0, (p.hanmiAngle || 0) * deg2rad * 0.5, 0, 'YXZ'),
      },
      {
        bone: 'Chest',
        getEuler: (p) => new THREE.Euler(
          (p.torsoPitch || 0) * deg2rad,
          (p.hanmiAngle || 0) * deg2rad * 0.5,
          0,
          'YXZ'
        ),
      },
      {
        bone: 'UpperArm.L',
        getEuler: (p) => new THREE.Euler(
          (p.leftShoulderPitch || 0) * deg2rad,
          0,
          (p.leftShoulderAbduct ?? 38) * deg2rad,
          'YXZ'
        ),
      },
      {
        bone: 'LowerArm.L',
        getEuler: (p) => new THREE.Euler(
          0,
          (p.leftForearmTwist || 0) * deg2rad,
          (p.leftElbowFlex || 60) * deg2rad,
          'YXZ'
        ),
      },
      {
        bone: 'UpperArm.R',
        getEuler: (p) => new THREE.Euler(
          (p.rightShoulderPitch || 0) * deg2rad,
          0,
          -(p.rightShoulderAbduct ?? 28) * deg2rad,
          'YXZ'
        ),
      },
      {
        bone: 'LowerArm.R',
        getEuler: (p) => new THREE.Euler(
          0,
          -(p.rightForearmTwist || 0) * deg2rad,
          -(p.rightElbowFlex || 60) * deg2rad,
          'YXZ'
        ),
      },
    ];

    for (const def of boneDef) {
      const qValues = [];
      for (const kf of keyframes) {
        const euler = def.getEuler(kf.pose || {});
        const q = new THREE.Quaternion().setFromEuler(euler);
        qValues.push(q.x, q.y, q.z, q.w);
      }

      const aliases = BONE_ALIASES[def.bone] || [def.bone];
      for (const alias of aliases) {
        tracks.push(
          new THREE.QuaternionKeyframeTrack(`${alias}.quaternion`, times, qValues)
        );
      }
    }
  } else {
    // НИЖНИЙ СЛОЙ: Таз In-Place, Бедра, Колени, Стопы
    const boneDef = [
      {
        bone: 'UpperLeg.L',
        getEuler: (p) => new THREE.Euler(
          Math.PI - (p.leftKneeFlex || 30) * deg2rad * 0.6,
          0,
          (p.leftHipSpread || 10) * deg2rad,
          'YXZ'
        ),
      },
      {
        bone: 'LowerLeg.L',
        getEuler: (p) => new THREE.Euler(
          -(p.leftKneeFlex || 30) * deg2rad,
          0,
          0,
          'YXZ'
        ),
      },
      {
        bone: 'UpperLeg.R',
        getEuler: (p) => new THREE.Euler(
          Math.PI + (p.rightKneeFlex || 20) * deg2rad * 0.4,
          0,
          -(p.rightHipSpread || 10) * deg2rad,
          'YXZ'
        ),
      },
      {
        bone: 'LowerLeg.R',
        getEuler: (p) => new THREE.Euler(
          -(p.rightKneeFlex || 20) * deg2rad,
          0,
          0,
          'YXZ'
        ),
      },
    ];

    for (const def of boneDef) {
      const qValues = [];
      for (const kf of keyframes) {
        const euler = def.getEuler(kf.pose || {});
        const q = new THREE.Quaternion().setFromEuler(euler);
        qValues.push(q.x, q.y, q.z, q.w);
      }

      const aliases = BONE_ALIASES[def.bone] || [def.bone];
      for (const alias of aliases) {
        tracks.push(
          new THREE.QuaternionKeyframeTrack(`${alias}.quaternion`, times, qValues)
        );
      }
    }

    // Таз In-Place (X/Z = 0, Y регулирует глубину стойки: 0.90м + dropMeters)
    const baseHipsY = 0.90;
    const posValues = [];
    for (const kf of keyframes) {
      const dropMeters = (kf.pose?.hipsDrop || 0) / 100;
      posValues.push(0, baseHipsY + dropMeters, 0);
    }
    for (const hAlias of BONE_ALIASES['Hips']) {
      tracks.push(new THREE.VectorKeyframeTrack(`${hAlias}.position`, times, posValues));
    }
  }

  return new THREE.AnimationClip(name, duration, tracks);
}

/**
 * Построить THREE.AnimationClip из записанной с веб-камеры последовательности кадров
 * 
 * @param {Object} params
 * @param {string} params.name - Уникальное название клипа
 * @param {'upper'|'lower'|'full'} params.layerType - Записываемый слой
 * @param {Array<Object>} params.recordedFrames - Массив захваченных кадров: [{ t, bones }, ...]
 * @param {number} params.totalDuration - Длительность записи в секундах
 * @returns {THREE.AnimationClip}
 */
export function buildClipFromRecordedFrames({ name, layerType, recordedFrames, totalDuration }) {
  if (!recordedFrames || recordedFrames.length < 2) return null;

  const duration = Math.max(totalDuration || 1.0, 0.4);
  const times = recordedFrames.map((f) => f.t);

  // Сбор названий всех затронутых костей
  const allBones = new Set();
  recordedFrames.forEach((f) => {
    if (f.bones) {
      Object.keys(f.bones).forEach((b) => allBones.add(b));
    }
  });

  const tracks = [];

  for (const boneName of allBones) {
    const isUpper = boneName.includes('Arm') || boneName.includes('Hand') || boneName.includes('Spine') || boneName.includes('Chest') || boneName.includes('Neck') || boneName.includes('Head');
    const isLower = boneName.includes('Leg') || boneName.includes('Foot') || boneName === 'Hips';

    if (layerType === 'upper' && !isUpper) continue;
    if (layerType === 'lower' && !isLower) continue;

    const qValues = [];
    for (const frame of recordedFrames) {
      const bData = frame.bones?.[boneName] || { x: 0, y: 0, z: 0 };
      const euler = new THREE.Euler(bData.x || 0, bData.y || 0, bData.z || 0, 'YXZ');
      const q = new THREE.Quaternion().setFromEuler(euler);
      qValues.push(q.x, q.y, q.z, q.w);
    }

    const aliases = BONE_ALIASES[boneName] || [boneName];
    for (const alias of aliases) {
      tracks.push(new THREE.QuaternionKeyframeTrack(`${alias}.quaternion`, times, qValues));
    }
  }

  // Если нижний слой или полный — фиксируем In-Place позицию таза
  if (layerType === 'lower' || layerType === 'full') {
    const posValues = [];
    for (const frame of recordedFrames) {
      const hipsYOffset = frame.bones?.Hips?.yOffset || 0;
      posValues.push(0, 0.95 + hipsYOffset, 0);
    }
    for (const hAlias of BONE_ALIASES['Hips']) {
      tracks.push(new THREE.VectorKeyframeTrack(`${hAlias}.position`, times, posValues));
    }
  }

  return new THREE.AnimationClip(name, duration, tracks);
}
