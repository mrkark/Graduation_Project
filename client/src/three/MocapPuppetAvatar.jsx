import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { extractHandBiomechanics, estimateHeadOrientation } from '../utils/mocapPoseTracker';
import { applyHandRetargetingToArmature } from '../utils/mocapHandRetargeter';
import {
  MasterBiomechanicalRetargeter,
  constrainKneeJoint,
  constrainElbowJoint,
} from '../utils/mocapBiomechanicalRetargeter';

/**
 * MocapPuppetAvatar — 3D-аватар мастера каратэ Шотокан (Karateka lowpoly).
 * 
 * Точный кинематический движок из Karate Motion Studio:
 * 1. Иерархическое выравнивание костей (alignBone) с защитой от сингулярностей (Gimbal flip)
 * 2. Динамическая протракция и депрессия ключиц (alignShoulder) для естественной посадки плеча
 * 3. Ориентация стоп на татами (alignFoot) с сохранением угла атаки и разворота носка
 * 4. Полный анатомический контроль 30 костей фаланг пальцев (Thumb1..3, Index1..3, Middle1..3, Ring1..3, Pinky1..3)
 *    с поддержкой перехода Сэйкэн (кулак) <-> Шуто (открытая ладонь)
 * 5. Ориентация взгляда и головы Мэцукэ (Head + Neck)
 * 6. Многосегментный позвоночник (Spine 45%, Spine1 75%, Chest 100%) и наклон таза (Pelvic Tilt 35%)
 * 7. Физическое заземление подошв на Y = 0 (Tatami floor): присед опускает корень строго синхронно с компрессией ног,
 *    исключая подтягивание ног к себе и проваливание под пол!
 * 8. Поддержка ролей Тори (Белое ги) и Укэ (Индиго ги) для парного режима Бункай и Кумитэ.
 */

function alignBone(bone, targetDir, alpha = 0.85) {
  if (!bone || !bone.restWorldDir || !targetDir || targetDir.lengthSq() < 1e-5) return;
  const vFrom = bone.restWorldDir;
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
  } else {
    const crossReach = Math.max(0, -uArm.x);
    const yOffset = elevate > 0 ? elevate * 0.25 : depress * 0.35;
    vClavicle = new THREE.Vector3(1.0 - crossReach * 0.35, yOffset, fwdReach * 0.35 + crossReach * 0.25).normalize();
  }
  alignBone(bone, vClavicle, alpha);
}

const footOrientMemory = {
  R: { yaw: null, pitch: null },
  L: { yaw: null, pitch: null },
};

function alignFoot(bone, vFoot, sideKey = 'R', alphaTarget = 0.75) {
  if (!bone || !bone.restWorldQ || !vFoot || vFoot.lengthSq() < 1e-4) return;
  const mem = footOrientMemory[sideKey] || footOrientMemory.R;

  let curYaw = Math.atan2(vFoot.x, vFoot.z);
  const lenXZ = Math.hypot(vFoot.x, vFoot.z);
  let curPitch = Math.atan2(vFoot.y, Math.max(0.04, lenXZ));
  curPitch = Math.max(-0.85, Math.min(0.40, curPitch));

  if (mem.yaw === null) {
    mem.yaw = curYaw;
    mem.pitch = curPitch;
  } else {
    let diffYaw = curYaw - mem.yaw;
    while (diffYaw > Math.PI) diffYaw -= 2 * Math.PI;
    while (diffYaw < -Math.PI) diffYaw += 2 * Math.PI;

    const maxDiff = Math.max(Math.abs(diffYaw), Math.abs(curPitch - mem.pitch));
    const alpha = maxDiff > 0.20 ? 0.75 : (maxDiff > 0.05 ? 0.40 : 0.20);
    mem.yaw += diffYaw * alpha;
    mem.pitch = mem.pitch * (1 - alpha) + curPitch * alpha;
  }

  const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), mem.yaw);
  const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -mem.pitch);
  const qDeltaWorld = qYaw.multiply(qPitch);
  const targetWorldQ = qDeltaWorld.multiply(bone.restWorldQ);

  const parentWorldQ = new THREE.Quaternion();
  if (bone.parent) bone.parent.getWorldQuaternion(parentWorldQ);
  const targetLocalQ = parentWorldQ.clone().invert().multiply(targetWorldQ);

  bone.quaternion.slerp(targetLocalQ, alphaTarget);
  bone.updateMatrixWorld(true);
}

const handOrientMemory = {
  R: { fwd: null, norm: null },
  L: { fwd: null, norm: null },
};

function alignHand(bone, targetFwd, targetNorm, sideKey = 'R', alphaTarget = 0.70) {
  if (!bone || !targetFwd || !targetNorm) return;
  const mem = handOrientMemory[sideKey] || handOrientMemory.R;

  let curFwd = targetFwd.clone().normalize();
  let curNorm = targetNorm.clone().normalize();
  if (curFwd.lengthSq() < 1e-4 || curNorm.lengthSq() < 1e-4) return;

  if (!mem.fwd) {
    mem.fwd = curFwd.clone();
    mem.norm = curNorm.clone();
  } else {
    const angFwd = mem.fwd.angleTo(curFwd);
    const angNorm = mem.norm.angleTo(curNorm);
    const maxAng = Math.max(angFwd, angNorm);
    const alpha = maxAng > 0.18 ? 0.70 : (maxAng > 0.06 ? 0.35 : 0.18);
    mem.fwd.lerp(curFwd, alpha).normalize();
    mem.norm.lerp(curNorm, alpha).normalize();
  }

  const uy = mem.fwd.clone();
  const dorsal = mem.norm.clone().negate().normalize();
  const dot = dorsal.dot(uy);
  const uz = dorsal.clone().sub(uy.clone().multiplyScalar(dot)).normalize();
  if (uz.lengthSq() < 1e-4) return;

  const ux = new THREE.Vector3().crossVectors(uy, uz).normalize();
  if (ux.lengthSq() < 1e-4) return;

  const basisMat = new THREE.Matrix4().makeBasis(ux, uy, uz);
  const targetWorldQ = new THREE.Quaternion().setFromRotationMatrix(basisMat);

  const parentWorldQ = new THREE.Quaternion();
  if (bone.parent) bone.parent.getWorldQuaternion(parentWorldQ);
  const targetLocalQ = parentWorldQ.clone().invert().multiply(targetWorldQ);

  bone.quaternion.slerp(targetLocalQ, alphaTarget);
  bone.updateMatrixWorld(true);
}

const FINGER_TYPES = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

/**
 * Анатомический перенос движений пальцев на фаланги Karateka_Armature (30 костей)
 * Точный алгоритм из Karate Motion Studio:
 * - Большой палец: оппозиция CMC в плоскости ладони + сгибание MCP и IP
 * - 4 пальца: MCP разведение (abduction) + фаланговое сгибание вокруг -X
 */
function applyFingersToArmature(boneMap, fData, sideKey = 'R', alpha = 0.80) {
  if (!boneMap || !fData) return;
  const isLeft = sideKey === 'L';
  const hasPhalanges = fData.phalanges && fData.detected;

  FINGER_TYPES.forEach((ftype) => {
    const fKey = ftype.toLowerCase();
    const curl = typeof fData[fKey] === 'number' ? fData[fKey] : (fData.general_curl ?? 0.15);
    const phalanges = fData.phalanges?.[fKey];
    const abd = fData.abduction?.[fKey] || 0.0;

    for (let ph = 1; ph <= 3; ph++) {
      const bname = `${ftype}${ph}.${sideKey}`;
      const bone = boneMap.get(bname);
      if (!bone || !bone.restLocalQ) continue;

      if (ftype === 'Thumb') {
        const zSign = isLeft ? 1.0 : -1.0;
        const flexVal = phalanges?.[ph - 1] !== undefined ? phalanges[ph - 1] : curl * 1.2;
        let rotVec;
        if (ph === 1) {
          // Trapeziometacarpal / CMC: оппозиция поперек ладони и сгибание
          const oppVal = hasPhalanges ? Math.max(0.0, abd) : curl;
          rotVec = new THREE.Vector3(-0.35 * flexVal, 0.0, 0.80 * oppVal * zSign);
        } else if (ph === 2) {
          // MCP: сгибание
          rotVec = new THREE.Vector3(-0.80 * flexVal, 0.0, 0.35 * curl * zSign);
        } else {
          // IP: дистальное сгибание
          rotVec = new THREE.Vector3(-0.95 * flexVal, 0.0, 0.15 * zSign);
        }
        const len = rotVec.length();
        if (len > 1e-4) {
          const flexQ = new THREE.Quaternion().setFromAxisAngle(rotVec.clone().normalize(), len);
          const qTarget = bone.restLocalQ.clone().multiply(flexQ);
          bone.quaternion.slerp(qTarget, alpha);
        } else {
          bone.quaternion.slerp(bone.restLocalQ, alpha);
        }
      } else {
        // 4 пальца: индивидуальное сгибание вокруг локальной оси -X
        const flexAng = phalanges?.[ph - 1] !== undefined ? phalanges[ph - 1] : curl * 1.4;
        const flexQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-1, 0, 0), flexAng);

        if (ph === 1) {
          // MCP: разведение пальцев в плоскости ладони (abduction) вокруг оси Z
          const sideSign = isLeft ? 1.0 : -1.0;
          let abdDir = 0.0;
          if (ftype === 'Index') abdDir = 1.0 * sideSign;
          else if (ftype === 'Pinky') abdDir = -1.2 * sideSign;
          else if (ftype === 'Ring') abdDir = -0.4 * sideSign;

          const abdAng = abd * abdDir * 0.45;
          const abdQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), abdAng);
          const qTarget = bone.restLocalQ.clone().multiply(abdQ).multiply(flexQ);
          bone.quaternion.slerp(qTarget, alpha);
        } else {
          const qTarget = bone.restLocalQ.clone().multiply(flexQ);
          bone.quaternion.slerp(qTarget, alpha);
        }
      }
    }
  });
}


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
  role = 'tori', // 'tori' (белое ги) | 'uke' (индиго ги)
}) {
  const groupRef = useRef();
  // Загружаем классическую легковесную модель мастера из Karate Motion Studio
  const { scene } = useGLTF('/models/karateka_lowpoly.glb');

  const { clonedModel, boneMap, modelScale, modelYOffset } = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    const map = new Map();

    const bbox = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    // Нормализация роста до 1.78 м
    const s = size.y > 0 ? 1.78 / size.y : 1.0;
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
          if (name.includes('Belt') || name.includes('Obi')) {
            mat.color = new THREE.Color(role === 'uke' ? '#2d1808' : '#141414');
            if (xrayMode) {
              mat.transparent = true;
              mat.opacity = 0.7;
            }
          } else if (name.includes('Gi') || name.includes('Jacket') || name.includes('Pants') || name.includes('Mesh')) {
            mat.color = new THREE.Color(role === 'uke' ? '#1b2c45' : '#faf9f6');
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
  }, [scene, xrayMode, role]);

  const masterRetargeterRef = useRef(null);
  if (!masterRetargeterRef.current) {
    masterRetargeterRef.current = new MasterBiomechanicalRetargeter({ groundY: 0.0 });
  }

  useEffect(() => {
    clonedModel.updateMatrixWorld(true);
    boneMap.forEach((node) => {
      node.restLocalQ = node.quaternion.clone();
      node.restWorldQ = new THREE.Quaternion();
      node.getWorldQuaternion(node.restWorldQ);
      // Динамическое вычисление оси покоя каждой кости armature в мировом пространстве:
      node.restWorldDir = new THREE.Vector3(0, 1, 0).applyQuaternion(node.restWorldQ).normalize();
      node.restPosition = node.position.clone();
    });
    masterRetargeterRef.current.registerRestArmature(boneMap);
  }, [boneMap, clonedModel]);

  const nominalLegLenRef = useRef(0.82);
  const smoothRootYRef = useRef(0.0);
  const smoothRootZRef = useRef(0.0);

  useFrame((_, delta) => {
    const lerpFactor = Math.min(1.0, delta * 16);

    const activePose = poseDataRef?.current || (
      (worldLandmarks || poseLandmarks) ? { worldLandmarks, landmarks: poseLandmarks } : null
    );

    const ptsRaw = activePose?.worldLandmarks || activePose?.landmarks;

    if (ptsRaw && ptsRaw.length >= 33) {
      const toVec = (idx) => {
        const p = ptsRaw[idx];
        if (!p) return null;
        if (activePose.worldLandmarks) {
          return new THREE.Vector3(p.x, -p.y, -p.z);
        }
        return new THREE.Vector3((p.x - 0.5) * 1.5, -(p.y - 0.5) * 1.8, -((p.z || 0) * 1.5));
      };

      const pLSh = toVec(11);
      const pRSh = toVec(12);
      const pLEl = toVec(13);
      const pREl = toVec(14);
      const pLWr = toVec(15);
      const pRWr = toVec(16);
      const pLPinky = toVec(17);
      const pRPinky = toVec(18);
      const pLIdx = toVec(19);
      const pRIdx = toVec(20);
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

      // Маппинг костей: Зеркальный режим vs Прямой
      const armR_Upper = mirrorMode ? boneMap.get('UpperArm.L') : boneMap.get('UpperArm.R');
      const armR_Lower = mirrorMode ? boneMap.get('LowerArm.L') : boneMap.get('LowerArm.R');
      const armR_Hand = mirrorMode ? boneMap.get('Hand.L') : boneMap.get('Hand.R');
      const armR_Shoulder = mirrorMode ? boneMap.get('Shoulder.L') : boneMap.get('Shoulder.R');

      const armL_Upper = mirrorMode ? boneMap.get('UpperArm.R') : boneMap.get('UpperArm.L');
      const armL_Lower = mirrorMode ? boneMap.get('LowerArm.R') : boneMap.get('LowerArm.L');
      const armL_Hand = mirrorMode ? boneMap.get('Hand.R') : boneMap.get('Hand.L');
      const armL_Shoulder = mirrorMode ? boneMap.get('Shoulder.R') : boneMap.get('Shoulder.L');

      const legR_Upper = mirrorMode ? boneMap.get('UpperLeg.L') : boneMap.get('UpperLeg.R');
      const legR_Lower = mirrorMode ? boneMap.get('LowerLeg.L') : boneMap.get('LowerLeg.R');
      const legR_Foot = mirrorMode ? boneMap.get('Foot.L') : boneMap.get('Foot.R');

      const legL_Upper = mirrorMode ? boneMap.get('UpperLeg.R') : boneMap.get('UpperLeg.L');
      const legL_Lower = mirrorMode ? boneMap.get('LowerLeg.R') : boneMap.get('LowerLeg.L');
      const legL_Foot = mirrorMode ? boneMap.get('Foot.R') : boneMap.get('Foot.L');

      // 1. ПРАВАЯ РУКА ЧЕЛОВЕКА
      let vArmR = null;
      if (pRSh && pREl) {
        vArmR = pREl.clone().sub(pRSh);
        if (mirrorMode) vArmR.x = -vArmR.x;
        if (armR_Shoulder) alignShoulder(armR_Shoulder, vArmR, mirrorMode ? 'L' : 'R');
        alignBone(armR_Upper, vArmR, 0.78);
      }

      // 2. ЛЕВАЯ РУКА ЧЕЛОВЕКА
      let vArmL = null;
      if (pLSh && pLEl) {
        vArmL = pLEl.clone().sub(pLSh);
        if (mirrorMode) vArmL.x = -vArmL.x;
        if (armL_Shoulder) alignShoulder(armL_Shoulder, vArmL, mirrorMode ? 'R' : 'L');
        alignBone(armL_Upper, vArmL, 0.78);
      }

      // 3. БИОМЕХАНИКА КИСТЕЙ И ПАЛЬЦЕВ (Thumb, Index, Middle, Ring, Pinky 1..3)
      const fingersBio = activePose.fingers || extractHandBiomechanics(ptsRaw);
      const fR = fingersBio?.right;
      const fL = fingersBio?.left;

      if (pREl && pRWr) {
        let vForearm = pRWr.clone().sub(pREl);
        if (mirrorMode) vForearm.x = -vForearm.x;
        if (vArmR) {
          const elbowChk = constrainElbowJoint(vArmR, vForearm, mirrorMode);
          if (elbowChk.correctedForearm) vForearm.copy(elbowChk.correctedForearm);
        }
        alignBone(armR_Lower, vForearm, 0.78);

        // Кисть правой руки (поворот ладони, супинация / пронация)
        if (armR_Hand) {
          const activeHandF = mirrorMode ? fL : fR;
          if (activeHandF?.hand_direction && activeHandF?.palm_normal) {
            const targetFwd = new THREE.Vector3(...activeHandF.hand_direction);
            const targetNorm = new THREE.Vector3(...activeHandF.palm_normal);
            if (mirrorMode) {
              targetFwd.x = -targetFwd.x;
              targetNorm.x = -targetNorm.x;
            }
            alignHand(armR_Hand, targetFwd, targetNorm, mirrorMode ? 'L' : 'R', 0.75);
          } else if (pRIdx || pRPinky) {
            const pKnuckles = (pRIdx && pRPinky)
              ? pRIdx.clone().add(pRPinky).multiplyScalar(0.5)
              : (pRIdx || pRPinky);
            const vHand = pKnuckles.clone().sub(pRWr);
            if (mirrorMode) vHand.x = -vHand.x;
            alignBone(armR_Hand, vHand, 0.75);
          }
        }
      }

      if (pLEl && pLWr) {
        let vForearm = pLWr.clone().sub(pLEl);
        if (mirrorMode) vForearm.x = -vForearm.x;
        if (vArmL) {
          const elbowChk = constrainElbowJoint(vArmL, vForearm, !mirrorMode);
          if (elbowChk.correctedForearm) vForearm.copy(elbowChk.correctedForearm);
        }
        alignBone(armL_Lower, vForearm, 0.78);

        // Кисть левой руки (поворот ладони, супинация / пронация)
        if (armL_Hand) {
          const activeHandF = mirrorMode ? fR : fL;
          if (activeHandF?.hand_direction && activeHandF?.palm_normal) {
            const targetFwd = new THREE.Vector3(...activeHandF.hand_direction);
            const targetNorm = new THREE.Vector3(...activeHandF.palm_normal);
            if (mirrorMode) {
              targetFwd.x = -targetFwd.x;
              targetNorm.x = -targetNorm.x;
            }
            alignHand(armL_Hand, targetFwd, targetNorm, mirrorMode ? 'R' : 'L', 0.75);
          } else if (pLIdx || pLPinky) {
            const pKnuckles = (pLIdx && pLPinky)
              ? pLIdx.clone().add(pLPinky).multiplyScalar(0.5)
              : (pLIdx || pLPinky);
            const vHand = pKnuckles.clone().sub(pLWr);
            if (mirrorMode) vHand.x = -vHand.x;
            alignBone(armL_Hand, vHand, 0.75);
          }
        }
      }

      // Применение анатомических вращений фаланг (30 костей) с 1€ фильтрацией и ROM-клампингом
      if (fR) applyHandRetargetingToArmature(boneMap, fR, mirrorMode ? 'L' : 'R', 0.82);
      if (fL) applyHandRetargetingToArmature(boneMap, fL, mirrorMode ? 'R' : 'L', 0.82);

      // 4. ПРАВАЯ НОГА ЧЕЛОВЕКА
      if (pRHp && pRKn) {
        const vThigh = pRKn.clone().sub(pRHp);
        if (mirrorMode) vThigh.x = -vThigh.x;
        alignBone(legR_Upper, vThigh, 0.85);

        if (pRAn) {
          const pRAnGrounded = masterRetargeterRef.current?.footContactManager.processFoot('R', pRAn) || pRAn;
          let vShin = pRAnGrounded.clone().sub(pRKn);
          if (mirrorMode) vShin.x = -vShin.x;
          const kneeChk = constrainKneeJoint(vThigh, vShin, mirrorMode);
          if (kneeChk.correctedShin) vShin.copy(kneeChk.correctedShin);
          alignBone(legR_Lower, vShin, 0.85);
        }

        if (pRToe && pRHeel && legR_Foot) {
          const vFoot = pRToe.clone().sub(pRHeel);
          if (mirrorMode) vFoot.x = -vFoot.x;
          alignFoot(legR_Foot, vFoot, mirrorMode ? 'L' : 'R', 0.75);
        }
      }

      // 5. ЛЕВАЯ НОГА ЧЕЛОВЕКА
      if (pLHp && pLKn) {
        const vThigh = pLKn.clone().sub(pLHp);
        if (mirrorMode) vThigh.x = -vThigh.x;
        alignBone(legL_Upper, vThigh, 0.85);

        if (pLAn) {
          const pLAnGrounded = masterRetargeterRef.current?.footContactManager.processFoot('L', pLAn) || pLAn;
          let vShin = pLAnGrounded.clone().sub(pLKn);
          if (mirrorMode) vShin.x = -vShin.x;
          const kneeChk = constrainKneeJoint(vThigh, vShin, !mirrorMode);
          if (kneeChk.correctedShin) vShin.copy(kneeChk.correctedShin);
          alignBone(legL_Lower, vShin, 0.85);
        }

        if (pLToe && pLHeel && legL_Foot) {
          const vFoot = pLToe.clone().sub(pLHeel);
          if (mirrorMode) vFoot.x = -vFoot.x;
          alignFoot(legL_Foot, vFoot, mirrorMode ? 'R' : 'L', 0.75);
        }
      }

      // 6. ОРИЕНТАЦИЯ ГОЛОВЫ И ВЗГЛЯД МЭЦУКЭ
      const bHead = boneMap.get('Head');
      const bNeck = boneMap.get('Neck');
      const headBio = activePose.head || estimateHeadOrientation(ptsRaw);
      if (bHead && bHead.restWorldQ && headBio) {
        const yaw = mirrorMode ? -headBio.yaw : headBio.yaw;
        const pitch = headBio.pitch;
        const roll = mirrorMode ? -headBio.roll : headBio.roll;

        if (bNeck && bNeck.restWorldQ) {
          const eulerNeck = new THREE.Euler(-pitch * 0.35, yaw * 0.35, roll * 0.30, 'YXZ');
          const qNeckDelta = new THREE.Quaternion().setFromEuler(eulerNeck);
          const targetWorldQNeck = qNeckDelta.multiply(bNeck.restWorldQ);
          const parentWorldQNeck = new THREE.Quaternion();
          if (bNeck.parent) bNeck.parent.getWorldQuaternion(parentWorldQNeck);
          const targetLocalQNeck = parentWorldQNeck.clone().invert().multiply(targetWorldQNeck);
          bNeck.quaternion.slerp(targetLocalQNeck, 0.70);
        }

        const eulerHead = new THREE.Euler(-pitch * 0.65, yaw * 0.65, roll * 0.50, 'YXZ');
        const qHeadDelta = new THREE.Quaternion().setFromEuler(eulerHead);
        const targetWorldQHead = qHeadDelta.multiply(bHead.restWorldQ);
        const parentWorldQHead = new THREE.Quaternion();
        if (bHead.parent) bHead.parent.getWorldQuaternion(parentWorldQHead);
        const targetLocalQHead = parentWorldQHead.clone().invert().multiply(targetWorldQHead);
        bHead.quaternion.slerp(targetLocalQHead, 0.75);
      }

      // 7. МНОГОСЕГМЕНТНЫЙ ПОЗВОНОЧНИК, ГРУДЬ И ТАЗ
      const bHips = boneMap.get('Hips');
      const bSpine = boneMap.get('Spine');
      const bSpine1 = boneMap.get('Spine1');
      const bChest = boneMap.get('Chest');

      let torsoFwdZ = 0.0;

      if (pLHp && pRHp && pLSh && pRSh) {
        const midHip = pLHp.clone().add(pRHp).multiplyScalar(0.5);
        const midSh = pLSh.clone().add(pRSh).multiplyScalar(0.5);
        const vSpine = midSh.clone().sub(midHip);
        if (mirrorMode) vSpine.x = -vSpine.x;

        torsoFwdZ = vSpine.z;

        // Наклон и непрерывный поворот таза (Continuous 360° Azimuth & Phase Unwrapped Yaw)
        if (bHips && bHips.restWorldQ) {
          const vHipsLat = pLHp.clone().sub(pRHp);
          if (mirrorMode) vHipsLat.x = -vHipsLat.x;

          if (vHipsLat.lengthSq() > 1e-4) {
            const headingVec = masterRetargeterRef.current.azimuthTracker.computeCompositeHeading(ptsRaw);
            if (mirrorMode) headingVec.x = -headingVec.x;
            const continuousYaw = masterRetargeterRef.current.azimuthTracker.updateYaw(headingVec);

            const trunkForwardPitch = Math.atan2(vSpine.z, Math.max(0.08, vSpine.y));
            const pelvicTilt = trunkForwardPitch * 0.35;
            const pelvicRoll = Math.atan2(vHipsLat.y, Math.hypot(vHipsLat.x, vHipsLat.z));

            const qRotContinuous = masterRetargeterRef.current.azimuthTracker.getRootOrientationQuaternion(
              -pelvicTilt,
              pelvicRoll
            );
            const targetWorldQHips = qRotContinuous.clone().multiply(bHips.restWorldQ);

            const parentWorldQHips = new THREE.Quaternion();
            if (bHips.parent) bHips.parent.getWorldQuaternion(parentWorldQHips);
            const targetLocalHips = parentWorldQHips.clone().invert().multiply(targetWorldQHips);
            bHips.quaternion.slerp(targetLocalHips, 0.78);
          }
        }

        // Фильтр сутулости при вертикальной стойке
        const isUprightStance = vSpine.y > 0.45 && Math.abs(vSpine.z) < 0.08;
        if (isUprightStance) {
          vSpine.z *= 0.15;
          if (Math.abs(vSpine.z) < 0.02) vSpine.z = 0.0;
        }

        if (vSpine.lengthSq() > 1e-4) {
          const uy = vSpine.clone().normalize();
          let vLat = pLSh.clone().sub(pRSh);
          if (mirrorMode) vLat.x = -vLat.x;

          if (vLat.lengthSq() > 1e-4) {
            vLat.normalize();
            const dotLat = vLat.dot(uy);
            const ux = vLat.clone().sub(uy.clone().multiplyScalar(dotLat)).normalize();

            if (ux.lengthSq() > 1e-4) {
              const uz = new THREE.Vector3().crossVectors(ux, uy).normalize();
              ux.crossVectors(uy, uz).normalize();

              const basisMat = new THREE.Matrix4().makeBasis(ux, uy, uz);
              const targetTorsoWorldQ = new THREE.Quaternion().setFromRotationMatrix(basisMat);
              const qIdentity = new THREE.Quaternion(0, 0, 0, 1);

              // 1. Поясничный отдел (Spine) ~45% наклона
              if (bSpine) {
                const qLumbar = qIdentity.clone().slerp(targetTorsoWorldQ, 0.45);
                const parentQ = new THREE.Quaternion();
                if (bSpine.parent) bSpine.parent.getWorldQuaternion(parentQ);
                const targetLocal = parentQ.clone().invert().multiply(qLumbar);
                bSpine.quaternion.slerp(targetLocal, 0.75);
              }

              // 2. Средне-грудной отдел (Spine1) ~75% наклона
              if (bSpine1) {
                const qMid = qIdentity.clone().slerp(targetTorsoWorldQ, 0.75);
                const parentQ = new THREE.Quaternion();
                if (bSpine1.parent) bSpine1.parent.getWorldQuaternion(parentQ);
                const targetLocal = parentQ.clone().invert().multiply(qMid);
                bSpine1.quaternion.slerp(targetLocal, 0.75);
              }

              // 3. Верхний грудной отдел (Chest) 100%
              if (bChest) {
                const parentQ = new THREE.Quaternion();
                if (bChest.parent) bChest.parent.getWorldQuaternion(parentQ);
                const targetLocal = parentQ.clone().invert().multiply(targetTorsoWorldQ);
                bChest.quaternion.slerp(targetLocal, 0.78);
              }
            }
          }
        }

        // 8. ФИЗИЧЕСКОЕ ЗАЗЕМЛЕНИЕ ПОДОШВ НА ТАТАМИ (Y = 0) И ПЕРЕМЕЩЕНИЕ КОРНЯ:
        const hasAnkle = pLAn || pRAn;
        if (hasAnkle) {
          const hipY = (pLHp.y + pRHp.y) * 0.5;
          let maxSupportDrop = 0.0;
          if (pLAn) maxSupportDrop = Math.max(maxSupportDrop, hipY - pLAn.y);
          if (pRAn) maxSupportDrop = Math.max(maxSupportDrop, hipY - pRAn.y);

          if (maxSupportDrop > 0.65 && maxSupportDrop < 1.15) {
            if (maxSupportDrop > nominalLegLenRef.current) {
              nominalLegLenRef.current = nominalLegLenRef.current * 0.90 + maxSupportDrop * 0.10;
            }
          }

          let targetRootY = 0.0;
          if (maxSupportDrop > 0.25) {
            const legCompression = maxSupportDrop - nominalLegLenRef.current;
            if (legCompression < -0.03) {
              targetRootY = Math.max(-0.62, legCompression + 0.03);
            }
          }

          const fwdBendShift = Math.max(0, torsoFwdZ) * 0.22;
          const targetRootZ = targetRootY * 0.25 - fwdBendShift;

          smoothRootYRef.current = smoothRootYRef.current * 0.80 + targetRootY * 0.20;
          smoothRootZRef.current = smoothRootZRef.current * 0.80 + targetRootZ * 0.20;

          if (bHips && bHips.restPosition) {
            const rootX = activePose.rootPosition ? (mirrorMode ? -activePose.rootPosition[0] : activePose.rootPosition[0]) : 0;
            const rootZ = activePose.rootPosition ? activePose.rootPosition[2] : 0;
            bHips.position.x = bHips.restPosition.x + rootX;
            bHips.position.y = bHips.restPosition.y + smoothRootYRef.current;
            bHips.position.z = bHips.restPosition.z + rootZ + smoothRootZRef.current;
          }
        }
      }
    } else if (boneRotations) {
      // Фолбэк на подготовленный объект boneRotations
      boneMap.forEach((bone, name) => {
        const restQ = bone.restLocalQ;
        if (!restQ) return;

        if (boneRotations[name]) {
          const rot = boneRotations[name];
          if (rot.quaternion || Array.isArray(rot)) {
            const arr = rot.quaternion || rot;
            const q = new THREE.Quaternion(arr[0], arr[1], arr[2], arr[3]);
            bone.quaternion.slerp(q, lerpFactor);
          } else {
            const euler = new THREE.Euler(rot.x || 0, rot.y || 0, rot.z || 0, 'XYZ');
            const targetQ = restQ.clone().multiply(new THREE.Quaternion().setFromEuler(euler));
            bone.quaternion.slerp(targetQ, lerpFactor);
          }

          if (name === 'Hips' && bone.restPosition) {
            const yOff = Math.max(-0.40, Math.min(0.05, rot.yOffset || 0));
            bone.position.y = THREE.MathUtils.lerp(bone.position.y, bone.restPosition.y + yOff, lerpFactor);
          }
        } else {
          bone.quaternion.slerp(restQ, lerpFactor * 0.5);
        }
      });
    } else {
      // Плавный возврат в базовую стойку ожидания (Rest Pose)
      boneMap.forEach((bone) => {
        if (bone.restLocalQ) bone.quaternion.slerp(bone.restLocalQ, lerpFactor * 0.4);
        if (bone.name === 'Hips' && bone.restPosition) {
          bone.position.y = THREE.MathUtils.lerp(bone.position.y, bone.restPosition.y, lerpFactor * 0.4);
        }
      });
    }
  });

  return (
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

useGLTF.preload('/models/karateka_lowpoly.glb');
