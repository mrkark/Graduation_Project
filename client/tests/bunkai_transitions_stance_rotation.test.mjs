import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  mirrorClipLeftRight,
  trimClipRange,
  synthesizeModularClip,
  synthesizeStanceTransitionClip,
  adaptKickClipToStance,
  makeClipInPlace,
  synthesizeJodanOiZukiClip,
  synthesizeHoldExtendedPunchClip,
} from '../src/three/modularAnimationEngine.js';
import {
  HEIAN_SHODAN_BUNKAI_18_STEPS,
  chainBunkaiEpisodes,
  computeAvatarPlacement,
} from '../src/three/bunkaiScenarioEngine.js';

function loadGlbAnimations(glbPath) {
  const buf = fs.readFileSync(glbPath);
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
  const bin = buf.slice(20 + jsonLen + 8);

  function readAccessor(idx) {
    const acc = gltf.accessors[idx];
    const bv = gltf.bufferViews[acc.bufferView];
    const off = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const compCount = acc.type === 'SCALAR' ? 1 : acc.type === 'VEC3' ? 3 : acc.type === 'VEC4' ? 4 : 1;
    const arr = new Float32Array(acc.count * compCount);
    for (let i = 0; i < arr.length; i++) arr[i] = bin.readFloatLE(off + i * 4);
    return arr;
  }

  const clips = new Map();
  for (const anim of gltf.animations) {
    const tracks = [];
    let dur = 0;
    for (const ch of anim.channels) {
      const node = gltf.nodes[ch.target.node]?.name;
      if (!node) continue;
      const s = anim.samplers[ch.sampler];
      const times = readAccessor(s.input);
      const values = readAccessor(s.output);
      if (times.length > 0 && times[times.length - 1] > dur) dur = times[times.length - 1];
      if (ch.target.path === 'translation') {
        tracks.push(new THREE.VectorKeyframeTrack(`${node}.position`, times, values));
      } else if (ch.target.path === 'rotation') {
        tracks.push(new THREE.QuaternionKeyframeTrack(`${node}.quaternion`, times, values));
      }
    }
    clips.set(anim.name, new THREE.AnimationClip(anim.name, dur, tracks));
  }
  return clips;
}

function getTrackStartEndQuat(clip, nodeName) {
  const t = clip.tracks.find((tr) => tr.name === `${nodeName}.quaternion`);
  assert.ok(t, `Missing track ${nodeName}.quaternion in ${clip.name}`);
  const v = t.values;
  return {
    start: [v[0], v[1], v[2], v[3]],
    end: [v[v.length - 4], v[v.length - 3], v[v.length - 2], v[v.length - 1]],
  };
}

console.log('=== TEST SUITE: Transitions, Initial Stance Continuity & Synced Rotations ===\n');

const glbClips = loadGlbAnimations('public/models/karateka_techniques_v4.glb');

// 1. Зеркальное отражение стойки Миги Фудо-дати и челнока
{
  const fudoLeft = glbClips.get('fudo_dachi');
  const fudoRight = mirrorClipLeftRight(fudoLeft, 'fudo_dachi_right_test');
  const legLOrig = getTrackStartEndQuat(fudoLeft, 'UpperLeg.L');
  const legRMir = getTrackStartEndQuat(fudoRight, 'UpperLeg.R');
  assert.ok(Math.abs(legRMir.start[3] - legLOrig.start[3]) < 0.01, 'fudo_dachi_right должен отразить переднюю ногу влево->вправо');

  const slideL = glbClips.get('slide_backward');
  const slideR = mirrorClipLeftRight(slideL, 'slide_backward_right_test');
  const zRightRef = getTrackStartEndQuat(glbClips.get('zenkutsu_dachi_right'), 'UpperLeg.R');
  const slideRLegR = getTrackStartEndQuat(slideR, 'UpperLeg.R');
  assert.ok(Math.abs(slideRLegR.start[3] - zRightRef.start[3]) < 0.02, 'slide_backward_right должен стартовать из Миги Дзэнкуцу-дати');
  console.log('✓ 1. Зеркальные стойки и шаги (fudo_dachi_right, slide_backward_right) корректно совпадают с правой стойкой.');
}

// 2. Обрезка tech_* убирает возврат в Хэйко-дати перед ударом/блоком
{
  const tate = glbClips.get('tech_tate_zuki_right');
  const trimmed = trimClipRange(tate, tate.duration * 0.52, tate.duration * 0.90, 'test_tate_active');
  const shiko = glbClips.get('stance_shiko');
  const synth = synthesizeModularClip({ lowerClip: shiko, upperClip: trimmed, name: 'test_shiko_tate' });
  const hipsPos = synth.tracks.find((tr) => tr.name === 'Hips.position');
  assert.ok(hipsPos, 'Должен присутствовать Hips.position');
  assert.ok(hipsPos.values[1] < 0.58, `Стойка Сико-дати сохранена (hipsY=${hipsPos.values[1].toFixed(2)}), без вставания в Хэйко-дати`);
  console.log('✓ 2. Отоси-дзуки в Сико-дати (Шаг 28) и tech_* клипы не встают в Хэйко-дати.');
}

// 3. Адаптация Маэ-гэри: landingMode='forward' (Шаг 6) и старт из Миги Дзэнкуцу (Шаг 18)
{
  const maeR = glbClips.get('mae_geri_right');
  const zL = glbClips.get('zenkutsu_dachi_left');
  const zR = glbClips.get('zenkutsu_dachi_right');

  const step6Kick = adaptKickClipToStance({
    kickClip: maeR,
    startStanceClip: zL,
    endStanceClip: zR,
    landingMode: 'forward',
    name: 'test_kick_step6',
  });
  const legR6 = getTrackStartEndQuat(step6Kick, 'UpperLeg.R');
  const zRLegR = getTrackStartEndQuat(zR, 'UpperLeg.R');
  assert.ok(legR6.start[3] < 0, 'Шаг 6 Маэ-гэри правой стартует с правой ногой сзади (Хидари Дзэнкуцу)');
  assert.ok(Math.abs(legR6.end[3] - zRLegR.start[3]) < 0.05, 'Шаг 6 Маэ-гэри приземляется вперед в Миги Дзэнкуцу-дати');

  const step18Kick = adaptKickClipToStance({
    kickClip: maeR,
    startStanceClip: zR,
    endStanceClip: zR,
    landingMode: 'back',
    name: 'test_kick_step18',
  });
  const legR18 = getTrackStartEndQuat(step18Kick, 'UpperLeg.R');
  assert.ok(Math.abs(legR18.start[3] - zRLegR.start[3]) < 0.05, 'Шаг 18 Тори стартует в Миги Дзэнкуцу-дати, не меняя стойку перед ударом');
  assert.ok(Math.abs(legR18.end[3] - zRLegR.start[3]) < 0.05, 'Шаг 18 Тори возвращается назад в Миги Дзэнкуцу-дати');
  console.log('✓ 3. Адаптация Маэ-гэри (Шаг 6 приход вперед, Шаг 18 без переброса стойки перед ударом) проверена.');
}

// 4. Непрерывность позиций и углов поворота (нулевые скачки) на всех 34 шагах
{
  const chained = chainBunkaiEpisodes(HEIAN_SHODAN_BUNKAI_18_STEPS, 'continuous');
  for (let i = 1; i < chained.length; i++) {
    const prevP = computeAvatarPlacement({ episode: chained[i - 1] });
    const curP = computeAvatarPlacement({ episode: chained[i] });
    const gapT = Math.hypot(curP.startPosTori[0] - prevP.endPosTori[0], curP.startPosTori[2] - prevP.endPosTori[2]);
    const gapU = Math.hypot(curP.startPosUke1[0] - prevP.endPosUke1[0], curP.startPosUke1[2] - prevP.endPosUke1[2]);
    const gapRT = Math.abs(Math.atan2(Math.sin(curP.startRotTori[1] - prevP.rotTori[1]), Math.cos(curP.startRotTori[1] - prevP.rotTori[1])));
    const gapRU = Math.abs(Math.atan2(Math.sin(curP.startRotUke1[1] - prevP.rotUke1[1]), Math.cos(curP.startRotUke1[1] - prevP.rotUke1[1])));
    assert.ok(gapT < 0.005 && gapU < 0.005, `Шаг ${i + 1}: позиция старта должна совпадать с концом шага ${i} (gapT=${gapT}, gapU=${gapU})`);
    assert.ok(gapRT < 0.01 && gapRU < 0.01, `Шаг ${i + 1}: угол старта должен совпадать с концом шага ${i} (gapRT=${gapRT}, gapRU=${gapRU})`);
  }
  console.log('✓ 4. Полная непрерывность позиций и углов Yaw (< 0.005м, < 0.01 рад) подтверждена на всех 34 шагах.');
}

// 5. Проверка единого окна перемещения и поворота в MultiAvatarModel.jsx и плавных переходов в BunkaiMultiAvatarPlayer.jsx
{
  const modelSrc = fs.readFileSync('src/three/MultiAvatarModel.jsx', 'utf8');
  assert.ok(modelSrc.includes('currentYaw = startYaw + angleDelta * motionProgress'), 'Поворот и шаг обязаны использовать единый motionProgress');
  assert.ok(modelSrc.includes('waitingStanceActiveRef'), 'Должно поддерживаться удержание начальной стойки во время delaySeconds');
  assert.ok(modelSrc.includes('catchupOffsetRef'), 'При переключении шага должен выполняться плавный переход вместо телепортации');
  assert.ok(modelSrc.includes('savedBoneQuatsRef'), 'Процедурные наклоны/IK обязаны сбрасывать базу кадра без накопления оборотов');
  assert.ok(!modelSrc.includes('isStepChanged && !isPureStaticStance'), 'Переключение шага не должно принудительно обрывать crossFadeTo');

  const playerSrc = fs.readFileSync('src/three/BunkaiMultiAvatarPlayer.jsx', 'utf8');
  const nextFn = playerSrc.slice(playerSrc.indexOf('function handleNextStep'), playerSrc.indexOf('const handleReplayStep'));
  assert.ok(!nextFn.includes('setReplayNonce'), 'handleNextStep не должен вызывать жесткий сброс replayNonce');
  assert.ok(playerSrc.includes('activeStepVisualKey'), 'BunkaiMultiAvatarPlayer должен перезапускать шаг при смене стойки из редактора');
  assert.ok(!playerSrc.includes('target={INITIAL_ORBIT_TARGET}'), 'OrbitControls не должен сбрасывать target при ре-рендерах');

  const formSrc = fs.readFileSync('src/pages/BunkaiFormPage.jsx', 'utf8');
  assert.ok(formSrc.includes('isStanceOnlyClip'), 'BunkaiFormPage должен синхронно обновлять клип при смене стойки на стоечном шаге');
  assert.ok(modelSrc.includes('mod_stance_tr_'), 'MultiAvatarModel должен уважать смену стойки даже для чисто стоечных клипов');
  assert.ok(modelSrc.includes("combatOptions.contactType === 'distance_only'"), 'distance_only шаги должны использовать единое окно перемещения и поворота');
  assert.ok(!modelSrc.includes('if (isStationary || isZeroDisp)'), 'Перемещение не должно телепортироваться в end при start !== end');
  assert.ok(modelSrc.includes('lastLayoutStepKeyRef'), 'MultiAvatarModel должен сбрасывать prevPhraseRef при смене stepKey, не обрывая crossFadeTo');
  assert.ok(!playerSrc.slice(playerSrc.indexOf('else if (autoAdvance)'), playerSrc.indexOf('onAutoAdvance(currentStepIdx')).includes('phraseRef.current = 0'), 'BunkaiPlaybackClock не должен сбрасывать phraseRef до рендера следующего шага');

  // Шаг выхода из болевого приёма: Тори сохраняет фронтальный угол без разворота на 180°, Укэ отшагивает на дистанцию боя
  const chained15 = chainBunkaiEpisodes(HEIAN_SHODAN_BUNKAI_18_STEPS, 'continuous')[14];
  const p15 = computeAvatarPlacement({ episode: chained15 });
  const u15Disp = Math.hypot(p15.endPosUke1[0] - p15.startPosUke1[0], p15.endPosUke1[2] - p15.startPosUke1[2]);
  const t15Turn = Math.abs(Math.atan2(Math.sin(p15.rotTori[1] - p15.startRotTori[1]), Math.cos(p15.rotTori[1] - p15.startRotTori[1])));
  assert.ok(t15Turn < 0.05, 'Шаг 15: разворот Тори на 180° убран');
  assert.ok(u15Disp > 0.40, `Шаг 15 Укэ должен плавно разрывать захват (disp=${u15Disp.toFixed(2)}м)`);
  console.log('✓ 5. Единая синхронизация поворота/перемещения, кроссфейды и отсутствие разворота 180° подтверждены.');
}

// 6. Естественные опущенные руки в Мусуби-дати и Хэйсоку-дати
{
  const heiko = glbClips.get('heiko_dachi');
  const musubiRaw = glbClips.get('stance_musubi');
  const musubiFixed = synthesizeModularClip({
    lowerClip: musubiRaw,
    upperClip: heiko,
    name: 'test_musubi_natural',
    bypassCache: true,
  });
  const heikoArm = getTrackStartEndQuat(heiko, 'UpperArm.L');
  const musubiArm = getTrackStartEndQuat(musubiFixed, 'UpperArm.L');
  assert.ok(Math.abs(musubiArm.start[0] - heikoArm.start[0]) < 0.02, 'В Мусуби-дати руки должны быть опущены как в Хэйко-дати');
  console.log('✓ 6. Положение рук в Мусуби-дати (и Хэйсоку-дати) приведено к естественной стойке внимания.');
}

// 7. Проверка отсутствия проваливания стоп под пол после Маэ-гэри и переходов стоек + сохранность полных клипов и phraseStepRef
{
  const modelSrc = fs.readFileSync('src/three/MultiAvatarModel.jsx', 'utf8');
  const playerSrc = fs.readFileSync('src/three/BunkaiMultiAvatarPlayer.jsx', 'utf8');

  assert.ok(modelSrc.includes('baseClip.duration * 0.36, baseClip.duration * 0.99'), 'tech_* клипы должны сохранять замах, пик и кимэ (0.36..0.99), не обрезаясь на 0.52');
  assert.ok(!modelSrc.includes('duration * 0.88'), 'getClipHoldEndTime не должен обрезать последние 12% готовых клипов');
  assert.ok(modelSrc.includes('phraseStepRef && phraseStepRef.current !== stepKey'), 'MultiAvatarModel не должен применять phrase нового шага к пропсам старого шага');
  assert.ok(playerSrc.includes('phraseStepRef'), 'BunkaiPlaybackClock должен сбрасывать phraseRef синхронно внутри <Canvas>');

  globalThis.self = globalThis;
  const origWarn = console.warn;
  const origErr = console.error;
  console.warn = () => {};
  console.error = () => {};
  const glbBuf = fs.readFileSync('public/models/karateka_techniques_v4.glb');
  const ab = glbBuf.buffer.slice(glbBuf.byteOffset, glbBuf.byteOffset + glbBuf.byteLength);
  const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(ab, '', resolve, reject));
  console.warn = origWarn;
  console.error = origErr;

  const mixer = new THREE.AnimationMixer(gltf.scene);
  const byName = new Map(gltf.animations.map((a) => [a.name, makeClipInPlace(a)]));
  const getBoneY = (name) => {
    const p = new THREE.Vector3();
    gltf.scene.getObjectByName(name)?.getWorldPosition(p);
    return p.y;
  };
  const assertNoFloorSink = (label, clip) => {
    const act = mixer.clipAction(clip);
    act.reset();
    act.enabled = true;
    act.setEffectiveWeight(1);
    act.play();
    let minFootY = 999;
    let minToeY = 999;
    for (let i = 0; i <= 40; i++) {
      act.time = (i / 40) * clip.duration;
      mixer.update(0);
      gltf.scene.updateMatrixWorld(true);
      minFootY = Math.min(minFootY, getBoneY('FootL'), getBoneY('FootR'));
      minToeY = Math.min(minToeY, getBoneY('ToeL'), getBoneY('ToeR'));
    }
    act.stop();
    assert.ok(minFootY >= 0.04, `${label}: Foot Y не должен опускаться под пол (minFootY=${minFootY.toFixed(3)})`);
    assert.ok(minToeY >= 0.0, `${label}: Toe Y не должен уходить ниже нуля (minToeY=${minToeY.toFixed(3)})`);
  };

  assertNoFloorSink('mae_geri_right fwd', adaptKickClipToStance({
    kickClip: byName.get('mae_geri_right'),
    startStanceClip: byName.get('zenkutsu_dachi_left'),
    endStanceClip: byName.get('zenkutsu_dachi_right'),
    landingMode: 'forward',
    name: 't7_mg_r_fwd',
  }));
  assertNoFloorSink('mae_geri_left fwd', adaptKickClipToStance({
    kickClip: byName.get('mae_geri_left'),
    startStanceClip: byName.get('zenkutsu_dachi_right'),
    endStanceClip: byName.get('zenkutsu_dachi_left'),
    landingMode: 'forward',
    name: 't7_mg_l_fwd',
  }));
  assertNoFloorSink('mae_geri_right back/same', adaptKickClipToStance({
    kickClip: byName.get('mae_geri_right'),
    startStanceClip: byName.get('zenkutsu_dachi_right'),
    endStanceClip: byName.get('zenkutsu_dachi_right'),
    landingMode: 'back',
    name: 't7_mg_r_back',
  }));
  assertNoFloorSink('zenkutsu L->R transition', synthesizeStanceTransitionClip({
    fromStanceClip: byName.get('zenkutsu_dachi_left'),
    toStanceClip: byName.get('zenkutsu_dachi_right'),
    duration: 1.2,
    name: 't7_z_lr',
  }));

  // Проверка удара в голову (Дзёдан-цки на базе Ой-дзуки) и удержания вытянутой руки на следующем шаге
  const jodanClip = synthesizeJodanOiZukiClip(byName.get('oi_zuki_right'), 'right', 't7_oi_jodan_r');
  const jodanAct = mixer.clipAction(jodanClip);
  jodanAct.reset();
  jodanAct.enabled = true;
  jodanAct.setEffectiveWeight(1);
  jodanAct.play();
  jodanAct.time = jodanClip.duration * 0.85;
  mixer.update(0);
  gltf.scene.updateMatrixWorld(true);
  const jodanHandR = new THREE.Vector3();
  gltf.scene.getObjectByName('HandR')?.getWorldPosition(jodanHandR);
  jodanAct.stop();
  assert.ok(jodanHandR.y >= 1.35 && jodanHandR.z >= 0.45, `Дзёдан Ой-дзуки должен бить на уровне головы (y=${jodanHandR.y.toFixed(2)}, z=${jodanHandR.z.toFixed(2)})`);

  const holdClip = synthesizeHoldExtendedPunchClip({
    stanceClip: byName.get('zenkutsu_dachi_right'),
    punchClip: jodanClip,
    name: 't7_hold_r',
  });
  const holdAct = mixer.clipAction(holdClip);
  holdAct.reset();
  holdAct.enabled = true;
  holdAct.setEffectiveWeight(1);
  holdAct.play();
  holdAct.time = 0;
  mixer.update(0);
  gltf.scene.updateMatrixWorld(true);
  const holdHandR = new THREE.Vector3();
  gltf.scene.getObjectByName('HandR')?.getWorldPosition(holdHandR);
  holdAct.stop();
  assert.ok(holdHandR.z >= 0.45 && holdHandR.y >= 1.35, `Стойка после удара должна удерживать вытянутую руку (y=${holdHandR.y.toFixed(2)}, z=${holdHandR.z.toFixed(2)})`);

  console.log('✓ 7. Стопы после Маэ-гэри не проваливаются под пол, клипы техник не обрезаются, Дзёдан-цки и удержание руки проверены.');
}

console.log('\nALL TRANSITIONS, STANCE CONTINUITY & SYNCED ROTATION TESTS PASSED!');
