import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * Канонические единичные векторы покоя (Rest World Directions) для скелета Karateka_Armature.
 * В формате glTF кости ориентированы вдоль этих осей:
 */
const REST_WORLD_DIRS = {
  Spine: new THREE.Vector3(0, 1, 0),
  Spine1: new THREE.Vector3(0, 1, 0),
  Chest: new THREE.Vector3(0, 1, 0),
  Neck: new THREE.Vector3(0, 1, 0),
  Head: new THREE.Vector3(0, 1, 0),
  'UpperArm.L': new THREE.Vector3(1, 0, 0),    // Рука мастера влево (+X / экранное право)
  'LowerArm.L': new THREE.Vector3(1, 0, 0),
  'Hand.L': new THREE.Vector3(1, 0, 0),
  'UpperArm.R': new THREE.Vector3(-1, 0, 0),   // Рука мастера вправо (-X / экранное лево)
  'LowerArm.R': new THREE.Vector3(-1, 0, 0),
  'Hand.R': new THREE.Vector3(-1, 0, 0),
  'UpperLeg.L': new THREE.Vector3(0, -1, 0),   // Бедро вниз (-Y)
  'LowerLeg.L': new THREE.Vector3(0, -1, 0),
  'Foot.L': new THREE.Vector3(0, -0.6, 0.8).normalize(),
  'UpperLeg.R': new THREE.Vector3(0, -1, 0),
  'LowerLeg.R': new THREE.Vector3(0, -1, 0),
  'Foot.R': new THREE.Vector3(0, -0.6, 0.8).normalize(),
};

/**
 * Иерархическое выравнивание кости по 3D вектору движения:
 * Q_local = Q_parent_world^-1 * (Q_rot_delta * Q_bone_rest_world)
 */
function alignBone(bone, vRest, targetDir, alpha = 0.80) {
  if (!bone || !bone.restWorldQ || !targetDir || targetDir.lengthSq() < 1e-5) return;
  const vFrom = vRest;
  let vTo = targetDir.clone().normalize();
  const dot = vFrom.dot(vTo);

  // Защита от сингулярности при перекрещивании конечностей
  if (dot < -0.92) {
    vTo.z = Math.max(vTo.z, 0.35);
    vTo.normalize();
  }

  const rotWorld = new THREE.Quaternion().setFromUnitVectors(vFrom, vTo);
  const targetWorldQ = rotWorld.clone().multiply(bone.restWorldQ);
  const parentWorldQ = new THREE.Quaternion();
  if (bone.parent) bone.parent.getWorldQuaternion(parentWorldQ);

  const targetLocalQ = parentWorldQ.clone().invert().multiply(targetWorldQ);
  bone.quaternion.slerp(targetLocalQ, alpha);
  bone.updateMatrixWorld(true);
}

/**
 * Естественное движение ключицы/плечевого сустава при выпадах и ударах руками
 */
function alignShoulder(bone, vArm, sideKey = 'R', alpha = 0.70) {
  if (!bone || !vArm || vArm.lengthSq() < 1e-4) return;
  const uArm = vArm.clone().normalize();
  const fwdReach = Math.max(0, uArm.z);
  const elevate = Math.max(0, uArm.y);
  const depress = Math.min(0, uArm.y);
  let vClavicle = null;

  if (sideKey === 'R') {
    const crossReach = Math.max(0, uArm.x);
    const yOffset = elevate > 0 ? elevate * 0.25 : depress * 0.35;
    vClavicle = new THREE.Vector3(-1.0 + crossReach * 0.35, yOffset, fwdReach * 0.35 + crossReach * 0.25).normalize();
    alignBone(bone, REST_WORLD_DIRS['UpperArm.R'], vClavicle, alpha);
  } else {
    const crossReach = Math.max(0, -uArm.x);
    const yOffset = elevate > 0 ? elevate * 0.25 : depress * 0.35;
    vClavicle = new THREE.Vector3(1.0 - crossReach * 0.35, yOffset, fwdReach * 0.35 + crossReach * 0.25).normalize();
    alignBone(bone, REST_WORLD_DIRS['UpperArm.L'], vClavicle, alpha);
  }
}

/**
 * MocapPuppetAvatar — 3D-аватар мастера каратэ Шотокан, управляемый движениями человека.
 * 
 * Особенности:
 * 1. Идеальное заземление на татами (подошвы строго на Y=0 при любом росте).
 * 2. Анатомический иерархический ретаргетинг на базе единичных кватернионов.
 * 3. Таз (Hips) никогда не проваливается под пол: приседы вычисляются относительно restPosition.
 * 4. Поддержка прямого зеркального отражения (mirrorMode = true).
 */
export default function MocapPuppetAvatar({
  boneRotations = null,
  poseLandmarks = null,
  worldLandmarks = null,
  poseDataRef = null,
  mirrorMode = true,
  detectedStance = 'ready',
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1.0,
  xrayMode = false,
}) {
  const groupRef = useRef();
  const { scene } = useGLTF('/models/karateka_techniques_v4.glb');

  // Клонируем SkinnedMesh с калибровкой высоты и смещением подошв на Y=0
  const { clonedModel, boneMap, modelScale, modelYOffset } = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    const map = new Map();

    // Вычисляем габаритный бокс до изменения трансформации
    const bbox = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    // Нормализация роста бойца до 1.78 м
    const s = size.y > 0 ? 1.78 / size.y : 1.0;

    // Смещение по высоте, чтобы ступни стояли ровно на татами (Y = 0)
    const yOff = -bbox.min.y * s;

    clone.traverse((child) => {
      if (child.isBone) {
        map.set(child.name, child);
      }
      if (child.isMesh) {
        child.frustumCulled = false;
        child.castShadow = !xrayMode;
        child.receiveShadow = true;

        if (child.material) {
          const mat = child.material.clone();
          mat.side = THREE.DoubleSide;
          const name = child.name || '';
          if (name.includes('Belt')) {
            mat.color = new THREE.Color('#141414'); // Черный пояс Kuro-Obi
            if (xrayMode) {
              mat.transparent = true;
              mat.opacity = 0.7;
            }
          } else if (name.includes('Gi') || name.includes('Jacket') || name.includes('Pants')) {
            mat.color = new THREE.Color('#faf9f6'); // Белое кимоно мастера
            if (xrayMode) {
              mat.transparent = true;
              mat.opacity = 0.45;
              mat.roughness = 0.5;
            }
          }
          child.material = mat;
        }
      }
    });

    return { clonedModel: clone, boneMap: map, modelScale: s, modelYOffset: yOff };
  }, [scene, xrayMode]);

  // Запоминаем исходные (Rest Pose) параметры для всех суставов
  useEffect(() => {
    clonedModel.updateMatrixWorld(true);
    boneMap.forEach((bone) => {
      bone.restLocalQ = bone.quaternion.clone();
      const wq = new THREE.Quaternion();
      bone.getWorldQuaternion(wq);
      bone.restWorldQ = wq;
      bone.restPosition = bone.position.clone();
    });
  }, [boneMap, clonedModel]);

  // Высота ног для расчета глубины стойки / приседа
  const nominalLegLenRef = useRef(0.78);

  // Плавное обновление суставов на каждом кадре Three.js (60 FPS)
  useFrame((_, delta) => {
    const lerpFactor = Math.min(1.0, delta * 16);

    // Получаем актуальные данные позы (из ref для ультра-плавности или из props)
    const activePose = poseDataRef?.current || (
      (worldLandmarks || poseLandmarks) ? { worldLandmarks, landmarks: poseLandmarks } : null
    );

    const ptsRaw = activePose?.worldLandmarks || activePose?.landmarks;

    if (ptsRaw && ptsRaw.length >= 33) {
      // Конвертация точки MediaPipe в вектор Three.js (X вправо, Y вверх, Z вперед к камере)
      const toVec = (idx) => {
        const p = ptsRaw[idx];
        if (!p) return null;
        if (activePose.worldLandmarks) {
          // worldLandmarks в реальных метрах
          return new THREE.Vector3(p.x, -p.y, -p.z);
        }
        // Обычные landmarks [0..1]
        return new THREE.Vector3((p.x - 0.5) * 1.5, -(p.y - 0.5) * 1.8, -((p.z || 0) * 1.5));
      };

      const pNose = toVec(0);
      const pLSh = toVec(11);
      const pRSh = toVec(12);
      const pLEl = toVec(13);
      const pREl = toVec(14);
      const pLWr = toVec(15);
      const pRWr = toVec(16);
      const pLHp = toVec(23);
      const pRHp = toVec(24);
      const pLKn = toVec(25);
      const pRKn = toVec(26);
      const pLAn = toVec(27);
      const pRAn = toVec(28);
      const pLHeel = toVec(29) || pLAn;
      const pRHeel = toVec(30) || pRAn;
      const pLToe = toVec(31) || pLAn;
      const pRToe = toVec(32) || pRAn;

      // Определение соответствия костей: Зеркальное (как в зеркале Додзё) vs Анатомическое
      const armR_Upper = mirrorMode ? boneMap.get('UpperArm.L') : boneMap.get('UpperArm.R');
      const armR_Lower = mirrorMode ? boneMap.get('LowerArm.L') : boneMap.get('LowerArm.R');
      const armR_Shoulder = mirrorMode ? boneMap.get('Shoulder.L') : boneMap.get('Shoulder.R');
      const restArmR_Upper = mirrorMode ? REST_WORLD_DIRS['UpperArm.L'] : REST_WORLD_DIRS['UpperArm.R'];
      const restArmR_Lower = mirrorMode ? REST_WORLD_DIRS['LowerArm.L'] : REST_WORLD_DIRS['LowerArm.R'];

      const armL_Upper = mirrorMode ? boneMap.get('UpperArm.R') : boneMap.get('UpperArm.L');
      const armL_Lower = mirrorMode ? boneMap.get('LowerArm.R') : boneMap.get('LowerArm.L');
      const armL_Shoulder = mirrorMode ? boneMap.get('Shoulder.R') : boneMap.get('Shoulder.L');
      const restArmL_Upper = mirrorMode ? REST_WORLD_DIRS['UpperArm.R'] : REST_WORLD_DIRS['UpperArm.L'];
      const restArmL_Lower = mirrorMode ? REST_WORLD_DIRS['LowerArm.R'] : REST_WORLD_DIRS['LowerArm.L'];

      const legR_Upper = mirrorMode ? boneMap.get('UpperLeg.L') : boneMap.get('UpperLeg.R');
      const legR_Lower = mirrorMode ? boneMap.get('LowerLeg.L') : boneMap.get('LowerLeg.R');
      const legR_Foot = mirrorMode ? boneMap.get('Foot.L') : boneMap.get('Foot.R');
      const restLegR_Upper = mirrorMode ? REST_WORLD_DIRS['UpperLeg.L'] : REST_WORLD_DIRS['UpperLeg.R'];
      const restLegR_Lower = mirrorMode ? REST_WORLD_DIRS['LowerLeg.L'] : REST_WORLD_DIRS['LowerLeg.R'];
      const restLegR_Foot = mirrorMode ? REST_WORLD_DIRS['Foot.L'] : REST_WORLD_DIRS['Foot.R'];

      const legL_Upper = mirrorMode ? boneMap.get('UpperLeg.R') : boneMap.get('UpperLeg.L');
      const legL_Lower = mirrorMode ? boneMap.get('LowerLeg.R') : boneMap.get('LowerLeg.L');
      const legL_Foot = mirrorMode ? boneMap.get('Foot.R') : boneMap.get('Foot.L');
      const restLegL_Upper = mirrorMode ? REST_WORLD_DIRS['UpperLeg.R'] : REST_WORLD_DIRS['UpperLeg.L'];
      const restLegL_Lower = mirrorMode ? REST_WORLD_DIRS['LowerLeg.R'] : REST_WORLD_DIRS['LowerLeg.L'];
      const restLegL_Foot = mirrorMode ? REST_WORLD_DIRS['Foot.R'] : REST_WORLD_DIRS['Foot.L'];

      // 1. ПРАВАЯ РУКА ЧЕЛОВЕКА
      if (pRSh && pREl) {
        const vArm = pREl.clone().sub(pRSh);
        if (mirrorMode) vArm.x = -vArm.x;
        if (armR_Shoulder) alignShoulder(armR_Shoulder, vArm, mirrorMode ? 'L' : 'R');
        alignBone(armR_Upper, restArmR_Upper, vArm, 0.78);

        if (pRWr) {
          const vForearm = pRWr.clone().sub(pREl);
          if (mirrorMode) vForearm.x = -vForearm.x;
          alignBone(armR_Lower, restArmR_Lower, vForearm, 0.78);
        }
      }

      // 2. ЛЕВАЯ РУКА ЧЕЛОВЕКА
      if (pLSh && pLEl) {
        const vArm = pLEl.clone().sub(pLSh);
        if (mirrorMode) vArm.x = -vArm.x;
        if (armL_Shoulder) alignShoulder(armL_Shoulder, vArm, mirrorMode ? 'R' : 'L');
        alignBone(armL_Upper, restArmL_Upper, vArm, 0.78);

        if (pLWr) {
          const vForearm = pLWr.clone().sub(pLEl);
          if (mirrorMode) vForearm.x = -vForearm.x;
          alignBone(armL_Lower, restArmL_Lower, vForearm, 0.78);
        }
      }

      // 3. ПРАВАЯ НОГА ЧЕЛОВЕКА
      if (pRHp && pRKn) {
        const vThigh = pRKn.clone().sub(pRHp);
        if (mirrorMode) vThigh.x = -vThigh.x;
        alignBone(legR_Upper, restLegR_Upper, vThigh, 0.85);

        if (pRAn) {
          const vShin = pRAn.clone().sub(pRKn);
          if (mirrorMode) vShin.x = -vShin.x;
          alignBone(legR_Lower, restLegR_Lower, vShin, 0.85);
        }

        if (pRToe && pRHeel && legR_Foot) {
          const vFoot = pRToe.clone().sub(pRHeel);
          if (mirrorMode) vFoot.x = -vFoot.x;
          alignBone(legR_Foot, restLegR_Foot, vFoot, 0.75);
        }
      }

      // 4. ЛЕВАЯ НОГА ЧЕЛОВЕКА
      if (pLHp && pLKn) {
        const vThigh = pLKn.clone().sub(pLHp);
        if (mirrorMode) vThigh.x = -vThigh.x;
        alignBone(legL_Upper, restLegL_Upper, vThigh, 0.85);

        if (pLAn) {
          const vShin = pLAn.clone().sub(pLKn);
          if (mirrorMode) vShin.x = -vShin.x;
          alignBone(legL_Lower, restLegL_Lower, vShin, 0.85);
        }

        if (pLToe && pLHeel && legL_Foot) {
          const vFoot = pLToe.clone().sub(pLHeel);
          if (mirrorMode) vFoot.x = -vFoot.x;
          alignBone(legL_Foot, restLegL_Foot, vFoot, 0.75);
        }
      }

      // 5. ПОЗВОНОЧНИК, ГРУДЬ И ТАЗ
      const bHips = boneMap.get('Hips');
      const bSpine = boneMap.get('Spine');
      const bSpine1 = boneMap.get('Spine1');
      const bChest = boneMap.get('Chest');

      if (pLHp && pRHp && pLSh && pRSh) {
        const midHip = pLHp.clone().add(pRHp).multiplyScalar(0.5);
        const midSh = pLSh.clone().add(pRSh).multiplyScalar(0.5);
        const vSpine = midSh.clone().sub(midHip);
        if (mirrorMode) vSpine.x = -vSpine.x;

        // Наклон и поворот таза (Pelvic Tilt & Yaw)
        if (bHips && bHips.restWorldQ) {
          const vHipsLat = pLHp.clone().sub(pRHp);
          if (mirrorMode) vHipsLat.x = -vHipsLat.x;

          const hipYaw = Math.atan2(vHipsLat.z, Math.max(1e-4, vHipsLat.x));
          const trunkForwardPitch = Math.atan2(vSpine.z, Math.max(0.08, vSpine.y));
          const pelvicTilt = trunkForwardPitch * 0.35;
          const pelvicRoll = Math.atan2(vHipsLat.y, Math.hypot(vHipsLat.x, vHipsLat.z));

          const eulerHips = new THREE.Euler(-pelvicTilt, hipYaw, pelvicRoll, 'YXZ');
          const qDelta = new THREE.Quaternion().setFromEuler(eulerHips);
          const targetWorldQHips = qDelta.clone().multiply(bHips.restWorldQ);

          const parentWorldQHips = new THREE.Quaternion();
          if (bHips.parent) bHips.parent.getWorldQuaternion(parentWorldQHips);
          const targetLocalHips = parentWorldQHips.clone().invert().multiply(targetWorldQHips);
          bHips.quaternion.slerp(targetLocalHips, 0.75);
        }

        // Позвоночник и грудной отдел
        if (bSpine) alignBone(bSpine, REST_WORLD_DIRS.Spine, vSpine, 0.72);
        if (bSpine1) alignBone(bSpine1, REST_WORLD_DIRS.Spine1, vSpine, 0.75);
        if (bChest) alignBone(bChest, REST_WORLD_DIRS.Chest, vSpine, 0.78);

        // 6. СМЕЩЕНИЕ ТАЗА ПО ВЫСОТЕ (ПРИСЕД В СТОЙКУ ДЗЭНКУЦУ / КИБА):
        // Таз опускается строго относительно своего restPosition.y (~0.9м).
        // Модель НИ ПРИ КАКИХ ОБСТОЯТЕЛЬСТВАХ не падает под татами!
        if (bHips && (pLAn || pRAn)) {
          const hipY = (pLHp.y + pRHp.y) * 0.5;
          const footY = Math.min(pLAn ? pLAn.y : pRAn.y, pRAn ? pRAn.y : pLAn.y);
          const legDrop = hipY - footY;

          if (legDrop > nominalLegLenRef.current) {
            nominalLegLenRef.current = nominalLegLenRef.current * 0.95 + legDrop * 0.05;
          }

          const compression = legDrop - nominalLegLenRef.current;
          // Ограничиваем сжатие от -0.40м (глубокий присед) до +0.03м (прыжок/выпрямление)
          const targetSquatOffset = Math.max(-0.40, Math.min(0.04, compression));
          const restHipsY = bHips.restPosition ? bHips.restPosition.y : 0.9;
          const targetY = restHipsY + targetSquatOffset;

          bHips.position.y = THREE.MathUtils.lerp(bHips.position.y, targetY, lerpFactor * 1.2);
        }
      }
    } else if (boneRotations) {
      // Фолбэк: управление через подготовленные повороты boneRotations
      boneMap.forEach((bone, name) => {
        const restQ = bone.restLocalQ;
        if (!restQ) return;

        if (boneRotations[name]) {
          const rot = boneRotations[name];
          if (rot.quaternion) {
            const q = new THREE.Quaternion(rot.quaternion[0], rot.quaternion[1], rot.quaternion[2], rot.quaternion[3]);
            bone.quaternion.slerp(q, lerpFactor);
          } else {
            const euler = new THREE.Euler(rot.x || 0, rot.y || 0, rot.z || 0, 'XYZ');
            const targetQ = restQ.clone().multiply(new THREE.Quaternion().setFromEuler(euler));
            bone.quaternion.slerp(targetQ, lerpFactor);
          }

          if (name === 'Hips') {
            const restHipsY = bone.restPosition ? bone.restPosition.y : 0.9;
            const yOff = Math.max(-0.40, Math.min(0.05, rot.yOffset || 0));
            bone.position.y = THREE.MathUtils.lerp(bone.position.y, restHipsY + yOff, lerpFactor);
          }
        } else {
          bone.quaternion.slerp(restQ, lerpFactor * 0.5);
        }
      });
    } else {
      // Возврат в базовую стойку ожидания (Rest Pose)
      boneMap.forEach((bone) => {
        if (bone.restLocalQ) bone.quaternion.slerp(bone.restLocalQ, lerpFactor * 0.4);
        if (bone.name === 'Hips' && bone.restPosition) {
          bone.position.y = THREE.MathUtils.lerp(bone.position.y, bone.restPosition.y, lerpFactor * 0.4);
        }
      });
    }
  });

  return (
    // Масштаб и смещение Y применяются к родителю <group>, сохраняя bindMatrix меша
    <group
      ref={groupRef}
      position={[position[0], position[1] + modelYOffset, position[2]]}
      rotation={rotation}
      scale={[scale * modelScale, scale * modelScale, scale * modelScale]}
    >
      <primitive object={clonedModel} />
    </group>
  );
}

useGLTF.preload('/models/karateka_techniques_v4.glb');
