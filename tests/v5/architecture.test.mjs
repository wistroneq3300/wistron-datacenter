import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../../vendor/three.module.js';

// Use the checked-in Three.js CPU implementation, not geometry stubs. Browser
// screenshots remain necessary for material, lighting and visual acceptance.
const threeURL = new URL('../../vendor/three.module.js', import.meta.url).href;
const dataModule = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const architectureSource = fs.readFileSync(new URL('../../modules/environment/hq5-architecture.js', import.meta.url), 'utf8');
const { ArchitectureBuilder } = await import(dataModule(architectureSource.replace("from 'three'", `from '${threeURL}'`)
  .replace("from '../../vendor/BufferGeometryUtils.js'", `from '${new URL('../../vendor/BufferGeometryUtils.js', import.meta.url).href}'`)));

function createOwner() {
  const owner = { building: new THREE.Group(), geometry: new Set(), materials: new Set(), signs: [] };
  for (const key of ['stone', 'trim', 'frame', 'metal', 'glass', 'canopyGlass', 'interior', 'roof', 'roughStone', 'lamp', 'paving']) {
    const material = key === 'glass' ? new THREE.MeshPhysicalMaterial({ transmission: .8, vertexColors: true }) : new THREE.MeshStandardMaterial();
    material.name = key; owner[key] = material; owner.materials.add(material);
  }
  owner.own = geometry => { owner.geometry.add(geometry); return geometry; };
  owner.sign = (...args) => owner.signs.push(args); // Canvas text is outside CPU geometry coverage.
  owner.release = () => {
    for (const geometry of owner.geometry) geometry.dispose();
    for (const material of owner.materials) material.dispose();
    owner.geometry.clear(); owner.materials.clear(); owner.building.clear();
  };
  return owner;
}

function built() {
  const owner = createOwner(), builder = new ArchitectureBuilder(owner);
  builder.build(); owner.building.updateMatrixWorld(true);
  return { owner, builder };
}

function firstHit(owner, origin, direction, objects = owner.building.children) {
  const ray = new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction), 0, 100);
  return ray.intersectObjects(objects, true)[0];
}

test('Merged architecture has finite indexed-independent geometry and nonempty physical bounds', () => {
  const { owner, builder } = built();
  assert.equal(builder.parts.size, 0); assert.ok(owner.building.children.length < 30);
  for (const mesh of owner.building.children) {
    if (!mesh.isMesh) continue;
    assert.ok(owner.geometry.has(mesh.geometry), `${mesh.material.name} geometry must belong to the environment owner`);
    for (const name of ['position', 'normal', 'uv']) {
      assert.ok(mesh.geometry.attributes[name]?.count > 0, `${name} must exist`);
      assert.ok([...mesh.geometry.attributes[name].array].every(Number.isFinite), `${name} must be finite`);
    }
    if (mesh.material === owner.glass) {
      assert.equal(mesh.geometry.attributes.color?.count,mesh.geometry.attributes.position.count);
      assert.ok(mesh.geometry.attributes.color.array.every(value=>Number.isFinite(value)&&value>=0&&value<=1));
    }
    mesh.geometry.computeBoundingBox();
    assert.equal(mesh.geometry.boundingBox.isEmpty(), false);
  }
  const bounds = new THREE.Box3().setFromObject(owner.building), size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 35 && size.x < 45); assert.ok(size.y > 19 && size.y < 22); assert.ok(size.z > 38 && size.z < 45);
  assert.equal(/new\s+THREE\.BoxGeometry\s*\(/.test(architectureSource), false);
  assert.match(owner.building.userData.facades.windowSchedule, /unverified/);
  assert.match(owner.building.userData.facades.roof, /unverified/);
  owner.release();
});

test('Representative authored front and return openings expose glass before stone', () => {
  const { owner } = built();
  // These sample coordinates belong to the authored Draft model, not an OEM or
  // surveyed window schedule. Offset points avoid intentional frame mullions.
  for (const [x, y] of [[-20.78, 2.17], [-20.78, 8.52], [-20.78, 11.77], [-14.87, 5.17], [-14.87, 15.02], [-2.83, 18.27], [3.12, 11.77]]) {
    const hit = firstHit(owner, [x, y, 10], [0, 0, -1]);
    assert.ok(hit, `front opening at ${x}, ${y} must be visible`);
    assert.equal(hit.object.material, owner.glass, `front opening at ${x}, ${y} was blocked by ${hit.object.material.name}`);
    assert.ok(hit.point.z < -4.3 && hit.point.z > -4.7);
  }
  for (const [z, y] of [[-13.93, 2.17], [-18.33, 5.17], [-22.73, 8.52], [-27.03, 11.77], [-31.53, 18.27]]) {
    const hit = firstHit(owner, [30, y, z], [-1, 0, 0]);
    assert.ok(hit, `return opening at ${z}, ${y} must be visible`);
    assert.equal(hit.object.material, owner.glass, `return opening at ${z}, ${y} was blocked by ${hit.object.material.name}`);
  }
  // A wall pier remains solid: the hole repair must not remove the whole facade.
  assert.equal(firstHit(owner, [-18.1, 8.5, 10], [0, 0, -1]).object.material, owner.stone);
  owner.release();
});

test('Ray-measured corner glazing contains four upper bands and two base bands', () => {
  const { owner } = built(), glassMeshes = owner.building.children.filter(mesh => mesh.material === owner.glass);
  const bands = []; let current = null;
  // Discover intervals from the finished merged geometry, independently of the
  // builder's loop metadata. A filled slab behind a window cannot create a band.
  for (let i = 0; i <= 1025; i++) {
    const y = i * .02, hit = firstHit(owner, [10.31, y, 8], [0, 0, -1], glassMeshes);
    const visible = !!hit && hit.point.z > -5;
    if (visible && !current) { current = { min: y, max: y }; bands.push(current); }
    else if (visible) current.max = y;
    else current = null;
  }
  assert.equal(bands.length, 6, JSON.stringify(bands));
  assert.equal(bands.filter(band => band.max < 6.2).length, 2);
  assert.equal(bands.filter(band => band.min > 7).length, 4);
  for (const band of bands.slice(2)) {
    assert.ok(band.max - band.min > 2.5 && band.max - band.min < 2.8);
    const hit = firstHit(owner, [10.31, (band.min + band.max) / 2, 8], [0, 0, -1]);
    assert.equal(hit.object.material, owner.glass);
  }
  assert.ok(bands.at(-1).max < 19.7);
  owner.release();
});

test('Elevated left step returns block exterior rays before they can see the interior glazing', () => {
  const { owner } = built();
  // Probe the finished merged building from the camera-facing left side. The
  // previous open returns let these rays travel through to the opposite glass.
  for (const [x, heights] of [[-18.1, [13.7, 14.8, 15.8]], [-12, [16.9, 18, 19.05]]]) {
    for (const y of heights) for (const z of [-40.5, -35, -22, -8, -4.3]) {
      const hit = firstHit(owner, [-30, y, z], [1, 0, 0]);
      assert.ok(hit, `step return must close the envelope at ${x}, ${y}, ${z}`);
      assert.equal(hit.object.material, owner.stone, `step return exposed ${hit.object.material.name} at ${x}, ${y}, ${z}`);
      assert.ok(Math.abs(hit.point.x - x) < .08, `expected left envelope at x=${x}; reached x=${hit.point.x}`);
    }
  }
  owner.release();
});

test('Step-return closure preserves both roof setbacks and the upper x=-12 silhouette boundary', () => {
  const { owner } = built();
  // Closing the holes must not replace the stair profile with a tall outer box.
  for (const [x, y] of [[-18.2, 14.8], [-12.1, 18], [-12, 20.5]]) {
    assert.equal(firstHit(owner, [x, y, 10], [0, 0, -1]), undefined, `closure expanded beyond the authored silhouette at ${x}, ${y}`);
  }
  assert.equal(firstHit(owner, [-11.9, 18, 10], [0, 0, -1]).object.material, owner.stone);
  owner.release();
});

test('Overlapping facade holes fail before triangulation and preserve existing staged geometry', () => {
  const owner = createOwner(), builder = new ArchitectureBuilder(owner);
  builder.rect(1, 1, .2, owner.stone, 10, 0, 0);
  const staged = [...builder.parts.values()][0].geometries[0];
  const outer = [[-5, 0], [5, 0], [5, 10], [-5, 10]];
  for (const holes of [
    [[-2, 1, 3, 3], [0, 2, 2, 3]], // crossing rectangles
    [[-2, 1, 4, 5], [-1, 2, 1, 1]], // one contained within another
    [[-1, 2, 2, 3], [-1, 2, 2, 3]], // duplicated openings
  ]) assert.throws(() => builder.prism(outer, .6, owner.stone, [0, 0, 0], 0, holes), /Overlapping HQ facade openings/);
  assert.equal(builder.parts.size, 1); assert.equal([...builder.parts.values()][0].geometries.length, 1);
  assert.equal([...builder.parts.values()][0].geometries[0], staged); assert.equal(owner.geometry.size, 0);
  builder.flush(); owner.release();
});

test('Multiple disjoint window voids survive triangulation while surrounding stone stays closed', () => {
  const owner = createOwner(), builder = new ArchitectureBuilder(owner);
  builder.prism([[-6, 0], [6, 0], [6, 9], [-6, 9]], .6, owner.stone, [0, 0, 0], 0,
    [[-4.5, 1, 3, 2], [1.5, 1, 3, 2], [-4.5, 5, 3, 2], [1.5, 5, 3, 2]], .025);
  builder.flush(); owner.building.updateMatrixWorld(true);
  for (const x of [-4.2, -3, -1.8, 1.8, 3, 4.2]) for (const y of [1.3, 2.7, 5.3, 6.7]) {
    assert.equal(firstHit(owner, [x, y, 10], [0, 0, -1]), undefined, `stone crossed a cutout at ${x}, ${y}`);
  }
  for (const [x, y] of [[0, 2], [0, 6], [-3, 4], [3, 4], [-5.5, 6]]) {
    assert.equal(firstHit(owner, [x, y, 10], [0, 0, -1]).object.material, owner.stone);
  }
  owner.release();
});

test('Architecture merge releases staged buffers and registers every retained mesh for disposal', () => {
  const owner = createOwner(), builder = new ArchitectureBuilder(owner), staged = [], original = builder.add.bind(builder);
  builder.add = (geometry, material, parent) => {
    original(geometry, material, parent);
    const batch = builder.parts.get(material.uuid + (parent || owner.building).uuid), retained = batch.geometries.at(-1);
    const event = { geometry: retained, disposed: 0 }; staged.push(event);
    retained.addEventListener('dispose', () => event.disposed++);
  };
  builder.build();
  assert.ok(staged.length > 200); assert.ok(staged.every(item => item.disposed === 1));
  assert.equal(builder.parts.size, 0);
  const owned = [...owner.geometry], counts = new Map(owned.map(geometry => [geometry, 0]));
  for (const geometry of owned) geometry.addEventListener('dispose', () => counts.set(geometry, counts.get(geometry) + 1));
  owner.building.traverse(object => { if (object.isMesh) assert.ok(owner.geometry.has(object.geometry)); });
  owner.release();
  assert.ok([...counts.values()].every(count => count === 1));
  assert.equal(owner.geometry.size, 0); assert.equal(owner.building.children.length, 0);
});
