import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

// Стилизованная "тушь и бумага" фигура каратиста в стойке — собрана из примитивов,
// поскольку внешняя GLB-модель не подключена. Медленное, "текучее" вращение.
export default function HeroFigure() {
  const group = useRef();

  useFrame((state) => {
    group.current.rotation.y = state.clock.elapsedTime * 0.22;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.08;
  });

  const inkMaterial = { color: '#2b2520', roughness: 0.85, metalness: 0.05 };
  const goldMaterial = { color: '#c9a961', roughness: 0.4, metalness: 0.3 };

  return (
    <group ref={group} position={[0, -0.4, 0]}>
      {/* Торс */}
      <mesh position={[0, 0.9, 0]}>
        <capsuleGeometry args={[0.42, 0.9, 8, 16]} />
        <meshStandardMaterial {...inkMaterial} />
      </mesh>
      {/* Голова */}
      <mesh position={[0, 1.85, 0]}>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial {...inkMaterial} />
      </mesh>
      {/* Пояс — золотой акцент */}
      <mesh position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.44, 0.05, 8, 32]} />
        <meshStandardMaterial {...goldMaterial} />
      </mesh>
      {/* Рука в стойке (блок) */}
      <mesh position={[0.55, 1.0, 0.15]} rotation={[0, 0, -0.6]}>
        <capsuleGeometry args={[0.11, 0.7, 6, 12]} />
        <meshStandardMaterial {...inkMaterial} />
      </mesh>
      {/* Вторая рука */}
      <mesh position={[-0.5, 0.7, 0.25]} rotation={[0, 0, 0.9]}>
        <capsuleGeometry args={[0.11, 0.6, 6, 12]} />
        <meshStandardMaterial {...inkMaterial} />
      </mesh>
      {/* Опорная нога */}
      <mesh position={[0.25, -0.15, 0]} rotation={[0, 0, -0.15]}>
        <capsuleGeometry args={[0.15, 0.8, 6, 12]} />
        <meshStandardMaterial {...inkMaterial} />
      </mesh>
      <mesh position={[-0.4, -0.15, 0.3]} rotation={[0.2, 0, 0.15]}>
        <capsuleGeometry args={[0.15, 0.8, 6, 12]} />
        <meshStandardMaterial {...inkMaterial} />
      </mesh>
    </group>
  );
}
