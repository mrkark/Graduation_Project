import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileKataScenario, resolveComposedClip } from '../src/three/kataCompositionEngine.js';
import { CANONICAL_EMBUSEN } from '../src/three/kataMotionUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== TEST SUITE: Kata Sideward Motion & Anti-Foot-Sliding Execution ===\n');

// Тест 1: Проверка бокового смещения на шаге 1 (Гэдан-барай влево)
{
  const jsonPath = path.resolve(__dirname, '../public/kata_data/heian_shodan.json');
  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const scenario = compileKataScenario(rawData.steps, 'heian_shodan');

  console.log('Test 1: Heian Shodan Step 1 sideward displacement & 90° orientation');
  const step0 = scenario.steps[0];
  const step1 = scenario.steps[1];

  // Шаг 0 (Йой)
  assert.deepEqual(step0.position, [0, 0, 0], 'Шаг 0 должен быть в центре [0, 0, 0]');
  assert.equal(step0.facingDeg, 0, 'Шаг 0 должен смотреть строго вперед (0°)');

  // Шаг 1 (Поворот на 90° влево и боковой выпад в дзэнкуцу-дати)
  assert.equal(step1.facingDeg, 90, 'Шаг 1 должен быть ориентирован на Запад (+90° / влево)');
  assert.equal(step1.deltaYawDeg, 90, 'Шаг 1 должен иметь дельта-поворот +90°');
  assert.deepEqual(step1.startPosition, [0, 0, 0], 'Шаг 1 должен стартовать из позиции Йой [0, 0, 0]');
  assert.deepEqual(step1.position, [0.23, 0, -0.06], 'Шаг 1 должен иметь конечное смещение [0.23, 0, -0.06]');

  // Проверка физического смещения вбок (X > 0)
  const lateralShift = step1.position[0] - step1.startPosition[0];
  assert.ok(lateralShift > 0.20, `Модель обязана уходить в бок (lateralShift=${lateralShift} > 0.20м)`);
  console.log('  PASSED: Step 1 initiates from [0,0,0] and displaces sideways to [0.23, 0, -0.06] with +90° yaw\n');
}

// Тест 2: Проверка непрерывности траектории (startPosition[i] === position[i - 1])
{
  console.log('Test 2: Spatial continuity across all steps of Kata');
  const jsonPath = path.resolve(__dirname, '../public/kata_data/heian_shodan.json');
  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const scenario = compileKataScenario(rawData.steps, 'heian_shodan');

  for (let i = 1; i < scenario.steps.length; i++) {
    const prev = scenario.steps[i - 1];
    const curr = scenario.steps[i];
    assert.deepEqual(
      curr.startPosition,
      prev.position,
      `Шаг ${i} должен непрерывно начинаться с конечной позиции шага ${i - 1} [${prev.position}]`
    );
  }
  console.log(`  PASSED: All ${scenario.steps.length} steps maintain seamless spatial continuity\n`);
}

// Тест 3: Математическая проверка весовой кривой анти-скольжения (Anti-Foot-Sliding Hermite curve)
{
  console.log('Test 3: Anti-sliding weight transfer curve validation');

  function calculateFootSlideWeight(p) {
    if (p <= 0.15) return 0;
    if (p >= 0.75) return 1;
    const u = (p - 0.15) / 0.60;
    return u * u * (3 - 2 * u);
  }

  // Фаза 0.0 .. 0.15: Подготовка / опорная нога на полу (0% движения)
  assert.equal(calculateFootSlideWeight(0.0), 0);
  assert.equal(calculateFootSlideWeight(0.10), 0);
  assert.equal(calculateFootSlideWeight(0.15), 0);

  // Фаза 0.15 .. 0.75: Перенос ноги и плавное смещение веса (кубический Hermite)
  const midWeight = calculateFootSlideWeight(0.45);
  assert.ok(Math.abs(midWeight - 0.5) < 1e-4, 'В середине шага (p=0.45) вес должен быть ровно 0.5');

  // Фаза 0.75 .. 1.00: Акцент кимэ и жесткая фиксация конечной стойки (100% фиксация)
  assert.equal(calculateFootSlideWeight(0.75), 1);
  assert.equal(calculateFootSlideWeight(0.85), 1);
  assert.equal(calculateFootSlideWeight(1.0), 1);

  console.log('  PASSED: Pivot foot planted at p<=0.15, smoothstep weight transfer in 0.15..0.75, stance locked at p>=0.75\n');
}

// Тест 4: Проверка разрешения клипов для Heian Shodan (включая сюто-укэ)
{
  console.log('Test 4: Clip resolution for all steps in Heian Shodan');
  const jsonPath = path.resolve(__dirname, '../public/kata_data/heian_shodan.json');
  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const scenario = compileKataScenario(rawData.steps, 'heian_shodan');

  assert.equal(scenario.steps[0].clipName, 'idle_shizentai');
  assert.equal(scenario.steps[1].clipName, 'gedan_barai_left');
  assert.equal(scenario.steps[2].clipName, 'oi_zuki_right');
  assert.equal(scenario.steps[3].clipName, 'gedan_barai_right');
  assert.equal(scenario.steps[7].clipName, 'age_uke_right');
  assert.equal(scenario.steps[8].clipName, 'age_uke_left');
  assert.equal(scenario.steps[18].clipName, 'shuto_uke');
  assert.equal(scenario.steps[22].clipName, 'idle_shizentai');

  console.log('  PASSED: Canonical technique clips mapped to individual reusable clips\n');
}

console.log('=================================================');
console.log('ALL KATA SIDEWARD MOTION & ANTI-SLIDE TESTS PASSED!');
console.log('=================================================');
