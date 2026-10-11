import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';

/**
 * Просторное традиционное японское Додзё (Honbu Dojo)
 * Высокодетализированная PBR 3D модель dojo.glb:
 * - 18x18 метров полированный пол из кипариса Хиноки
 * - 10x10 метров боевой настил татами с традиционной окантовкой Хэри и кругом Эмбусэн
 * - Почётная ниша Камидза (Токонома) со свитком «空手道» / «松濤館», мечами боккэн и катана
 * - Раздвижные стены Сёдзи с решеткой Кумико и рисовой бумагой васи
 * - Тренировочные столбы Макивара с обмоткой канатом
 * - Потолочные массивные кедровые балки
 * - Японские напольные фонари Андон с тёплым светом
 */
export default function TraditionalDojo(props) {
  const { scene } = useGLTF('/models/dojo.glb');

  // Клонируем сцену для независимого рендеринга и настройки материалов/теней
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      // Исключаем любые остаточные персонажи/скелеты, а также круги эмбусэна под ногами
      const lowerName = (child.name || '').toLowerCase();
      if (
        lowerName.includes('karateka') ||
        lowerName.includes('armature') ||
        lowerName.includes('spine') ||
        lowerName.includes('neck') ||
        lowerName.includes('head') ||
        lowerName.includes('embusen') ||
        lowerName.includes('circle')
      ) {
        child.visible = false;
        return;
      }

      // Отключаем встроенные в dojo.glb сырые точечные источники света,
      // чтобы настроить физически точное освещение через React Three Fiber
      if (child.isLight) {
        child.visible = false;
        return;
      }

      if (child.isMesh) {
        // Стены, потолочные балки, перекрытия и треки не должны отбрасывать резкие полосатые тени на татами
        if (
          lowerName.includes('ceiling') ||
          lowerName.includes('beam') ||
          lowerName.includes('track') ||
          lowerName.includes('wall') ||
          lowerName.includes('pillar') ||
          lowerName.includes('floor') ||
          lowerName.includes('tatami')
        ) {
          child.castShadow = false;
        } else {
          child.castShadow = true;
        }
        child.receiveShadow = true;

        if (child.material) {
          child.material.side = THREE.FrontSide;

          // Теплое аутентичное свечение подвесных потолочных фонарей и напольных андонов
          if (lowerName.includes('lantern_washi') || lowerName.includes('andon_light')) {
            child.material.emissive = new THREE.Color('#ffe4b5');
            child.material.emissiveIntensity = 1.0;
            child.material.roughness = 0.9;
          } else if (lowerName.includes('lantern_') || lowerName.includes('ceiling_')) {
            child.material.roughness = 0.7;
          }

          // Устранение мерцания текстур пола (Z-Fighting) при изменении ракурса камеры
          if (lowerName.includes('floor_hinoki') || lowerName.includes('hinoki')) {
            child.renderOrder = 0;
            child.material.polygonOffset = true;
            child.material.polygonOffsetFactor = 3;
            child.material.polygonOffsetUnits = 3;
            child.material.depthWrite = true;
          } else if (lowerName.includes('tatami_base') || lowerName.includes('tatami')) {
            child.renderOrder = 1;
            child.material.polygonOffset = true;
            child.material.polygonOffsetFactor = 1;
            child.material.polygonOffsetUnits = 1;
            child.material.depthWrite = true;
          } else if (lowerName.includes('tatami_border')) {
            child.renderOrder = 2;
            child.material.polygonOffset = true;
            child.material.polygonOffsetFactor = -1;
            child.material.polygonOffsetUnits = -1;
            child.material.depthWrite = true;
          }
        }
      }
    });
    return clone;
  }, [scene]);

  return (
    <group {...props}>
      <primitive object={clonedScene} />

      {/* ================= МЯГКОЕ АТМОСФЕРНОЕ ОСВЕЩЕНИЕ ДОДЗЁ ================= */}
      {/* 1. Центральный потолочный светильник над зоной тренировки */}
      <pointLight position={[0, 4.30, 0.8]} intensity={0.9} distance={12} decay={1.4} color="#fff2db" />

      {/* 2. Подсветка ниши Камидза (Токонома со свитком «松濤館» и катанами) */}
      <pointLight position={[0, 3.80, -6.2]} intensity={0.8} distance={8} decay={1.4} color="#ffe8cc" />

      {/* 3. Тёплые боковые акценты у фонарей андон */}
      <pointLight position={[-4.5, 3.50, 0]} intensity={0.4} distance={9} decay={1.5} color="#ffd8a8" />
      <pointLight position={[4.5, 3.50, 0]} intensity={0.4} distance={9} decay={1.5} color="#ffd8a8" />
    </group>
  );
}

useGLTF.preload('/models/dojo.glb');

