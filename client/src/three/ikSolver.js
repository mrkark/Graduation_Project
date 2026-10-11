import * as THREE from 'three';

/**
 * Аналитический двухзвенный ИК-решатель (2-Bone Analytical IK via Law of Cosines).
 * Применяется для конечностей каратиста (Плечо -> Локоть -> Кисть или Бедро -> Колено -> Стопа)
 * в окне контакта боевого взаимодействия (удары, блоки, захваты).
 *
 * Преимущества:
 * - Вычисляется за доли микросекунды без итеративных приближений (CCD/FABRIK).
 * - Гарантирует сохранение канонических длин звеньев рига без деформации меша.
 * - Плавная интерполяция через вес ikWeight в окне контакта [t_contact ± 0.15s].
 */

const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vC = new THREE.Vector3();
const _vTarget = new THREE.Vector3();
const _vPole = new THREE.Vector3();
const _dirTarget = new THREE.Vector3();
const _planeNormal = new THREE.Vector3();
const _dirUpper = new THREE.Vector3();
const _dirFore = new THREE.Vector3();
const _qUpperOrig = new THREE.Quaternion();
const _qForeOrig = new THREE.Quaternion();
const _qParentInv = new THREE.Quaternion();
const _qTargetUpper = new THREE.Quaternion();
const _qTargetFore = new THREE.Quaternion();
const _mWorldToParent = new THREE.Matrix4();

/**
 * Решает 2-Bone IK для звеньев rootBone -> midBone -> endBone.
 *
 * @param {THREE.Bone} rootBone - Начальная кость (mixamorigRightArm / mixamorigLeftArm)
 * @param {THREE.Bone} midBone  - Промежуточный сустав (mixamorigRightForeArm / mixamorigLeftForeArm)
 * @param {THREE.Bone} endBone  - Конечный эффектор (mixamorigRightHand / mixamorigLeftHand)
 * @param {THREE.Vector3} targetWorldPos - Желаемая мировая позиция контакта
 * @param {THREE.Vector3} poleWorldPos   - Направление сгиба локтя / колена (вектор ориентации)
 * @param {number} weight                - Вес влияния IK (0.0 = чистая анимация, 1.0 = точное попадание в таргет)
 */
export function solveTwoBoneIK(rootBone, midBone, endBone, targetWorldPos, poleWorldPos, weight = 1.0) {
  if (!rootBone || !midBone || !endBone || weight <= 0.001) return;

  // Обновляем мировую матрицу костей для точности
  rootBone.updateWorldMatrix(true, false);
  midBone.updateWorldMatrix(true, false);
  endBone.updateWorldMatrix(true, false);

  rootBone.getWorldPosition(_vA);
  midBone.getWorldPosition(_vB);
  endBone.getWorldPosition(_vC);
  _vTarget.copy(targetWorldPos);
  _vPole.copy(poleWorldPos);

  const l1 = _vA.distanceTo(_vB);
  const l2 = _vB.distanceTo(_vC);
  const maxReach = (l1 + l2) * 0.999;
  const minReach = Math.max(0.01, Math.abs(l1 - l2) * 1.01);

  _dirTarget.subVectors(_vTarget, _vA);
  let dist = _dirTarget.length();
  if (dist < 0.0001) return;

  // Ограничиваем дистанцию пределами досягаемости конечности
  dist = THREE.MathUtils.clamp(dist, minReach, maxReach);
  _dirTarget.normalize();

  // Теорема косинусов для внутренних углов треугольника конечности
  // Угол в корневом суставе (Плечо: A)
  const cosAlpha = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
  const alpha = Math.acos(THREE.MathUtils.clamp(cosAlpha, -1, 1));

  // Угол во внутреннем суставе (Локоть: B)
  const cosBeta = (l1 * l1 + l2 * l2 - dist * dist) / (2 * l1 * l2);
  const beta = Math.acos(THREE.MathUtils.clamp(cosBeta, -1, 1));

  // Плоскость треугольника задаётся вектором на таргет и вектором pole (направление локтя)
  const dirPole = new THREE.Vector3().subVectors(_vPole, _vA).normalize();
  _planeNormal.crossVectors(_dirTarget, dirPole);
  if (_planeNormal.lengthSq() < 0.0001) {
    // Вырожденный случай: pole параллелен таргету, используем ось Y
    _planeNormal.crossVectors(_dirTarget, new THREE.Vector3(0, 1, 0));
  }
  _planeNormal.normalize();

  // Направление от плеча к локтю: поворачиваем _dirTarget на угол alpha вокруг нормали плоскости
  _dirUpper.copy(_dirTarget).applyAxisAngle(_planeNormal, alpha).normalize();

  // Новая позиция локтя B_new = A + _dirUpper * l1
  const vB_new = new THREE.Vector3().copy(_vA).addScaledVector(_dirUpper, l1);

  // Направление от локтя к кисти
  _dirFore.subVectors(_vTarget, vB_new).normalize();

  // Сохраняем оригинальные ориентации
  _qUpperOrig.copy(rootBone.quaternion);
  _qForeOrig.copy(midBone.quaternion);

  // Переводим расчетные мировые повороты в локальное пространство родительских объектов
  if (rootBone.parent) {
    rootBone.parent.updateWorldMatrix(true, false);
    _mWorldToParent.copy(rootBone.parent.matrixWorld).invert();
    _qParentInv.setFromRotationMatrix(_mWorldToParent);
  } else {
    _qParentInv.identity();
  }

  // Расчёт вращения UpperArm: поворот от исходного направления (_vB - _vA) к _dirUpper
  const currentUpperDir = new THREE.Vector3().subVectors(_vB, _vA).normalize();
  const qDeltaUpper = new THREE.Quaternion().setFromUnitVectors(currentUpperDir, _dirUpper);
  
  // Применяем к мировой ориентации корневой кости
  const qWorldUpper = new THREE.Quaternion();
  rootBone.getWorldQuaternion(qWorldUpper);
  qWorldUpper.premultiply(qDeltaUpper);
  _qTargetUpper.copy(_qParentInv).multiply(qWorldUpper);

  // Сглаженное взвешенное смешивание (Slerp)
  rootBone.quaternion.slerp(_qTargetUpper, weight);
  rootBone.updateWorldMatrix(true, false);

  // Расчёт вращения ForeArm
  midBone.updateWorldMatrix(true, false);
  const qMidParentInv = new THREE.Quaternion();
  midBone.parent.getWorldQuaternion(qMidParentInv).invert();

  const currentForeDir = new THREE.Vector3().subVectors(_vC, _vB).normalize();
  const qDeltaFore = new THREE.Quaternion().setFromUnitVectors(currentForeDir, _dirFore);
  
  const qWorldFore = new THREE.Quaternion();
  midBone.getWorldQuaternion(qWorldFore);
  qWorldFore.premultiply(qDeltaFore);
  _qTargetFore.copy(qMidParentInv).multiply(qWorldFore);

  midBone.quaternion.slerp(_qTargetFore, weight);
  midBone.updateWorldMatrix(true, true);
}

/**
 * Вычисляет окно контакта и плавный колоколообразный вес IK (smoothstep envelope)
 * @param {number} currentTime  - Текущее время клипа в секундах
 * @param {number} contactTime  - Момент наивысшего контакта (например 0.45s)
 * @param {number} halfWindow   - Полуширина окна контакта (по умолчанию 0.15s)
 * @returns {number} Вес IK от 0.0 до 1.0
 */
export function getContactIKWeight(currentTime, contactTime = 0.45, halfWindow = 0.15) {
  const dt = Math.abs(currentTime - contactTime);
  if (dt >= halfWindow) return 0.0;
  
  // Косинусное сглаживание от 0 до 1 и обратно в 0
  const norm = dt / halfWindow; // 0 в момент контакта, 1 на краях окна
  return 0.5 * (1 + Math.cos(norm * Math.PI));
}
