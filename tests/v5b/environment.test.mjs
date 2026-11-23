import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../../vendor/three.module.js';

const load = async path => {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8')
    .replace("from 'three'", `from '${new URL('../../vendor/three.module.js', import.meta.url).href}'`)
    .replace("from '../../vendor/BufferGeometryUtils.js'", `from '${new URL('../../vendor/BufferGeometryUtils.js', import.meta.url).href}'`);
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
};
const { HQVegetation } = await load('../../modules/environment/hq5-vegetation.js');
const { SiteContext, CONTEXT_MASSES } = await load('../../modules/environment/hq5b-site.js');
const renderer = { capabilities: { getMaxAnisotropy: () => 8 } };

async function syntheticTextures(run) {
  const original = THREE.TextureLoader.prototype.loadAsync;
  THREE.TextureLoader.prototype.loadAsync = async () => new THREE.Texture();
  try { await run(); } finally { THREE.TextureLoader.prototype.loadAsync = original; }
}

test('P5B crowns preserve a bounded individual-blade budget, distinct shapes and depth writing', () => syntheticTextures(async () => {
  const scene = new THREE.Scene(), plants = new HQVegetation(scene, renderer);
  await plants.ready;
  const stats = plants.stats();
  assert.ok(stats.leaves > 50000 && stats.leaves < 70000, `actual leaves ${stats.leaves}`);
  assert.equal(plants.leafGeometry.index.count / 3, 12);
  assert.equal(plants.leaves.transparent, false); assert.equal(plants.leaves.depthWrite, true);
  assert.ok(plants.leaves.alphaTest > .4);
  const profiles = plants.foliage.map(item => {
    const size = new THREE.Vector3(); item.mesh.boundingBox.getSize(size); return size;
  });
  assert.ok(profiles.every(size => size.y > 2.3 && size.x > 3 && size.z > 3));
  assert.ok(new Set(profiles.map(size => size.x.toFixed(2) + ':' + size.y.toFixed(2) + ':' + size.z.toFixed(2))).size === 10);
  plants.dispose();
}));

test('Quality profiles reduce the same shuffled leaf buffers with no allocations and no lost trees', () => syntheticTextures(async () => {
  const scene = new THREE.Scene(), plants = new HQVegetation(scene, renderer);
  await plants.ready;
  const geometry = plants.leafGeometry, textures = [...plants.textures], full = plants.stats().renderedLeaves;
  const counts = [];
  for (const quality of ['ultra', 'high', 'medium', 'low']) {
    plants.setQuality(quality); counts.push(plants.stats().renderedLeaves);
    assert.equal(plants.leafGeometry, geometry); assert.deepEqual([...plants.textures], textures);
    assert.ok(plants.foliage.every(item => item.mesh.visible && item.mesh.count > 0));
  }
  assert.equal(counts[0], full); assert.ok(counts.every((value, i) => i === 0 || value < counts[i - 1]));
  assert.throws(() => plants.setQuality('unknown'), TypeError);
  plants.setQuality('ultra'); assert.equal(plants.stats().renderedLeaves, full);
  plants.dispose();
}));

test('Site detail is finite, merged, below the HQ roofline and explicitly Draft', () => {
  const owner = { city: new THREE.Group(), paving: new THREE.MeshStandardMaterial() };
  const site = new SiteContext(owner), stats = site.stats();
  assert.equal(stats.evidence.status, 'draft'); assert.equal(stats.masses, 5);
  assert.ok(CONTEXT_MASSES.every(mass => mass.height + mass.roof < 14));
  assert.ok(stats.drawCalls <= 20 && stats.triangles < 30000, JSON.stringify(stats));
  for (const geometry of site.geometries) {
    for (const key of ['position', 'normal', 'uv']) assert.ok([...geometry.getAttribute(key).array].every(Number.isFinite));
    assert.ok(Number.isFinite(geometry.boundingSphere.radius));
  }
  assert.equal(site.textures.size, 1); assert.equal([...site.textures][0].image.width, 64);
  site.dispose(); owner.paving.dispose();
});

test('Site quality switches preserve borrowed PBR and dispose owned resources once', () => {
  const owner = { city: new THREE.Group(), paving: new THREE.MeshStandardMaterial() }, site = new SiteContext(owner);
  const count = { geometry: 0, material: 0, texture: 0, borrowed: 0 }, expected = { geometry: site.geometries.size, material: site.materials.size, texture: 1, borrowed: 0 };
  for (const [key, objects] of [['geometry', site.geometries], ['material', site.materials], ['texture', site.textures]]) for (const object of objects) object.addEventListener('dispose', () => count[key]++);
  owner.paving.addEventListener('dispose', () => count.borrowed++);
  const full = site.stats(), geometry = [...site.geometries];
  for (let i = 0; i < 8; i++) for (const quality of ['ultra', 'medium', 'low', 'high']) site.setQuality(quality);
  assert.deepEqual([...site.geometries], geometry); assert.equal(site.stats().triangles, full.triangles);
  site.setQuality('low'); assert.ok(site.stats().drawCalls < full.drawCalls);
  site.setLighting('night'); assert.ok(site.contextGlass.emissiveIntensity > 0);
  site.setLighting('day'); assert.equal(site.contextGlass.emissiveIntensity, 0);
  site.dispose(); site.dispose(); assert.deepEqual(count, expected); assert.equal(owner.city.children.length, 0);
  owner.paving.dispose();
});

test('Site rejects malformed owners before attaching resources', () => {
  for (const owner of [null, {}, { city: new THREE.Group() }]) assert.throws(() => new SiteContext(owner), TypeError);
});
