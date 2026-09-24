import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import './three.css';

// 3D-граф: ката в центре → последовательности → движения → бункай.
// Клик по узлу-движению вызывает onSelectMovement (используется для перемотки видео).
function Node({ position, label, color, size = 0.14, onClick, active }) {
  const [hovered, setHovered] = useState(false);
  return (
    <group position={position}>
      <mesh
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        scale={hovered || active ? 1.25 : 1}
      >
        <sphereGeometry args={[size, 20, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hovered || active ? 0.6 : 0.15} roughness={0.5} />
      </mesh>
      {(hovered || active) && (
        <Html distanceFactor={8} style={{ pointerEvents: 'none' }}>
          <div className="graph-label">{label}</div>
        </Html>
      )}
    </group>
  );
}

export default function KataTreeGraph({ kata, activeMovementId, onSelectMovement }) {
  const layout = useMemo(() => {
    const sequences = kata?.sequences || [];
    const nodes = [];
    const lines = [];
    const root = [0, 1.6, 0];
    nodes.push({ id: 'root', position: root, label: kata?.name || 'Ката', color: '#c9a961', size: 0.22 });

    sequences.forEach((seq, si) => {
      const angleSeq = (si / Math.max(sequences.length, 1)) * Math.PI * 2;
      const seqPos = [Math.cos(angleSeq) * 1.6, 0.6, Math.sin(angleSeq) * 1.6];
      nodes.push({ id: `seq-${seq.id}`, position: seqPos, label: seq.name, color: '#8b1a1a', size: 0.15 });
      lines.push([root, seqPos]);

      const movements = seq.movements || [];
      movements.forEach((mv, mi) => {
        const angleMv = angleSeq + (mi - (movements.length - 1) / 2) * 0.35;
        const mvPos = [Math.cos(angleMv) * 2.9, -0.5, Math.sin(angleMv) * 2.9];
        nodes.push({
          id: `mv-${mv.id}`,
          movementId: mv.id,
          position: mvPos,
          label: mv.name,
          color: '#e8dcc4',
          size: 0.12,
        });
        lines.push([seqPos, mvPos]);

        const bunkaiList = mv.bunkaiList || [];
        bunkaiList.forEach((b, bi) => {
          const angleB = angleMv + (bi - (bunkaiList.length - 1) / 2) * 0.22;
          const bPos = [Math.cos(angleB) * 4.1, -1.7, Math.sin(angleB) * 4.1];
          nodes.push({ id: `b-${b.id}`, label: b.title, color: '#ddc48b', size: 0.08 });
          lines.push([mvPos, bPos]);
        });
      });
    });

    return { nodes, lines };
  }, [kata]);

  return (
    <div className="kata-graph">
      <Canvas camera={{ position: [0, 2, 7], fov: 45 }}>
        <color attach="background" args={['#100d0b']} />
        <ambientLight intensity={0.6} />
        <pointLight position={[4, 4, 4]} intensity={0.8} color="#c9a961" />
        {layout.lines.map((pts, i) => (
          <Line key={i} points={pts} color="#3a332b" lineWidth={1} transparent opacity={0.6} />
        ))}
        {layout.nodes.map((n) => (
          <Node
            key={n.id}
            position={n.position}
            label={n.label}
            color={n.color}
            size={n.size}
            active={n.movementId === activeMovementId}
            onClick={() => n.movementId && onSelectMovement?.(n.movementId)}
          />
        ))}
        <OrbitControls enablePan={false} minDistance={3} maxDistance={12} autoRotate autoRotateSpeed={0.4} />
      </Canvas>
    </div>
  );
}
