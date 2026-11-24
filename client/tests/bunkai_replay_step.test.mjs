import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Bunkai Replay Step System & WebGL Context Loss Handlers', async (t) => {
  const multiAvatarModelPath = path.join(__dirname, '../src/three/MultiAvatarModel.jsx');
  const playerPath = path.join(__dirname, '../src/three/BunkaiMultiAvatarPlayer.jsx');
  const panelPath = path.join(__dirname, '../src/three/BunkaiMotionControlPanel.jsx');

  const multiAvatarSource = fs.readFileSync(multiAvatarModelPath, 'utf-8');
  const playerSource = fs.readFileSync(playerPath, 'utf-8');
  const panelSource = fs.readFileSync(panelPath, 'utf-8');

  await t.test('1. MultiAvatarModel accepts replayTrigger and rewinds animation actions cleanly', () => {
    assert.match(multiAvatarSource, /replayTrigger\s*=\s*0/, 'MultiAvatarModel should accept replayTrigger in props');
    assert.match(multiAvatarSource, /replayTrigger\]\);/, 'useEffect should depend on replayTrigger for instant rewind');
    assert.match(multiAvatarSource, /prevPhraseRef\.current\s*>\s*0\.70\s*&&\s*phrase\s*<\s*0\.10/, 'useFrame should detect rewind/loop and replay subclip 0');
    assert.match(multiAvatarSource, /idx\s*===\s*0/, 'playSubclipAt should handle idx === 0 cleanly on replay');
  });

  await t.test('2. BunkaiMultiAvatarPlayer maintains replayNonce, connects hotkeys, and passes trigger to all avatars', () => {
    assert.match(playerSource, /const\s*\[replayNonce,\s*setReplayNonce\]\s*=\s*useState\(0\)/, 'Player should declare replayNonce state');
    assert.match(playerSource, /setReplayNonce\(\(n\)\s*=>\s*n\s*\+\s*1\)/, 'handleReplayStep should increment replayNonce');
    assert.match(playerSource, /replayTrigger=\{replayNonce\}/, 'Player should pass replayTrigger to avatar models');
    assert.match(playerSource, /e\.code\s*===\s*'KeyR'/, 'Player should support hotkey R for instant step replay');
    assert.match(playerSource, /onReplayStep=\{handleReplayStep\}/, 'Player should pass onReplayStep to BunkaiMotionControlPanel');
  });

  await t.test('3. BunkaiMultiAvatarPlayer automatically rewinds and replays when user modifies any motion parameter', () => {
    // In handleUniversalParamChange, phrase is reset and replayNonce is incremented
    const fnMatch = playerSource.match(/handleUniversalParamChange\s*=\s*useCallback\([\s\S]*?\n\s*\},/);
    assert.ok(fnMatch, 'handleUniversalParamChange should exist');
    const fnBody = fnMatch[0];
    assert.ok(fnBody.includes('phraseRef.current = 0'), 'Modifying motion param should reset phrase to 0 for instant testing');
    assert.ok(fnBody.includes('setReplayNonce'), 'Modifying motion param should increment replayNonce');
    assert.ok(fnBody.includes('setIsPlaying(true)'), 'Modifying motion param should resume playing');
  });

  await t.test('4. WebGL context loss is handled on Canvas to prevent crashes', () => {
    assert.match(playerSource, /webglcontextlost/, 'Canvas should have listener for webglcontextlost');
    assert.match(playerSource, /e\.preventDefault\(\)/, 'webglcontextlost should call e.preventDefault() to preserve renderer');
  });

  await t.test('5. BunkaiMotionControlPanel renders dedicated "Повторить шаг (R)" button in header', () => {
    assert.match(panelSource, /onReplayStep\s*=\s*null/, 'BunkaiMotionControlPanel should accept onReplayStep in props');
    assert.match(panelSource, /RotateCcw/, 'BunkaiMotionControlPanel should import and use RotateCcw');
    assert.match(panelSource, /Повторить шаг \(R\)/, 'BunkaiMotionControlPanel should display a prominent "Повторить шаг (R)" button');
    assert.match(panelSource, /onClick=\{onReplayStep\}/, 'Button should invoke onReplayStep');
  });

  await t.test('6. Behavioral simulation: step execution, clamp, and instant replay flow', () => {
    let phrase = 0.0;
    let isPlaying = true;
    let stepCompleted = false;
    let replayNonce = 0;
    let activeAction = { time: 0, paused: false, effectiveWeight: 1.0, clamped: false };
    let finalStanceApplied = false;

    function stepTick(dt, duration = 2.0) {
      if (!isPlaying) return;
      phrase = Math.min(1.0, phrase + dt / duration);
      activeAction.time = phrase * 1.5;
      if (phrase >= 0.70) {
        finalStanceApplied = true;
      }
      if (phrase >= 1.0) {
        stepCompleted = true;
        activeAction.clamped = true;
        isPlaying = false;
      }
    }

    function replay() {
      phrase = 0.0;
      stepCompleted = false;
      isPlaying = true;
      replayNonce += 1;
      // MultiAvatarModel response to replayTrigger:
      activeAction.time = 0.0;
      activeAction.clamped = false;
      activeAction.effectiveWeight = 1.0;
      finalStanceApplied = false;
    }

    // Step plays to completion
    stepTick(1.0); // phrase = 0.5
    assert.equal(stepCompleted, false);
    stepTick(1.0); // phrase = 1.0
    assert.equal(stepCompleted, true);
    assert.equal(activeAction.clamped, true);
    assert.equal(finalStanceApplied, true);

    // User tests a motion change / clicks "Повторить шаг"
    replay();
    assert.equal(replayNonce, 1);
    assert.equal(phrase, 0.0);
    assert.equal(stepCompleted, false);
    assert.equal(isPlaying, true);
    assert.equal(activeAction.time, 0.0);
    assert.equal(activeAction.clamped, false);
    assert.equal(finalStanceApplied, false);
  });
});
