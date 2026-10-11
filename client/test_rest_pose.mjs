globalThis.self = globalThis;
import fs from 'fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const buffer = fs.readFileSync('./public/models/karateka_lowpoly.glb');
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const loader = new GLTFLoader();
loader.parse(arrayBuffer, '', (gltf) => {
  const scene = gltf.scene;
  console.log('=== BONES BEFORE ANY ANIMATION (REST POSE IN THREE.JS) ===');
  scene.traverse((child) => {
    if (child.isBone) {
      if (child.name.includes('Leg') || child.name.includes('Arm') || child.name.includes('Hips') || child.name.includes('Spine')) {
        console.log(`Bone ${child.name}: pos=[${child.position.toArray().map(v=>v.toFixed(3))}], rot=[${child.rotation.toArray().slice(0,3).map(v=>v.toFixed(3))}], quat=[${child.quaternion.toArray().map(v=>v.toFixed(3))}]`);
      }
    }
  });

  console.log('\n=== MESH BOUNDING BOXES (REST POSE) ===');
  scene.traverse((child) => {
    if (child.isSkinnedMesh) {
      child.geometry.computeBoundingBox();
      const bb = child.geometry.boundingBox;
      console.log(`SkinnedMesh ${child.name}: Y min=${bb.min.y.toFixed(3)}, max=${bb.max.y.toFixed(3)}, Z min=${bb.min.z.toFixed(3)}, max=${bb.max.z.toFixed(3)}`);
    }
  });
});
