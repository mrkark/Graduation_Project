import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import HeroFigure from './HeroFigure';
import SakuraPetals from './SakuraPetals';
import './three.css';

// 3D-сцена главной страницы: додзё-атмосфера, стилизованный каратист, падающая сакура.
// Если WebGL недоступен, оборачивающий Canvas сам покажет пустой fallback —
// текстовый контент героя остаётся читаемым поверх.
export default function HeroScene() {
  return (
    <div className="hero-scene">
      <Canvas camera={{ position: [0, 1.2, 4.2], fov: 42 }} dpr={[1, 1.5]}>
        <color attach="background" args={['#1a1613']} />
        <fog attach="fog" args={['#1a1613', 4, 11]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 4, 2]} intensity={1.1} color="#c9a961" />
        <directionalLight position={[-3, 1, -2]} intensity={0.35} color="#8b1a1a" />
        <Suspense fallback={null}>
          <HeroFigure />
          <SakuraPetals />
          <Environment preset="night" />
        </Suspense>
      </Canvas>
    </div>
  );
}
