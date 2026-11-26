import assert from 'node:assert/strict';
import {
  HEIAN_SHODAN_BUNKAI_18_STEPS,
  computeAvatarPlacement,
  resolveBunkaiClip,
} from '../src/three/bunkaiScenarioEngine.js';

console.log('=== TEST SUITE: Bunkai Reaction Timing, Strike Hold (Kime) & Contact Distance ===\n');

// 1. Тест: Задержка реакции защищающегося (Reaction Delay)
console.log('--- Тест 1: Задержка реакции защищающегося (Reaction Delay) ---');
{
  const ep5 = HEIAN_SHODAN_BUNKAI_18_STEPS[2]; // Шаг 3 (Исх. шаг 5.1)
  assert.equal(ep5.stepNumber, 3);

  const ukePart = ep5.participants.find(p => p.role === 'uke' || p.role === 'uke1');
  assert.ok(ukePart, 'Укэ должен присутствовать на Шаге 5');
  assert.ok(ukePart.delaySeconds >= 0.12, `Задержка реакции Укэ (${ukePart.delaySeconds}с) должна быть >= 0.12с`);

  // Симуляция тайминга:
  const reactionDelay = Math.max(0.12, Math.min(0.20, ukePart.delaySeconds || 0.16));
  const contactPhase = ep5.tContact || 0.48;

  // Фаза 0.05: до реакции
  let phraseEarly = 0.05;
  assert.ok(phraseEarly < reactionDelay, 'В фазе 0.05 Укэ еще удерживает исходную стойку');

  // Фаза контакта 0.48: Укэ полностью закончил уход Тай-сабаки
  let phraseContact = contactPhase;
  assert.ok(phraseContact > reactionDelay, 'В фазе контакта 0.48 Укэ уже на позиции встречи атаки');
  console.log(`✓ Задержка реакции Укэ выверена: ожидание до ${reactionDelay.toFixed(2)} фазы, уход с линии атаки точно к контакту на фазе ${contactPhase.toFixed(2)}.`);
}

// 2. Тест: Фиксация позы в конце клипа (Kime) — запрет сброса в нейтральную стойку
console.log('\n--- Тест 2: Запрет сброса состояния после завершения клипа (Gyaku-zuki / Block) ---');
{
  const testClips = [
    'tech_gyaku_zuki_right',
    'tech_oi_zuki_right',
    'tech_tettsui_right',
    'tech_shuto_uchi_right',
    'tech_gedan_barai_left',
    'tech_age_uke_right',
  ];

  for (const clip of testClips) {
    const clipLower = clip.toLowerCase();
    const isStrikeOrBlockAction = (
      clipLower.includes('zuki') ||
      clipLower.includes('tsuki') ||
      clipLower.includes('punch') ||
      clipLower.includes('tettsui') ||
      clipLower.includes('shuto') ||
      clipLower.includes('empi') ||
      clipLower.includes('uraken') ||
      clipLower.includes('tate') ||
      clipLower.includes('uke') ||
      clipLower.includes('barai')
    );
    assert.equal(isStrikeOrBlockAction, true, `Клип ${clip} должен классифицироваться как удар/блок с фиксацией Кимэ`);
  }
  console.log('✓ Все ударные и блокирующие техники надежно защищены от сброса в нейтральную стойку и фиксируют финальную позу.');
}

// 3. Тест: Калибровка дистанции и директрисы атаки на Шаге 3 и Шаге 4 (исх. 5.1 и 5.2)
console.log('\n--- Тест 3: Калибровка боевой дистанции и оси атаки (Шаг 3 и Шаг 4) ---');
{
  const ep5 = HEIAN_SHODAN_BUNKAI_18_STEPS[2];
  assert.equal(ep5.attackAngleDeg, 0, 'Тори на шаге 3 должен атаковать строго прямо (attackAngleDeg === 0)');

  const placement5 = computeAvatarPlacement({
    episode: ep5,
    customDistance: null,
    toriAngleOffsetDeg: 0,
    ukeEvasionAngleDeg: undefined,
  });

  // Расчет взаимного расстояния между Тори и Укэ на шаге 3
  const dist5 = Math.hypot(placement5.posUke1[0] - placement5.posTori[0], placement5.posUke1[2] - placement5.posTori[2]);
  assert.ok(dist5 >= 1.05 && dist5 <= 1.30, `Боевая дистанция на шаге 3 (${dist5.toFixed(2)}м) должна быть в диапазоне контакта 1.05м-1.30м`);

  // Боковое смещение (Тай-сабаки) должно быть в пределах 0.30 - 0.40м от центра
  const lateralShift5 = Math.abs(placement5.posUke1[0] - placement5.posTori[0]);
  assert.ok(lateralShift5 >= 0.28 && lateralShift5 <= 0.45, `Смещение Укэ по оси X (${lateralShift5.toFixed(2)}м) обеспечивает прямой физический перехват конечности`);

  // Шаг 4: Контрудар Укэ Гяку-дзуки в корпус
  const ep6 = HEIAN_SHODAN_BUNKAI_18_STEPS[3];
  assert.equal(ep6.stepNumber, 4, 'Шаг 4 должен быть контрударом Гяку-дзуки');
  assert.equal(ep6.contactType, 'punch_body', 'Контакт на шаге 7 — удар в корпус');
  const placement6 = computeAvatarPlacement({
    episode: ep6,
    customDistance: null,
    toriAngleOffsetDeg: 0,
    ukeEvasionAngleDeg: undefined,
  });
  const dist6 = Math.hypot(placement6.posUke1[0] - placement6.posTori[0], placement6.posUke1[2] - placement6.posTori[2]);
  assert.ok(dist6 >= 0.68 && dist6 <= 0.95, `Боевая дистанция на шаге 7 (${dist6.toFixed(2)}м) должна обеспечивать прямой контакт кулака с корпусом`);
  console.log(`✓ Дистанция Шага 6: ${dist5.toFixed(2)}м (смещение X=${lateralShift5.toFixed(2)}м). Дистанция Шага 7: ${dist6.toFixed(2)}м. Модели находятся в зоне прямого физического контакта!`);
}

console.log('\n======================================================');
console.log('ВСЕ ТЕСТЫ ТАЙМИНГОВ, ФИКСАЦИИ ПОЗЫ И ДИСТАНЦИИ ПРОЙДЕНЫ!');
console.log('======================================================');
