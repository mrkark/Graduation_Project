import fs from 'fs';
const dummyEl = { setAttribute: () => {}, style: {}, addEventListener: () => {}, removeEventListener: () => {} };
globalThis.window = { URL: { createObjectURL: () => '' } };
globalThis.document = { createElementNS: () => dummyEl, createElement: () => dummyEl };
globalThis.Blob = class Blob {};
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const buffer = fs.readFileSync('./public/models/sensei.fbx');
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const loader = new FBXLoader();
const fbx = loader.parse(arrayBuffer, '');

// Clone using SkeletonUtils
const clone = SkeletonUtils.clone(fbx);
let skinnedMesh;
clone.traverse(child => { if (child.isSkinnedMesh) skinnedMesh = child; });

console.log('Original skinnedMesh bones:', skinnedMesh.skeleton.bones.length);
console.log('Original boneInverses:', skinnedMesh.skeleton.boneInverses.length);

// Let's create a new BufferGeometry and test bind
const newGeom = new THREE.BufferGeometry();
newGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(30), 3));
newGeom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(30), 3));
newGeom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(20), 2));
newGeom.setAttribute('skinIndex', new THREE.BufferAttribute(new Float32Array(40), 4));
newGeom.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(40), 4));

skinnedMesh.geometry.dispose();
skinnedMesh.geometry = newGeom;
skinnedMesh.bind(skinnedMesh.skeleton, skinnedMesh.bindMatrix);

console.log('Successfully re-bound new geometry to skeleton!');
console.log('Bone count after re-bind:', skinnedMesh.skeleton.bones.length);
