import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BONE_CONNECTIONS_3D } from '../utils/mocapPoseTracker';

/**
 * Mocap3DSkeleton — Объемная 3D-модель кинематического скелета мастера каратэ
 * 
 * В отличие от плоского 2D-оверлея, строит полноценные трехмерные кости (3D-цилиндры)
 * и суставы (3D-сферы) в Three.js координатах:
 * - Точное отслеживание глубины Z при ударах (Ой-цуки, Гяку-цуки) и стойках (Дзэнкуцу, Киба)
 * - Свободное вращение камеры в 3D на 360° (OrbitControls)
 * - Отображение центра тяжести (丹田 · Тандэн) с проекцией на татами
 * - Цветовая дифференциация сторон (Левая: Циан/Изумруд, Правая: Алый/Янтарь, Ось: Золото)
 */

function BoneCylinder({ p1, p2, radius = 0.025, color = '#f59e0b', name }) {
  const meshRef = useRef();
  const v1 = useMemo(() => new THREE.Vector3(), []);
  const v2 = useMemo(() => new THREE.Vector3(), []);
  const mid = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);

  useFrame((_, delta) => {
    if (!meshRef.current || !p1 || !p2) return;

    v1.set(p1.x, p1.y, p1.z);
    v2.set(p2.x, p2.y, p2.z);

    // Длина кости в метрах
    const length = v1.distanceTo(v2);
    if (length < 0.01) {
      meshRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;

    // Средняя точка для позиционирования цилиндра
    mid.addVectors(v1, v2).multiplyScalar(0.5);

    // Ориентация цилиндра по направлению вектора кости
    dir.subVectors(v2, v1).normalize();
    quat.setFromUnitVectors(up, dir);

    const lerpRate = Math.min(1.0, delta * 20); // Плавная интерполяция 20 Гц
    meshRef.current.position.lerp(mid, lerpRate);
    meshRef.current.quaternion.slerp(quat, lerpRate);
    meshRef.current.scale.set(1, length, 1);
  });

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <cylinderGeometry args={[radius * 0.9, radius, 1, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.35}
        roughness={0.25}
        metalness={0.7}
      />
    </mesh>
  );
}

function JointSphere({ pos, radius = 0.038, color = '#ffffff', name }) {
  const meshRef = useRef();
  const targetPos = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (!meshRef.current || !pos) return;
    targetPos.set(pos.x, pos.y, pos.z);
    meshRef.current.position.lerp(targetPos, Math.min(1.0, delta * 20));
  });

  return (
    <mesh ref={meshRef} castShadow>
      <sphereGeometry args={[radius, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5}
        roughness={0.15}
        metalness={0.8}
      />
    </mesh>
  );
}

export default function Mocap3DSkeleton({
  skeleton3DData = null,
  detectedStance = 'ready',
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1.0,
  showCenterOfMass = true,
}) {
  const groupRef = useRef();

  const joints = skeleton3DData?.joints;
  const com = skeleton3DData?.centerOfMass;

  // Если данных захвата нет, рендерим базовый фантом стояния в готовности
  const defaultJoints = useMemo(() => {
    return {
      head: { x: 0, y: 1.68, z: 0 },
      neck: { x: 0, y: 1.48, z: 0 },
      spineMid: { x: 0, y: 1.22, z: 0 },
      hipsMid: { x: 0, y: 0.95, z: 0 },
      shoulderL: { x: 0.22, y: 1.44, z: 0 },
      shoulderR: { x: -0.22, y: 1.44, z: 0 },
      elbowL: { x: 0.28, y: 1.15, z: 0.08 },
      elbowR: { x: -0.28, y: 1.15, z: 0.08 },
      wristL: { x: 0.16, y: 0.96, z: 0.22 },
      wristR: { x: -0.16, y: 0.96, z: 0.22 },
      handL: { x: 0.14, y: 0.94, z: 0.26 },
      handR: { x: -0.14, y: 0.94, z: 0.26 },
      hipL: { x: 0.14, y: 0.92, z: 0 },
      hipR: { x: -0.14, y: 0.92, z: 0 },
      kneeL: { x: 0.18, y: 0.48, z: 0.05 },
      kneeR: { x: -0.18, y: 0.48, z: 0.05 },
      ankleL: { x: 0.20, y: 0.08, z: 0 },
      ankleR: { x: -0.20, y: 0.08, z: 0 },
      footL: { x: 0.20, y: 0.02, z: 0.12 },
      footR: { x: -0.20, y: 0.02, z: 0.12 },
    };
  }, []);

  const activeJoints = joints || defaultJoints;
  const activeCom = com || { x: 0, y: 0.82, z: 0 };

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* 1. ОБЪЕМНЫЕ КОСТИ СКЕЛЕТА (3D ЦИЛИНДРЫ) */}
      {BONE_CONNECTIONS_3D.map((bone) => {
        const p1 = activeJoints[bone.from];
        const p2 = activeJoints[bone.to];
        if (!p1 || !p2) return null;

        return (
          <BoneCylinder
            key={bone.id}
            name={bone.id}
            p1={p1}
            p2={p2}
            radius={bone.radius}
            color={bone.color}
          />
        );
      })}

      {/* 2. СУСТАВНЫЕ УЗЛЫ (3D СФЕРЫ) */}
      {/* Голова */}
      {activeJoints.head && (
        <JointSphere pos={activeJoints.head} radius={0.065} color="#ffd700" name="head" />
      )}
      {/* Шея */}
      {activeJoints.neck && (
        <JointSphere pos={activeJoints.neck} radius={0.038} color="#f59e0b" name="neck" />
      )}
      {/* Позвоночник */}
      {activeJoints.spineMid && (
        <JointSphere pos={activeJoints.spineMid} radius={0.036} color="#f59e0b" name="spineMid" />
      )}
      {/* Таз */}
      {activeJoints.hipsMid && (
        <JointSphere pos={activeJoints.hipsMid} radius={0.042} color="#f59e0b" name="hipsMid" />
      )}

      {/* Плечи */}
      {activeJoints.shoulderL && (
        <JointSphere pos={activeJoints.shoulderL} radius={0.038} color="#06b6d4" name="shoulderL" />
      )}
      {activeJoints.shoulderR && (
        <JointSphere pos={activeJoints.shoulderR} radius={0.038} color="#ef4444" name="shoulderR" />
      )}

      {/* Локти */}
      {activeJoints.elbowL && (
        <JointSphere pos={activeJoints.elbowL} radius={0.034} color="#10b981" name="elbowL" />
      )}
      {activeJoints.elbowR && (
        <JointSphere pos={activeJoints.elbowR} radius={0.034} color="#f59e0b" name="elbowR" />
      )}

      {/* Запястья */}
      {activeJoints.wristL && (
        <JointSphere pos={activeJoints.wristL} radius={0.030} color="#10b981" name="wristL" />
      )}
      {activeJoints.wristR && (
        <JointSphere pos={activeJoints.wristR} radius={0.030} color="#ef4444" name="wristR" />
      )}

      {/* Тазобедренные суставы */}
      {activeJoints.hipL && (
        <JointSphere pos={activeJoints.hipL} radius={0.040} color="#06b6d4" name="hipL" />
      )}
      {activeJoints.hipR && (
        <JointSphere pos={activeJoints.hipR} radius={0.040} color="#f59e0b" name="hipR" />
      )}

      {/* Колени */}
      {activeJoints.kneeL && (
        <JointSphere pos={activeJoints.kneeL} radius={0.036} color="#10b981" name="kneeL" />
      )}
      {activeJoints.kneeR && (
        <JointSphere pos={activeJoints.kneeR} radius={0.036} color="#ef4444" name="kneeR" />
      )}

      {/* Лодыжки и стопы */}
      {activeJoints.ankleL && (
        <JointSphere pos={activeJoints.ankleL} radius={0.032} color="#10b981" name="ankleL" />
      )}
      {activeJoints.ankleR && (
        <JointSphere pos={activeJoints.ankleR} radius={0.032} color="#ef4444" name="ankleR" />
      )}
      {activeJoints.footL && (
        <JointSphere pos={activeJoints.footL} radius={0.026} color="#34d399" name="footL" />
      )}
      {activeJoints.footR && (
        <JointSphere pos={activeJoints.footR} radius={0.026} color="#f87171" name="footR" />
      )}

      {/* 3. ЦЕНТР ТЯЖЕСТИ (丹田 · ТАНДЭН) И ОТВЕС НА ТАТАМИ */}
      {showCenterOfMass && activeCom && (
        <group position={[activeCom.x, activeCom.y, activeCom.z]}>
          {/* Сфера Тандэн */}
          <mesh>
            <sphereGeometry args={[0.045, 20, 20]} />
            <meshStandardMaterial
              color="#fbbf24"
              emissive="#f59e0b"
              emissiveIntensity={1.2}
              roughness={0.1}
            />
          </mesh>

          {/* Светящееся кольцо равновесия */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.07, 0.085, 32]} />
            <meshBasicMaterial color="#fbbf24" side={THREE.DoubleSide} />
          </mesh>

          {/* Вертикальный отвес до пола татами */}
          <line>
            <bufferGeometry
              attach="geometry"
              onUpdate={(geom) => {
                geom.setFromPoints([
                  new THREE.Vector3(0, 0, 0),
                  new THREE.Vector3(0, -activeCom.y, 0),
                ]);
              }}
            />
            <lineDashedMaterial
              color="#fbbf24"
              dashSize={0.04}
              gapSize={0.02}
              linewidth={2}
            />
          </line>

          {/* Круг приземления центра тяжести на полу */}
          <mesh position={[0, -activeCom.y + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.1, 0.12, 32]} />
            <meshBasicMaterial color="#fbbf24" side={THREE.DoubleSide} transparent opacity={0.7} />
          </mesh>
        </group>
      )}
    </group>
  );
}
