import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

/**
 * Вспомогательный 3D-компонент стрелки направления
 */
function DirectionArrow3D({ position, yaw, color = '#2563eb', length = 0.75, radius = 0.022, headLength = 0.16, headRadius = 0.055 }) {
  const rotation = useMemo(() => [0, yaw, 0], [yaw]);
  const shaftLength = length - headLength;

  return (
    <group position={position} rotation={rotation}>
      {/* Стержень стрелки */}
      <mesh position={[0, 0, shaftLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, shaftLength, 12]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.7} emissive={color} emissiveIntensity={0.35} />
      </mesh>
      {/* Наконечник стрелки */}
      <mesh position={[0, 0, shaftLength + headLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[headRadius, headLength, 12]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.8} emissive={color} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

/**
 * Вспомогательный 3D-компонент линии взгляда и соосности
 */
function LineOfSight3D({ posTori, posUke, isEvaded }) {
  const linePoints = useMemo(() => {
    return [
      new THREE.Vector3(posUke[0], 1.05, posUke[2]),
      new THREE.Vector3(posTori[0], 1.05, posTori[2]),
    ];
  }, [posTori, posUke]);

  const lineGeo = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(linePoints);
  }, [linePoints]);

  if (!isEvaded) return null;

  return (
    <group>
      <line geometry={lineGeo}>
        <lineBasicMaterial color="#10b981" linewidth={2} transparent opacity={0.65} />
      </line>
    </group>
  );
}

/**
 * 3D-компонент системы координат Бункай (Bunkai 3D Coordinate System)
 * Отображение канонических осей: X (красная), Y (зеленая), Z (синяя)
 * и вектор для поворотов: круговая дуга вращения (+Yaw) и направляющие векторы поворота
 */
function BunkaiCoordinateSystem3D({
  yawTori = 0,
  yawUke = Math.PI,
  startYawTori = 0,
  endYawTori = 0,
  startYawUke = Math.PI,
  endYawUke = Math.PI,
}) {
  return (
    <group name="bunkai-coordinate-system">
      {/* 1. Центр (Origin 0,0,0) */}
      <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.06, 0.09, 32]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.65} side={THREE.DoubleSide} />
      </mesh>

      {/* 2. Ось X (Красная — Латеральная ось / Боковое смещение) */}
      <group>
        <mesh position={[0, 0.006, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.008, 0.008, 3.8, 12]} />
          <meshStandardMaterial color="#ef4444" roughness={0.3} metalness={0.7} emissive="#ef4444" emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[1.95, 0.006, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.035, 0.12, 12]} />
          <meshStandardMaterial color="#ef4444" roughness={0.2} metalness={0.8} emissive="#ef4444" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[-1.95, 0.006, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.035, 0.12, 12]} />
          <meshStandardMaterial color="#ef4444" roughness={0.2} metalness={0.8} emissive="#ef4444" emissiveIntensity={0.5} />
        </mesh>
        <Html position={[2.08, 0.04, 0]} center distanceFactor={10} zIndexRange={[10, 0]}>
          <span
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              color: '#fca5a5',
              border: '1px solid #ef4444',
              padding: '1px 5px',
              borderRadius: 3,
              fontSize: '9px',
              fontWeight: 700,
              fontFamily: 'monospace',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            +X
          </span>
        </Html>
      </group>

      {/* 3. Ось Y (Зеленая — Вертикальная ось / Высота) */}
      <group>
        <mesh position={[0, 0.85, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 1.7, 12]} />
          <meshStandardMaterial color="#22c55e" roughness={0.3} metalness={0.7} emissive="#22c55e" emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[0, 1.75, 0]}>
          <coneGeometry args={[0.035, 0.12, 12]} />
          <meshStandardMaterial color="#22c55e" roughness={0.2} metalness={0.8} emissive="#22c55e" emissiveIntensity={0.5} />
        </mesh>
        <Html position={[0, 1.86, 0]} center distanceFactor={10} zIndexRange={[10, 0]}>
          <span
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              color: '#86efac',
              border: '1px solid #22c55e',
              padding: '1px 5px',
              borderRadius: 3,
              fontSize: '9px',
              fontWeight: 700,
              fontFamily: 'monospace',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            +Y
          </span>
        </Html>
      </group>

      {/* 4. Ось Z (Синяя — Продольная ось / Директриса атаки) */}
      <group>
        <mesh position={[0, 0.006, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 4.2, 12]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.3} metalness={0.7} emissive="#3b82f6" emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[0, 0.006, 2.55]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.035, 0.12, 12]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.2} metalness={0.8} emissive="#3b82f6" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0, 0.006, -1.75]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.035, 0.12, 12]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.2} metalness={0.8} emissive="#3b82f6" emissiveIntensity={0.5} />
        </mesh>
        <Html position={[0, 0.04, 2.68]} center distanceFactor={10} zIndexRange={[10, 0]}>
          <span
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              color: '#93c5fd',
              border: '1px solid #3b82f6',
              padding: '1px 5px',
              borderRadius: 3,
              fontSize: '9px',
              fontWeight: 700,
              fontFamily: 'monospace',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            +Z
          </span>
        </Html>
      </group>

      {/* 5. Вектор поворота вокруг вертикальной оси Y (Yaw Rotation Arc) */}
      <group position={[0, 0.007, 0]}>
        {/* Круговая дуга поворота (радиус 0.55м, угол 135°) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.55, 0.007, 8, 36, Math.PI * 0.75]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.3} metalness={0.7} emissive="#f59e0b" emissiveIntensity={0.5} />
        </mesh>
        {/* Наконечник стрелки на конце дуги поворота */}
        <mesh
          position={[Math.cos(Math.PI * 0.75) * 0.55, 0, -Math.sin(Math.PI * 0.75) * 0.55]}
          rotation={[0, Math.PI * 0.75, 0]}
        >
          <coneGeometry args={[0.026, 0.08, 12]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.2} metalness={0.8} emissive="#f59e0b" emissiveIntensity={0.7} />
        </mesh>
        <Html position={[0.42, 0.04, -0.22]} center distanceFactor={10} zIndexRange={[10, 0]}>
          <span
            style={{
              background: 'rgba(15, 23, 42, 0.88)',
              color: '#fde68a',
              border: '1px solid #f59e0b',
              padding: '1px 6px',
              borderRadius: 3,
              fontSize: '9px',
              fontWeight: 700,
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            ⟲ Вектор поворота (+Yaw)
          </span>
        </Html>
      </group>

      {/* 6. Направляющий вектор ориентации Тори (Синий) */}
      <group rotation={[0, yawTori, 0]}>
        <mesh position={[0, 0.008, 0.35]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.58, 12]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.3} metalness={0.7} emissive="#3b82f6" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0, 0.008, 0.68]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.025, 0.09, 12]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.2} metalness={0.8} emissive="#3b82f6" emissiveIntensity={0.6} />
        </mesh>
        <Html position={[0, 0.04, 0.74]} center distanceFactor={10} zIndexRange={[10, 0]}>
          <span
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              color: '#93c5fd',
              border: '1px solid #3b82f6',
              padding: '1px 5px',
              borderRadius: 3,
              fontSize: '9px',
              fontWeight: 700,
              fontFamily: 'monospace',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            Тори {Math.round((yawTori * 180) / Math.PI)}°
          </span>
        </Html>
      </group>

      {/* 7. Направляющий вектор ориентации Укэ (Фиолетовый) */}
      <group rotation={[0, yawUke, 0]}>
        <mesh position={[0, 0.008, 0.35]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.58, 12]} />
          <meshStandardMaterial color="#c084fc" roughness={0.3} metalness={0.7} emissive="#c084fc" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0, 0.008, 0.68]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.025, 0.09, 12]} />
          <meshStandardMaterial color="#c084fc" roughness={0.2} metalness={0.8} emissive="#c084fc" emissiveIntensity={0.6} />
        </mesh>
        <Html position={[0, 0.04, 0.74]} center distanceFactor={10} zIndexRange={[10, 0]}>
          <span
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              color: '#e9d5ff',
              border: '1px solid #c084fc',
              padding: '1px 5px',
              borderRadius: 3,
              fontSize: '9px',
              fontWeight: 700,
              fontFamily: 'monospace',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            Укэ {Math.round((yawUke * 180) / Math.PI)}°
          </span>
        </Html>
      </group>

      {/* 8. Индикатор активного разворота */}
      {(() => {
        const deltaTori = Math.atan2(Math.sin(endYawTori - startYawTori), Math.cos(endYawTori - startYawTori));
        const deltaUke = Math.atan2(Math.sin(endYawUke - startYawUke), Math.cos(endYawUke - startYawUke));
        const hasToriTurn = Math.abs(deltaTori) > 0.08;
        const hasUkeTurn = Math.abs(deltaUke) > 0.08;

        if (!hasToriTurn && !hasUkeTurn) return null;

        const activeDelta = hasToriTurn ? deltaTori : deltaUke;
        const activeColor = hasToriTurn ? '#38bdf8' : '#a855f7';
        const activeRole = hasToriTurn ? 'Тори' : 'Укэ';
        const turnDeg = Math.round((Math.abs(activeDelta) * 180) / Math.PI);

        return (
          <group position={[0, 0.012, 0]}>
            <Html position={[0, 0.06, 0.94]} center distanceFactor={10} zIndexRange={[10, 0]}>
              <span
                style={{
                  background: 'rgba(30, 27, 75, 0.90)',
                  color: '#e0e7ff',
                  border: `1.5px solid ${activeColor}`,
                  padding: '2px 7px',
                  borderRadius: 4,
                  fontSize: '10px',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                }}
              >
                ⤾ Разворот {activeRole}: {turnDeg}° {activeDelta > 0 ? '(влево)' : '(вправо)'}
              </span>
            </Html>
          </group>
        );
      })()}
    </group>
  );
}

/**
 * Стрелка стопы на татами
 */
function FootArrow3D({ position, yaw, color = '#10b981', label = '' }) {
  const rotation = useMemo(() => [0, yaw, 0], [yaw]);

  return (
    <group position={position} rotation={rotation}>
      {/* Плоская стрелка подошвы */}
      <mesh position={[0, 0.015, 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.07, 0.22]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
      {/* Треугольный носок */}
      <mesh position={[0, 0.016, 0.27]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.055, 0.09, 3]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} />
      </mesh>
    </group>
  );
}

/**
 * Визуальные манипуляторы и индикаторы Бункая в 3D сцене:
 * 1. Индикатор направления корпуса (Chest vector): СИНИЙ для Тори (Атакующий), БЕЛЫЙ для Укэ (Защищающийся)
 * 2. Индикаторы направления стоп (Foot alignment vector)
 * 3. Исходная линия направления атаки (Directrix) — не поворачивается при уходе Укэ!
 * 4. Линия боевой дистанции с бейджем метров (Ма-ай)
 * 5. Точка контакта и зона анти-проникновения
 * 6. Диагностический статус боя
 */
export default function BunkaiVisualAids({
  placement,
  showCoordinateSystem = true,
  showTorsoVector = true,
  showFootVectors = true,
  showAttackLine = true,
  showDistanceLine = true,
  showContactPoint = true,
  showSafeBoundaries = true,
  contactPoint = null,
  isContactActive = false,
  bodyInteraction = null,
}) {
  if (!placement) return null;

  const posTori = placement.posTori || [0, 0, 0];
  const posUke = placement.posUke1 || [0, 0, 1.45];
  const yawTori = placement.angles?.toriYaw ?? placement.rotTori?.[1] ?? 0;
  const yawUke = placement.angles?.uke1Yaw ?? placement.rotUke1?.[1] ?? Math.PI;

  const footTori = placement.footAnglesTori || { lead: yawTori, rear: yawTori + 0.78, spec: {} };
  const footUke = placement.footAnglesUke || { lead: yawUke, rear: yawUke - 0.78, spec: {} };

  const distMeters = placement.finalDist || 1.45;
  const midX = (posTori[0] + posUke[0]) / 2;
  const midZ = (posTori[2] + posUke[2]) / 2;

  // Относительные координаты стоп для Тори и Укэ
  const stanceWidthT = footTori.spec?.feetWidth || 0.35;
  const stanceDistT = (footTori.spec?.feetDistance || 1.25) * 0.35;
  const stanceWidthU = footUke.spec?.feetWidth || 0.35;
  const stanceDistU = (footUke.spec?.feetDistance || 1.25) * 0.35;

  const cosT = Math.cos(yawTori);
  const sinT = Math.sin(yawTori);
  const cosU = Math.cos(yawUke);
  const sinU = Math.sin(yawUke);

  const toriLeadPos = [
    posTori[0] - sinT * stanceDistT - cosT * (stanceWidthT / 2),
    0.01,
    posTori[2] + cosT * stanceDistT - sinT * (stanceWidthT / 2),
  ];
  const toriRearPos = [
    posTori[0] + sinT * stanceDistT + cosT * (stanceWidthT / 2),
    0.01,
    posTori[2] - cosT * stanceDistT + sinT * (stanceWidthT / 2),
  ];

  const ukeLeadPos = [
    posUke[0] - sinU * stanceDistU - cosU * (stanceWidthU / 2),
    0.01,
    posUke[2] + cosU * stanceDistU - sinU * (stanceWidthU / 2),
  ];
  const ukeRearPos = [
    posUke[0] + sinU * stanceDistU + cosU * (stanceWidthU / 2),
    0.01,
    posUke[2] - cosU * stanceDistU + sinU * (stanceWidthU / 2),
  ];

  // Директриса атаки (исходный неизменный вектор атаки Синего Тори)
  const directrix = placement.attackDirectrix;
  const attackPoints = useMemo(() => {
    if (directrix && directrix.start && directrix.end) {
      return [
        new THREE.Vector3(directrix.start[0], directrix.start[1], directrix.start[2]),
        new THREE.Vector3(directrix.end[0], directrix.end[1], directrix.end[2]),
      ];
    }
    return [
      new THREE.Vector3(posTori[0], 0.95, posTori[2]),
      new THREE.Vector3(posTori[0], 0.95, posTori[2] + 2.2),
    ];
  }, [directrix, posTori]);

  const attackLineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(attackPoints);
    return geo;
  }, [attackPoints]);

  // Линия смещения ухода Тай-сабаки (если Укэ сошел с линии атаки)
  const isEvaded = Boolean(placement.isEvaded);
  const evasionPoints = useMemo(() => {
    if (!isEvaded || !directrix) return null;
    // Ближайшая точка на линии атаки к позиции Укэ
    const p1 = new THREE.Vector3(directrix.start[0], 0.03, posUke[2]);
    const p2 = new THREE.Vector3(posUke[0], 0.03, posUke[2]);
    return [p1, p2];
  }, [isEvaded, directrix, posUke]);

  const evasionLineGeo = useMemo(() => {
    if (!evasionPoints) return null;
    return new THREE.BufferGeometry().setFromPoints(evasionPoints);
  }, [evasionPoints]);

  // Линия боевой дистанции на полу
  const distPoints = useMemo(() => {
    return [
      new THREE.Vector3(posTori[0], 0.02, posTori[2]),
      new THREE.Vector3(posUke[0], 0.02, posUke[2]),
    ];
  }, [posTori, posUke]);

  const distLineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(distPoints);
    return geo;
  }, [distPoints]);

  // Определение цвета точки контакта:
  // Зеленый: блок перехватил атаку
  // Красный: удар нанесен в корпус/голову
  // Янтарный: в процессе сближения / подготовке
  const isBlock = bodyInteraction?.isBlockIntercept;
  const isHit = bodyInteraction?.isStrikeHit;
  const contactColor = isBlock ? '#22c55e' : (isHit ? '#ef4444' : (isContactActive ? '#f59e0b' : '#38bdf8'));
  const contactEmissive = isBlock ? '#15803d' : (isHit ? '#b91c1c' : (isContactActive ? '#d97706' : '#0284c7'));

  return (
    <group name="bunkai-visual-aids">
      {/* 0. Пространственная 3D-система координат Бункай (Оси X/Y/Z и вектор поворотов) */}
      {showCoordinateSystem && (
        <BunkaiCoordinateSystem3D
          posTori={posTori}
          posUke={posUke}
          yawTori={yawTori}
          yawUke={yawUke}
          startYawTori={placement.startRotTori?.[1] ?? yawTori}
          endYawTori={placement.rotTori?.[1] ?? yawTori}
          startYawUke={placement.startRotUke1?.[1] ?? yawUke}
          endYawUke={placement.rotUke1?.[1] ?? yawUke}
          isEvaded={isEvaded}
          isFacingOpponent={placement?.coordinates?.uke1?.isFacingOpponent}
        />
      )}

      {/* Линия прямого взгляда и соосности при уходе с линии атаки */}
      {showCoordinateSystem && isEvaded && (
        <LineOfSight3D posTori={posTori} posUke={posUke} isEvaded={isEvaded} />
      )}

      {/* 1. Индикаторы направления корпуса (Torso vector) */}
      {showTorsoVector && (
        <>
          {/* Вектор Тори (Синий — Атакующий): королевский синий #2563eb */}
          <DirectionArrow3D
            position={[posTori[0], 1.05, posTori[2]]}
            yaw={yawTori}
            color="#2563eb"
            length={0.80}
          />
          {/* Вектор Укэ (Белый — Защищающийся): белый/платиновый #f8fafc */}
          <DirectionArrow3D
            position={[posUke[0], 1.05, posUke[2]]}
            yaw={yawUke}
            color="#f8fafc"
            length={0.80}
          />
        </>
      )}

      {/* 2. Индикаторы направления стоп на татами */}
      {showFootVectors && (
        <>
          {/* Стопы Тори: передняя (синяя) и задняя (лазурная) */}
          <FootArrow3D position={toriLeadPos} yaw={footTori.lead} color="#3b82f6" label="Передняя Тори" />
          <FootArrow3D position={toriRearPos} yaw={footTori.rear} color="#1d4ed8" label="Задняя Тори" />

          {/* Стопы Укэ: передняя (белая) и задняя (серебряная) */}
          <FootArrow3D position={ukeLeadPos} yaw={footUke.lead} color="#f8fafc" label="Передняя Укэ" />
          <FootArrow3D position={ukeRearPos} yaw={footUke.rear} color="#cbd5e1" label="Задняя Укэ" />
        </>
      )}

      {/* 3. Исходная линия направления атаки (директриса Синего Тори) */}
      {showAttackLine && (
        <group>
          <line geometry={attackLineGeo}>
            <lineBasicMaterial color="#06b6d4" linewidth={2} transparent opacity={0.85} />
          </line>
          {/* Бейдж директрисы атаки */}
          <Html position={[attackPoints[1].x, 0.95, attackPoints[1].z]} center distanceFactor={9} zIndexRange={[10, 0]}>
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.85)',
                color: '#38bdf8',
                border: '1px solid #0284c7',
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: '10px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              Линия атаки Тори (направление зафиксировано)
            </div>
          </Html>
        </group>
      )}

      {/* Линия смещения ухода Тай-сабаки */}
      {isEvaded && evasionLineGeo && (
        <group>
          <line geometry={evasionLineGeo}>
            <lineBasicMaterial color="#a855f7" linewidth={2} transparent opacity={0.80} />
          </line>
          <Html position={[(posUke[0] + (directrix?.start?.[0] || 0)) / 2, 0.06, posUke[2]]} center distanceFactor={8} zIndexRange={[10, 0]}>
            <div
              style={{
                background: 'rgba(88, 28, 135, 0.90)',
                color: '#f3e8ff',
                border: '1px solid #a855f7',
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: '10px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              Тай-сабаки: смещение {(placement.lateralOffsetMeters || 0).toFixed(2)}м
            </div>
          </Html>
        </group>
      )}

      {/* 4. Линия боевой дистанции с бейджем на татами */}
      {showDistanceLine && (
        <group>
          <line geometry={distLineGeo}>
            <lineBasicMaterial color="#38bdf8" linewidth={2} transparent opacity={0.75} />
          </line>
          <Html position={[midX, 0.08, midZ]} center distanceFactor={8} zIndexRange={[10, 0]}>
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.90)',
                color: '#38bdf8',
                border: '1px solid #0284c7',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: '11px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
              }}
            >
              Дистанция Ма-ай: {distMeters.toFixed(2)} м
            </div>
          </Html>
        </group>
      )}

      {/* 5. Точка физического контакта с эффектом импакта */}
      {showContactPoint && (isContactActive || bodyInteraction?.validContact) && contactPoint && (
        <group position={contactPoint}>
          {/* Яркая сфера соприкосновения */}
          <mesh>
            <sphereGeometry args={[0.055, 16, 16]} />
            <meshStandardMaterial
              color={contactColor}
              emissive={contactEmissive}
              emissiveIntensity={1.25}
              roughness={0.2}
              metalness={0.8}
            />
          </mesh>
          {/* Горизонтальное кольцо импакта */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.07, 0.12, 24]} />
            <meshBasicMaterial
              color={contactColor}
              transparent
              opacity={0.85}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Вертикальное кольцо импакта */}
          <mesh rotation={[0, 0, 0]}>
            <ringGeometry args={[0.06, 0.10, 24]} />
            <meshBasicMaterial
              color={contactColor}
              transparent
              opacity={0.70}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}

      {/* 6. Границы безопасности анти-проникновения (Torso Clearance 0.52м) */}
      {showSafeBoundaries && (
        <>
          {/* Зона Тори (Синий) */}
          <mesh position={[posTori[0], 0.008, posTori[2]]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.26, 0.28, 32]} />
            <meshBasicMaterial color="#2563eb" transparent opacity={0.45} side={THREE.DoubleSide} />
          </mesh>
          {/* Зона Укэ (Белый) */}
          <mesh position={[posUke[0], 0.008, posUke[2]]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.26, 0.28, 32]} />
            <meshBasicMaterial color="#f8fafc" transparent opacity={0.45} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
    </group>
  );
}
