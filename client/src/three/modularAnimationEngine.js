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

