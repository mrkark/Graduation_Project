import assert from 'node:assert';
import {
  computeAvatarPlacement,
  normalizeBunkaiEpisode,
  HEIAN_SHODAN_BUNKAI_18_STEPS,
} from '../src/three/bunkaiScenarioEngine.js';

console.log('=== TEST SUITE: Bunkai Model End Rotation (Yaw) & Live Preview Calibration ===\n');

// 1. Тест нормализации эпизода с явными toriEndAngleDeg и ukeEndAngleDeg
console.log('--- Тест 1: Извлечение и нормализация конечных углов поворота (End Yaw) ---');
const rawEpWithAngles = {
  stepNumber: 1,
  title: 'Поворот и блок',
  toriEndAngleDeg: 90,
  ukeEndAngleDeg: -90,
  participants: [
    { role: 'tori', clipName: 'tech_gedan_barai_left' },
    { role: 'uke1', clipName: 'tech_oi_zuki_right' },
  ],
};

const norm1 = normalizeBunkaiEpisode(rawEpWithAngles);
assert.strictEqual(norm1.toriEndAngleDeg, 90, 'toriEndAngleDeg должен быть 90°');
assert.strictEqual(norm1.ukeEndAngleDeg, -90, 'ukeEndAngleDeg должен быть -90°');
assert(Math.abs(norm1.toriEndYaw - Math.PI / 2) < 0.001, 'toriEndYaw должен соответствовать PI/2 радиан');
assert(Math.abs(norm1.ukeEndYaw - (-Math.PI / 2)) < 0.001, 'ukeEndYaw должен соответствовать -PI/2 радиан');
console.log('✓ Тест 1 пройден: конечное значение поворота точно нормализуется в радианы и градусы.\n');

// 2. Тест прямого задания конечного поворота через customToriYawDeg и customUkeYawDeg в computeAvatarPlacement
console.log('--- Тест 2: Мгновенное применение конечного угла поворота (Live Preview) ---');
const placementCustom = computeAvatarPlacement({
  episode: HEIAN_SHODAN_BUNKAI_18_STEPS[0],
  customToriYawDeg: 45,
  customUkeYawDeg: 135,
});

const toriYawDeg = Math.round((placementCustom.rotTori[1] * 180) / Math.PI);
const ukeYawDeg = Math.round((placementCustom.rotUke1[1] * 180) / Math.PI);

assert.strictEqual(toriYawDeg, 45, `Тори должен иметь поворот ровно 45°, получено: ${toriYawDeg}°`);
assert.strictEqual(ukeYawDeg, 135, `Укэ должен иметь поворот ровно 135°, получено: ${ukeYawDeg}°`);
console.log(`✓ Тест 2 пройден: Тори развернут в ${toriYawDeg}°, Укэ развернут в ${ukeYawDeg}° (Live Preview работает моментально).\n`);

// 3. Тест круговых разворотов: 180°, -90°, +90°
console.log('--- Тест 3: Калибровка круговых и перпендикулярных разворотов (90°, 180°, -90°) ---');
const testAngles = [
  { tori: 180, uke: 0 },
  { tori: -90, uke: 90 },
  { tori: 35, uke: -35 },
];

testAngles.forEach(({ tori, uke }) => {
  const p = computeAvatarPlacement({
    episode: HEIAN_SHODAN_BUNKAI_18_STEPS[2],
    customToriYawDeg: tori,
    customUkeYawDeg: uke,
  });
  let resTori = Math.round((p.rotTori[1] * 180) / Math.PI);
  let resUke = Math.round((p.rotUke1[1] * 180) / Math.PI);
  if (resTori === -180 && tori === 180) resTori = 180;
  if (resUke === -180 && uke === 180) resUke = 180;
  assert.strictEqual(resTori, tori, `Тори должен быть развернут под ${tori}°, получено: ${resTori}°`);
  assert.strictEqual(resUke, uke, `Укэ должен быть развернут под ${uke}°, получено: ${resUke}°`);
  console.log(`  ✓ Угол [Тори: ${tori}°, Укэ: ${uke}°] успешно рассчитан: rotTori=[${p.rotTori.map(n => n.toFixed(2)).join(', ')}], rotUke=[${p.rotUke1.map(n => n.toFixed(2)).join(', ')}]`);
});

console.log('\n======================================================');
console.log('ВСЕ ТЕСТЫ КОНЕЧНОГО ПОВОРОТА И ЖИВОГО ПРЕДПРОСМОТРА ПРОЙДЕНЫ!');
console.log('======================================================');
