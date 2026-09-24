import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Лепестки сакуры — простая частичная система, медленно падающая и покачивающаяся,
// создаёт атмосферу без резких "поп"-эффектов.
export default function SakuraPetals({ count = 120 }) {
  const meshRef = useRef();

  const { positions, speeds, sways } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const sways = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 1] = Math.random() * 14 - 4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 14;
      speeds[i] = 0.35 + Math.random() * 0.4;
      sways[i] = Math.random() * Math.PI * 2;
    }
    return { positions, speeds, sways };
  }, [count]);

  useFrame((state, delta) => {
    const geo = meshRef.current.geometry;
    const pos = geo.attributes.position;
    for (let i = 0; i < count; i++) {
      let y = pos.getY(i) - speeds[i] * delta;
      sways[i] += delta * 0.6;
      let x = pos.getX(i) + Math.sin(sways[i]) * 0.004;
      if (y < -6) y = 8;
      pos.setY(i, y);
      pos.setX(i, x);
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#e6a6a6" size={0.09} transparent opacity={0.75} depthWrite={false} />
    </points>
  );
}
