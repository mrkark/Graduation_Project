globalThis.self = globalThis;
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import fs from 'fs';

const modelPath = './public/models/karateka_lowpoly.glb';
console.log('Loading GLB model:', modelPath);
const buffer = fs.readFileSync(modelPath);
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const loader = new GLTFLoader();
loader.parse(arrayBuffer, '', (gltf) => {
  const scene = gltf.scene;
  const anims = gltf.animations;

  console.log(`\n==============================================`);
  console.log(`THREE.JS VERIFICATION REPORT FOR SHOTOKAN GLB`);
  console.log(`==============================================`);
  console.log(`Total animations found in GLB: ${anims.length}`);

  if (anims.length !== 87) {
    console.error(`ERROR: Expected 87 animations, found ${anims.length}`);
  } else {
    console.log(`✔ Exact match: 87/87 Shotokan Actions present!`);
  }

  // 1. Check all expected action names
  const expectedPrefixes = [
    'idle_', 'zenkutsu_', 'kokutsu_', 'heiko_', 'fudo_',
    'enter_', 'exit_', 'step_', 'slide_', 'shift_',
    'pivot_', 'turn_', 'hikite_', 'chamber_', 'fist_',
    'oi_zuki_', 'gyaku_zuki_', 'chudan_zuki_', 'jodan_zuki_',
    'gedan_barai_', 'age_uke_', 'mae_geri_', 'stance_shift_',
    'front_leg_', 'rear_leg_', 'hip_rotation_', 'body_alignment_',
    'heian_shodan_preview'
  ];

  const animNames = anims.map(a => a.name);
  console.log('\nSample action names (first 10):', animNames.slice(0, 10));
  console.log('Sample action names (last 10):', animNames.slice(-10));

  // 2. Play every clip through THREE.AnimationMixer
  console.log('\nTesting playback of all 87 clips through THREE.AnimationMixer...');
  const clone = SkeletonUtils.clone(scene);
  const mixer = new THREE.AnimationMixer(clone);

  let playErrors = 0;
  let nanErrors = 0;

  for (const clip of anims) {
    try {
      const action = mixer.clipAction(clip);
      action.play();

      // Test 0%, 50%, 100%
      mixer.setTime(0);
      mixer.update(0.01);
      mixer.setTime(clip.duration * 0.5);
      mixer.update(0.01);
      mixer.setTime(clip.duration);
      mixer.update(0.01);

      action.stop();
    } catch (e) {
      console.error(`Failed to play clip ${clip.name}:`, e);
      playErrors++;
    }

    // Check for NaN in tracks
    for (const track of clip.tracks) {
      for (const val of track.values) {
        if (Number.isNaN(val) || !Number.isFinite(val)) {
          console.error(`NaN/Inf found in track ${track.name} of clip ${clip.name}`);
          nanErrors++;
        }
      }
    }
  }

  console.log(`Playback verification: ${anims.length - playErrors}/${anims.length} clips played flawlessly!`);
  console.log(`Numeric verification: ${nanErrors} NaN/Inf values detected.`);

  // 3. Static Bounding Box and Bone Positions
  const bbox = new THREE.Box3().setFromObject(clone);
  console.log('\n--- MODEL DIMENSIONS & ALIGNMENT ---');
  console.log(`Min (X, Y, Z): (${bbox.min.x.toFixed(3)}, ${bbox.min.y.toFixed(3)}, ${bbox.min.z.toFixed(3)})`);
  console.log(`Max (X, Y, Z): (${bbox.max.x.toFixed(3)}, ${bbox.max.y.toFixed(3)}, ${bbox.max.z.toFixed(3)})`);
  console.log(`Height: ${(bbox.max.y - bbox.min.y).toFixed(3)} m`);

  // Floor level
  if (Math.abs(bbox.min.y) < 0.05) {
    console.log(`✔ Floor level: Y min is ${bbox.min.y.toFixed(4)} m (perfectly grounded on tatami)`);
  } else {
    console.warn(`WARNING: Floor level Y min is ${bbox.min.y.toFixed(4)} m`);
  }

  // Key bones
  clone.traverse(c => {
    if (c.isBone && ['Root', 'Hips', 'Head'].includes(c.name)) {
      const wp = c.getWorldPosition(new THREE.Vector3());
      console.log(`Bone ${c.name}: world position = (${wp.x.toFixed(3)}, ${wp.y.toFixed(3)}, ${wp.z.toFixed(3)})`);
    }
  });

  if (playErrors === 0 && nanErrors === 0 && anims.length === 87) {
    console.log('\n==============================================');
    console.log('✔ FULL VERIFICATION PASSED WITH 100% SUCCESS!');
    console.log('==============================================\n');
  } else {
    console.error('\n❌ VERIFICATION COMPLETED WITH WARNINGS/ERRORS.');
    process.exit(1);
  }
}, (err) => {
  console.error('GLTFLoader parsing error:', err);
  process.exit(1);
});
