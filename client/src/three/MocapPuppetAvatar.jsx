import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * MocapPuppetAvatar — 3D-аватар мастера, управляемый в реальном времени
 * через MediaPipe Pose (веб-камера ПК или камера смартфона).
 * 
 * Напрямую управляет иерархией суставов Armature:
 * - UpperArm.L / LowerArm.L / Hand.L
 * - UpperArm.R / LowerArm.R / Hand.R
 * - UpperLeg.L / LowerLeg.L / Foot.L
 * - UpperLeg.R / LowerLeg.R / Foot.R
 * - Spine / Neck / Head / Hips
 */
export default function MocapPuppetAvatar({
  boneRotations = null,
  detectedStance = 'ready',
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1.0,
  xrayMode = false,
}) {
  const groupRef = useRef();
  const { scene } = useGLTF('/models/karateka_techniques_v4.glb');

  // Клонируем SkinnedMesh с сохранением исходной калибровки
  const { clonedModel, boneMap } = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    const map = new Map();

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
              mat.opacity = 0.42;
              mat.roughness = 0.5;
            }
          }
          child.material = mat;
        }
      }
    });

    return { clonedModel: clone, boneMap: map };
  }, [scene, xrayMode]);

  // Запоминаем исходные (Rest Pose) кватернионы костей
  const restQuatsRef = useRef(new Map());
  useEffect(() => {
    boneMap.forEach((bone, name) => {
      restQuatsRef.current.set(name, bone.quaternion.clone());
    });
  }, [boneMap]);

  // Плавное обновление положения суставов на каждом кадре Three.js
  useFrame((_, delta) => {
    const lerpFactor = Math.min(1.0, delta * 14); // Сглаживание 14 Гц против рывков

    boneMap.forEach((bone, name) => {
      const restQ = restQuatsRef.current.get(name);
      if (!restQ) return;

      if (boneRotations && boneRotations[name]) {
        const targetRot = boneRotations[name];
        // Целевой кватернион из поворотов Эйлера
        const euler = new THREE.Euler(targetRot.x || 0, targetRot.y || 0, targetRot.z || 0, 'XYZ');
        const targetQ = restQ.clone().multiply(new THREE.Quaternion().setFromEuler(euler));
        bone.quaternion.slerp(targetQ, lerpFactor);

        // Смещение таза по высоте при приседе в стойку
        if (name === 'Hips' && targetRot.yOffset !== undefined) {
          bone.position.y = THREE.MathUtils.lerp(bone.position.y, targetRot.yOffset, lerpFactor);
        }
      } else {
        // Возврат в базовую стойку ожидания (Rest Pose)
        bone.quaternion.slerp(restQ, lerpFactor * 0.5);
      }
    });
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <primitive object={clonedModel} />
    </group>
  );
}

useGLTF.preload('/models/karateka_techniques_v4.glb');
