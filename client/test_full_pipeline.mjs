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

// Load uv json
const uvRaw = JSON.parse(fs.readFileSync('./public/models/sensei-uv.json', 'utf8'));
const bin = Buffer.from(uvRaw.uv, 'base64');
const atlasUV = new Float32Array(bin.buffer, bin.byteOffset, bin.byteLength / 4);

function buildCleanGeometry(sourceGeom, role, skeleton) {
  const pos = sourceGeom.attributes.position;
  const norm = sourceGeom.attributes.normal;
  const si = sourceGeom.attributes.skinIndex;
  const sw = sourceGeom.attributes.skinWeight;
  const boneNames = skeleton ? skeleton.bones.map(b => b.name) : [];
  const numTris = pos.count / 3;

  // BFS Islands
  const vertToTris = new Map();
  for (let t = 0; t < numTris; t++) {
    for (let k = 0; k < 3; k++) {
      const vi = t * 3 + k;
      const key = Math.round(pos.getX(vi) * 200) + '_' + Math.round(pos.getY(vi) * 200) + '_' + Math.round(pos.getZ(vi) * 200);
      let list = vertToTris.get(key);
      if (!list) { list = []; vertToTris.set(key, list); }
      list.push(t);
    }
  }

  const visited = new Uint8Array(numTris);
  const islands = [];
  for (let t = 0; t < numTris; t++) {
    if (visited[t]) continue;
    const queue = [t];
    visited[t] = 1;
    const island = [];
    while (queue.length > 0) {
      const cur = queue.pop();
      island.push(cur);
      for (let k = 0; k < 3; k++) {
        const vi = cur * 3 + k;
        const key = Math.round(pos.getX(vi) * 200) + '_' + Math.round(pos.getY(vi) * 200) + '_' + Math.round(pos.getZ(vi) * 200);
        const neighbors = vertToTris.get(key);
        if (neighbors) {
          for (let i = 0; i < neighbors.length; i++) {
            const n = neighbors[i];
            if (!visited[n]) { visited[n] = 1; queue.push(n); }
          }
        }
      }
    }
    islands.push(island);
  }

  const droppedTris = new Uint8Array(numTris);
  const beltTris = new Uint8Array(numTris);
  islands.forEach(isl => {
    if (isl.length === 1355 || isl.length === 139 || isl.length === 26) {
      isl.forEach(t => { droppedTris[t] = 1; });
    } else if (isl.length === 136 || isl.length === 101) {
      isl.forEach(t => { beltTris[t] = 1; });
    }
  });

  let keptCount = 0;
  for (let t = 0; t < numTris; t++) {
    if (!droppedTris[t]) keptCount++;
  }

  const newVertCount = keptCount * 3;
  const newPos = new Float32Array(newVertCount * 3);
  const newNorm = new Float32Array(newVertCount * 3);
  const newUV = new Float32Array(newVertCount * 2);
  const newSI = new Float32Array(newVertCount * 4);
  const newSW = new Float32Array(newVertCount * 4);
  const newCol = new Float32Array(newVertCount * 3);

  // Gi color setup
  let giR = 1.0, giG = 1.0, giB = 1.0;
  if (role === 'uke') {
    const c = new THREE.Color('#3a4a5e');
    giR = c.r; giG = c.g; giB = c.b;
  } else if (role === 'uke2') {
    const c = new THREE.Color('#423737');
    giR = c.r; giG = c.g; giB = c.b;
  }

  let dst = 0;
  for (let t = 0; t < numTris; t++) {
    if (droppedTris[t]) continue;
    for (let k = 0; k < 3; k++) {
      const src = t * 3 + k;
      const x = pos.getX(src), y = pos.getY(src), z = pos.getZ(src);
      const ax = Math.abs(x);

      newPos[dst * 3] = x;
      newPos[dst * 3 + 1] = y;
      newPos[dst * 3 + 2] = z;

      newNorm[dst * 3] = norm.getX(src);
      newNorm[dst * 3 + 1] = norm.getY(src);
      newNorm[dst * 3 + 2] = norm.getZ(src);

      newUV[dst * 2] = atlasUV[src * 2];
      newUV[dst * 2 + 1] = atlasUV[src * 2 + 1];

      for (let c = 0; c < 4; c++) {
        newSI[dst * 4 + c] = si.getComponent(src, c);
        newSW[dst * 4 + c] = sw.getComponent(src, c);
      }

      // Check skin / belt / gi
      let isSkin = false;
      let isBelt = beltTris[t] === 1;

      if (!isBelt && y >= 49.5 && y <= 53.5 && ax <= 12.5 && z >= -8.5 && z <= 9.0) {
        isBelt = true;
      }

      if (!isBelt) {
        if (y >= 80.5) isSkin = true;
        if (ax >= 36.8 && y >= 64.0 && y <= 82.0) isSkin = true;
        if (y <= 8.5 && ax >= 6.0) isSkin = true;

        if (si && sw && !isSkin) {
          for (let w = 0; w < 4; w++) {
            const b = boneNames[si.getComponent(src, w)];
            const weight = sw.getComponent(src, w);
            if (weight > 0.25) {
              if (b && (b.includes('Head') || b.includes('Neck') || b.includes('Hand') || b.includes('Foot') || b.includes('Toe'))) {
                isSkin = true;
                break;
              }
            }
          }
        }
      }

      if (isBelt) {
        newCol[dst * 3] = 0.12;
        newCol[dst * 3 + 1] = 0.12;
        newCol[dst * 3 + 2] = 0.12;
      } else if (isSkin) {
        newCol[dst * 3] = 1.0;
        newCol[dst * 3 + 1] = 1.0;
        newCol[dst * 3 + 2] = 1.0;
      } else {
        newCol[dst * 3] = giR;
        newCol[dst * 3 + 1] = giG;
        newCol[dst * 3 + 2] = giB;
      }

      dst++;
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
  geom.setAttribute('normal', new THREE.BufferAttribute(newNorm, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(newUV, 2));
  geom.setAttribute('skinIndex', new THREE.BufferAttribute(newSI, 4));
  geom.setAttribute('skinWeight', new THREE.BufferAttribute(newSW, 4));
  geom.setAttribute('color', new THREE.BufferAttribute(newCol, 3));
  return geom;
}

const toriGeom = buildCleanGeometry(fbx.children[0].geometry, 'tori', fbx.children[0].skeleton);
const ukeGeom = buildCleanGeometry(fbx.children[0].geometry, 'uke', fbx.children[0].skeleton);

console.log('Tori geom created:', toriGeom.attributes.position.count, 'verts');
console.log('Uke geom created:', ukeGeom.attributes.position.count, 'verts');

// Clone 2 meshes and bind
const cloneTori = SkeletonUtils.clone(fbx);
const cloneUke = SkeletonUtils.clone(fbx);

cloneTori.children[0].geometry = toriGeom;
cloneTori.children[0].bind(cloneTori.children[0].skeleton, cloneTori.children[0].bindMatrix);

cloneUke.children[0].geometry = ukeGeom;
cloneUke.children[0].bind(cloneUke.children[0].skeleton, cloneUke.children[0].bindMatrix);

// Load an animation clip and test mixer update
const animRaw = JSON.parse(fs.readFileSync('./public/anims/choku_zuki.json', 'utf8'));
const clip = THREE.AnimationClip.parse(animRaw);

const mixerTori = new THREE.AnimationMixer(cloneTori);
const actionTori = mixerTori.clipAction(clip);
actionTori.play();
mixerTori.update(0.1);

const mixerUke = new THREE.AnimationMixer(cloneUke);
const actionUke = mixerUke.clipAction(clip);
actionUke.play();
mixerUke.update(0.1);

console.log('Animation mixer updated successfully on both Tori and Uke without any errors!');
