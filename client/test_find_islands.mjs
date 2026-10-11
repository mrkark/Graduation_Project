import fs from 'fs';
const dummyEl = { setAttribute: () => {}, style: {}, addEventListener: () => {}, removeEventListener: () => {} };
globalThis.window = { URL: { createObjectURL: () => '' } };
globalThis.document = { createElementNS: () => dummyEl, createElement: () => dummyEl };
globalThis.Blob = class Blob {};
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const buffer = fs.readFileSync('./public/models/sensei.fbx');
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const loader = new FBXLoader();
const group = loader.parse(arrayBuffer, '');
let mesh;
group.traverse(child => { if (child.isMesh) mesh = child; });
const geom = mesh.geometry;
const pos = geom.attributes.position;
const norm = geom.attributes.normal;
const origUV = geom.attributes.uv;
const si = geom.attributes.skinIndex;
const sw = geom.attributes.skinWeight;
const numTris = pos.count / 3;

// Load Atlas UV
const uvRaw = JSON.parse(fs.readFileSync('./public/models/sensei-uv.json', 'utf8'));
const bin = Buffer.from(uvRaw.uv, 'base64');
const atlasUV = new Float32Array(bin.buffer, bin.byteOffset, bin.byteLength / 4);

// Connected islands
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

// Dropped islands: Hat (1355) and hair cards (139, 139, 26)
const droppedTris = new Uint8Array(numTris);
islands.forEach(isl => {
  if (isl.length === 1355 || isl.length === 139 || isl.length === 26) {
    isl.forEach(t => { droppedTris[t] = 1; });
  }
});

let keptTrisCount = 0;
for (let t = 0; t < numTris; t++) {
  if (!droppedTris[t]) keptTrisCount++;
}

const newVertCount = keptTrisCount * 3;
const newPos = new Float32Array(newVertCount * 3);
const newNorm = new Float32Array(newVertCount * 3);
const newUV = new Float32Array(newVertCount * 2);
const newSI = new Float32Array(newVertCount * 4);
const newSW = new Float32Array(newVertCount * 4);
const newCol = new Float32Array(newVertCount * 3);

let dst = 0;
for (let t = 0; t < numTris; t++) {
  if (droppedTris[t]) continue;
  for (let k = 0; k < 3; k++) {
    const src = t * 3 + k;
    newPos[dst * 3] = pos.getX(src);
    newPos[dst * 3 + 1] = pos.getY(src);
    newPos[dst * 3 + 2] = pos.getZ(src);

    newNorm[dst * 3] = norm.getX(src);
    newNorm[dst * 3 + 1] = norm.getY(src);
    newNorm[dst * 3 + 2] = norm.getZ(src);

    newUV[dst * 2] = atlasUV[src * 2];
    newUV[dst * 2 + 1] = atlasUV[src * 2 + 1];

    for (let c = 0; c < 4; c++) {
      newSI[dst * 4 + c] = si.getComponent(src, c);
      newSW[dst * 4 + c] = sw.getComponent(src, c);
    }
    dst++;
  }
}

console.log('Successfully created clean BufferGeometry data:');
console.log('Vertices:', dst, 'Triangles:', dst / 3);
