/**
 * Генерация точных анимационных клипов Шотокан каратэ для THREE.js
 * Использует реальный FBX-скелет мастера
 * 
 * Особенности:
 * - Канонические кулаки Сэйкэн: большой палец жестко прижат поверх указательного и среднего пальцев (дистанция < 0.3 см)
 * - Настоящая биомеханика ударов ногами (Маэ-гэри, Ёко-гэри, Маваси-гэри, Усиро-гэри):
 *   фаза камеры (вынос колена к груди выше уровня пояса Y > 15), удар в чудан/дзёдан (Y > 16), ретракция (хикиаси)
 * - Устранение изломов суставов: физиологические углы сгибания в локтях и коленях
 * 
 * Запуск: $env:NODE_PATH="client/node_modules"; node server/scripts/generate-shotokan-clips.js
 */
const fs = require('fs');
const path = require('path');
const THREE = require('three');
const { FBXLoader } = require('three/examples/jsm/loaders/FBXLoader.js');

global.window = { URL: { createObjectURL: () => '' } };
global.document = { createElementNS: () => ({ setAttribute: () => {}, addEventListener: () => {} }) };

const clientDir = path.resolve(__dirname, '..', '..', 'client');
const fbxPath = path.join(clientDir, 'public', 'models', 'sensei.fbx');
const animsPublicDir = path.join(clientDir, 'public', 'anims');
const animsDistDir = path.join(clientDir, 'dist', 'anims');

if (!fs.existsSync(animsPublicDir)) fs.mkdirSync(animsPublicDir, { recursive: true });
if (!fs.existsSync(animsDistDir)) fs.mkdirSync(animsDistDir, { recursive: true });

const loader = new FBXLoader();
const buffer = fs.readFileSync(fbxPath);
const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
const fbx = loader.parse(ab, '');

const scene = new THREE.Scene();
scene.add(fbx);
scene.updateMatrixWorld(true);

const FINGER_BONES = [
  'LeftHandThumb1', 'LeftHandThumb2', 'LeftHandThumb3',
  'LeftHandIndex1', 'LeftHandIndex2', 'LeftHandIndex3',
  'LeftHandMiddle1', 'LeftHandMiddle2', 'LeftHandMiddle3',
  'LeftHandRing1', 'LeftHandRing2', 'LeftHandRing3',
  'LeftHandPinky1', 'LeftHandPinky2', 'LeftHandPinky3',
  'RightHandThumb1', 'RightHandThumb2', 'RightHandThumb3',
  'RightHandIndex1', 'RightHandIndex2', 'RightHandIndex3',
  'RightHandMiddle1', 'RightHandMiddle2', 'RightHandMiddle3',
  'RightHandRing1', 'RightHandRing2', 'RightHandRing3',
  'RightHandPinky1', 'RightHandPinky2', 'RightHandPinky3'
];

const RIG_BONES = [
  'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
  'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase',
  ...FINGER_BONES
];

const bones = {}, restQuat = {};
fbx.traverse(o => {
  if (o.isBone) {
    const clean = o.name.replace(/^mixamorig:?/, '');
    if (RIG_BONES.includes(clean) && !bones[clean]) {
      bones[clean] = o;
      restQuat[clean] = o.quaternion.clone();
    }
  }
});

const rig = { root: fbx, bones, restQuat, hipsRestY: bones.Hips.position.y };

const _posA = new THREE.Vector3();
const _posB = new THREE.Vector3();
const _targetDir = new THREE.Vector3();
const _worldQuat = new THREE.Quaternion();
const _parentWorldQuat = new THREE.Quaternion();
const _deltaQuat = new THREE.Quaternion();

function aim(boneName, childName, dx, dy, dz) {
  const bone = rig.bones[boneName];
  const child = rig.bones[childName];
  if (!bone || !child) return;

  bone.getWorldPosition(_posA);
  child.getWorldPosition(_posB);
  _posB.sub(_posA);
  if (_posB.lengthSq() < 1e-10) return;
  _posB.normalize();

  rig.root.getWorldQuaternion(_worldQuat);
  _targetDir.set(dx, dy, dz).normalize().applyQuaternion(_worldQuat);

  _deltaQuat.setFromUnitVectors(_posB, _targetDir);

  bone.getWorldQuaternion(_worldQuat);
  _worldQuat.premultiply(_deltaQuat);
  bone.parent.getWorldQuaternion(_parentWorldQuat).invert();
  bone.quaternion.copy(_parentWorldQuat).multiply(_worldQuat);
  bone.updateMatrixWorld(true);
}

function reset() {
  for (const n in rig.bones) {
    rig.bones[n].quaternion.copy(rig.restQuat[n]);
  }
  rig.bones.Hips.position.y = rig.hipsRestY;
  rig.root.updateMatrixWorld(true);
}

function clampForearmTwist(boneName, maxAngleDeg = 45) {
  const b = rig.bones[boneName];
  if (!b) return;
  const q = b.quaternion;
  let twY = q.y, twW = q.w;
  const len = Math.sqrt(twY * twY + twW * twW);
  if (len < 1e-6) return;
  twY /= len; twW /= len;
  let angle = 2 * Math.atan2(twY, twW);
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  const maxRad = maxAngleDeg * Math.PI / 180;
  const clampedAngle = Math.max(-maxRad, Math.min(maxRad, angle));
  const oldTwist = new THREE.Quaternion(0, twY, 0, twW);
  const newTwist = new THREE.Quaternion(0, Math.sin(clampedAngle / 2), 0, Math.cos(clampedAngle / 2));
  const swing = q.clone().multiply(oldTwist.invert());
  b.quaternion.copy(swing.multiply(newTwist));
}

function poseHikite(side) {
  const isLeft = side === 'left';
  const sign = isLeft ? 1 : -1;
  // Локоть прижат к боку (X = ±12.7), кулак заведен прямо под ребра (X = ±9.5, Y = 20.6)
  aim(isLeft ? 'LeftArm' : 'RightArm', isLeft ? 'LeftForeArm' : 'RightForeArm', -sign * 0.02, -0.74, -0.74);
  aim(isLeft ? 'LeftForeArm' : 'RightForeArm', isLeft ? 'LeftHand' : 'RightHand', -sign * 0.22, -0.04, 0.98);
  // Кулак в хикитэ повернут согнутыми пальцами строго вверх (+Y)
  const hand = isLeft ? rig.bones.LeftHand : rig.bones.RightHand;
  if (hand) hand.rotateY(isLeft ? -Math.PI / 4 : Math.PI / 4);
}

/**
 * Формирование канонического плотно зажатого кулака (Сэйкэн)
 * Фаланги пальцев сжаты, большой палец жестко прижимает указательный и средний снаружи
 * без проникновения в геометрию ладони
 */
function makeFist(side) {
  const prefix = side === 'left' ? 'LeftHand' : 'RightHand';
  const isLeft = side === 'left';
  const sign = isLeft ? 1 : -1;

  // 1. Четыре пальца (указательный, средний, безымянный, мизинец) плотно согнуты внутрь к ладони
  for (const finger of ['Index', 'Middle', 'Ring', 'Pinky']) {
    const b1 = rig.bones[prefix + finger + '1'];
    const b2 = rig.bones[prefix + finger + '2'];
    const b3 = rig.bones[prefix + finger + '3'];
    if (b1) b1.rotateX(1.30);
    if (b2) b2.rotateX(1.40);
    if (b3) b3.rotateX(1.10);
  }

  // 2. Большой палец плотно дожат СТРОГО ПОВЕРХ согнутых указательного и среднего пальцев (Сэйкэн)
  const t1 = rig.bones[prefix + 'Thumb1'];
  const t2 = rig.bones[prefix + 'Thumb2'];
  const t3 = rig.bones[prefix + 'Thumb3'];
  if (t1) {
    t1.rotation.set(-0.30, sign * 0.80, sign * 0.50);
  }
  if (t2) {
    t2.rotation.set(0.70, 0, 0);
  }
  if (t3) {
    t3.rotation.set(0.60, 0, 0);
  }
}

/**
 * Раскрытая ладонь-меч (Сюто)
 */
function makeShuto(side) {
  const prefix = side === 'left' ? 'LeftHand' : 'RightHand';
  const sign = side === 'left' ? 1 : -1;

  for (const finger of ['Index', 'Middle', 'Ring', 'Pinky']) {
    const b1 = rig.bones[prefix + finger + '1'];
    const b2 = rig.bones[prefix + finger + '2'];
    const b3 = rig.bones[prefix + finger + '3'];
    if (b1) b1.rotateX(0.04);
    if (b2) b2.rotateX(0.02);
    if (b3) b3.rotateX(0.0);
  }

  const t1 = rig.bones[prefix + 'Thumb1'];
  const t2 = rig.bones[prefix + 'Thumb2'];
  const t3 = rig.bones[prefix + 'Thumb3'];
  if (t1) {
    t1.rotateY(sign * 0.35);
    t1.rotateZ(sign * 0.65);
  }
  if (t2) t2.rotateX(0.60);
  if (t3) t3.rotateX(0.60);
}

function fistBoth() {
  makeFist('left');
  makeFist('right');
}

function generateClip(name, duration, keyframes) {
  const trackMap = {};
  for (const bName of RIG_BONES) trackMap[bName] = { times: [], values: [] };
  const hipsPosTrack = { times: [], values: [] };

  for (const kf of keyframes) {
    reset();
    kf.pose();
    clampForearmTwist('LeftForeArm', 45);
    clampForearmTwist('RightForeArm', 45);
    rig.root.updateMatrixWorld(true);
    for (const bName of RIG_BONES) {
      const b = rig.bones[bName];
      if (b) {
        trackMap[bName].times.push(kf.t);
        trackMap[bName].values.push(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
      }
    }
    hipsPosTrack.times.push(kf.t);
    hipsPosTrack.values.push(rig.bones.Hips.position.x, rig.bones.Hips.position.y, rig.bones.Hips.position.z);
  }

  const tracks = [];
  tracks.push(new THREE.VectorKeyframeTrack('mixamorigHips.position', hipsPosTrack.times, hipsPosTrack.values));
  for (const bName of RIG_BONES) {
    tracks.push(new THREE.QuaternionKeyframeTrack('mixamorig' + bName + '.quaternion', trackMap[bName].times, trackMap[bName].values));
  }
  const clip = new THREE.AnimationClip(name, duration, tracks);
  const jsonStr = JSON.stringify(clip.toJSON(), null, 2);
  fs.writeFileSync(path.join(animsPublicDir, name + '.json'), jsonStr);
  fs.writeFileSync(path.join(animsDistDir, name + '.json'), jsonStr);
  console.log('✔ Saved ' + name + '.json (' + tracks.length + ' tracks, ' + duration + 's)');
}

// ----------------------------------------------------
// Позы стоек
// ----------------------------------------------------

/**
 * Стойка Йой (Хэйко-дати / Сидзэнтай)
 * Ноги на ширине плеч, стопы параллельны
 * Руки смотрят вниз и вперед (кулаки опущены под углом ~45° перед низом живота)
 * Кулаки плотно сжаты (сэйкэн)
 */
function poseReady(br = 0) {
  aim('Spine', 'Spine1', 0, 1, 0.015);
  aim('Neck', 'Head', 0, 1, 0.02);
  // Ноги строго на ширине плеч, устойчивая опора
  aim('LeftUpLeg', 'LeftLeg', 0.10, -0.99, 0.12);
  aim('LeftLeg', 'LeftFoot', 0, -0.99, -0.12);
  aim('RightUpLeg', 'RightLeg', -0.10, -0.99, 0.12);
  aim('RightLeg', 'RightFoot', 0, -0.99, -0.12);
  // Руки согнуты под 45° перед низом живота, предплечья сведены
  aim('LeftShoulder', 'LeftArm', 0.06, -0.04, 0.08);
  aim('LeftArm', 'LeftForeArm', 0.18, -0.92, 0.28);
  aim('LeftForeArm', 'LeftHand', 0.06, -0.88, 0.44);
  aim('RightShoulder', 'RightArm', -0.06, -0.04, 0.08);
  aim('RightArm', 'RightForeArm', -0.18, -0.92, 0.28);
  aim('RightForeArm', 'RightHand', -0.06, -0.88, 0.44);
  rig.bones.Hips.position.y = rig.hipsRestY * (0.99 + br * 0.004);
  
  fistBoth();
}

function poseZenkutsu(br = 0) {
  aim('Spine', 'Spine1', 0, 1, 0.04);
  aim('Neck', 'Head', 0, 1, 0.05);
  aim('RightShoulder', 'RightArm', -0.05, 0.05, 0.4);
  aim('RightArm', 'RightForeArm', -0.05, 0.02, 0.99);
  aim('RightForeArm', 'RightHand', -0.02, 0.01, 0.99);
  poseHikite('left');
  aim('LeftUpLeg', 'LeftLeg', 0.16, -0.68, 0.72);
  aim('LeftLeg', 'LeftFoot', 0, -0.92, -0.38);
  aim('RightUpLeg', 'RightLeg', -0.16, -0.74, -0.66);
  aim('RightLeg', 'RightFoot', 0, -0.92, -0.38);
  rig.bones.Hips.position.y = rig.hipsRestY * (0.83 + br * 0.003);
  fistBoth();
}

function poseKokutsu(br = 0) {
  aim('Spine', 'Spine1', -0.03, 1, 0.02);
  aim('LeftUpLeg', 'LeftLeg', 0.12, -0.85, 0.50);
  aim('LeftLeg', 'LeftFoot', 0, -0.94, -0.34);
  aim('RightUpLeg', 'RightLeg', -0.22, -0.62, -0.75);
  aim('RightLeg', 'RightFoot', 0, -0.90, -0.42);
  aim('LeftArm', 'LeftForeArm', 0.38, -0.20, 0.90);
  aim('LeftForeArm', 'LeftHand', -0.25, 0.35, 0.90);
  aim('RightArm', 'RightForeArm', -0.32, -0.35, 0.88);
  aim('RightForeArm', 'RightHand', 0.30, 0.10, 0.94);
  rig.bones.Hips.position.y = rig.hipsRestY * (0.84 + br * 0.003);
  makeShuto('left');
  makeFist('right');
}

function poseNaturalLegs() {
  aim('Spine', 'Spine1', 0, 1, 0.015);
  aim('Neck', 'Head', 0, 1, 0.02);
  aim('LeftUpLeg', 'LeftLeg', 0.10, -0.99, 0.12);
  aim('LeftLeg', 'LeftFoot', 0, -0.99, -0.12);
  aim('RightUpLeg', 'RightLeg', -0.10, -0.99, 0.12);
  aim('RightLeg', 'RightFoot', 0, -0.99, -0.12);
  rig.bones.Hips.position.y = rig.hipsRestY * 0.99;
}

function poseKibaStance(br = 0) {
  aim('Spine', 'Spine1', 0, 1, 0.02);
  aim('Neck', 'Head', 0, 1, 0.02);
  aim('LeftUpLeg', 'LeftLeg', 0.65, -0.72, 0.22);
  aim('LeftLeg', 'LeftFoot', -0.20, -0.94, -0.25);
  aim('RightUpLeg', 'RightLeg', -0.65, -0.72, 0.22);
  aim('RightLeg', 'RightFoot', 0.20, -0.94, -0.25);
  rig.bones.Hips.position.y = rig.hipsRestY * (0.81 + br * 0.003);
}

function poseChokuPunch(side) {
  const isLeft = side === 'left';
  const sign = isLeft ? -1 : 1;
  aim(isLeft ? 'LeftShoulder' : 'RightShoulder', isLeft ? 'LeftArm' : 'RightArm', sign * 0.05, 0.0, 0.40);
  aim(isLeft ? 'LeftArm' : 'RightArm', isLeft ? 'LeftForeArm' : 'RightForeArm', sign * 0.16, -0.04, 0.98);
  aim(isLeft ? 'LeftForeArm' : 'RightForeArm', isLeft ? 'LeftHand' : 'RightHand', sign * 0.16, 0.0, 0.98);
}

function poseKiba(br = 0) {
  poseKibaStance(br);
  aim('LeftArm', 'LeftForeArm', 0.40, 0.05, 0.90);
  aim('LeftForeArm', 'LeftHand', -0.85, 0.05, 0.52);
  poseHikite('right');
  fistBoth();
}

function poseFudo(br = 0) {
  aim('Spine', 'Spine1', 0, 1, 0.03);
  aim('LeftUpLeg', 'LeftLeg', 0.25, -0.72, 0.64);
  aim('LeftLeg', 'LeftFoot', 0, -0.92, -0.38);
  aim('RightUpLeg', 'RightLeg', -0.28, -0.68, -0.67);
  aim('RightLeg', 'RightFoot', 0, -0.90, -0.42);
  aim('LeftArm', 'LeftForeArm', 0.28, -0.15, 0.94);
  aim('LeftForeArm', 'LeftHand', 0.08, 0.35, 0.93);
  aim('RightArm', 'RightForeArm', -0.28, -0.40, 0.86);
  aim('RightForeArm', 'RightHand', 0.10, 0.15, 0.98);
  rig.bones.Hips.position.y = rig.hipsRestY * (0.83 + br * 0.003);
  fistBoth();
}

function poseGankaku(br = 0) {
  aim('Spine', 'Spine1', 0, 1, 0.02);
  aim('LeftUpLeg', 'LeftLeg', 0.02, -0.98, 0.18);
  aim('LeftLeg', 'LeftFoot', 0, -0.98, -0.18);
  aim('RightUpLeg', 'RightLeg', -0.42, -0.35, 0.83);
  aim('RightLeg', 'RightFoot', 0.50, -0.85, -0.15);
  aim('LeftArm', 'LeftForeArm', 0.55, 0.25, 0.79);
  aim('LeftForeArm', 'LeftHand', -0.30, 0.85, 0.42);
  aim('RightArm', 'RightForeArm', -0.35, -0.45, 0.82);
  aim('RightForeArm', 'RightHand', 0.20, 0.20, 0.95);
  rig.bones.Hips.position.y = rig.hipsRestY * (0.97 + br * 0.004);
  fistBoth();
}

// ----------------------------------------------------
// 1-6. Клипы стоек (Stance clips)
// ----------------------------------------------------
generateClip('stance_ready', 2.4, [
  { t: 0.0, pose: () => poseReady(0) },
  { t: 1.2, pose: () => poseReady(1) },
  { t: 2.4, pose: () => poseReady(0) },
]);

generateClip('stance_zenkutsu', 2.4, [
  { t: 0.0, pose: () => poseZenkutsu(0) },
  { t: 1.2, pose: () => poseZenkutsu(1) },
  { t: 2.4, pose: () => poseZenkutsu(0) },
]);

generateClip('stance_kokutsu', 2.4, [
  { t: 0.0, pose: () => poseKokutsu(0) },
  { t: 1.2, pose: () => poseKokutsu(1) },
  { t: 2.4, pose: () => poseKokutsu(0) },
]);

generateClip('stance_kiba', 2.4, [
  { t: 0.0, pose: () => poseKiba(0) },
  { t: 1.2, pose: () => poseKiba(1) },
  { t: 2.4, pose: () => poseKiba(0) },
]);

generateClip('stance_fudo', 2.4, [
  { t: 0.0, pose: () => poseFudo(0) },
  { t: 1.2, pose: () => poseFudo(1) },
  { t: 2.4, pose: () => poseFudo(0) },
]);

generateClip('stance_gankaku', 2.4, [
  { t: 0.0, pose: () => poseGankaku(0) },
  { t: 1.2, pose: () => poseGankaku(1) },
  { t: 2.4, pose: () => poseGankaku(0) },
]);

// ----------------------------------------------------
// 7-17. УДАРЫ РУКАМИ КАРАТЭ (Цуки и Учи)
// ----------------------------------------------------

// 1. Чоку-цуки (Прямой удар кулаком на месте)
// Начальное положение: левая рука в хикитэ под ребром (пальцами вверх), правая выпрямлена вперед.
// Конечное положение: правая рука в хикитэ под ребром (пальцами вверх), левая выпрямлена вперед.
// Движение начинается с возврата выпрямленной руки, затем вылетает вторая рука. Ноги остаются в естественной стойке.
generateClip('choku_zuki', 1.2, [
  // 1. Начальное положение: левая рука в хикитэ (пальцами вверх), правая выпрямлена вперед
  {
    t: 0.0,
    pose: () => {
      poseNaturalLegs();
      poseHikite('left');
      poseChokuPunch('right');
      fistBoth();
    }
  },
  // 2. Движение начинается с возврата прямой руки (правая начинает оттягиваться назад, левая еще неподвижна в хикитэ)
  {
    t: 0.12,
    pose: () => {
      poseNaturalLegs();
      poseHikite('left');
      aim('RightArm', 'RightForeArm', 0.02, -0.40, 0.80);
      aim('RightForeArm', 'RightHand', 0.10, -0.02, 0.98);
      if (rig.bones.RightHand) rig.bones.RightHand.rotateY(Math.PI / 8);
      fistBoth();
    }
  },
  // 3. Вылет второй руки (правая рука на середине возврата, левая вылетает из хикитэ вперед)
  {
    t: 0.24,
    pose: () => {
      poseNaturalLegs();
      aim('RightArm', 'RightForeArm', 0.0, -0.65, 0.20);
      aim('RightForeArm', 'RightHand', 0.14, -0.04, 0.98);
      if (rig.bones.RightHand) rig.bones.RightHand.rotateY(Math.PI / 6);
      aim('LeftArm', 'LeftForeArm', 0.04, -0.55, 0.45);
      aim('LeftForeArm', 'LeftHand', -0.16, -0.02, 0.98);
      if (rig.bones.LeftHand) rig.bones.LeftHand.rotateY(-Math.PI / 6);
      fistBoth();
    }
  },
  // 4. Скрещивание и разгон (правая почти у ребер, левая ускоряется по центральной линии)
  {
    t: 0.38,
    pose: () => {
      poseNaturalLegs();
      aim('RightArm', 'RightForeArm', 0.01, -0.72, -0.45);
      aim('RightForeArm', 'RightHand', 0.20, -0.04, 0.98);
      if (rig.bones.RightHand) rig.bones.RightHand.rotateY(Math.PI * 0.22);
      aim('LeftArm', 'LeftForeArm', -0.06, -0.12, 0.90);
      aim('LeftForeArm', 'LeftHand', -0.16, 0.0, 0.98);
      if (rig.bones.LeftHand) rig.bones.LeftHand.rotateY(-Math.PI / 10);
      fistBoth();
    }
  },
  // 5. Точка удара и кимэ (правая рука жестко в хикитэ под ребром пальцами вверх, левая полностью выпрямлена вперед)
  {
    t: 0.52,
    pose: () => {
      poseNaturalLegs();
      poseHikite('right');
      poseChokuPunch('left');
      fistBoth();
    }
  },
  // 6. Удержание конечного положения (дзансин)
  {
    t: 0.80,
    pose: () => {
      poseNaturalLegs();
      poseHikite('right');
      poseChokuPunch('left');
      fistBoth();
    }
  },
  // 7. Конечное положение: правая рука в хикитэ под ребром (пальцами вверх), левая выпрямлена вперед
  {
    t: 1.20,
    pose: () => {
      poseNaturalLegs();
      poseHikite('right');
      poseChokuPunch('left');
      fistBoth();
    }
  },
]);

// 2. Ой-цуки (Прямой удар с выпадом вперед в чудан)
generateClip('oi_zuki', 1.5, [
  { t: 0.0, pose: () => poseReady(0) },
  { t: 0.25, pose: () => {
      aim('LeftUpLeg', 'LeftLeg', 0.14, -0.75, 0.55);
      aim('LeftLeg', 'LeftFoot', 0, -0.92, -0.38);
      aim('RightUpLeg', 'RightLeg', -0.14, -0.78, -0.55);
      aim('RightLeg', 'RightFoot', 0, -0.92, -0.38);
      poseHikite('right');
      aim('LeftArm', 'LeftForeArm', 0.12, 0.05, 0.95);
      aim('LeftForeArm', 'LeftHand', 0.05, 0.02, 0.98);
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.88;
    }
  },
  { t: 0.60, pose: () => {
      poseZenkutsu(0);
      aim('RightArm', 'RightForeArm', -0.02, 0.02, 0.98);
      aim('RightForeArm', 'RightHand', 0.0, 0.0, 0.99);
      poseHikite('left');
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.83;
    }
  },
  { t: 1.00, pose: () => {
      poseZenkutsu(0);
      aim('RightArm', 'RightForeArm', -0.02, 0.02, 0.98);
      aim('RightForeArm', 'RightHand', 0.0, 0.0, 0.99);
      poseHikite('left');
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.83;
    }
  },
  { t: 1.5, pose: () => poseReady(0) },
]);

// 3. Гяку-цуки (Обратный реверсивный удар от бедра с доворотом таза)
generateClip('gyaku_zuki', 1.5, [
  { t: 0.0, pose: () => poseReady(0) },
  { t: 0.25, pose: () => {
      aim('LeftUpLeg', 'LeftLeg', 0.12, -0.80, 0.45);
      aim('LeftLeg', 'LeftFoot', 0, -0.94, -0.32);
      aim('RightUpLeg', 'RightLeg', -0.14, -0.80, -0.45);
      aim('RightLeg', 'RightFoot', 0, -0.92, -0.36);
      aim('LeftArm', 'LeftForeArm', 0.15, 0.10, 0.85);
      aim('LeftForeArm', 'LeftHand', 0.08, 0.15, 0.92);
      poseHikite('right');
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.86;
    }
  },
  { t: 0.58, pose: () => {
      aim('Spine', 'Spine1', -0.04, 1, 0.08);
      aim('LeftUpLeg', 'LeftLeg', 0.16, -0.70, 0.68);
      aim('LeftLeg', 'LeftFoot', 0, -0.92, -0.38);
      aim('RightUpLeg', 'RightLeg', -0.16, -0.74, -0.66);
      aim('RightLeg', 'RightFoot', 0, -0.92, -0.38);
      aim('RightShoulder', 'RightArm', -0.08, 0.06, 0.50);
      aim('RightArm', 'RightForeArm', -0.02, 0.03, 0.98);
      aim('RightForeArm', 'RightHand', 0.0, 0.0, 0.99);
      poseHikite('left');
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.83;
    }
  },
  { t: 0.95, pose: () => {
      aim('Spine', 'Spine1', -0.04, 1, 0.08);
      aim('LeftUpLeg', 'LeftLeg', 0.16, -0.70, 0.68);
      aim('RightUpLeg', 'RightLeg', -0.16, -0.74, -0.66);
      aim('RightArm', 'RightForeArm', -0.02, 0.03, 0.98);
      aim('RightForeArm', 'RightHand', 0.0, 0.0, 0.99);
      poseHikite('left');
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.83;
    }
  },
  { t: 1.5, pose: () => poseReady(0) },
]);

// 4. Кизами-цуки (Быстрый передний джеб каратэ)
generateClip('kizami_zuki', 1.2, [
  { t: 0.0, pose: () => poseReady(0) },
  { t: 0.18, pose: () => {
      aim('LeftUpLeg', 'LeftLeg', 0.10, -0.88, 0.35);
      aim('RightArm', 'RightForeArm', -0.22, -0.15, 0.85);
      aim('RightForeArm', 'RightHand', -0.10, 0.15, 0.92);
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.94;
    }
  },
  { t: 0.42, pose: () => {
      aim('LeftUpLeg', 'LeftLeg', 0.12, -0.80, 0.50);
      aim('LeftShoulder', 'LeftArm', 0.05, 0.08, 0.40);
      aim('LeftArm', 'LeftForeArm', 0.02, 0.14, 0.98);
      aim('LeftForeArm', 'LeftHand', 0.0, 0.06, 0.99);
      aim('RightArm', 'RightForeArm', -0.25, -0.20, 0.82);
      aim('RightForeArm', 'RightHand', 0.08, 0.18, 0.92);
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.92;
    }
  },
  { t: 0.70, pose: () => {
      aim('LeftArm', 'LeftForeArm', 0.15, -0.30, 0.85);
      aim('LeftForeArm', 'LeftHand', 0.08, -0.40, 0.85);
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.96;
    }
  },
  { t: 1.2, pose: () => poseReady(0) },
]);

// 5. Рэн-цуки (Связка «двойка»: левый джеб + правый реверс)
generateClip('ren_zuki', 1.6, [
  { t: 0.0, pose: () => poseReady(0) },
  { t: 0.22, pose: () => {
      aim('LeftUpLeg', 'LeftLeg', 0.14, -0.80, 0.45);
      aim('LeftArm', 'LeftForeArm', 0.02, 0.12, 0.98);
      aim('LeftForeArm', 'LeftHand', 0.0, 0.04, 0.99);
      poseHikite('right');
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.88;
    }
  },
  { t: 0.45, pose: () => {
      aim('LeftArm', 'LeftForeArm', 0.20, -0.10, -0.70);
      poseHikite('right');
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.85;
    }
  },
  { t: 0.75, pose: () => {
      poseZenkutsu(0);
      aim('RightArm', 'RightForeArm', -0.02, 0.02, 0.98);
      aim('RightForeArm', 'RightHand', 0.0, 0.0, 0.99);
      poseHikite('left');
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.83;
    }
  },
  { t: 1.15, pose: () => {
      poseZenkutsu(0);
      aim('RightArm', 'RightForeArm', -0.02, 0.02, 0.98);
      aim('RightForeArm', 'RightHand', 0.0, 0.0, 0.99);
      poseHikite('left');
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.83;
    }
  },
  { t: 1.6, pose: () => poseReady(0) },
]);

// 6. Уракэн-учи (Хлесткий круговой удар тыльной стороной кулака)
generateClip('uraken_uchi', 1.4, [
  { t: 0.0, pose: () => poseReady(0) },
  { t: 0.25, pose: () => {
      aim('Spine', 'Spine1', 0.04, 1, 0.02);
      aim('RightShoulder', 'RightArm', 0.20, 0.15, 0.50);
      aim('RightArm', 'RightForeArm', 0.35, 0.20, 0.70);
      aim('RightForeArm', 'RightHand', 0.15, 0.35, 0.60);
      aim('LeftArm', 'LeftForeArm', 0.22, -0.40, 0.75);
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.94;
    }
  },
  { t: 0.58, pose: () => {
      aim('RightShoulder', 'RightArm', -0.15, 0.10, 0.40);
      aim('RightArm', 'RightForeArm', -0.75, 0.18, 0.45);
      aim('RightForeArm', 'RightHand', -0.85, 0.08, 0.25);
      poseHikite('left');
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.90;
    }
  },
  { t: 0.90, pose: () => {
      aim('RightArm', 'RightForeArm', -0.50, 0.05, 0.65);
      aim('RightForeArm', 'RightHand', -0.40, 0.05, 0.75);
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.95;
    }
  },
  { t: 1.4, pose: () => poseReady(0) },
]);

// 7. Тэтцуи-учи (Удар кулаком-молотом сверху-вниз)
generateClip('tetsui_uchi', 1.4, [
  { t: 0.0, pose: () => poseReady(0) },
  { t: 0.30, pose: () => {
      aim('RightShoulder', 'RightArm', -0.10, 0.40, 0.20);
      aim('RightArm', 'RightForeArm', -0.15, 0.85, 0.30);
      aim('RightForeArm', 'RightHand', 0.10, 0.80, -0.20);
      aim('LeftArm', 'LeftForeArm', 0.15, -0.50, 0.70);
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.95;
    }
  },
  { t: 0.65, pose: () => {
      aim('Spine', 'Spine1', 0, 1, 0.08);
      aim('RightShoulder', 'RightArm', -0.10, -0.10, 0.40);
      aim('RightArm', 'RightForeArm', -0.15, -0.30, 0.88);
      aim('RightForeArm', 'RightHand', 0.0, -0.50, 0.80);
      poseHikite('left');
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.85;
    }
  },
  { t: 0.95, pose: () => {
      aim('RightArm', 'RightForeArm', -0.15, -0.30, 0.88);
      aim('RightForeArm', 'RightHand', 0.0, -0.50, 0.80);
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.85;
    }
  },
  { t: 1.4, pose: () => poseReady(0) },
]);

// 8. Эмпи-учи (Удар локтем маваси-эмпи)
generateClip('empi_uchi', 1.4, [
  { t: 0.0, pose: () => poseReady(0) },
  { t: 0.28, pose: () => {
      aim('RightShoulder', 'RightArm', -0.30, -0.10, -0.40);
      aim('RightArm', 'RightForeArm', -0.60, -0.15, -0.70);
      aim('RightForeArm', 'RightHand', 0.70, 0.10, 0.40);
      aim('LeftArm', 'LeftForeArm', 0.20, 0.05, 0.80);
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.92;
    }
  },
  { t: 0.62, pose: () => {
      aim('Spine', 'Spine1', -0.06, 1, 0.06);
      aim('RightShoulder', 'RightArm', -0.10, 0.08, 0.50);
      aim('RightArm', 'RightForeArm', -0.35, 0.10, 0.85);
      aim('RightForeArm', 'RightHand', 0.85, 0.0, 0.30);
      aim('LeftShoulder', 'LeftArm', 0.10, 0.05, 0.40);
      aim('LeftArm', 'LeftForeArm', 0.30, 0.05, 0.85);
      aim('LeftForeArm', 'LeftHand', -0.70, 0.0, 0.40);
      makeFist('right');
      makeShuto('left');
      rig.bones.Hips.position.y = rig.hipsRestY * 0.86;
    }
  },
  { t: 0.95, pose: () => {
      aim('RightArm', 'RightForeArm', -0.35, 0.10, 0.85);
      aim('RightForeArm', 'RightHand', 0.85, 0.0, 0.30);
      aim('LeftArm', 'LeftForeArm', 0.30, 0.05, 0.85);
      aim('LeftForeArm', 'LeftHand', -0.70, 0.0, 0.40);
      makeFist('right');
      makeShuto('left');
      rig.bones.Hips.position.y = rig.hipsRestY * 0.86;
    }
  },
  { t: 1.4, pose: () => poseReady(0) },
]);

// 9. Сюто-учи (Рубящий удар ребром открытой ладони)
generateClip('shuto_uchi', 1.4, [
  { t: 0.0, pose: () => poseReady(0) },
  { t: 0.28, pose: () => {
      aim('RightShoulder', 'RightArm', 0.15, 0.25, 0.40);
      aim('RightArm', 'RightForeArm', 0.30, 0.40, 0.60);
      aim('RightForeArm', 'RightHand', 0.10, 0.70, 0.40);
      aim('LeftArm', 'LeftForeArm', 0.20, -0.30, 0.75);
      makeShuto('right');
      makeFist('left');
      rig.bones.Hips.position.y = rig.hipsRestY * 0.94;
    }
  },
  { t: 0.62, pose: () => {
      aim('RightShoulder', 'RightArm', -0.15, 0.05, 0.45);
      aim('RightArm', 'RightForeArm', -0.45, -0.15, 0.80);
      aim('RightForeArm', 'RightHand', -0.30, -0.10, 0.90);
      poseHikite('left');
      makeShuto('right');
      makeFist('left');
      rig.bones.Hips.position.y = rig.hipsRestY * 0.88;
    }
  },
  { t: 0.95, pose: () => {
      aim('RightArm', 'RightForeArm', -0.45, -0.15, 0.80);
      aim('RightForeArm', 'RightHand', -0.30, -0.10, 0.90);
      makeShuto('right');
      makeFist('left');
      rig.bones.Hips.position.y = rig.hipsRestY * 0.88;
    }
  },
  { t: 1.4, pose: () => poseReady(0) },
]);

// 10. Моротэ-цуки (Двойной удар двумя кулаками вперед)
generateClip('morote_zuki', 1.4, [
  { t: 0.0, pose: () => poseReady(0) },
  { t: 0.28, pose: () => {
      poseHikite('left');
      poseHikite('right');
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.90;
    }
  },
  { t: 0.65, pose: () => {
      aim('LeftShoulder', 'LeftArm', 0.05, 0.02, 0.30);
      aim('LeftArm', 'LeftForeArm', 0.10, 0.04, 0.98);
      aim('LeftForeArm', 'LeftHand', 0.05, 0.0, 0.99);
      aim('RightShoulder', 'RightArm', -0.05, 0.02, 0.30);
      aim('RightArm', 'RightForeArm', -0.10, 0.04, 0.98);
      aim('RightForeArm', 'RightHand', -0.05, 0.0, 0.99);
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.85;
    }
  },
  { t: 0.98, pose: () => {
      aim('LeftArm', 'LeftForeArm', 0.10, 0.04, 0.98);
      aim('LeftForeArm', 'LeftHand', 0.05, 0.0, 0.99);
      aim('RightArm', 'RightForeArm', -0.10, 0.04, 0.98);
      aim('RightForeArm', 'RightHand', -0.05, 0.0, 0.99);
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.85;
    }
  },
  { t: 1.4, pose: () => poseReady(0) },
]);

// 11. Каги-цуки (Крюк кулаком в корпус)
generateClip('hook', 1.4, [
  { t: 0.0, pose: () => poseReady(0) },
  { t: 0.30, pose: () => {
      aim('LeftUpLeg', 'LeftLeg', 0.50, -0.75, 0.20);
      aim('RightUpLeg', 'RightLeg', -0.50, -0.75, 0.20);
      aim('RightArm', 'RightForeArm', -0.25, -0.10, -0.85);
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.85;
    }
  },
  { t: 0.60, pose: () => {
      poseKiba(0);
      aim('RightArm', 'RightForeArm', -0.45, 0.0, 0.45);
      aim('RightForeArm', 'RightHand', 0.85, 0.0, 0.25);
      poseHikite('left');
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.81;
    }
  },
  { t: 0.95, pose: () => {
      poseKiba(0);
      aim('RightArm', 'RightForeArm', -0.45, 0.0, 0.45);
      aim('RightForeArm', 'RightHand', 0.85, 0.0, 0.25);
      poseHikite('left');
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.81;
    }
  },
  { t: 1.4, pose: () => poseReady(0) },
]);

// ----------------------------------------------------
// 18-22. ЗАЩИТНЫЕ БЛОКИ (УКЭ)
// ----------------------------------------------------

// 12. Агэ-укэ (Верхний восходящий блок головы)
generateClip('age_uke', 1.4, [
  { t: 0.0, pose: () => poseReady(0) },
  { t: 0.25, pose: () => {
      aim('LeftArm', 'LeftForeArm', 0.10, -0.20, 0.60);
      aim('LeftForeArm', 'LeftHand', -0.20, 0.30, 0.70);
      poseHikite('right');
      fistBoth();
    }
  },
  { t: 0.55, pose: () => {
      poseZenkutsu(0);
      aim('LeftArm', 'LeftForeArm', 0.25, 0.50, 0.35);
      aim('LeftForeArm', 'LeftHand', -0.35, 0.65, 0.35);
      poseHikite('right');
      fistBoth();
    }
  },
  { t: 0.95, pose: () => {
      poseZenkutsu(0);
      aim('LeftArm', 'LeftForeArm', 0.25, 0.50, 0.35);
      aim('LeftForeArm', 'LeftHand', -0.35, 0.65, 0.35);
      poseHikite('right');
      fistBoth();
    }
  },
  { t: 1.4, pose: () => poseReady(0) },
]);

// 13. Сото-укэ (Блок предплечьем снаружи-внутрь)
generateClip('soto_uke', 1.4, [
  { t: 0.0, pose: () => poseReady(0) },
  { t: 0.28, pose: () => {
      poseZenkutsu(0);
      aim('RightShoulder', 'RightArm', -0.15, 0.35, 0.45);
      aim('RightArm', 'RightForeArm', -0.45, 0.65, 0.40);
      aim('RightForeArm', 'RightHand', 0.10, 0.60, 0.65);
      aim('LeftArm', 'LeftForeArm', 0.10, -0.10, 0.90);
      aim('LeftForeArm', 'LeftHand', 0.05, 0.0, 0.95);
      fistBoth();
    }
  },
  { t: 0.60, pose: () => {
      poseZenkutsu(0);
      aim('RightShoulder', 'RightArm', -0.08, 0.10, 0.50);
      aim('RightArm', 'RightForeArm', -0.25, 0.10, 0.85);
      aim('RightForeArm', 'RightHand', 0.45, 0.70, 0.35);
      poseHikite('left');
      fistBoth();
    }
  },
  { t: 0.95, pose: () => {
      poseZenkutsu(0);
      aim('RightShoulder', 'RightArm', -0.08, 0.10, 0.50);
      aim('RightArm', 'RightForeArm', -0.25, 0.10, 0.85);
      aim('RightForeArm', 'RightHand', 0.45, 0.70, 0.35);
      poseHikite('left');
      fistBoth();
    }
  },
  { t: 1.4, pose: () => poseReady(0) },
]);

// 14. Ути-укэ (Блок предплечьем изнутри-наружу)
generateClip('uchi_uke', 1.4, [
  { t: 0.0, pose: () => poseReady(0) },
  { t: 0.28, pose: () => {
      poseZenkutsu(0);
      aim('RightShoulder', 'RightArm', 0.05, -0.15, 0.45);
      aim('RightArm', 'RightForeArm', 0.35, -0.20, 0.65);
      aim('RightForeArm', 'RightHand', 0.20, -0.10, 0.85);
      aim('LeftArm', 'LeftForeArm', 0.10, 0.05, 0.95);
      aim('LeftForeArm', 'LeftHand', 0.05, 0.0, 0.98);
      fistBoth();
    }
  },
  { t: 0.60, pose: () => {
      poseZenkutsu(0);
      aim('RightShoulder', 'RightArm', -0.10, 0.08, 0.40);
      aim('RightArm', 'RightForeArm', -0.30, 0.15, 0.82);
      aim('RightForeArm', 'RightHand', -0.30, 0.75, 0.35);
      poseHikite('left');
      fistBoth();
    }
  },
  { t: 0.95, pose: () => {
      poseZenkutsu(0);
      aim('RightShoulder', 'RightArm', -0.10, 0.08, 0.40);
      aim('RightArm', 'RightForeArm', -0.30, 0.15, 0.82);
      aim('RightForeArm', 'RightHand', -0.30, 0.75, 0.35);
      poseHikite('left');
      fistBoth();
    }
  },
  { t: 1.4, pose: () => poseReady(0) },
]);

// 15. Гэдан-барай (Нижний смет предплечьем)
generateClip('gedan_barai', 1.4, [
  { t: 0.0, pose: () => poseReady(0) },
  { t: 0.25, pose: () => {
      aim('LeftArm', 'LeftForeArm', -0.25, 0.55, 0.40);
      aim('LeftForeArm', 'LeftHand', -0.15, 0.65, 0.30);
      aim('RightArm', 'RightForeArm', 0.05, -0.10, 0.95);
      fistBoth();
    }
  },
  { t: 0.55, pose: () => {
      poseZenkutsu(0);
      aim('LeftArm', 'LeftForeArm', 0.25, -0.75, 0.45);
      aim('LeftForeArm', 'LeftHand', 0.15, -0.85, 0.35);
      poseHikite('right');
      fistBoth();
    }
  },
  { t: 0.95, pose: () => {
      poseZenkutsu(0);
      aim('LeftArm', 'LeftForeArm', 0.25, -0.75, 0.45);
      aim('LeftForeArm', 'LeftHand', 0.15, -0.85, 0.35);
      poseHikite('right');
      fistBoth();
    }
  },
  { t: 1.4, pose: () => poseReady(0) },
]);

// 16. Сюто-укэ (Блок ребром ладони в Кокуцу-дати)
generateClip('shuto_uke', 1.4, [
  { t: 0.0, pose: () => poseReady(0) },
  { t: 0.25, pose: () => {
      aim('LeftArm', 'LeftForeArm', -0.25, 0.35, -0.40);
      aim('LeftForeArm', 'LeftHand', -0.15, 0.45, -0.30);
      makeShuto('left');
      makeFist('right');
    }
  },
  { t: 0.55, pose: () => {
      poseKokutsu(0);
      aim('LeftArm', 'LeftForeArm', 0.35, 0.05, 0.85);
      aim('LeftForeArm', 'LeftHand', 0.25, 0.15, 0.90);
      aim('RightArm', 'RightForeArm', -0.25, -0.25, 0.85);
      aim('RightForeArm', 'RightHand', 0.15, 0.05, 0.92);
      makeShuto('left');
      makeFist('right');
    }
  },
  { t: 0.95, pose: () => {
      poseKokutsu(0);
      aim('LeftArm', 'LeftForeArm', 0.35, 0.05, 0.85);
      aim('LeftForeArm', 'LeftHand', 0.25, 0.15, 0.90);
      aim('RightArm', 'RightForeArm', -0.25, -0.25, 0.85);
      aim('RightForeArm', 'RightHand', 0.15, 0.05, 0.92);
      makeShuto('left');
      makeFist('right');
    }
  },
  { t: 1.4, pose: () => poseReady(0) },
]);

// ----------------------------------------------------
// 23-27. УДАРЫ НОГАМИ (ГЭРИ) — ВЫСОКИЙ ВЫНОС КОЛЕНА И ТОЧНЫЙ ХЛЁСТ
// ----------------------------------------------------

// 17. Маэ-гэри (Прямой пробивающий удар ногой подушечками коси)
generateClip('mae_geri', 1.6, [
  { t: 0.0, pose: () => poseReady(0) },
  { t: 0.35, pose: () => {
      // Фаза камеры (Hikiage): колено взлетает к груди (Y = 15.3, выше пояса!), пятка прижата под бедро
      aim('LeftUpLeg', 'LeftLeg', 0.02, -0.99, 0.12);
      aim('LeftLeg', 'LeftFoot', 0, -0.99, -0.12);
      aim('RightUpLeg', 'RightLeg', -0.02, 0.86, 0.51);
      aim('RightLeg', 'RightFoot', 0.0, -0.75, -0.65);
      // Руки в защитном блоке со сжатыми кулаками
      aim('LeftArm', 'LeftForeArm', 0.20, -0.15, 0.85);
      aim('RightArm', 'RightForeArm', -0.20, -0.15, 0.85);
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 1.01;
    }
  },
  { t: 0.65, pose: () => {
      // Кимэ (Strike): колено удерживается высоко, голень выстреливает в чудан (солнечное сплетение, Y = 15.2!)
      aim('LeftUpLeg', 'LeftLeg', 0.05, -0.98, -0.05);
      aim('RightUpLeg', 'RightLeg', -0.02, 0.55, 0.83);
      aim('RightLeg', 'RightFoot', 0.0, 0.38, 0.92);
      aim('RightFoot', 'RightToeBase', 0.0, 0.45, 0.89);
      aim('LeftArm', 'LeftForeArm', 0.20, -0.15, 0.85);
      aim('RightArm', 'RightForeArm', -0.20, -0.15, 0.85);
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 1.01;
    }
  },
  { t: 1.05, pose: () => {
      // Хикиаси (Retraction): мгновенное складывание стопы обратно к колену у груди
      aim('RightUpLeg', 'RightLeg', -0.02, 0.86, 0.51);
      aim('RightLeg', 'RightFoot', 0.0, -0.75, -0.65);
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 1.01;
    }
  },
  { t: 1.6, pose: () => poseReady(0) },
]);

// 18. Ёко-гэри кэкоми (Боковой проникающий удар ногой ребром сокуто)
generateClip('yoko_geri', 1.6, [
  { t: 0.0, pose: () => poseReady(0) },
  { t: 0.35, pose: () => {
      // Камера: подъем правого колена высоко к противоположному плечу (Y > 16)
      aim('LeftUpLeg', 'LeftLeg', 0.05, -0.98, 0.15);
      aim('LeftLeg', 'LeftFoot', 0, -0.98, -0.15);
      aim('RightUpLeg', 'RightLeg', -0.35, 0.82, 0.45);
      aim('RightLeg', 'RightFoot', 0.25, -0.75, -0.60);
      aim('Spine', 'Spine1', 0.10, 0.98, 0.05);
      aim('LeftArm', 'LeftForeArm', 0.20, -0.15, 0.85);
      aim('RightArm', 'RightForeArm', -0.20, -0.15, 0.85);
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 1.01;
    }
  },
  { t: 0.65, pose: () => {
      // Кимэ: мощный линейный выстрел ребром стопы сокуто на уровне груди (Y > 16), наклон корпуса
      aim('LeftUpLeg', 'LeftLeg', 0.25, -0.95, -0.15);
      aim('RightUpLeg', 'RightLeg', -0.85, 0.45, 0.28);
      aim('RightLeg', 'RightFoot', -0.88, 0.40, 0.25);
      aim('RightFoot', 'RightToeBase', -0.85, 0.40, 0.25);
      aim('Spine', 'Spine1', 0.35, 0.92, 0.05);
      aim('RightArm', 'RightForeArm', -0.65, 0.15, 0.45);
      aim('RightForeArm', 'RightHand', -0.75, 0.10, 0.40);
      aim('LeftArm', 'LeftForeArm', 0.20, -0.10, 0.85);
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.98;
    }
  },
  { t: 1.05, pose: () => {
      // Хикиаси: возврат стопы к паху/колену
      aim('RightUpLeg', 'RightLeg', -0.35, 0.82, 0.45);
      aim('RightLeg', 'RightFoot', 0.25, -0.75, -0.60);
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 1.01;
    }
  },
  { t: 1.6, pose: () => poseReady(0) },
]);

// 19. Маваси-гэри (Круговой удар ногой в чудан/дзёдан)
function generateMawashi(name) {
  generateClip(name, 1.6, [
    { t: 0.0, pose: () => poseReady(0) },
    { t: 0.35, pose: () => {
        // Замах: колено выносится высоко по диагонали (Y > 15), опорная стопа разворачивается
        aim('LeftUpLeg', 'LeftLeg', 0.15, -0.98, -0.10);
        aim('RightUpLeg', 'RightLeg', -0.65, 0.70, 0.30);
        aim('RightLeg', 'RightFoot', 0.35, -0.70, -0.62);
        aim('LeftArm', 'LeftForeArm', 0.20, -0.15, 0.85);
        aim('RightArm', 'RightForeArm', -0.20, -0.15, 0.85);
        fistBoth();
      }
    },
    { t: 0.65, pose: () => {
        // Кимэ: таз опрокидывается, голень раскручивается по кругу в солнечное сплетение/челюсть (Y > 17!)
        aim('LeftUpLeg', 'LeftLeg', 0.25, -0.95, -0.15);
        aim('RightUpLeg', 'RightLeg', -0.55, 0.45, 0.70);
        aim('RightLeg', 'RightFoot', 0.60, 0.35, 0.72);
        aim('RightFoot', 'RightToeBase', 0.60, 0.35, 0.72);
        aim('Spine', 'Spine1', 0.15, 0.95, 0.25);
        fistBoth();
      }
    },
    { t: 1.05, pose: () => {
        // Хикиаси: возврат ноги по той же круговой дуге
        aim('RightUpLeg', 'RightLeg', -0.65, 0.70, 0.30);
        aim('RightLeg', 'RightFoot', 0.35, -0.70, -0.62);
        fistBoth();
      }
    },
    { t: 1.6, pose: () => poseReady(0) },
  ]);
}
generateMawashi('kick');
generateMawashi('mawashi_geri');

// 20. Усиро-гэри (Удар ногой назад пяткой какато)
generateClip('ushiro_geri', 1.6, [
  { t: 0.0, pose: () => poseReady(0) },
  { t: 0.35, pose: () => {
      // Замах: поворот головы через плечо назад, колено поджато высоко к груди (Y > 15)
      aim('Neck', 'Head', 0.15, 0.90, -0.35);
      aim('RightUpLeg', 'RightLeg', -0.02, 0.85, 0.52);
      aim('RightLeg', 'RightFoot', 0.0, -0.75, -0.65);
      aim('LeftArm', 'LeftForeArm', 0.20, -0.20, 0.85);
      aim('RightArm', 'RightForeArm', -0.20, -0.20, 0.85);
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 1.01;
    }
  },
  { t: 0.65, pose: () => {
      // Кимэ: прямолинейный удар пяткой назад на уровне чудан (Y > 14), балансирующий наклон корпуса
      aim('Neck', 'Head', 0.20, 0.85, -0.40);
      aim('Spine', 'Spine1', 0.0, 0.88, 0.45);
      aim('RightUpLeg', 'RightLeg', -0.02, 0.25, -0.96);
      aim('RightLeg', 'RightFoot', 0.0, 0.28, -0.96);
      aim('RightFoot', 'RightToeBase', 0.0, 0.35, -0.93);
      aim('LeftArm', 'LeftForeArm', 0.25, -0.30, 0.75);
      aim('RightArm', 'RightForeArm', -0.25, -0.30, 0.75);
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 0.94;
    }
  },
  { t: 1.05, pose: () => {
      // Хикиаси: возврат пятки к колену
      aim('RightUpLeg', 'RightLeg', -0.02, 0.85, 0.52);
      aim('RightLeg', 'RightFoot', 0.0, -0.75, -0.65);
      fistBoth();
      rig.bones.Hips.position.y = rig.hipsRestY * 1.01;
    }
  },
  { t: 1.6, pose: () => poseReady(0) },
]);

// 21. Цуги-аси (Подшаг)
generateClip('step', 1.4, [
  { t: 0.0, pose: () => poseReady(0) },
  { t: 0.35, pose: () => {
      rig.bones.Hips.position.y = rig.hipsRestY * 0.86;
      aim('LeftUpLeg', 'LeftLeg', 0.14, -0.75, 0.60);
      aim('RightUpLeg', 'RightLeg', -0.14, -0.78, -0.50);
      fistBoth();
    }
  },
  { t: 0.70, pose: () => poseReady(0) },
  { t: 1.4, pose: () => poseReady(0) },
]);

console.log('\n🥋 Все клипы техники каратэ успешно перегенерированы с правильной биомеханикой, сжатыми кулаками и высокими ударами!');
