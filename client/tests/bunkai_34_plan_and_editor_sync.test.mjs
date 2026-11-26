import assert from 'node:assert/strict';
import {
  HEIAN_SHODAN_BUNKAI_18_STEPS,
  HEIAN_SHODAN_BUNKAI_34_STEPS,
  SHOTOKAN_STANCES,
  formEpisodeToEngineStep,
  episodeToDbStep,
  buildStepsFromDb,
  chainBunkaiEpisodes,
  computeAvatarPlacement,
  resolveBunkaiClip,
} from '../src/three/bunkaiScenarioEngine.js';

console.log('=== TEST SUITE: 34-Step Bunkai Plan & Editor/Demonstration Sync ===\n');

// 1. Проверка структуры 22 шагов плана (первые 4 шага поклона объединены в Шаг 1 с rei_bow)
assert.equal(HEIAN_SHODAN_BUNKAI_18_STEPS.length, 22, 'Должно быть ровно 22 шага');
assert.equal(HEIAN_SHODAN_BUNKAI_34_STEPS.length, 22);

HEIAN_SHODAN_BUNKAI_18_STEPS.forEach((step, idx) => {
  assert.equal(step.stepNumber, idx + 1, `stepNumber должен быть ${idx + 1}`);
  const tori = step.participants.find((p) => p.role === 'tori');
  const uke = step.participants.find((p) => p.role === 'uke1');
  assert.ok(tori && uke, `Шаг ${step.stepNumber}: должны быть Тори и Укэ`);
  assert.ok(resolveBunkaiClip(tori.clipName).clipName, `Шаг ${step.stepNumber}: клип Тори ${tori.clipName}`);
  assert.ok(resolveBunkaiClip(uke.clipName).clipName, `Шаг ${step.stepNumber}: клип Укэ ${uke.clipName}`);
  if (tori.stance !== 'fallen_ukemi') {
    assert.ok(SHOTOKAN_STANCES[tori.stance], `Шаг ${step.stepNumber}: неизвестная стойка Тори ${tori.stance}`);
  }
  if (uke.stance !== 'fallen_ukemi') {
    assert.ok(SHOTOKAN_STANCES[uke.stance], `Шаг ${step.stepNumber}: неизвестная стойка Укэ ${uke.stance}`);
  }
});

// Проверка ключевых шагов плана
const s1 = HEIAN_SHODAN_BUNKAI_18_STEPS[0];
assert.equal(s1.participants[0].clipName, 'rei_bow', 'Шаг 1 должен использовать единый клип поклона rei_bow');
assert.equal(s1.participants[1].clipName, 'rei_bow', 'Шаг 1 Укэ должен использовать единый клип поклона rei_bow');
assert.equal(s1.participants[0].stance, 'heiko_dachi');
assert.equal(s1.participants[0].finalStance, 'heiko_dachi');

const s2 = HEIAN_SHODAN_BUNKAI_18_STEPS[1];
assert.equal(s2.optimalDistance, 1.50);
assert.equal(s2.participants[0].finalStance, 'zenkutsu_dachi_left');
assert.equal(s2.participants[1].finalStance, 'zenkutsu_dachi_right');

const s3 = HEIAN_SHODAN_BUNKAI_18_STEPS[2];
assert.equal(s3.optimalDistance, 1.05);
assert.equal(s3.contactType, 'block_gedan');
assert.equal(s3.participants[0].landingMode, 'forward');
assert.equal(s3.participants[1].delaySeconds, 0.16);

const s5 = HEIAN_SHODAN_BUNKAI_18_STEPS[4];
assert.equal(s5.attackAngleDeg, 12.5);
assert.equal(s5.participants[0].clipName, 'mae_geri_left');
assert.equal(s5.participants[1].clipName, 'gedan_barai_right');

const s6 = HEIAN_SHODAN_BUNKAI_18_STEPS[5];
assert.equal(s6.participants[1].clipName, 'tech_tettsui_right');

const s8 = HEIAN_SHODAN_BUNKAI_18_STEPS[7];
assert.equal(s8.participants[0].stance, 'zenkutsu_dachi_left');
assert.equal(s8.participants[0].finalStance, 'zenkutsu_dachi_left');

const s9 = HEIAN_SHODAN_BUNKAI_18_STEPS[8];
assert.equal(s9.participants[0].clipName, 'mae_geri_right');

const s10 = HEIAN_SHODAN_BUNKAI_18_STEPS[9];
assert.equal(s10.participants[0].clipName, 'tech_jodan_zuki_right');

const s11 = HEIAN_SHODAN_BUNKAI_18_STEPS[10];
assert.equal(s11.contactType, 'joint_lock');
assert.equal(s11.optimalDistance, 0.65);

const s13 = HEIAN_SHODAN_BUNKAI_18_STEPS[12];
assert.equal(s13.participants[0].clipName, 'mae_geri_left');
assert.equal(s13.participants[0].landingMode, 'back');
assert.equal(s13.participants[0].delaySeconds, 0.22);
assert.equal(s13.participants[1].clipName, 'gedan_barai_right');
assert.equal(s13.participants[1].delaySeconds, 0.0);
assert.equal(s13.participants[1].finalStance, 'zenkutsu_dachi_right');
assert.equal(s13.ukeFullTurn, true);

const s15 = HEIAN_SHODAN_BUNKAI_18_STEPS[14];
assert.equal(s15.participants[0].clipName, 'step_backward_right');
assert.equal(s15.participants[1].clipName, 'gyaku_zuki_right');
assert.equal(s15.participants[1].stance, 'zenkutsu_dachi_right');
assert.equal(s15.participants[1].finalStance, 'zenkutsu_dachi_left');

const s16 = HEIAN_SHODAN_BUNKAI_18_STEPS[15];
assert.equal(s16.participants[0].clipName, 'oi_zuki_jodan_right');
assert.equal(s16.participants[1].clipName, 'tech_shuto_uke_right');
assert.equal(s16.participants[1].finalStance, 'kokutsu_dachi_right');
assert.ok(s16.ukeTrajectory.end[2] > s16.toriTrajectory.end[2], 'Шаг 16: Укэ остаётся спереди-слева (+Z), не заходя за спину');
assert.ok(s16.ukeTrajectory.end[0] < s16.toriTrajectory.end[0], 'Шаг 16: Укэ уходит с линии атаки влево (-X)');
assert.equal(s16.scenarioAngles.retreatAngleDeg, -30);
assert.equal(s16.ukeTurnDir, 0);

const s17 = HEIAN_SHODAN_BUNKAI_18_STEPS[16];
assert.equal(s17.contactType, 'punch_body');
assert.equal(s17.isGround, true);
assert.equal(s17.participants[1].clipName, 'tech_shuto_uke_left');
assert.equal(s17.participants[1].finalStance, 'kokutsu_dachi_left');
assert.equal(s17.participants[0].finalStance, 'fallen_ukemi');

const s18 = HEIAN_SHODAN_BUNKAI_18_STEPS[17];
assert.equal(s18.contactType, 'ground_finish');
assert.equal(s18.isGround, true);
assert.equal(s18.participants[1].clipName, 'tech_tate_zuki_right');
assert.equal(s18.participants[1].finalStance, 'stance_shiko');

const s21 = HEIAN_SHODAN_BUNKAI_18_STEPS[20];
assert.equal(s21.isBow, true);
assert.equal(s21.isGround, true);
assert.equal(s21.participants[0].finalStance, 'fallen_ukemi');
assert.equal(s21.participants[1].clipName, 'stance_musubi');

console.log('✓ Проверка всех 22 шагов плана (включая объединённый поклон rei_bow, стойки, клипы, Ма-ай, контакты, тайминги) пройдена.');

// 2. Проверка непрерывности позиций и удержания вытянутой руки в chainBunkaiEpisodes
const chained22 = chainBunkaiEpisodes(HEIAN_SHODAN_BUNKAI_18_STEPS, 'continuous');
assert.equal(chained22[10].participants[0].holdPunchClip, 'tech_jodan_zuki_right', 'После Дзёдан-дзуки Тори удерживает правую руку вытянутой на шаге болевого приёма');
for (let i = 1; i < chained22.length; i++) {
  const prev = chained22[i - 1];
  const cur = chained22[i];
  assert.deepEqual(cur.toriStartPos, prev.toriEndPos, `Шаг ${i + 1}: toriStartPos должен совпадать с prev.toriEndPos`);
  assert.deepEqual(cur.ukeStartPos, prev.ukeEndPos, `Шаг ${i + 1}: ukeStartPos должен совпадать с prev.ukeEndPos`);
}
console.log('✓ Непрерывность цепочки позиций и удержание вытянутой руки на всех 22 шагах подтверждена.');

// 3. Проверка 100% совпадения Редактора и Демонстрации (Roundtrip Editor -> DB -> Demonstration)
function toFormEpLike(st) {
  const toriP = st.participants.find((p) => p.role === 'tori');
  const ukeP = st.participants.find((p) => p.role === 'uke1');
  return {
    attackTechnique: st.title,
    toriCounter: st.description,
    outcome: st.notes,
    notes: st.notes,
    combatDistance: st.optimalDistance,
    attackAngleDeg: st.attackAngleDeg,
    toriAngleOffsetDeg: st.toriAngleOffsetDeg || 0,
    ukeEvasionAngleDeg: st.ukeEvasionAngleDeg || 0,
    toriEndAngleDeg: st.scenarioAngles?.toriAngleDeg ?? Math.round(((st.toriTrajectory?.endYaw || 0) * 180) / Math.PI),
    ukeEndAngleDeg: st.scenarioAngles?.ukeAngleDeg ?? Math.round(((st.ukeTrajectory?.endYaw || Math.PI) * 180) / Math.PI),
    toriClip: toriP.clipName,
    toriStance: toriP.stance,
    toriFinalStance: toriP.finalStance,
    toriLandingMode: toriP.landingMode || 'auto',
    toriDelaySeconds: toriP.delaySeconds ?? 0,
    toriActionType: st.toriActionType,
    ukeClip: ukeP.clipName,
    ukeStance: ukeP.stance,
    ukeFinalStance: ukeP.finalStance,
    ukeLandingMode: ukeP.landingMode || 'auto',
    ukeDelaySeconds: ukeP.delaySeconds ?? 0,
    ukeActionType: st.ukeActionType,
    duration: st.duration,
    contactType: st.contactType,
    interactionType: st.interactionType,
    tContact: st.tContact,
    isGround: Boolean(st.isGround),
    isRising: Boolean(st.isRising),
    isBow: Boolean(st.isBow),
    backToOpponent: Boolean(st.backToOpponent),
    ukeFullTurn: Boolean(st.ukeFullTurn),
    preserveScenarioYaw: Boolean(st.preserveScenarioYaw),
    toriTurnDir: st.toriTurnDir || 0,
    ukeTurnDir: st.ukeTurnDir || 0,
    scenarioAngles: st.scenarioAngles,
    toriTrajectory: st.toriTrajectory,
    ukeTrajectory: st.ukeTrajectory,
    displacementTori: st.displacementTori,
    displacementUke: st.displacementUke,
  };
}

const editorFormEps = HEIAN_SHODAN_BUNKAI_18_STEPS.map(toFormEpLike);
const editorPreviewSteps = editorFormEps.map((ep, idx) =>
  formEpisodeToEngineStep(ep, idx, editorFormEps.length)
);
const dbPayload = editorFormEps.map((ep, idx) =>
  episodeToDbStep(ep, idx, new Map(), false, editorFormEps.length)
);
const demoSteps = buildStepsFromDb(dbPayload);

const chainedEditor = chainBunkaiEpisodes(editorPreviewSteps, 'continuous');
const chainedDemo = chainBunkaiEpisodes(demoSteps, 'continuous');

for (let i = 0; i < 22; i++) {
  const plEditor = computeAvatarPlacement({ episode: chainedEditor[i] });
  const plDemo = computeAvatarPlacement({ episode: chainedDemo[i] });

  assert.deepEqual(plEditor.posTori, plDemo.posTori, `Шаг ${i + 1}: posTori не совпадает`);
  assert.deepEqual(plEditor.posUke1, plDemo.posUke1, `Шаг ${i + 1}: posUke1 не совпадает`);
  assert.deepEqual(plEditor.startPosTori, plDemo.startPosTori, `Шаг ${i + 1}: startPosTori не совпадает`);
  assert.deepEqual(plEditor.startPosUke1, plDemo.startPosUke1, `Шаг ${i + 1}: startPosUke1 не совпадает`);
  assert.deepEqual(plEditor.rotTori, plDemo.rotTori, `Шаг ${i + 1}: rotTori не совпадает`);
  assert.deepEqual(plEditor.rotUke1, plDemo.rotUke1, `Шаг ${i + 1}: rotUke1 не совпадает`);
  assert.equal(chainedEditor[i].contactType, chainedDemo[i].contactType, `Шаг ${i + 1}: contactType не совпадает`);
  assert.equal(chainedEditor[i].duration, chainedDemo[i].duration, `Шаг ${i + 1}: duration не совпадает`);
  assert.equal(chainedEditor[i].tContact, chainedDemo[i].tContact, `Шаг ${i + 1}: tContact не совпадает`);
  assert.equal(Boolean(chainedEditor[i].ukeFullTurn), Boolean(chainedDemo[i].ukeFullTurn), `Шаг ${i + 1}: ukeFullTurn не совпадает`);
  assert.equal(chainedEditor[i].participants[0].clipName, chainedDemo[i].participants[0].clipName);
  assert.equal(chainedEditor[i].participants[1].clipName, chainedDemo[i].participants[1].clipName);
  assert.equal(chainedEditor[i].participants[0].delaySeconds, chainedDemo[i].participants[0].delaySeconds);
  assert.equal(chainedEditor[i].participants[1].delaySeconds, chainedDemo[i].participants[1].delaySeconds);
}
console.log('✓ 100% совпадение 3D-движений Редактора и Демонстрации на всех 22 шагах подтверждено.');

// 3.1 Проверка, что редактирование дистанции, углов и конечного положения в редакторе применяется и сохраняется в БД
{
  const edited = toFormEpLike(HEIAN_SHODAN_BUNKAI_18_STEPS[15]);
  edited.combatDistance = 1.65;
  edited.isCustomDistance = true;
  edited.ukeEndAngleDeg = -45;
  edited.orientationModeUke = 'mode1_free';
  const stepPreview = formEpisodeToEngineStep(edited, 15, 22);
  const dbRows22 = editorFormEps.map((e, i) =>
    episodeToDbStep(i === 15 ? edited : e, i, new Map(), false, 22)
  );
  const stepDemo = buildStepsFromDb(dbRows22)[15];
  const pPrev = computeAvatarPlacement({ episode: stepPreview });
  const pDemo = computeAvatarPlacement({ episode: stepDemo });
  assert.ok(Math.abs(pPrev.finalDist - 1.65) < 0.02, 'Пользовательская дистанция должна применяться в предпросмотре');
  assert.ok(Math.abs(pDemo.finalDist - 1.65) < 0.02, 'Пользовательская дистанция должна сохраняться в БД');
  assert.ok(Math.abs(pPrev.rotUke1[1] - (-Math.PI / 4)) < 0.01, 'Пользовательский угол поворота Укэ должен применяться без перезаписи');
  assert.deepEqual(pPrev.rotUke1, pDemo.rotUke1, 'Угол поворота должен совпадать между Редактором и Демонстрацией');

  const withCustomXZ = toFormEpLike(HEIAN_SHODAN_BUNKAI_18_STEPS[15]);
  withCustomXZ.customUkePosX = -0.85;
  withCustomXZ.customUkePosZ = 0.25;
  const pXZ = computeAvatarPlacement({ episode: formEpisodeToEngineStep(withCustomXZ, 15, 22) });
  assert.ok(Math.abs(pXZ.endPosUke1[0] - (-0.85)) < 0.01 && Math.abs(pXZ.endPosUke1[2] - 0.25) < 0.01, 'Конечное положение X/Z должно применяться напрямую');
  console.log('✓ Переопределение дистанции, углов поворота и конечного положения X/Z в редакторе подтверждено.');
}

// 4. Проверка совпадения для пользовательского бункая (не 34 шага) с ручными правками
const customEps = [
  {
    attackTechnique: 'Маэ-гэри (возврат назад)',
    toriCounter: 'Гэдан-барай со смещением +35°',
    outcome: 'Контроль дистанции',
    combatDistance: 1.35,
    isCustomDistance: true,
    attackAngleDeg: 0,
    ukeEvasionAngleDeg: 35,
    toriEndAngleDeg: 0,
    ukeEndAngleDeg: 180,
    toriClip: 'mae_geri_right',
    toriStance: 'zenkutsu_dachi_left',
    toriFinalStance: 'zenkutsu_dachi_left',
    toriLandingMode: 'back',
    ukeClip: 'gedan_barai_left',
    ukeStance: 'zenkutsu_dachi_right',
    ukeFinalStance: 'zenkutsu_dachi_left',
    ukeLandingMode: 'auto',
    ukeDelaySeconds: 0.16,
    duration: 2.3,
    tContact: 0.48,
    contactType: 'block_gedan',
  },
  {
    attackTechnique: 'Ой-дзуки выпад',
    toriCounter: 'Агэ-укэ',
    outcome: 'Перехват',
    combatDistance: 1.12,
    isCustomDistance: true,
    attackAngleDeg: 10,
    toriEndAngleDeg: 10,
    ukeEndAngleDeg: -170,
    toriClip: 'oi_zuki_right',
    toriStance: 'zenkutsu_dachi_left',
    toriFinalStance: 'zenkutsu_dachi_right',
    ukeClip: 'age_uke_left',
    ukeStance: 'zenkutsu_dachi_left',
    ukeFinalStance: 'zenkutsu_dachi_left',
    ukeDelaySeconds: 0.14,
    duration: 2.0,
    tContact: 0.46,
    contactType: 'block_jodan',
  },
];

const customPreview = chainBunkaiEpisodes(customEps.map((e, i) => formEpisodeToEngineStep(e, i, customEps.length)), 'continuous');
const customDb = customEps.map((e, i) => episodeToDbStep(e, i, new Map(), false, customEps.length));
const customDemo = chainBunkaiEpisodes(buildStepsFromDb(customDb), 'continuous');

for (let i = 0; i < customEps.length; i++) {
  const pe = computeAvatarPlacement({ episode: customPreview[i] });
  const pd = computeAvatarPlacement({ episode: customDemo[i] });
  assert.deepEqual(pe.posTori, pd.posTori);
  assert.deepEqual(pe.posUke1, pd.posUke1);
  assert.deepEqual(pe.rotTori, pd.rotTori);
  assert.deepEqual(pe.rotUke1, pd.rotUke1);
  assert.equal(customPreview[i].contactType, customDemo[i].contactType);
  assert.equal(customPreview[i].participants[0].landingMode, customDemo[i].participants[0].landingMode);
}
console.log('✓ 100% совпадение Редактора и Демонстрации для пользовательского бункая подтверждено.');

console.log('\n======================================================');
console.log('ALL 34-STEP PLAN & EDITOR/DEMO SYNC TESTS PASSED!');
console.log('======================================================');
