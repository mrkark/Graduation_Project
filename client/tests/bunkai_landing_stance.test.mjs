import assert from 'assert/strict';
import {
  chainBunkaiEpisodes,
  normalizeBunkaiEpisode,
} from '../src/three/bunkaiScenarioEngine.js';

console.log('=== TEST SUITE: Bunkai Landing Stance & Mae-Geri Modes ===\n');

// 1. Проверка установки конечной стойки: ногу назад vs ногу вперед для Тори
console.log('Test 1: Mae Geri landingMode: back vs forward for Tori');
{
  // Эпизод с "ногу назад"
  const epBack = {
    stepNumber: 1,
    title: 'Маэ-гэри (ногу назад в исходную)',
    participants: [
      {
        role: 'tori',
        clipName: 'mae_geri_right',
        stance: 'zenkutsu_dachi_left',
        finalStance: 'zenkutsu_dachi_left',
        landingMode: 'back',
        delaySeconds: 0.0,
      },
      {
        role: 'uke1',
        clipName: 'gedan_barai_left',
        stance: 'zenkutsu_dachi_left',
        finalStance: 'zenkutsu_dachi_left',
        landingMode: 'back',
        delaySeconds: 0.1,
      },
    ],
  };

  const chainedBack = chainBunkaiEpisodes([epBack], 'continuous');
  assert.equal(chainedBack.length, 1);
  // Тори остался на месте (displacement = 0)
  assert.deepEqual(chainedBack[0].toriStartPos, [0, 0, 0]);
  assert.deepEqual(chainedBack[0].toriEndPos, [0, 0, 0]);
  assert.equal(chainedBack[0].participants[0].finalStance, 'zenkutsu_dachi_left');
  assert.equal(chainedBack[0].participants[0].landingMode, 'back');

  // Эпизод с "ногу вперед"
  const epForward = {
    stepNumber: 1,
    title: 'Маэ-гэри (ногу вперед со сменой стойки)',
    participants: [
      {
        role: 'tori',
        clipName: 'mae_geri_right',
        stance: 'zenkutsu_dachi_left',
        finalStance: 'zenkutsu_dachi_right',
        landingMode: 'forward',
        delaySeconds: 0.0,
      },
      {
        role: 'uke1',
        clipName: 'gedan_barai_left',
        stance: 'zenkutsu_dachi_left',
        finalStance: 'zenkutsu_dachi_left',
        landingMode: 'back',
        delaySeconds: 0.1,
      },
    ],
  };

  const chainedForward = chainBunkaiEpisodes([epForward], 'continuous');
  assert.equal(chainedForward.length, 1);
  // Тори продвинулся вперед на +0.70м по оси Z
  assert.deepEqual(chainedForward[0].toriStartPos, [0, 0, 0]);
  assert.equal(chainedForward[0].toriEndPos[2], 0.70);
  assert.equal(chainedForward[0].participants[0].finalStance, 'zenkutsu_dachi_right');
  assert.equal(chainedForward[0].participants[0].landingMode, 'forward');

  console.log('  PASSED: Tori landingMode back keeps position [0,0,0]; forward advances +0.70m along Z');
}

// 2. Наследование конечной стойки в следующий шаг цепочки
console.log('\nTest 2: Stance inheritance across chained episodes');
{
  const steps = [
    {
      stepNumber: 1,
      title: 'Шаг 1: Маэ-гэри ногу вперед',
      participants: [
        {
          role: 'tori',
          clipName: 'mae_geri_right',
          stance: 'zenkutsu_dachi_left',
          finalStance: 'zenkutsu_dachi_right',
          landingMode: 'forward',
        },
        { role: 'uke1', clipName: 'gedan_barai_left', stance: 'zenkutsu_dachi_left' },
      ],
    },
    {
      stepNumber: 2,
      title: 'Шаг 2: Последующий удар из новой стойки',
      participants: [
        {
          role: 'tori',
          clipName: 'gyaku_zuki_left',
          // stance не задан жестко вручную
        },
        { role: 'uke1', clipName: 'oi_zuki_right', stance: 'zenkutsu_dachi_left' },
      ],
    },
  ];

  const chained = chainBunkaiEpisodes(steps, 'continuous');
  // В Шаге 2 начальная стойка Тори должна унаследовать конечную стойку Шага 1 (zenkutsu_dachi_right)
  assert.equal(chained[1].participants[0].stance, 'zenkutsu_dachi_right');
  assert.equal(chained[1].toriStartPos[2], 0.70, 'Шаг 2 начинается с конечной позиции Шага 1 (+0.70м)');

  console.log('  PASSED: Step 2 inherits finalStance zenkutsu_dachi_right and position +0.70m from Step 1');
}

console.log('\n=================================================');
console.log('ALL BUNKAI LANDING STANCE TESTS PASSED! (2/2)');
console.log('=================================================');
