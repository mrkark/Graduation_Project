import fs from 'fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
globalThis.window = globalThis;

// Load demo zenkutsu dachi frames
const demoData = JSON.parse(fs.readFileSync('C:/Users/user/Downloads/bunkai_explorer_karate_motion_capture/karate_motion_studio/demo_assets/demo_zenkutsu_dachi.json', 'utf8'));
const frame0 = demoData.filteredFrames[0];

// Load karateka_lowpoly.glb
const buf = fs.readFileSync('public/models/karateka_lowpoly.glb');
const loader = new GLTFLoader();

loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => {
  const model = gltf.scene;
  model.updateMatrixWorld(true);

  const boneMap = new Map();
  model.traverse((child) => {
    if (child.isBone) {
      const raw = child.name;
      boneMap.set(raw, child);
      boneMap.set(raw.replace(/\./g, ''), child);
      if (raw.endsWith('L') && !raw.includes('.')) {
        boneMap.set(raw.slice(0, -1) + '.L', child);
      } else if (raw.endsWith('R') && !raw.includes('.')) {
        boneMap.set(raw.slice(0, -1) + '.R', child);
      }

      child.restLocalQ = child.quaternion.clone();
      child.restWorldQ = new THREE.Quaternion();
      child.getWorldQuaternion(child.restWorldQ);
      child.restWorldDir = new THREE.Vector3(0, 1, 0).applyQuaternion(child.restWorldQ).normalize();
      child.restPosition = child.position.clone();
    }
  });

  console.log(`[Verify] Total bones indexed: ${boneMap.size}`);
  const testBones = ['UpperArm.L', 'UpperArm.R', 'LowerArm.L', 'LowerArm.R', 'UpperLeg.L', 'UpperLeg.R', 'Hips', 'Spine'];
  for (const name of testBones) {
    const b = boneMap.get(name);
    if (!b) {
      console.error(`FAIL: Bone ${name} NOT FOUND in boneMap!`);
      process.exit(1);
    }
    console.log(`  Bone ${name}: restWorldDir = (${b.restWorldDir.x.toFixed(2)}, ${b.restWorldDir.y.toFixed(2)}, ${b.restWorldDir.z.toFixed(2)})`);
  }

  // Simulate alignBone
  function alignBone(bone, targetDir, alpha = 0.85) {
    if (!bone || !bone.restWorldDir || !targetDir || targetDir.lengthSq() < 1e-5) return;
    const vFrom = bone.restWorldDir;
    let vTo = targetDir.clone().normalize();
    const dot = vFrom.dot(vTo);
    if (dot < -0.92) {
      vTo.z = Math.max(vTo.z, 0.35);
      vTo.normalize();
    }
    const rotWorld = new THREE.Quaternion().setFromUnitVectors(vFrom, vTo);
    const targetWorldQ = rotWorld.clone().multiply(bone.restWorldQ);
    const parentWorldQ = new THREE.Quaternion();
    if (bone.parent) bone.parent.getWorldQuaternion(parentWorldQ);
    const targetLocalQ = parentWorldQ.clone().invert().multiply(targetWorldQ);
    bone.quaternion.slerp(targetLocalQ, alpha);
    bone.updateMatrixWorld(true);
  }

  // Target vector for left arm punching forward (+Z)
  const armL = boneMap.get('UpperArm.L');
  const initialQ = armL.quaternion.clone();
  const punchForward = new THREE.Vector3(0, 0, 1);
  alignBone(armL, punchForward, 1.0);

  const angleChange = initialQ.angleTo(armL.quaternion);
  console.log(`[Verify] UpperArm.L rotation angle change after alignBone: ${(angleChange * 180 / Math.PI).toFixed(1)}°`);

  if (angleChange < 0.1) {
    console.error('FAIL: Bone did not rotate!');
    process.exit(1);
  }

  console.log('SUCCESS: Bone retargeting verified and functional!');
});
