globalThis.self = globalThis;
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import fs from 'fs';

const buffer = fs.readFileSync('./public/models/karateka_lowpoly.glb');
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const loader = new GLTFLoader();
loader.parse(arrayBuffer, '', (gltf) => {
  const scene = gltf.scene;
  const clone = SkeletonUtils.clone(scene);

  const animJson = JSON.parse(fs.readFileSync('./public/anims/stance_ready.json', 'utf8'));
  const clip = THREE.AnimationClip.parse(animJson);
  const mixer = new THREE.AnimationMixer(clone);
  const action = mixer.clipAction(clip);
  action.play();

  // Simulate several frames
  for (let i = 0; i < 30; i++) mixer.update(0.033);

  console.log('\n--- BONE WORLD POSITIONS AFTER 30 FRAMES ---');
  clone.traverse(c => {
    if (c.isBone) {
      if (['Root', 'Hips', 'UpperArmL', 'UpperArmR', 'UpperLegL', 'UpperLegR', 'LowerArmL', 'LowerLegL'].includes(c.name)) {
        const wp = c.getWorldPosition(new THREE.Vector3());
        console.log(c.name, '  worldPos:', wp.toArray().map(v => v.toFixed(3)), '  localPos:', c.position.toArray().map(v => v.toFixed(3)));
      }
    }
  });

  // Check for any bone with extreme positions
  console.log('\n--- BONES WITH EXTREME WORLD POSITION (>5 units) ---');
  clone.traverse(c => {
    if (c.isBone) {
      const wp = c.getWorldPosition(new THREE.Vector3());
      if (Math.abs(wp.x) > 5 || Math.abs(wp.y) > 5 || Math.abs(wp.z) > 5) {
        console.log('EXTREME:', c.name, wp.toArray().map(v => v.toFixed(3)));
      }
    }
  });
}, (err) => console.error('Error:', err));
