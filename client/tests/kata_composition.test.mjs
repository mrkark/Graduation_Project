import assert from 'assert/strict';
import fs from 'fs';
import {
  TECHNIQUE_REGISTRY,
  parseTransitionCode,
  resolveComposedClip,
  evaluateStepCompatibility,
  compileKataScenario,
} from '../src/three/kataCompositionEngine.js';

console.log('=== TEST SUITE: Kata Composition Engine v5 ===\n');

// 1. Проверка разрешения техник и клипов библиотеки v4
console.log('Test 1: Reusable technique clip resolution');
{
  const gedanStep = { T: 'T_L-gedan_barai', stance: 'zenkutsu' };
  const resGedan = resolveComposedClip(gedanStep);
  assert.equal(resGedan.clipName, 'gedan_barai_left', 'T_L-gedan_barai должен разрешаться в gedan_barai_left');
  assert.equal(resGedan.type, 'block');

  const oiZukiStep = { T: 'T_R-oi_zuki', stance: 'zenkutsu' };
  const resOi = resolveComposedClip(oiZukiStep);
  assert.equal(resOi.clipName, 'oi_zuki_right', 'T_R-oi_zuki должен разрешаться в oi_zuki_right');
  assert.equal(resOi.type, 'punch');

  const shutoStep = { T: 'T_L-shuto_uke', stance: 'kokutsu' };
  const resShuto = resolveComposedClip(shutoStep);
  assert.equal(resShuto.clipName, 'shuto_uke', 'T_L-shuto_uke должен разрешаться в shuto_uke');

  const yoiStep = { isYoi: true, isYoiStart: true };
  const resYoi = resolveComposedClip(yoiStep);
  assert.equal(resYoi.clipName, 'rei_bow', 'Начальный Йой должен разрешаться в единый клип поклона rei_bow');

  const kickStep = { S: 'S_kick_mae_geri_R_zenkutsuL', stance: 'zenkutsu' };
  const resKick = resolveComposedClip(kickStep);
  assert.equal(resKick.clipName, 'kick_mae_geri_right', 'Маэ-гэри правой должен разрешаться в kick_mae_geri_right');
  assert.equal(resKick.type, 'kick');

  const jumpStep = { S: 'S_jump_heisokuL_kosaR_0.12_0.0', stance: 'kosa' };
  const resJump = resolveComposedClip(jumpStep);
  assert.equal(resJump.type, 'jump');

  console.log('  PASSED: Basic blocks, punches, kicks and jumps resolve to existing v4 clips');
}

// 2. Проверка парсера переходов и опорной ноги (pivotFoot)
console.log('\nTest 2: Transition code parsing (pivotFoot & stepFoot)');
{
  const tStep = parseTransitionCode('S_step_heisokuL_zenkutsuL_R');
  assert.equal(tStep.type, 'step');
  assert.equal(tStep.pivotFoot, 'right', 'В коде _R опорная (support/pivot) нога - правая');
  assert.equal(tStep.stepFoot, 'left');

  const tHold = parseTransitionCode('S_hold_zenkutsuL_R');
  assert.equal(tHold.type, 'hold');

  const tKick = parseTransitionCode('S_kick_yoko_fumikomi_R_kokutsuL');
  assert.equal(tKick.type, 'kick');
  assert.equal(tKick.stepFoot, 'right');
  console.log('  PASSED: Pivot and stepping feet correctly extracted from S code');
}

// 3. Проверка оценки совместимости шагов и длительности смешивания (crossfade)
console.log('\nTest 3: Step transition compatibility & blend duration');
{
  const stepA = { stance: 'zenkutsu', facingDeg: 90 };
  const stepB = { stance: 'zenkutsu', facingDeg: 90 };
  const resSame = evaluateStepCompatibility(stepA, stepB);
  assert.equal(resSame.compatible, true);
  assert(resSame.blendDuration <= 0.30, 'Прямой шаг в той же стойке должен смешиваться быстро (<= 0.30с)');

  const stepTurn90 = { stance: 'zenkutsu', facingDeg: 0 };
  const resTurn = evaluateStepCompatibility(stepA, stepTurn90);
  assert.equal(resTurn.compatible, true);
  assert(resTurn.blendDuration >= 0.30, 'Поворот на 90° требует более плавного смешивания (>= 0.30с)');

  const stepTurn180 = { stance: 'zenkutsu', facingDeg: -90 };
  const res180 = evaluateStepCompatibility(stepA, stepTurn180);
  assert.equal(res180.compatible, true);
  assert(res180.blendDuration >= 0.35, 'Разворот на 180° требует глубокого смешивания (>= 0.35с)');
  console.log('  PASSED: Transition blending dynamically adapts to stance and turn angle');
}

// 4. Проверка компиляции Heian Shodan (23 шага: шаг 0 Йой, 21 техника, шаг 22 Йой)
console.log('\nTest 4: Compilation of Heian Shodan into unified scenario (23 steps including Yoi)');
{
  const hsData = JSON.parse(fs.readFileSync('./public/kata_data/heian_shodan.json', 'utf8'));
  const scenario = compileKataScenario(hsData.steps, 'heian_shodan');

  assert.equal(scenario.steps.length, 23, 'Heian Shodan должен содержать 23 шага (Йой старт, 21 прием, Йой финиш)');
  assert.equal(scenario.embusenPoints.length, 23, 'Эмбусэн должен содержать 23 точки');
  assert.deepEqual(scenario.meta.kiaiSteps, [9, 17], 'КИАЙ должен быть строго на шагах 9 и 17');

  // Шаг 0 (Начало формы — Поклон Рэй)
  const step0 = scenario.steps[0];
  assert.equal(step0.moveNumber, 0);
  assert.equal(step0.facingDeg, 0);
  assert.equal(step0.clipName, 'rei_bow');
  assert.equal(step0.stance, 'ready');
  assert.equal(step0.startTime, 0);

  // Шаг 1 (первый боевой шаг: поворот влево 90°, гэдан-барай)
  const step1 = scenario.steps[1];
  assert.equal(step1.moveNumber, 1);
  assert.equal(step1.facingDeg, 90);
  assert.equal(step1.clipName, 'gedan_barai_left');
  assert.equal(step1.stance, 'zenkutsu');
  assert.equal(step1.startTime, step0.endTime);
  assert(step1.duration > 1.0);

  // Шаг 2 (ой-цуки правой вперед)
  const step2 = scenario.steps[2];
  assert.equal(step2.moveNumber, 2);
  assert.equal(step2.clipName, 'oi_zuki_right');
  assert.equal(step2.facingDeg, 90);
  assert.equal(step2.startTime, step1.endTime, 'Таймлайн должен быть непрерывным');

  // Шаг 18 (сюто-укэ)
  const step18 = scenario.steps[18];
  assert(step18.clipName === 'shuto_uke' || step18.clipName === 'turn_into_kokutsu_left' || step18.clipName === 'tech_shuto_uke_left');
  assert.equal(step18.stance, 'kokutsu');

  // Шаг 22 (завершение формы — Поклон Рэй)
  const step22 = scenario.steps[22];
  assert.equal(step22.moveNumber, 22);
  assert.equal(step22.facingDeg, 0);
  assert.equal(step22.clipName, 'rei_bow');

  console.log('  PASSED: Heian Shodan compiled into complete 23-step composed sequence (with opening & closing Yoi)');
}

// 5. Проверка компиляции всех 26 ката Shotokan
console.log('\nTest 5: Compilation of ALL 26 KATAS from public/kata_data/*.json');
{
  const kataFiles = fs.readdirSync('./public/kata_data').filter(f => f.endsWith('.json'));
  assert.equal(kataFiles.length, 26, 'Должно быть ровно 26 ката');

  let totalCompiledSteps = 0;
  kataFiles.forEach(file => {
    const kataSlug = file.replace('.json', '');
    const data = JSON.parse(fs.readFileSync('./public/kata_data/' + file, 'utf8'));
    const scenario = compileKataScenario(data.steps, kataSlug);

    assert(scenario.steps.length > 0, `Ката ${kataSlug} должно иметь шаги`);
    assert(scenario.totalDuration > 10, `Длительность ${kataSlug} должна быть > 10с`);
    assert.equal(scenario.embusenPoints.length, scenario.steps.length);

    scenario.steps.forEach((st, idx) => {
      assert(st.clipName, `Шаг ${idx + 1} ката ${kataSlug} должен иметь clipName`);
      assert(typeof st.facingDeg === 'number', `Шаг ${idx + 1} ката ${kataSlug} должен иметь facingDeg`);
      assert(Array.isArray(st.position), `Шаг ${idx + 1} ката ${kataSlug} должен иметь position`);
      totalCompiledSteps++;
    });
  });

  console.log(`  PASSED: All 26 katas compiled cleanly (${totalCompiledSteps} total steps)!`);
}

console.log('\n=================================================');
console.log('ALL COMPOSITION ENGINE TESTS PASSED! (5/5)');
console.log('=================================================');
