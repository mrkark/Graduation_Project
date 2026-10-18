import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

/**
 * MocapRetargetingBeams — 3D-визуализация кинематического переноса движений
 * от объемного 3D-скелета пользователя на 3D-модель мастера каратэ.
 */
function TransferBeam({ p1, p2, color = '#38bdf8' }) {
  const lineRef = useRef();
  const sphereRef = useRef();
  const progressRef = useRef(Math.random());

  const v1 = useMemo(() => new THREE.Vector3(), []);
  const v2 = useMemo(() => new THREE.Vector3(), []);
  const current = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (!p1 || !p2) return;
    v1.set(p1.x, p1.y, p1.z);
    v2.set(p2.x, p2.y, p2.z);

    // Обновление линии
    if (lineRef.current) {
      const geom = lineRef.current.geometry;
      geom.setFromPoints([v1, v2]);
      if (lineRef.current.material) {
        lineRef.current.material.dashOffset -= delta * 3.5;
      }
    }

    // Анимированная частица энергии переноса
    if (sphereRef.current) {
      progressRef.current = (progressRef.current + delta * 1.4) % 1.0;
      current.lerpVectors(v1, v2, progressRef.current);
      sphereRef.current.position.copy(current);
    }
  });

  return (
    <group>
      <line ref={lineRef}>
        <bufferGeometry />
        <lineDashedMaterial
          color={color}
          dashSize={0.08}
          gapSize={0.04}
          linewidth={2}
          transparent
          opacity={0.65}
        />
      </line>

      {/* Светящаяся частица передачи кинематической энергии */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[0.022, 12, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

export default function MocapRetargetingBeams({
  skeleton3DData,
  sourcePos = [-0.95, 0, 0],
  targetPos = [0.95, 0, 0],
}) {
  const joints = skeleton3DData?.joints;

  // Базовые точки, если данные ещё загружаются
  const defaultJoints = useMemo(() => ({
    head: { x: 0, y: 1.68, z: 0 },
    shoulderL: { x: 0.22, y: 1.44, z: 0 },
    shoulderR: { x: -0.22, y: 1.44, z: 0 },
    handL: { x: 0.26, y: 0.96, z: 0.2 },
    handR: { x: -0.26, y: 0.96, z: 0.2 },
    kneeL: { x: 0.18, y: 0.48, z: 0.05 },
    kneeR: { x: -0.18, y: 0.48, z: 0.05 },
    hipsMid: { x: 0, y: 0.95, z: 0 },
  }), []);

  const j = joints || defaultJoints;

  const beamPairs = useMemo(() => [
    { key: 'head', p: j.head, color: '#ffd700' },
    { key: 'handL', p: j.handL || j.wristL, color: '#06b6d4' },
    { key: 'handR', p: j.handR || j.wristR, color: '#ef4444' },
    { key: 'kneeL', p: j.kneeL, color: '#10b981' },
    { key: 'kneeR', p: j.kneeR, color: '#f59e0b' },
    { key: 'hipsMid', p: j.hipsMid, color: '#fbbf24' },
  ], [j]);

  return (
    <group>
      {/* 3D Подписи над аватарами */}
      <Text
        position={[sourcePos[0], 2.05, sourcePos[2]]}
        fontSize={0.11}
        color="#fbbf24"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.012}
        outlineColor="#000000"
      >
        ⚡ 3D СКЕЛЕТ ЗАХВАТА
      </Text>

      <Text
        position={[targetPos[0], 2.05, targetPos[2]]}
        fontSize={0.11}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.012}
        outlineColor="#000000"
      >
        🥋 3D МОДЕЛЬ МАСТЕРА
      </Text>

      <Text
        position={[(sourcePos[0] + targetPos[0]) / 2, 2.15, sourcePos[2]]}
        fontSize={0.085}
        color="#10b981"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.01}
        outlineColor="#000000"
      >
        ── ПЕРЕНОС ДВИЖЕНИЙ 60 FPS ➔ ──
      </Text>

      {/* Лучи передачи движений между суставами */}
      {beamPairs.map(({ key, p, color }) => {
        if (!p) return null;
        const pSource = { x: sourcePos[0] + p.x, y: sourcePos[1] + p.y, z: sourcePos[2] + p.z };
        const pTarget = { x: targetPos[0] + p.x, y: targetPos[1] + p.y, z: targetPos[2] + p.z };
        return (
          <TransferBeam
            key={key}
            p1={pSource}
            p2={pTarget}
            color={color}
          />
        );
      })}
    </group>
  );
}
