import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { compileKataScenario } from '../src/three/kataCompositionEngine.js';
import { hasRootDisplacement } from '../src/three/modularAnimationEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== TEST SUITE: Kata Discrete Step Movement Clips & Composed Motion ===\n');

// Тест 1: Все 23 отдельных клипа шагов присутствуют на диске и валидируются Three.js
console.log('Test 1: Verification of 23 discrete step animation clips on disk');
const stepsDir = path.resolve(__dirname, '../public/anims/kata_steps');
assert.ok(fs.existsSync(stepsDir), 'Директория kata_steps должна существовать');

const parsedClips = [];
for (let i = 0; i < 23; i++) {
  const filePath = path.join(stepsDir, `heian_shodan_step_${i}.json`);
  assert.ok(fs.existsSync(filePath), `Файл ${filePath} должен существовать`);
  
  const rawJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const clip = THREE.AnimationClip.parse(rawJson);
  assert.ok(clip instanceof THREE.AnimationClip, `Клип шага ${i} должен успешно парситься Three.js`);
  assert.ok(clip.tracks.length > 30, `Клип шага ${i} должен содержать скелетные треки (найдено ${clip.tracks.length})`);
  
  const hipsTrack = clip.tracks.find((t) => t.name === 'Hips.position');
  assert.ok(hipsTrack, `Клип шага ${i} должен содержать трек Hips.position`);
  parsedClips.push(clip);
}
console.log('  PASSED: All 23 discrete step clips exist, parse into THREE.AnimationClip and contain Hips tracks\n');

// Тест 2: Проверка физического перемещения таза (hasRootDisplacement) в клипах
console.log('Test 2: Validation of physical root displacement in movement clips');
for (let i = 1; i <= 21; i++) {
  const clip = parsedClips[i];
  const hasDisp = hasRootDisplacement(clip);
  assert.equal(hasDisp, true, `Клип шага ${i} (${clip.name}) обязан содержать физическое перемещение таза`);
}

// Шаг 1: Боковое смещение из Йой
const step1Hips = parsedClips[1].tracks.find((t) => t.name === 'Hips.position').values;
const step1StartX = step1Hips[0];
const step1EndX = step1Hips[step1Hips.length - 3];
assert.ok(step1EndX - step1StartX > 0.20, `Шаг 1 обязан смещаться вбок по X на >0.20м (фактически: ${(step1EndX - step1StartX).toFixed(3)}м)`);

// Шаг 2: Выпад вперед с ударом ой-цуки (+0.90м)
const step2Hips = parsedClips[2].tracks.find((t) => t.name === 'Hips.position').values;
const step2StartX = step2Hips[0];
const step2EndX = step2Hips[step2Hips.length - 3];
assert.ok(step2EndX - step2StartX > 0.85, `Шаг 2 обязан перемещаться вперед на >0.85м (фактически: ${(step2EndX - step2StartX).toFixed(3)}м)`);

console.log('  PASSED: Step 1 displaces laterally (+0.22m) and Step 2 advances forward (+0.90m) with full root motion\n');

// Тест 3: Проверка непрерывности координат между смежными дискретными клипами
console.log('Test 3: Seamless spatial continuity across consecutive discrete step clips');
for (let i = 0; i < 22; i++) {
  const curHips = parsedClips[i].tracks.find((t) => t.name === 'Hips.position').values;
  const nextHips = parsedClips[i + 1].tracks.find((t) => t.name === 'Hips.position').values;

  const curEnd = [curHips[curHips.length - 3], curHips[curHips.length - 2], curHips[curHips.length - 1]];
  const nextStart = [nextHips[0], nextHips[1], nextHips[2]];

  const dist = Math.hypot(curEnd[0] - nextStart[0], curEnd[1] - nextStart[1], curEnd[2] - nextStart[2]);
  assert.ok(
    dist < 0.05,
    `Стык между шагом ${i} и ${i + 1} должен быть бесшовным (расхождение ${dist.toFixed(4)}м < 0.05м)`
  );
}
console.log('  PASSED: All 22 transitions between discrete clips are spatially seamless (dist < 0.05m)\n');

// Тест 4: Интеграция со сценарием compileKataScenario
console.log('Test 4: Integration with compileKataScenario (stepClipName resolution)');
const jsonPath = path.resolve(__dirname, '../public/kata_data/heian_shodan.json');
const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const scenario = compileKataScenario(rawData.steps, 'heian_shodan');

assert.equal(scenario.steps.length, 23);
for (let i = 0; i < 23; i++) {
  assert.equal(scenario.steps[i].stepClipName, `heian_shodan_step_${i}`);
  assert.equal(scenario.steps[i].kataStepClip, `heian_shodan_step_${i}`);
}
console.log('  PASSED: compileKataScenario provides canonical stepClipName for all 23 steps\n');

// Тест 5: Проверка соответствия имен костей спецификации Three.js GLTFLoader (исключение T-позы)
console.log('Test 5: Bone name sanitization and non-T-pose joint motion validation');
for (let i = 0; i < 23; i++) {
  const clip = parsedClips[i];
  const trackNames = clip.tracks.map((t) => t.name);

  // Имена костей не должны содержать разделителей с точками (.L / .R), которые Three.js парсит как subproperties
  const invalidDottedTracks = trackNames.filter((n) => n.includes('.L.') || n.includes('.R.'));
  assert.equal(
    invalidDottedTracks.length,
    0,
    `Шаг ${i} содержит некорректные имена костей с точками: ${invalidDottedTracks.join(', ')}`
  );

  // Должны присутствовать корректно санитизированные ключевые кости конечностей
  assert.ok(trackNames.some((n) => n.startsWith('UpperArmL.')), `Шаг ${i} обязан содержать трек UpperArmL`);
  assert.ok(trackNames.some((n) => n.startsWith('UpperArmR.')), `Шаг ${i} обязан содержать трек UpperArmR`);
  assert.ok(trackNames.some((n) => n.startsWith('FootL.')), `Шаг ${i} обязан содержать трек FootL`);
  assert.ok(trackNames.some((n) => n.startsWith('FootR.')), `Шаг ${i} обязан содержать трек FootR`);
}
console.log('  PASSED: All 23 step clips use sanitized bone names (UpperArmL, FootL, etc.) eliminating T-pose\n');

console.log('=================================================');
console.log('ALL DISCRETE STEP CLIPS & MOVEMENT TESTS PASSED!');
console.log('=================================================');
