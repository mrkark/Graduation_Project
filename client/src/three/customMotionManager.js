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
const ADMIN_OVERRIDES_KEY = 'bunkai_admin_animation_overrides';

/**
 * Загрузить переопределения и правки анимаций от администратора
 */
export function loadAdminAnimationOverrides() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ADMIN_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn('Ошибка загрузки правок анимаций администратора:', err);
    return {};
  }
}

/**
 * Сохранить отредактированную администратором анимацию
 */
export function saveAdminAnimationOverride(animId, data) {
  if (!animId) return false;
  try {
    const existing = loadAdminAnimationOverrides();
    existing[animId] = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(ADMIN_OVERRIDES_KEY, JSON.stringify(existing));
    return true;
  } catch (err) {
    console.error('Ошибка сохранения правки администратора:', err);
    return false;
  }
}

/**
 * Сбросить правки администратора для анимации
 */
export function resetAdminAnimationOverride(animId) {
  try {
    const existing = loadAdminAnimationOverrides();
    delete existing[animId];
    localStorage.setItem(ADMIN_OVERRIDES_KEY, JSON.stringify(existing));
    return true;
  } catch (err) {
    console.error('Ошибка сброса правок:', err);
    return false;
  }
}

/**
 * Сгенерировать канонический 3D клип прыжка Унсу 360° (Кээтоби-гэри / Keetobi-geri)
 * Включает взрывной присед, прыжок в воздух на 1.62м с разворотом на 360°,
 * горизонтальный удар ногой в полете и приземление в низкий партерный смет на татами.
 */
export function generateUnsuJump360Clip(name = 'jump_turn_360') {
  const duration = 2.0;
  const times = [0.0, 0.35, 0.70, 1.05, 1.40, 1.70, 2.0];
  const tracks = [];
  const deg2rad = Math.PI / 180;

  // 1. Траектория таза (Hips): взлет в воздух на 1.62м и посадка в партер на 0.42м
  const hipsPos = [
    0, 0.76, 0.00,  // t=0.0s: Камаэ готовности
    0, 0.50, -0.05, // t=0.35s: Глубокий компрессионный присед перед прыжком
    0, 1.45, 0.15,  // t=0.70s: Взрывной отрыв в воздух!
    0, 1.62, 0.28,  // t=1.05s: Апогей прыжка (максимальная высота в полете!)
    0, 0.95, 0.35,  // t=1.40s: Снижение и завершение удара ногой
    0, 0.42, 0.40,  // t=1.70s: Низкое приземление с упором рукой в пол (партер Унсу)
    0, 0.74, 0.40,  // t=2.00s: Подъем в устойчивую корневую стойку
  ];

  for (const hAlias of BONE_ALIASES['Hips']) {
    tracks.push(new THREE.VectorKeyframeTrack(`${hAlias}.position`, times, hipsPos));
  }

  // 2. Вращение тела на 360° в воздухе (Hips.quaternion)
  const hipsQuats = [];
  const rotYAngles = [0, -0.25, Math.PI, Math.PI * 1.55, Math.PI * 2, Math.PI * 2, Math.PI * 2];
  const pitchAngles = [0, 0.2, -0.15, -0.1, 0.25, 0.4, 0.05];
  for (let i = 0; i < times.length; i++) {
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(pitchAngles[i], rotYAngles[i], 0, 'YXZ')
    );
    hipsQuats.push(q.x, q.y, q.z, q.w);
  }
  for (const hAlias of BONE_ALIASES['Hips']) {
    tracks.push(new THREE.QuaternionKeyframeTrack(`${hAlias}.quaternion`, times, hipsQuats));
  }

  // 3. Правая нога (Ударная нога в воздухе)
  const rightLegQuats = [];
  const rightLegEulers = [
    new THREE.Euler(Math.PI, 0, 0),                        // t=0.0s
    new THREE.Euler(Math.PI - 35 * deg2rad, 0, -10 * deg2rad), // t=0.35s (присед)
    new THREE.Euler(Math.PI - 70 * deg2rad, 0, 25 * deg2rad),  // t=0.70s (вынос бедра)
    new THREE.Euler(Math.PI - 95 * deg2rad, 0, 45 * deg2rad),  // t=1.05s (удар ногой в воздухе!)
    new THREE.Euler(Math.PI - 45 * deg2rad, 0, 15 * deg2rad),  // t=1.40s (складывание ноги)
    new THREE.Euler(Math.PI - 15 * deg2rad, 0, -40 * deg2rad), // t=1.70s (стелющийся смет)
    new THREE.Euler(Math.PI + 10 * deg2rad, 0, -10 * deg2rad), // t=2.00s (стойка)
  ];
  for (const e of rightLegEulers) {
    const q = new THREE.Quaternion().setFromEuler(e);
    rightLegQuats.push(q.x, q.y, q.z, q.w);
  }
  for (const alias of BONE_ALIASES['UpperLeg.R']) {
    tracks.push(new THREE.QuaternionKeyframeTrack(`${alias}.quaternion`, times, rightLegQuats));
  }

  // 4. Правое колено
  const rightKneeQuats = [];
  const rightKneeAngles = [20, 80, 100, 15, 60, 30, 20];
  for (const ang of rightKneeAngles) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-ang * deg2rad, 0, 0, 'YXZ'));
    rightKneeQuats.push(q.x, q.y, q.z, q.w);
  }
  for (const alias of BONE_ALIASES['LowerLeg.R']) {
    tracks.push(new THREE.QuaternionKeyframeTrack(`${alias}.quaternion`, times, rightKneeQuats));
  }

  // 5. Левая нога (Толчковая и опорная)
  const leftLegQuats = [];
  const leftLegEulers = [
    new THREE.Euler(Math.PI, 0, 0),
    new THREE.Euler(Math.PI - 40 * deg2rad, 0, 10 * deg2rad),
    new THREE.Euler(Math.PI - 30 * deg2rad, 0, 15 * deg2rad),
    new THREE.Euler(Math.PI - 45 * deg2rad, 0, 10 * deg2rad),
    new THREE.Euler(Math.PI - 60 * deg2rad, 0, 15 * deg2rad),
    new THREE.Euler(Math.PI - 80 * deg2rad, 0, 20 * deg2rad),
    new THREE.Euler(Math.PI - 20 * deg2rad, 0, 10 * deg2rad),
  ];
  for (const e of leftLegEulers) {
    const q = new THREE.Quaternion().setFromEuler(e);
    leftLegQuats.push(q.x, q.y, q.z, q.w);
  }
  for (const alias of BONE_ALIASES['UpperLeg.L']) {
    tracks.push(new THREE.QuaternionKeyframeTrack(`${alias}.quaternion`, times, leftLegQuats));
  }

  // 6. Левое колено
  const leftKneeQuats = [];
  const leftKneeAngles = [30, 75, 45, 60, 80, 110, 35];
  for (const ang of leftKneeAngles) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-ang * deg2rad, 0, 0, 'YXZ'));
    leftKneeQuats.push(q.x, q.y, q.z, q.w);
  }
  for (const alias of BONE_ALIASES['LowerLeg.L']) {
    tracks.push(new THREE.QuaternionKeyframeTrack(`${alias}.quaternion`, times, leftKneeQuats));
  }

  // 7. Корпус и руки (Торс и упор рукой в пол при приземлении)
  const spineQuats = [];
  const spineEulers = [
    new THREE.Euler(0, 0, 0),
    new THREE.Euler(20 * deg2rad, -15 * deg2rad, 0),
    new THREE.Euler(-10 * deg2rad, 0, 0),
    new THREE.Euler(-15 * deg2rad, 20 * deg2rad, 0),
    new THREE.Euler(15 * deg2rad, 0, 0),
    new THREE.Euler(35 * deg2rad, 10 * deg2rad, 0),
    new THREE.Euler(5 * deg2rad, 0, 0),
  ];
  for (const e of spineEulers) {
    const q = new THREE.Quaternion().setFromEuler(e);
    spineQuats.push(q.x, q.y, q.z, q.w);
  }
  for (const alias of BONE_ALIASES['Spine']) {
    tracks.push(new THREE.QuaternionKeyframeTrack(`${alias}.quaternion`, times, spineQuats));
  }

  return new THREE.AnimationClip(name, duration, tracks);
}

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
      posValues.push(0, 0.85 + hipsYOffset, 0);
    }
    for (const hAlias of BONE_ALIASES['Hips']) {
      tracks.push(new THREE.VectorKeyframeTrack(`${hAlias}.position`, times, posValues));
    }
  }

  return new THREE.AnimationClip(name, duration, tracks);
}
