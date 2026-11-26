/**
 * ============================================================================
 * MODULAR ANIMATION ENGINE — МОДУЛЬНЫЙ ДВИЖОК АНИМАЦИИ ШОТОКАН (v1)
 * ============================================================================
 * 
 * Назначение:
 * 1. Разделение анимаций на независимые биомеханические слои:
 *    - Стойка / Перемещение / Шаги / Развороты (Нижняя часть тела + In-Place таз)
 *    - Техника / Удары / Блоки (Верхняя часть тела + скручивание позвоночника Ханми/Сёмен)
 * 2. Динамический синтез составных AnimationClip без необходимости хранить тысячи готовых файлов:
 *    N стоек * M техник = N*M комбинаций из N + M записей.
 * 3. Стабилизация Root Motion (In-Place): фиксация X/Z смещения для предотвращения
 *    проскальзывания стоп (foot sliding) с сохранением естественного вертикального перепада Y.
 */

import * as THREE from 'three';

// Канонические кости нижней половины тела (стойки, шаги, повороты, стопы)
export const LOWER_BODY_BONES = new Set([
  'Hips',
  'LeftUpLeg',
  'RightUpLeg',
  'LeftLeg',
  'RightLeg',
  'LeftFoot',
  'RightFoot',
  'LeftToeBase',
  'RightToeBase',
  'UpperLeg.L',
  'UpperLeg.R',
  'LowerLeg.L',
  'LowerLeg.R',
  'Foot.L',
  'Foot.R',
  'Toe.L',
  'Toe.R',
  'Toe3.L',
  'Toe3.R',
  // Mixamo / Blender aliases
  'mixamorig:Hips',
  'mixamorigHips',
  'mixamorig:LeftUpLeg',
  'mixamorigLeftUpLeg',
  'mixamorig:RightUpLeg',
  'mixamorigRightUpLeg',
  'mixamorig:LeftLeg',
  'mixamorigLeftLeg',
  'mixamorig:RightLeg',
  'mixamorigRightLeg',
  'mixamorig:LeftFoot',
  'mixamorigLeftFoot',
  'mixamorig:RightFoot',
  'mixamorigRightFoot',
  'mixamorig:LeftToeBase',
  'mixamorigLeftToeBase',
  'mixamorig:RightToeBase',
  'mixamorigRightToeBase',
]);

// Канонические кости верхней половины тела (удары, блоки, плечевой пояс, кисти, все 30 фаланг пальцев)
export const UPPER_BODY_BONES = new Set([
  'Spine',
  'Spine1',
  'Spine2',
  'Chest',
  'UpperChest',
  'Neck',
  'Head',
  'LeftShoulder',
  'RightShoulder',
  'Shoulder.L',
  'Shoulder.R',
  'LeftArm',
  'RightArm',
  'UpperArm.L',
  'UpperArm.R',
  'LeftForeArm',
  'RightForeArm',
  'LowerArm.L',
  'LowerArm.R',
  'LeftHand',
  'RightHand',
  'Hand.L',
  'Hand.R',
  // Пальцы рук: левая рука (Blender canonical)
  'Thumb1.L', 'Thumb2.L', 'Thumb3.L',
  'Index1.L', 'Index2.L', 'Index3.L',
  'Middle1.L', 'Middle2.L', 'Middle3.L',
  'Ring1.L', 'Ring2.L', 'Ring3.L',
  'Pinky1.L', 'Pinky2.L', 'Pinky3.L',
  // Пальцы рук: правая рука (Blender canonical)
  'Thumb1.R', 'Thumb2.R', 'Thumb3.R',
  'Index1.R', 'Index2.R', 'Index3.R',
  'Middle1.R', 'Middle2.R', 'Middle3.R',
  'Ring1.R', 'Ring2.R', 'Ring3.R',
  'Pinky1.R', 'Pinky2.R', 'Pinky3.R',
  // Пальцы рук (Mixamo / Web aliases)
  'LeftHandThumb1', 'LeftHandThumb2', 'LeftHandThumb3',
  'LeftHandIndex1', 'LeftHandIndex2', 'LeftHandIndex3',
  'LeftHandMiddle1', 'LeftHandMiddle2', 'LeftHandMiddle3',
  'LeftHandRing1', 'LeftHandRing2', 'LeftHandRing3',
  'LeftHandPinky1', 'LeftHandPinky2', 'LeftHandPinky3',
  'RightHandThumb1', 'RightHandThumb2', 'RightHandThumb3',
  'RightHandIndex1', 'RightHandIndex2', 'RightHandIndex3',
  'RightHandMiddle1', 'RightHandMiddle2', 'RightHandMiddle3',
  'RightHandRing1', 'RightHandRing2', 'RightHandRing3',
  'RightHandPinky1', 'RightHandPinky2', 'RightHandPinky3',
  // Mixamo / Blender aliases
  'mixamorig:Spine', 'mixamorig:Spine1', 'mixamorig:Spine2',
  'mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2',
  'mixamorig:Neck', 'mixamorig:Head',
  'mixamorigNeck', 'mixamorigHead',
  'mixamorig:LeftShoulder', 'mixamorig:RightShoulder',
  'mixamorigLeftShoulder', 'mixamorigRightShoulder',
  'mixamorig:LeftArm', 'mixamorig:RightArm',
  'mixamorigLeftArm', 'mixamorigRightArm',
  'mixamorig:LeftForeArm', 'mixamorig:RightForeArm',
  'mixamorigLeftForeArm', 'mixamorigRightForeArm',
  'mixamorig:LeftHand', 'mixamorig:RightHand',
  'mixamorigLeftHand', 'mixamorigRightHand',
]);

/**
 * Проверка принадлежности кости к нижней половине тела
 */
export function isLowerBone(trackName) {
  try {
    const parsed = THREE.PropertyBinding.parseTrackName(trackName);
    const nodeName = parsed.nodeName ?? '';
    if (LOWER_BODY_BONES.has(nodeName)) return true;
    const lower = nodeName.toLowerCase();
    return (
      lower.includes('leg') ||
      lower.includes('foot') ||
      lower.includes('toe') ||
      lower.includes('thigh') ||
      lower.includes('shin') ||
      lower === 'hips'
    );
  } catch {
    return false;
  }
}

/**
 * Проверка принадлежности кости к верхней половине тела (включая все 5 пальцев кисти)
 */
export function isUpperBone(trackName) {
  try {
    const parsed = THREE.PropertyBinding.parseTrackName(trackName);
    const nodeName = parsed.nodeName ?? '';
    if (UPPER_BODY_BONES.has(nodeName)) return true;
    const lower = nodeName.toLowerCase();
    return (
      lower.includes('spine') ||
      lower.includes('chest') ||
      lower.includes('arm') ||
      lower.includes('hand') ||
      lower.includes('shoulder') ||
      lower.includes('neck') ||
      lower.includes('head') ||
      lower.includes('finger') ||
      lower.includes('thumb') ||
      lower.includes('index') ||
      lower.includes('middle') ||
      lower.includes('ring') ||
      lower.includes('pinky')
    );
  } catch {
    return false;
  }
}

/**
 * Стабилизирует трек позиции Root/Hips:
 * Обнуляет горизонтальный дрейф (X, Z), сохраняя высоту бедер по вертикали (Y)
 */
export function stabilizeRootPositionTrack(track) {
  if (!track || !track.name.toLowerCase().includes('.position')) return track;
  const values = new Float32Array(track.values);
  for (let i = 0; i < values.length; i += 3) {
    values[i] = 0; // Полностью обнуляем горизонтальное смещение X для корректного In-Place
    // values[i + 1] сохраняем Y (высоту стойки, сгибание коленей, вертикальную биомеханику)
    values[i + 2] = 0; // Полностью обнуляем горизонтальное смещение Z для предотвращения наложения моделей
  }
  return new THREE.VectorKeyframeTrack(track.name, track.times, values);
}

/**
 * Проверяет наличие физического горизонтального смещения (Root/Hips displacement) в клипе.
 * Если смещение присутствует — клип является полноценным шагом/перемещением, а не стационарным упражнением на месте.
 */
export function hasRootDisplacement(clip) {
  if (!clip || !clip.tracks) return false;
  const track = clip.tracks.find((t) => {
    const l = t.name.toLowerCase();
    return l.includes('.position') && (l.includes('hips') || l.includes('root') || l.includes('pelvis'));
  });
  if (!track || !track.values || track.values.length < 6) return false;
  const vals = track.values;
  const x0 = vals[0];
  const z0 = vals[2];
  for (let i = 3; i < vals.length; i += 3) {
    if (Math.abs(vals[i] - x0) > 0.04 || Math.abs(vals[i + 2] - z0) > 0.04) {
      return true;
    }
  }
  return false;
}

/**
 * Преобразует любой AnimationClip в строго стационарный (In-Place):
 * Обнуляет горизонтальный дрейф таза и корня (X, Z = 0),
 * гарантируя, что аватар выполняет технику на месте и не шагает в объектив камеры.
 */
export function makeClipInPlace(clip, newName = null) {
  if (!clip) return clip;
  const name = newName || `${clip.name}_inplace`;
  const tracks = clip.tracks.map((track) => {
    const lower = track.name.toLowerCase();
    if (lower.includes('position') && (lower.includes('hips') || lower.includes('root') || lower.includes('pelvis'))) {
      return stabilizeRootPositionTrack(track);
    }
    return track.clone();
  });
  return new THREE.AnimationClip(name, clip.duration, tracks);
}

/**
 * Извлекает слой стойки / шага (ноги и таз) из полного клипа
 */
export function extractLowerBodyClip(clip, newName = null, zeroHorizontalRoot = true) {
  if (!clip) return null;
  const name = newName || `${clip.name}_lower`;
  const tracks = [];

  for (const track of clip.tracks) {
    if (isLowerBone(track.name)) {
      if (zeroHorizontalRoot && track.name.toLowerCase().includes('hips.position')) {
        tracks.push(stabilizeRootPositionTrack(track));
      } else {
        tracks.push(track.clone());
      }
    }
  }

  return new THREE.AnimationClip(name, clip.duration, tracks);
}

/**
 * Извлекает слой техники (руки, плечи, голова, торс) из полного клипа
 */
export function extractUpperBodyClip(clip, newName = null) {
  if (!clip) return null;
  const name = newName || `${clip.name}_upper`;
  const tracks = [];

  for (const track of clip.tracks) {
    if (isUpperBone(track.name)) {
      tracks.push(track.clone());
    }
  }

  return new THREE.AnimationClip(name, clip.duration, tracks);
}

/**
 * Масштабирует временные метки дорожки под целевую длительность
 */
function scaleTrackTime(track, originalDuration, targetDuration) {
  if (originalDuration <= 0 || targetDuration <= 0 || Math.abs(originalDuration - targetDuration) < 0.001) {
    return track.clone();
  }
  const ratio = targetDuration / originalDuration;
  const newTimes = new Float32Array(track.times.length);
  for (let i = 0; i < track.times.length; i++) {
    newTimes[i] = track.times[i] * ratio;
  }
  return new track.constructor(track.name, newTimes, track.values);
}

// Кэш скомпонованных клипов для предотвращения повторной генерации
const modularCompositeCache = new Map();

/**
 * Очистить кэш скомпонованных клипов
 */
export function clearModularCompositeCache(clipName = null) {
  if (clipName) {
    modularCompositeCache.delete(clipName);
  } else {
    modularCompositeCache.clear();
  }
}

/**
 * Динамический синтез составного клипа (Composite AnimationClip):
 * Объединяет слой стойки (lowerClip) и слой техники (upperClip) в единый AnimationClip
 * 
 * @param {Object} params
 * @param {THREE.AnimationClip} params.lowerClip - Клип стойки/шага (ноги, таз)
 * @param {THREE.AnimationClip} params.upperClip - Клип техники (удар, блок)
 * @param {string} [params.name] - Уникальное имя результата
 * @param {number} [params.duration] - Желаемая длительность (по умолчанию max длительностей)
 * @param {boolean} [params.zeroHorizontalRoot=true] - Обнулить X/Z дрейф
 * @param {boolean} [params.bypassCache=false] - Принудительно пересчитать без чтения из кэша
 * @returns {THREE.AnimationClip}
 */
export function synthesizeModularClip({
  lowerClip,
  upperClip,
  name = null,
  duration = null,
  zeroHorizontalRoot = true,
  bypassCache = false,
}) {
  if (!lowerClip && !upperClip) return null;
  if (!lowerClip) return upperClip;
  if (!upperClip) return lowerClip;

  const clipName = name || `modular_${lowerClip.name}__${upperClip.name}`;
  const isDynamic = bypassCache || clipName.includes('temp') || clipName.includes('preview') || clipName.includes('custom');
  if (!isDynamic && modularCompositeCache.has(clipName)) {
    return modularCompositeCache.get(clipName);
  }

  const targetDuration = duration || Math.max(lowerClip.duration, upperClip.duration, 0.5);
  const combinedTracks = [];
  const addedNodes = new Set();

  // 1. Добавляем нижние дорожки (стойка, шаг, таз)
  for (const track of lowerClip.tracks) {
    if (isLowerBone(track.name)) {
      let t = track;
      if (zeroHorizontalRoot && track.name.toLowerCase().includes('hips.position')) {
        t = stabilizeRootPositionTrack(t);
      }
      t = scaleTrackTime(t, lowerClip.duration, targetDuration);
      combinedTracks.push(t);
      addedNodes.add(track.name);
    }
  }

  // 2. Добавляем верхние дорожки (техника, руки, скручивание позвоночника Ханми/Сёмен)
  for (const track of upperClip.tracks) {
    if (isUpperBone(track.name)) {
      const t = scaleTrackTime(track, upperClip.duration, targetDuration);
      combinedTracks.push(t);
      addedNodes.add(track.name);
    }
  }

  const rawComposite = new THREE.AnimationClip(clipName, targetDuration, combinedTracks);
  const compositeClip = patchAgeUkeClip(rawComposite, clipName);
  modularCompositeCache.set(clipName, compositeClip);
  return compositeClip;
}

/**
 * Очистка кэша составных клипов
 */
export function clearModularClipCache() {
  modularCompositeCache.clear();
}

function swapSideInTrackName(trackName) {
  const dot = trackName.indexOf('.');
  if (dot < 0) return trackName;
  // Support Blender names like "UpperLeg.L.quaternion" or "Foot.R.position"
  const lastDot = trackName.lastIndexOf('.');
  const nodePart = trackName.slice(0, lastDot);
  const propPart = trackName.slice(lastDot);
  let swapped = nodePart;
  if (swapped.endsWith('.L')) {
    swapped = `${swapped.slice(0, -2)}.R`;
  } else if (swapped.endsWith('.R')) {
    swapped = `${swapped.slice(0, -2)}.L`;
  } else if (swapped.includes('Left')) {
    swapped = swapped.replace(/Left/g, 'Right');
  } else if (swapped.includes('Right')) {
    swapped = swapped.replace(/Right/g, 'Left');
  }
  return `${swapped}${propPart}`;
}

/**
 * Зеркально отражает AnimationClip влево/вправо относительно сагиттальной плоскости (X -> -X).
 * Используется для получения недостающих правосторонних стоек и челночных шагов (например fudo_dachi_right, slide_backward_right).
 */
export function mirrorClipLeftRight(clip, newName = null) {
  if (!clip || !clip.tracks) return clip;
  const clipName = newName || `${clip.name}_mirrored`;
  if (modularCompositeCache.has(clipName)) {
    return modularCompositeCache.get(clipName);
  }

  const tracks = clip.tracks.map((track) => {
    const targetName = swapSideInTrackName(track.name);
    const values = new Float32Array(track.values);
    const lower = targetName.toLowerCase();
    if (lower.endsWith('.quaternion')) {
      for (let i = 0; i < values.length; i += 4) {
        values[i + 1] = -values[i + 1];
        values[i + 2] = -values[i + 2];
      }
      return new THREE.QuaternionKeyframeTrack(targetName, new Float32Array(track.times), values);
    }
    if (lower.endsWith('.position')) {
      for (let i = 0; i < values.length; i += 3) {
        values[i] = -values[i];
      }
      return new THREE.VectorKeyframeTrack(targetName, new Float32Array(track.times), values);
    }
    return new track.constructor(targetName, new Float32Array(track.times), values);
  });

  const mirrored = new THREE.AnimationClip(clipName, clip.duration, tracks);
  modularCompositeCache.set(clipName, mirrored);
  return mirrored;
}

function sampleTrackAtTime(track, timeSec) {
  const times = track.times;
  const values = track.values;
  const stride = track.getValueSize ? track.getValueSize() : (track.name.endsWith('.quaternion') ? 4 : 3);
  if (!times || times.length === 0) return new Float32Array(stride);
  if (timeSec <= times[0] || times.length === 1) {
    return values.slice(0, stride);
  }
  const lastIdx = times.length - 1;
  if (timeSec >= times[lastIdx]) {
    return values.slice(lastIdx * stride, (lastIdx + 1) * stride);
  }

  let hi = 1;
  while (hi < times.length && times[hi] < timeSec) hi += 1;
  const lo = Math.max(0, hi - 1);
  const t0 = times[lo];
  const t1 = times[hi];
  const alpha = t1 > t0 ? (timeSec - t0) / (t1 - t0) : 0;

  if (stride === 4 && track.name.toLowerCase().endsWith('.quaternion')) {
    const q0 = new THREE.Quaternion(values[lo * 4], values[lo * 4 + 1], values[lo * 4 + 2], values[lo * 4 + 3]);
    const q1 = new THREE.Quaternion(values[hi * 4], values[hi * 4 + 1], values[hi * 4 + 2], values[hi * 4 + 3]);
    q0.slerp(q1, alpha);
    return new Float32Array([q0.x, q0.y, q0.z, q0.w]);
  }

  const out = new Float32Array(stride);
  for (let k = 0; k < stride; k++) {
    const v0 = values[lo * stride + k];
    const v1 = values[hi * stride + k];
    out[k] = v0 + (v1 - v0) * alpha;
  }
  return out;
}

/**
 * Вырезает рабочий отрезок [startTimeSec, endTimeSec] из клипа с переносом начала в 0.0с.
 */
export function trimClipRange(clip, startTimeSec = 0, endTimeSec = null, newName = null) {
  if (!clip || !clip.tracks) return clip;
  const tStart = Math.max(0, Math.min(startTimeSec || 0, Math.max(0, clip.duration - 0.15)));
  const tEnd = endTimeSec ? Math.min(clip.duration, Math.max(tStart + 0.15, endTimeSec)) : clip.duration;
  const newDur = Math.max(0.25, tEnd - tStart);
  const clipName = newName || `${clip.name}_trim_${tStart.toFixed(2)}_${tEnd.toFixed(2)}`;
  if (modularCompositeCache.has(clipName)) {
    return modularCompositeCache.get(clipName);
  }

  const tracks = [];
  for (const track of clip.tracks) {
    const stride = track.getValueSize ? track.getValueSize() : (track.name.endsWith('.quaternion') ? 4 : 3);
    const outTimes = [];
    const outValues = [];

    const startVal = sampleTrackAtTime(track, tStart);
    outTimes.push(0);
    for (let k = 0; k < stride; k++) outValues.push(startVal[k]);

    for (let i = 0; i < track.times.length; i++) {
      const t = track.times[i];
      if (t > tStart + 0.004 && t < tEnd - 0.004) {
        outTimes.push(t - tStart);
        for (let k = 0; k < stride; k++) outValues.push(track.values[i * stride + k]);
      }
    }

    const endVal = sampleTrackAtTime(track, tEnd);
    outTimes.push(newDur);
    for (let k = 0; k < stride; k++) outValues.push(endVal[k]);

    tracks.push(new track.constructor(track.name, new Float32Array(outTimes), new Float32Array(outValues)));
  }

  const trimmed = new THREE.AnimationClip(clipName, newDur, tracks);
  modularCompositeCache.set(clipName, trimmed);
  return trimmed;
}

/**
 * Синтезирует плавный переход нижней части тела (ноги и таз) из начальной стойки в конечную.
 */
export function synthesizeStanceTransitionClip({
  fromStanceClip,
  toStanceClip,
  upperClip = null,
  duration = 1.2,
  name = null,
}) {
  if (!fromStanceClip && !toStanceClip) return upperClip;
  const fromClip = fromStanceClip || toStanceClip;
  const toClip = toStanceClip || fromStanceClip;
  const clipName = name || `trans_${fromClip.name}__${toClip.name}__${upperClip?.name || 'none'}`;
  if (modularCompositeCache.has(clipName)) {
    return modularCompositeCache.get(clipName);
  }

  const targetDur = Math.max(0.6, duration || upperClip?.duration || 1.2);
  const fromMap = new Map(fromClip.tracks.map((t) => [t.name, t]));
  const toMap = new Map(toClip.tracks.map((t) => [t.name, t]));
  const lowerNames = new Set([...fromMap.keys(), ...toMap.keys()].filter((n) => isLowerBone(n)));
  const combinedTracks = [];

  // Проверяем, требуется ли компенсационный подъем таза (чтобы стопы не проваливались под пол при проходе ног через вертикаль)
  const hipsName = [...lowerNames].find((n) => n.toLowerCase().includes('hips.position'));
  const hipsStartVal = hipsName ? sampleTrackAtTime(fromMap.get(hipsName) || toMap.get(hipsName), 0) : null;
  const hipsEndVal = hipsName ? sampleTrackAtTime(toMap.get(hipsName) || fromMap.get(hipsName), 0) : null;
  const minStanceHipY = Math.min(hipsStartVal ? hipsStartVal[1] : 0.88, hipsEndVal ? hipsEndVal[1] : 0.88);
  const needsCrossoverLift = fromClip !== toClip && minStanceHipY < 0.84;
  const standingHipY = 0.88;

  const steps = 24;
  const times = new Float32Array(steps + 1);
  for (let i = 0; i <= steps; i++) times[i] = (i / steps) * targetDur;

  for (const tName of lowerNames) {
    const tA = fromMap.get(tName) || toMap.get(tName);
    const tB = toMap.get(tName) || fromMap.get(tName);
    const lowerT = tName.toLowerCase();
    const isQuat = lowerT.endsWith('.quaternion');
    const isHipsPos = lowerT.includes('hips.position');
    const stride = isQuat ? 4 : 3;
    const vA = sampleTrackAtTime(tA, 0);
    const vB = sampleTrackAtTime(tB, 0);
    const values = new Float32Array((steps + 1) * stride);

    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const smooth = f * f * (3 - 2 * f);
      if (isQuat) {
        const q = new THREE.Quaternion(vA[0], vA[1], vA[2], vA[3]);
        const qEnd = new THREE.Quaternion(vB[0], vB[1], vB[2], vB[3]);
        q.slerp(qEnd, smooth);
        values[i * 4] = q.x;
        values[i * 4 + 1] = q.y;
        values[i * 4 + 2] = q.z;
        values[i * 4 + 3] = q.w;
      } else {
        for (let k = 0; k < stride; k++) {
          let val = vA[k] + (vB[k] - vA[k]) * smooth;
          if (isHipsPos) {
            if (k === 0 || k === 2) {
              val = 0;
            } else if (k === 1 && needsCrossoverLift) {
              // Плавный подъем центра тяжести (таза) при перешагивании, чтобы прямые ноги не уходили под татами
              const bell = Math.sin(Math.PI * f);
              const targetPeakY = Math.max(val, standingHipY);
              val = val + (targetPeakY - val) * bell;
            }
          }
          values[i * stride + k] = val;
        }
      }
    }

    combinedTracks.push(
      isQuat
        ? new THREE.QuaternionKeyframeTrack(tName, times, values)
        : new THREE.VectorKeyframeTrack(tName, times, values)
    );
  }

  const upperSource = upperClip || toClip;
  for (const track of upperSource.tracks) {
    if (isUpperBone(track.name)) {
      combinedTracks.push(scaleTrackTime(track, upperSource.duration, targetDur));
    }
  }

  const result = new THREE.AnimationClip(clipName, targetDur, combinedTracks);
  modularCompositeCache.set(clipName, result);
  return result;
}

/**
 * Адаптирует удар ногой (Маэ-гэри) под реальную начальную и конечную стойку:
 * - При landingMode='forward' нога после удара сразу опускается вперед в конечную стойку (без отвода назад),
 *   при этом таз плавно удерживает опорную высоту до постановки шагающей стопы на татами (без провала стоп под пол).
 * - При ударе передней ногой из одноименной стойки (напр. Миги Дзэнкуцу -> Маэ-гэри правой)
 *   старт и возврат фиксируются в целевой стойке без смены ног до удара.
 */
export function adaptKickClipToStance({
  kickClip,
  startStanceClip = null,
  endStanceClip = null,
  landingMode = 'auto',
  name = null,
}) {
  if (!kickClip) return null;
  const clipName = name || `kick_${kickClip.name}_${startStanceClip?.name || 'same'}_${endStanceClip?.name || 'same'}_${landingMode}`;
  if (modularCompositeCache.has(clipName)) {
    return modularCompositeCache.get(clipName);
  }

  const dur = kickClip.duration || 2.0;
  const sampleCount = 32;
  const times = new Float32Array(sampleCount + 1);
  for (let i = 0; i <= sampleCount; i++) times[i] = (i / sampleCount) * dur;

  const startMap = startStanceClip ? new Map(startStanceClip.tracks.map((t) => [t.name, t])) : null;
  const endMap = endStanceClip ? new Map(endStanceClip.tracks.map((t) => [t.name, t])) : null;

  // Определяем, нужно ли перешагивание на старте или на выходе (противоположные стойки),
  // чтобы приподнять таз (Hips.y) на время прохода ног через вертикаль и исключить проваливание стоп под пол.
  const isOppositeAtTime = (map, tClip) => {
    if (!map) return false;
    for (const track of kickClip.tracks) {
      const ln = track.name.toLowerCase();
      if ((ln.includes('upperleg') || ln.includes('upleg')) && ln.endsWith('.quaternion')) {
        const stTrack = map.get(track.name);
        if (!stTrack) continue;
        const a = sampleTrackAtTime(track, tClip);
        const b = sampleTrackAtTime(stTrack, 0);
        const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
        if (dot < 0.90) return true;
      }
    }
    return false;
  };
  const needsStartCrossoverLift = isOppositeAtTime(startMap, 0);
  const needsEndCrossoverLift = isOppositeAtTime(endMap, landingMode === 'forward' ? dur * 0.68 : dur);

  const tracks = kickClip.tracks.map((track) => {
    const isLower = isLowerBone(track.name);
    const lowerName = track.name.toLowerCase();
    const isQuat = lowerName.endsWith('.quaternion');
    const isHipsPos = lowerName.includes('hips.position');
    if (!isLower) {
      return track.clone();
    }

    const tStartStance = startMap?.get(track.name);
    const tEndStance = endMap?.get(track.name);
    const vStart = tStartStance ? sampleTrackAtTime(tStartStance, 0) : null;
    const vEnd = tEndStance ? sampleTrackAtTime(tEndStance, 0) : null;
    const stride = isQuat ? 4 : 3;
    const values = new Float32Array((sampleCount + 1) * stride);

    for (let i = 0; i <= sampleCount; i++) {
      const f = i / sampleCount;
      // При landingMode === 'forward' сжимаем пик удара чуть раньше и плавно выходим в конечную стойку вперед
      const srcFrac = landingMode === 'forward'
        ? Math.min(0.68, f <= 0.62 ? (f / 0.62) * 0.60 : 0.60 + ((f - 0.62) / 0.38) * 0.08)
        : f;
      const baseSample = sampleTrackAtTime(track, srcFrac * dur);

      let blendToStart = 0;
      if (vStart && f < 0.22) {
        const k = 1 - f / 0.22;
        blendToStart = k * k * (3 - 2 * k);
      }
      let blendToEnd = 0;
      const endStart = landingMode === 'forward' ? 0.58 : 0.78;
      if (vEnd && f > endStart) {
        const k = (f - endStart) / (1 - endStart);
        blendToEnd = k * k * (3 - 2 * k);
      }

      if (isQuat) {
        const q = new THREE.Quaternion(baseSample[0], baseSample[1], baseSample[2], baseSample[3]);
        if (blendToStart > 0 && vStart) {
          q.slerp(new THREE.Quaternion(vStart[0], vStart[1], vStart[2], vStart[3]), blendToStart);
        }
        if (blendToEnd > 0 && vEnd) {
          q.slerp(new THREE.Quaternion(vEnd[0], vEnd[1], vEnd[2], vEnd[3]), blendToEnd);
        }
        values[i * 4] = q.x;
        values[i * 4 + 1] = q.y;
        values[i * 4 + 2] = q.z;
        values[i * 4 + 3] = q.w;
      } else {
        for (let k = 0; k < stride; k++) {
          let val = baseSample[k];
          if (blendToStart > 0 && vStart) val = val + (vStart[k] - val) * blendToStart;
          if (isHipsPos && k === 1 && landingMode === 'forward') {
            // При шаге вперед после Маэ-гэри таз сохраняет высоту (0.84–0.86м) до касания стопой пола (f=0.80),
            // и только затем опускается в конечную стойку — опорная нога никогда не уходит под пол!
            if (vEnd && f > 0.78) {
              const hipK = (f - 0.78) / 0.22;
              const hipSmooth = hipK * hipK * (3 - 2 * hipK);
              val = val + (vEnd[1] - val) * hipSmooth;
            }
            if (f >= 0.56 && f <= 0.86) {
              const bell = Math.sin(Math.PI * ((f - 0.56) / 0.30));
              val = Math.max(val, 0.84 + 0.03 * bell);
            }
          } else {
            if (blendToEnd > 0 && vEnd) val = val + (vEnd[k] - val) * blendToEnd;
          }
          if (isHipsPos && k === 1) {
            if (needsStartCrossoverLift && f < 0.22) {
              const bellStart = Math.sin(Math.PI * (f / 0.22));
              val = Math.max(val, val + (0.88 - val) * bellStart);
            }
            if (needsEndCrossoverLift && f > endStart && landingMode !== 'forward') {
              const bellEnd = Math.sin(Math.PI * ((f - endStart) / (1 - endStart)));
              val = Math.max(val, val + (0.88 - val) * bellEnd);
            }
          }
          if (isHipsPos && (k === 0 || k === 2)) val = 0;
          values[i * stride + k] = val;
        }
      }
    }

    return isQuat
      ? new THREE.QuaternionKeyframeTrack(track.name, times, values)
      : new THREE.VectorKeyframeTrack(track.name, times, values);
  });

  const adapted = new THREE.AnimationClip(clipName, dur, tracks);
  modularCompositeCache.set(clipName, adapted);
  return adapted;
}

/**
 * Корректирует ориентацию кисти в блоках Агэ-укэ (Age-uke).
 * В библиотеке karateka_techniques_v4.glb и в мастер-MoCap анимациях кисть уже ориентирована корректно из Blender.
 * Ранее применявшийся искусственный доворот на 90° приводил к неестественному перекручиванию запястья.
 * Возвращаем клип в оригинальном, анатомически выверенном виде без деформации суставов.
 */
export function patchAgeUkeClip(clip, clipName = '') {
  if (!clip || !clip.tracks) return clip;
  return clip;
}

/**
 * Создаёт клип удара в голову (Дзёдан-цки) на основе готового клипа Ой-дзуки:
 * сохраняет шаг, биомеханику таза и отвод второй руки (хикитэ), но поднимает бьющую руку
 * на высоту головы/челюсти противника (~1.42–1.45м).
 */
export function synthesizeJodanOiZukiClip(oiZukiClip, side = 'right', name = null) {
  if (!oiZukiClip || !oiZukiClip.tracks) return null;
  const clipName = name || `oi_zuki_jodan_${side}`;
  if (modularCompositeCache.has(clipName)) {
    return modularCompositeCache.get(clipName);
  }

  const dur = oiZukiClip.duration || 1.1;
  const sideLetter = side === 'left' ? 'L' : 'R';
  const targetArmTrackName = oiZukiClip.tracks.find((t) => {
    const ln = t.name.toLowerCase();
    return ln.endsWith('.quaternion') && (ln === `upperarm${sideLetter.toLowerCase()}.quaternion` || ln === `upperarm.${sideLetter.toLowerCase()}.quaternion`);
  })?.name;
  const shoulderTrack = oiZukiClip.tracks.find((t) => {
    const ln = t.name.toLowerCase();
    return ln.endsWith('.quaternion') && (ln === `shoulder${sideLetter.toLowerCase()}.quaternion` || ln === `shoulder.${sideLetter.toLowerCase()}.quaternion`);
  });

  if (!targetArmTrackName) {
    return oiZukiClip;
  }

  const worldPitchAxis = new THREE.Vector3(1, 0, 0);
  const sampleCount = 24;
  const times = new Float32Array(sampleCount + 1);
  for (let i = 0; i <= sampleCount; i++) times[i] = (i / sampleCount) * dur;

  const tracks = oiZukiClip.tracks.map((track) => {
    if (track.name !== targetArmTrackName) {
      return track.clone();
    }

    const values = new Float32Array((sampleCount + 1) * 4);
    for (let i = 0; i <= sampleCount; i++) {
      const f = i / sampleCount;
      const t = f * dur;
      const armLocalArr = sampleTrackAtTime(track, t);
      const qArmLocal = new THREE.Quaternion(armLocalArr[0], armLocalArr[1], armLocalArr[2], armLocalArr[3]);

      // Плавный подъём кулака от уровня груди (Тюдан) к уровню головы (Дзёдан) в фазе выноса руки (0.15..0.60)
      let extWeight = 0;
      if (f >= 0.60) {
        extWeight = 1;
      } else if (f > 0.12) {
        const k = (f - 0.12) / (0.60 - 0.12);
        extWeight = k * k * (3 - 2 * k);
      }

      if (extWeight > 0.001) {
        const pitchRad = -0.52 * extWeight;
        const qWorldDelta = new THREE.Quaternion().setFromAxisAngle(worldPitchAxis, pitchRad);
        const defaultShoulderBind = side === 'left'
          ? new THREE.Quaternion(-0.516, -0.483, -0.483, 0.516).normalize()
          : new THREE.Quaternion(-0.516, 0.483, 0.483, 0.516).normalize();
        const qShoulderW = shoulderTrack
          ? (() => {
              const shArr = sampleTrackAtTime(shoulderTrack, t);
              return new THREE.Quaternion(shArr[0], shArr[1], shArr[2], shArr[3]).normalize();
            })()
          : defaultShoulderBind;
        const qArmWorld = qShoulderW.clone().multiply(qArmLocal);
        const qRaisedWorld = qWorldDelta.multiply(qArmWorld);
        const qRaisedLocal = qShoulderW.clone().invert().multiply(qRaisedWorld);
        qArmLocal.copy(qRaisedLocal);
      }

      values[i * 4] = qArmLocal.x;
      values[i * 4 + 1] = qArmLocal.y;
      values[i * 4 + 2] = qArmLocal.z;
      values[i * 4 + 3] = qArmLocal.w;
    }

    return new THREE.QuaternionKeyframeTrack(track.name, times, values);
  });

  const clip = new THREE.AnimationClip(clipName, dur, tracks);
  modularCompositeCache.set(clipName, clip);
  return clip;
}

/**
 * Создаёт клип удержания стойки с вытянутой бьющей рукой после последнего удара рукой
 * (модель остаётся в стойке с кимэ вытянутой руки, не сбрасывая кулак в нейтральное положение).
 */
export function synthesizeHoldExtendedPunchClip({
  stanceClip,
  punchClip,
  holdTimeFrac = 0.96,
  name = null,
}) {
  if (!stanceClip) return punchClip || null;
  if (!punchClip) return stanceClip;
  const clipName = name || `mod_hold_punch_${stanceClip.name}__${punchClip.name}`;
  if (modularCompositeCache.has(clipName)) {
    return modularCompositeCache.get(clipName);
  }

  const targetDur = stanceClip.duration || 1.8;
  const sampleTime = Math.min(Math.max(0, (punchClip.duration || 1.0) - 0.02), (punchClip.duration || 1.0) * holdTimeFrac);
  const tracks = [];

  for (const track of stanceClip.tracks) {
    if (isLowerBone(track.name)) {
      if (track.name.toLowerCase().includes('hips.position')) {
        tracks.push(stabilizeRootPositionTrack(track));
      } else {
        tracks.push(track.clone());
      }
    }
  }

  const times = new Float32Array([0, targetDur]);
  for (const track of punchClip.tracks) {
    if (!isUpperBone(track.name)) continue;
    const isQuat = track.name.toLowerCase().endsWith('.quaternion');
    const stride = isQuat ? 4 : 3;
    const val = sampleTrackAtTime(track, sampleTime);
    const values = new Float32Array(2 * stride);
    for (let k = 0; k < stride; k++) {
      values[k] = val[k];
      values[stride + k] = val[k];
    }
    tracks.push(
      isQuat
        ? new THREE.QuaternionKeyframeTrack(track.name, times, values)
        : new THREE.VectorKeyframeTrack(track.name, times, values)
    );
  }

  const result = new THREE.AnimationClip(clipName, targetDur, tracks);
  modularCompositeCache.set(clipName, result);
  return result;
}

