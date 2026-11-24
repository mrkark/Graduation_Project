import {
  HEIAN_SHODAN_BUNKAI_18_STEPS,
  resolveBunkaiClip,
} from '../src/three/bunkaiScenarioEngine.js';

console.log('=== TEST SUITE: Bunkai 18 Steps Clip Resolution ===\n');

// Собираем все элементарные клипы из 18 шагов
const allClips = new Set();
HEIAN_SHODAN_BUNKAI_18_STEPS.forEach((step) => {
  step.participants.forEach((p) => {
    if (p.clipName) {
      const parts = p.clipName.split('+').map((s) => s.trim()).filter(Boolean);
      parts.forEach((c) => allClips.add(c));
    }
  });
});

console.log(`Found ${allClips.size} unique animation clip tokens in 18 steps:`);
console.log(Array.from(allClips).sort().join(', '));
console.log('\nTesting resolveBunkaiClip for each clip token:');

let unresolved = [];
for (const clip of allClips) {
  const resolved = resolveBunkaiClip(clip);
  console.log(`  Clip "${clip}" -> resolved: "${resolved ? resolved.clipName : 'NONE'}" (title: "${resolved ? resolved.title : ''}")`);
  if (!resolved) {
    unresolved.push(clip);
  }
}

console.log('\nTotal checked:', allClips.size);
console.log('Unresolved count:', unresolved.length);
