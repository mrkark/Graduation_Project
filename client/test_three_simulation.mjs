globalThis.self = globalThis;
import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const glbPath = './public/models/karateka_lowpoly.glb';
const buffer = fs.readFileSync(glbPath);
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const loader = new GLTFLoader();
loader.parse(arrayBuffer, '', (gltf) => {
  console.log('GLTF scene loaded successfully!');
  const scene = gltf.scene;

  console.log('\n--- SCENE CHILDREN ---');
  scene.traverse((child) => {
    if (child.isSkinnedMesh) {
      console.log(`  SkinnedMesh: ${child.name}, skeleton bones: ${child.skeleton.bones.length}`);
    }
  });

  const cloned = SkeletonUtils.clone(scene);

  // Load stance_ready.json
  const animJson = JSON.parse(fs.readFileSync('./public/anims/stance_ready.json', 'utf8'));
  const clip = THREE.AnimationClip.parse(animJson);
  console.log(`\nParsed clip: ${clip.name}, tracks: ${clip.tracks.length}, duration: ${clip.duration}`);

  const mixer = new THREE.AnimationMixer(cloned);
  const action = mixer.clipAction(clip);
  action.play();

  // Tick mixer
  mixer.update(0.1);

  console.log('\n--- BONE ROTATIONS & QUATERNIONS AFTER MIXER UPDATE ---');
  cloned.traverse((child) => {
    if (child.isBone) {
      if (child.name.includes('Leg') || child.name.includes('Arm') || child.name.includes('Hips')) {
        console.log(`Bone ${child.name}: pos=[${child.position.toArray().map(v=>v.toFixed(3))}], quat=[${child.quaternion.toArray().map(v=>v.toFixed(3))}]`);
      }
    }
  });

  // Check meshes in cloned scene: does each SkinnedMesh have a skeleton?
  console.log('\n--- CHECK SKINNED MESHES IN CLONE ---');
  cloned.traverse((child) => {
    if (child.isSkinnedMesh) {
      console.log(`SkinnedMesh: ${child.name}`);
      console.log(`  skeleton root: ${child.skeleton.bones[0]?.name}`);
      console.log(`  bindMatrix:`, child.bindMatrix.elements.slice(0, 4));
    }
  });

}, (err) => {
  console.error('Error parsing GLTF:', err);
});
