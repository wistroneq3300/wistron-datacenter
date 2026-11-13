import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../../vendor/three.module.js';

const moduleURL = new URL('../../modules/environment/hq5-vegetation.js', import.meta.url);
const source = fs.readFileSync(moduleURL, 'utf8').replace("from 'three'", `from '${new URL('../../vendor/three.module.js', import.meta.url).href}'`);
const { HQVegetation, DEFAULT_TREE_ROOTS } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const renderer = { capabilities: { getMaxAnisotropy: () => 8 } };

// These are CPU geometry/lifecycle tests with an explicitly synthetic texture
// loader. Actual image decode, WebGL shaders and visual quality require the
// retained browser/render tests; this suite does not claim those as covered.
async function syntheticTextures(run) {
  const original = THREE.TextureLoader.prototype.loadAsync;
  THREE.TextureLoader.prototype.loadAsync = async () => new THREE.Texture();
  try { await run(); } finally { THREE.TextureLoader.prototype.loadAsync = original; }
}

test('Landscape construction produces finite curved geometry and individual leaf coverage', () => syntheticTextures(async () => {
  const scene = new THREE.Scene(), vegetation = new HQVegetation(scene, renderer);
  await vegetation.ready;
  const stats = vegetation.stats();
  assert.equal(stats.trees, 10); assert.equal(stats.geometries, 2); assert.equal(stats.materials, 3); assert.equal(stats.textures, 7);
  assert.ok(stats.leaves > 30000 && stats.leaves < 70000); assert.ok(stats.branches > 2000);
  assert.equal(vegetation.branchMesh.geometry.type, 'BufferGeometry');
  assert.equal(vegetation.root.userData.evidence.status, 'draft');
  for (const geometry of vegetation.geometries) {
    for (const name of ['position', 'normal', 'uv']) assert.ok([...geometry.getAttribute(name).array].every(Number.isFinite), `${name} must be finite`);
    assert.ok(Number.isFinite(geometry.boundingSphere?.radius ?? 1));
  }
  for (const item of vegetation.foliage) {
    assert.ok(item.mesh.boundingBox.min.y > 2); assert.ok(item.mesh.boundingBox.max.y < 11);
    assert.equal(item.mesh.geometry, vegetation.leafGeometry); assert.equal(item.mesh.material, vegetation.leaves);
  }
  vegetation.dispose();
}));

test('Seeds reproduce geometry; distinct roots produce distinct curved trees', () => syntheticTextures(async () => {
  const scene = new THREE.Scene(), options = { roots: DEFAULT_TREE_ROOTS.slice(0, 2), seed: 53 };
  const first = new HQVegetation(scene, renderer, options), second = new HQVegetation(scene, renderer, options);
  await Promise.all([first.ready, second.ready]);
  assert.deepEqual(first.branchMesh.geometry.attributes.position.array, second.branchMesh.geometry.attributes.position.array);
  assert.deepEqual(first.foliage[0].mesh.instanceMatrix.array, second.foliage[0].mesh.instanceMatrix.array);
  assert.notDeepEqual(first.foliage[0].mesh.instanceMatrix.array, first.foliage[1].mesh.instanceMatrix.array);
  first.dispose(); second.dispose();
}));

test('Distance LOD and lighting changes reuse resources, preserve every tree and apply hysteresis', () => syntheticTextures(async () => {
  const scene = new THREE.Scene(), vegetation = new HQVegetation(scene, renderer, { roots: [[0, 0, 0], [5, 0, 0]] });
  await vegetation.ready;
  const near = vegetation.stats(), geometry = vegetation.leafGeometry, texture = vegetation.leaves.map;
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 5, 200); scene.updateMatrixWorld();
  vegetation.update(camera, 1); vegetation.update(camera, 2);
  assert.ok(vegetation.stats().renderedLeaves < near.renderedLeaves * .6);
  assert.ok(vegetation.foliage.every(item => item.mesh.count > 1000));
  camera.position.set(0, 5, 150); vegetation.update(camera, 3);
  assert.ok(vegetation.foliage.every(item => item.level === 2));
  camera.position.set(0, 5, 0); vegetation.update(camera, 4); vegetation.update(camera, 5);
  assert.equal(vegetation.stats().renderedLeaves, near.renderedLeaves);
  vegetation.setLighting('night'); assert.equal(vegetation._uniforms.hqTranslucency.value, 0);
  vegetation.setLighting('dusk'); assert.ok(vegetation._uniforms.hqTranslucency.value > 0);
  assert.equal(vegetation.leafGeometry, geometry); assert.equal(vegetation.leaves.map, texture);
  assert.equal(vegetation.stats().textures, near.textures); vegetation.dispose();
}));

test('Dispose releases each owned geometry, material, texture and instance exactly once', () => syntheticTextures(async () => {
  const scene = new THREE.Scene(), vegetation = new HQVegetation(scene, renderer, { roots: [[0, 0, 0]], shrubs: [{ position: [1, 0, 0] }] });
  await vegetation.ready;
  const actual = { geometry: 0, material: 0, texture: 0, instance: 0 };
  const expected = { geometry: 2, material: 3, texture: 7, instance: 2 };
  for (const [key, items] of [['geometry', vegetation.geometries], ['material', vegetation.materials], ['texture', vegetation.textures]]) {
    for (const item of items) item.addEventListener('dispose', () => actual[key]++);
  }
  for (const item of vegetation.foliage) item.mesh.addEventListener('dispose', () => actual.instance++);
  vegetation.dispose(); vegetation.dispose();
  assert.deepEqual(actual, expected); assert.equal(scene.children.length, 0);
  assert.equal(vegetation.stats().textures, 0); assert.equal(vegetation.stats().geometries, 0);
}));

test('Cancelled asynchronous loading disposes late textures and never reattaches foliage', async () => {
  const original = THREE.TextureLoader.prototype.loadAsync, pending = [];
  THREE.TextureLoader.prototype.loadAsync = () => new Promise(resolve => pending.push(resolve));
  try {
    const scene = new THREE.Scene(), vegetation = new HQVegetation(scene, renderer, { roots: [[0, 0, 0]] });
    vegetation.dispose(); let disposedTextures = 0;
    for (const resolve of pending) { const texture = new THREE.Texture(); texture.addEventListener('dispose', () => disposedTextures++); resolve(texture); }
    const status = await vegetation.ready;
    assert.equal(status.disposed, true); assert.equal(disposedTextures, 7);
    assert.equal(vegetation.stats().textures, 0); assert.equal(scene.children.length, 0);
  } finally { THREE.TextureLoader.prototype.loadAsync = original; }
});

test('Malformed planting data is rejected before any scene resource is attached', () => {
  const scene = new THREE.Scene();
  for (const options of [{ roots: [[NaN, 0, 0]] }, { roots: [{ position: [0, 0, 0], height: Infinity }] }, { shrubs: [[0, 0, 0]] }, { roots: Array.from({ length: 65 }, () => [0, 0, 0]) }]) {
    assert.throws(() => new HQVegetation(scene, renderer, options), TypeError); assert.equal(scene.children.length, 0);
  }
});

test('Every shipped vegetation surface matches its original CC0 asset checksum', () => {
  const directory = new URL('../../assets/environment/hq5-vegetation/', import.meta.url);
  const manifest = JSON.parse(fs.readFileSync(new URL('provenance.json', directory), 'utf8').replace(/^\uFEFF/, ''));
  assert.equal(manifest.files.length, 7);
  for (const entry of manifest.files) {
    const bytes = fs.readFileSync(new URL(entry.file, directory));
    assert.equal(bytes.length, entry.bytes); assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    assert.equal(entry.license, 'CC0-1.0'); assert.equal(new URL(entry.url).hostname, 'dl.polyhaven.org');
  }
});
