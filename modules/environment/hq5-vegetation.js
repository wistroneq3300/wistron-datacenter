import * as THREE from 'three';

// Authored broadleaf landscaping, not a claim about the species or tree survey
// at Wistron HQ. The source PBR surfaces are CC0; see adjacent provenance.
export const VEGETATION_EVIDENCE = Object.freeze({
  status: 'draft', species: 'unverified broadleaf', placement: 'illustrative',
  materials: ['Poly Haven / Japanese Camphor Bark', 'Poly Haven / Tree Small 02 leaf atlas'],
  provenance: 'assets/environment/hq5-vegetation/provenance.json',
});

export const DEFAULT_TREE_ROOTS = Object.freeze([
  [-24, .18, 2], [-16, .18, 2], [-8, .18, 2], [0, .18, 2], [12, .18, 2],
  [19, .18, -8], [19, .18, -17], [19, .18, -25], [-28, .18, -17], [-28, .18, -26],
].map(Object.freeze));

const TAU = Math.PI * 2;
const LOD_DENSITIES = [1, .79, .52];
const QUALITY_DENSITIES = Object.freeze({ ultra: 1, high: .92, medium: .68, low: .43 });
const UP = new THREE.Vector3(0, 1, 0);
const random = seed => () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);
const mix = THREE.MathUtils.lerp;
const arrayVector = a => new THREE.Vector3(...a);
const ASSET_ROOT = './assets/environment/hq5-vegetation/';

// Pixel rectangles deliberately select individual source leaves, not the
// original tree's large branch cards. Source UVs and all PBR maps stay aligned.
const ATLAS_RECTS = [
  [33, 308, 183, 119], [243, 544, 191, 105], [45, 610, 183, 106],
  [578, 439, 129, 90], [724, 492, 137, 94], [583, 545, 118, 71],
  [248, 285, 118, 84], [65, 55, 130, 91],
].map(([x, y, w, h]) => [x / 1024, 1 - (y + h) / 1024, w / 1024, h / 1024]);

function validPosition(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

// Build a continuous, tapering bent tube with longitudinal bark UVs. A changing
// radius and asymmetrical root flare replace stacked cones/cylinders.
class BranchBuilder {
  constructor() { this.positions = []; this.normals = []; this.uvs = []; this.colors = []; this.indices = []; this.curves = 0; }

  tube(curve, radius, tipRadius, { radial = 7, steps = 9, flare = 0, phase = 0, shade = 1 } = {}) {
    const base = this.positions.length / 3;
    const point = new THREE.Vector3(), tangent = new THREE.Vector3(), ring = new THREE.Vector3();
    const rotation = new THREE.Quaternion(), previous = new THREE.Vector3();
    let distance = 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      curve.getPoint(t, point);
      if (i) distance += point.distanceTo(previous);
      previous.copy(point);
      curve.getTangent(t, tangent).normalize();
      rotation.setFromUnitVectors(UP, tangent);
      const taper = mix(radius, tipRadius, Math.pow(t, .83));
      for (let j = 0; j <= radial; j++) {
        const angle = j / radial * TAU;
        const rootFlare = flare * Math.exp(-t * 13) * (.65 + .35 * Math.sin(angle * 5 + phase));
        const ridges = 1 + .035 * Math.sin(angle * 3 + phase + t * 1.2);
        const r = taper * ridges + rootFlare;
        ring.set(Math.cos(angle), 0, Math.sin(angle)).applyQuaternion(rotation);
        this.positions.push(point.x + ring.x * r, point.y + ring.y * r, point.z + ring.z * r);
        this.normals.push(ring.x, ring.y, ring.z);
        this.uvs.push(j / radial * Math.max(.25, radius * TAU / 1.8), distance / 1.8);
        const rootOcclusion = .66 + .34 * Math.min(1, t * 5 + (flare ? 0 : .6));
        const lightness = shade * rootOcclusion;
        this.colors.push(lightness, lightness, lightness);
        if (i < steps && j < radial) {
          const a = base + i * (radial + 1) + j, b = a + radial + 1;
          this.indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    this.curves++;
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.setIndex(this.indices); g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}

function curveBetween(start, end, bend, lift = .2) {
  return new THREE.CubicBezierCurve3(start.clone(), start.clone().lerp(end, .32).add(bend),
    start.clone().lerp(end, .74).addScaledVector(bend, .48).addScaledVector(UP, lift), end.clone());
}

// The same flutter and atlas coordinates are installed in the depth material,
// keeping the moving leaf silhouette and its shadow in agreement.
function patchLeaves(material, uniforms, depth = false) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
attribute vec4 hqLeafAtlas;
uniform float hqWindTime;
uniform float hqWindStrength;`);
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
vec2 hqAtlasUv = hqLeafAtlas.xy + uv * hqLeafAtlas.zw;
#ifdef USE_MAP
  vMapUv = hqAtlasUv;
#endif
#ifdef USE_ALPHAMAP
  vAlphaMapUv = hqAtlasUv;
#endif
#ifdef USE_NORMALMAP
  vNormalMapUv = hqAtlasUv;
#endif
#ifdef USE_ROUGHNESSMAP
  vRoughnessMapUv = hqAtlasUv;
#endif
#ifdef USE_AOMAP
  vAoMapUv = hqAtlasUv;
#endif`);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  float hqPhase = dot(instanceMatrix[3].xyz, vec3(1.73, 2.49, .87));
  float hqFlutter = sin(hqWindTime * 1.65 + hqPhase) + .35 * sin(hqWindTime * 3.1 + hqPhase * 2.3);
  transformed.z += hqFlutter * hqWindStrength * uv.x * .014;
  transformed.y += sin(hqWindTime * .75 + hqPhase) * hqWindStrength * uv.x * .004;
#endif`);
    if (!depth) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
uniform vec3 hqSunDirection;
uniform float hqTranslucency;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
// Modest back-light transmission; deliberately zero at night, never emissive.
vec3 hqViewSun = normalize((viewMatrix * vec4(hqSunDirection, 0.0)).xyz);
float hqBacklight = pow(max(0.0, dot(-normal, hqViewSun)), 1.4);
reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(.34, .40, .19) * hqBacklight * hqTranslucency;`);
    }
  };
  material.customProgramCacheKey = () => `hq5-pbr-leaves-${depth ? 'depth' : 'pbr'}-1`;
}

/**
 * Natural landscaping with bounded, shared GPU resources.
 *
 * roots: [x,y,z] or {position:[x,y,z],height?,seed?,spread?}; metres.
 * shrubs: {position:[x,y,z],height?,spread?,seed?}[]; optional low planting.
 * ready resolves an honest asset status; it does not convert failed fetches into
 * a verified fallback. All placement and species remain labelled Draft.
 */
export class HQVegetation {
  constructor(parent, renderer, { roots = DEFAULT_TREE_ROOTS, shrubs = [], seed = 158507, wind = .55 } = {}) {
    if (!Array.isArray(roots) || !Array.isArray(shrubs) || roots.length > 64 || shrubs.length > 64) {
      throw new TypeError('Landscaping requires at most 64 tree roots and 64 shrub roots');
    }
    for (const [kind, records] of [['tree', roots], ['shrub', shrubs]]) records.forEach((value, index) => {
      const spec = Array.isArray(value) ? { position: value } : value;
      if (!spec || (kind === 'shrub' && Array.isArray(value)) || !validPosition(spec.position) || ['height', 'spread', 'seed'].some(key => spec[key] !== undefined && !Number.isFinite(spec[key]))) {
        throw new TypeError(`Invalid ${kind} root ${index}`);
      }
    });
    this.root = new THREE.Group(); this.root.name = 'HQ broadleaf landscape · placement / species DRAFT';
    this.root.userData.evidence = VEGETATION_EVIDENCE; parent.add(this.root);
    this.renderer = renderer; this.disposed = false; this.assetErrors = []; this.loadedTextures = 0; this.quality = 'ultra';
    this.geometries = new Set(); this.materials = new Set(); this.textures = new Set(); this.foliage = [];
    this._cameraWorld = new THREE.Vector3(); this._treeWorld = new THREE.Vector3();
    this._uniforms = {
      hqWindTime: { value: 0 }, hqWindStrength: { value: wind },
      hqSunDirection: { value: new THREE.Vector3(-.6, 1, .6).normalize() }, hqTranslucency: { value: .42 },
    };
    this.bark = new THREE.MeshStandardMaterial({ color: 0xa4a296, roughness: .96, metalness: 0, vertexColors: true });
    this.leaves = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .72, metalness: 0,
      alphaTest: .42, side: THREE.DoubleSide, vertexColors: false, forceSinglePass: true });
    this.depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaTest: .42, side: THREE.DoubleSide });
    patchLeaves(this.leaves, this._uniforms); patchLeaves(this.depth, this._uniforms, true);
    this.materials.add(this.bark); this.materials.add(this.leaves); this.materials.add(this.depth);
    const branches = new BranchBuilder(), populations = [];
    roots.slice(0, 64).forEach((value, index) => {
      const spec = Array.isArray(value) ? { position: value } : value;
      if (!spec || !validPosition(spec.position)) throw new TypeError(`Invalid tree root ${index}`);
      const rnd = random(spec.seed ?? seed + index * 104729);
      const height = THREE.MathUtils.clamp(spec.height ?? 6.3 + rnd() * 2.1, 3, 12);
      const spread = THREE.MathUtils.clamp(spec.spread ?? 1.95 + rnd() * .70, 1, 4);
      populations.push(this._tree(branches, spec.position, height, spread, rnd, index));
    });
    const shrubMatrices = [], shrubColors = [];
    shrubs.slice(0, 64).forEach((spec, index) => {
      if (!validPosition(spec.position)) throw new TypeError(`Invalid shrub root ${index}`);
      const rnd = random(spec.seed ?? seed + index * 17957 + 7301);
      this._shrub(branches, spec.position, spec.height ?? .72, spec.spread ?? .6, rnd, shrubMatrices, shrubColors);
    });
    if (shrubMatrices.length) populations.push({ position: [0, 0, 0], matrices: shrubMatrices, colors: shrubColors, shrub: true });
    this.treeCount = roots.slice(0, 64).length; this.shrubCount = shrubs.slice(0, 64).length; this.branchCount = branches.curves;
    const branchGeometry = branches.geometry(); this.geometries.add(branchGeometry);
    this.branchMesh = new THREE.Mesh(branchGeometry, this.bark); this.branchMesh.name = 'Continuous tapered branches / CC0 bark PBR';
    this.branchMesh.castShadow = this.branchMesh.receiveShadow = true; this.root.add(this.branchMesh);
    const maxLeaves = Math.max(1, ...populations.map(p => p.matrices.length));
    this.leafGeometry = this._leafGeometry(maxLeaves, seed); this.geometries.add(this.leafGeometry);
    this.leafCount = 0;
    populations.forEach((population, index) => {
      const mesh = new THREE.InstancedMesh(this.leafGeometry, this.leaves, population.matrices.length);
      mesh.name = population.shrub ? 'Low mixed shrubs / individual leaf instances' : `Broadleaf tree ${index + 1} / individual leaves`;
      mesh.position.fromArray(population.position);
      population.matrices.forEach((matrix, i) => { mesh.setMatrixAt(i, matrix); mesh.setColorAt(i, population.colors[i]); });
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage); mesh.instanceColor?.setUsage(THREE.StaticDrawUsage);
      mesh.castShadow = mesh.receiveShadow = true; mesh.customDepthMaterial = this.depth;
      mesh.computeBoundingBox(); mesh.computeBoundingSphere(); mesh.visible = false;
      this.foliage.push({ mesh, fullCount: population.matrices.length, level: 0, shrub: !!population.shrub });
      this.leafCount += population.matrices.length; this.root.add(mesh);
    });
    this.setLighting('day');
    this.ready = this._loadTextures();
  }

  _leafGeometry(capacity, seed) {
    // A subtly cupped, asymmetrical blade rather than a flat billboard. UVs are
    // remapped per instance to eight independent source leaf textures.
    const geometry = new THREE.PlaneGeometry(1, 1, 3, 2), p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      // Keep the existing twelve triangles, but narrow the blade to a petiole
      // and tip. Atlas border stems cannot turn into rectangular paper shards.
      const bladeWidth = Math.pow(Math.max(0, Math.sin((x + .5) * Math.PI)), .65);
      p.setY(i, y * bladeWidth);
      p.setZ(i, .06 * Math.sin((x + .5) * Math.PI) + Math.abs(y) * bladeWidth * .035 + x * y * .05);
    }
    geometry.computeVertexNormals();
    const values = new Float32Array(capacity * 4), rnd = random(seed + 811);
    for (let i = 0; i < capacity; i++) values.set(ATLAS_RECTS[Math.floor(rnd() * ATLAS_RECTS.length)], i * 4);
    geometry.setAttribute('hqLeafAtlas', new THREE.InstancedBufferAttribute(values, 4));
    return geometry;
  }

  _leaf(matrices, colors, point, direction, rnd, scale = 1, maturity = 1) {
    const dummy = new THREE.Object3D();
    // Blades grow outward from a twig, tilted toward the sky with individual
    // yaw/roll. They do not float in random cubic volumes around a branch.
    const azimuth = Math.atan2(direction.z, direction.x) + (rnd() - .5) * .75;
    dummy.position.copy(point);
    const pitch = Math.atan2(direction.y, Math.hypot(direction.x, direction.z));
    dummy.rotation.set(-.5 + rnd() * 1.45 + pitch * .35, -azimuth, -.32 + rnd() * .95);
    const length = (.17 + rnd() * .09) * scale;
    dummy.scale.set(length, length * (.49 + rnd() * .19), length);
    dummy.updateMatrix(); matrices.push(dummy.matrix.clone());
    const variation = .79 + rnd() * .35;
    colors.push(new THREE.Color(variation * (maturity ? 1 : 1.13), variation * (maturity ? 1 : 1.07), variation * .94));
  }

  _spray(curve, matrices, colors, rnd, scale = 1, pairs = 8) {
    const point = new THREE.Vector3(), tangent = new THREE.Vector3(), side = new THREE.Vector3(), stem = new THREE.Vector3(), normal = new THREE.Vector3();
    for (let i = 0; i < pairs; i++) {
      // Shorter, irregular internodes collect the same number of blades around
      // shoot ends instead of producing evenly spaced fern-like paired rows.
      const t = .12 + Math.pow(i / pairs, .78) * .83 + (rnd() - .5) * .045;
      curve.getPoint(t, point); curve.getTangent(t, tangent).normalize();
      side.crossVectors(tangent, UP).normalize();
      if (side.lengthSq() < .1) side.set(1, 0, 0);
      normal.crossVectors(side, tangent).normalize();
      // Alternating whorls fill the shoot in three dimensions. The previous
      // paired flat sprays left long viewing gaps between every branch layer.
      const leavesAtNode = i % 3 === 0 ? 3 : 2, phase = i * 2.39996 + rnd() * .4;
      for (let leaf = 0; leaf < leavesAtNode; leaf++) {
        const angle = phase + leaf * TAU / leavesAtNode, reach = (.045 + rnd() * .08) * scale;
        stem.copy(side).multiplyScalar(Math.cos(angle) * reach).addScaledVector(normal, Math.sin(angle) * reach).addScaledVector(tangent, .015 + rnd() * .035);
        this._leaf(matrices, colors, point.clone().add(stem), stem, rnd, scale, t < .82);
      }
    }
    curve.getPoint(1, point); curve.getTangent(1, tangent);
    this._leaf(matrices, colors, point, tangent, rnd, scale * .8, false);
  }

  _tree(branches, position, height, spread, rnd, index) {
    const root = arrayVector(position), localRoot = new THREE.Vector3(), matrices = [], colors = [];
    const lean = new THREE.Vector3((rnd() - .5) * .75, 0, (rnd() - .5) * .7);
    const trunk = new THREE.CubicBezierCurve3(localRoot,
      new THREE.Vector3(-lean.x * .45, height * .23, -lean.z * .25),
      new THREE.Vector3(lean.x * 1.2, height * .57, lean.z * .8),
      new THREE.Vector3(lean.x, height * .83, lean.z));
    const worldCurve = curve => new THREE.CubicBezierCurve3(...[curve.v0, curve.v1, curve.v2, curve.v3].map(p => p.clone().add(root)));
    const phase = rnd() * TAU;
    branches.tube(worldCurve(trunk), .17 + height * .008, .025, { radial: 12, steps: 20, flare: .16, phase });
    const primaryCount = 10 + Math.floor(rnd() * 4);
    // Each seed has a distinct crown aspect, preferred growth direction and
    // droop. Lobes occupy a volume rather than repeating horizontal parasols.
    const crownAspect = .73 + rnd() * .48, crownBias = rnd() * TAU;
    const crownLift = -.035 + rnd() * .09, crownDroop = .06 + rnd() * .15;
    for (let i = 0; i < primaryCount; i++) {
      const originT = .41 + (i / primaryCount) * .52;
      const origin = trunk.getPoint(originT);
      // Golden-angle branching plus separate crown lobes breaks radial symmetry.
      const angle = phase + i * 2.39996 + (rnd() - .5) * .75;
      const crownLayer = i / primaryCount;
      const lobe = .86 + Math.sin(angle * 2 + crownBias) * .12 + rnd() * .13;
      const extension = spread * lobe * Math.sqrt(Math.max(.3, 1 - Math.pow(crownLayer * .92, 2)));
      const end = new THREE.Vector3(Math.cos(angle) * extension + lean.x,
        height * (.55 + crownLayer * .41 + crownLift) + (rnd() - .5) * height * .13,
        Math.sin(angle) * extension * crownAspect + lean.z);
      const bend = new THREE.Vector3(-Math.sin(angle) * .24, .16 + rnd() * .35, Math.cos(angle) * .24);
      const limb = curveBetween(origin, end, bend, -.08 - rnd() * .25);
      const radius = .045 * (1 - crownLayer * .5) + .009;
      branches.tube(worldCurve(limb), radius, .006, { radial: 8, steps: 12, phase: angle, shade: .94 + rnd() * .1 });
      // The previous primary curves ended in bare sawn-looking tips. Short
      // divergent growth now encloses each tip; no floating crown billboards.
      for (let tipIndex = 0; tipIndex < 3; tipIndex++) {
        const start = limb.getPoint(.79 + tipIndex * .09);
        const tipAngle = angle + (tipIndex - 1) * .72;
        const tip = start.clone().add(new THREE.Vector3(Math.cos(tipAngle) * (.35 + rnd() * .27),
          .08 + rnd() * .43, Math.sin(tipAngle) * (.35 + rnd() * .27)));
        const twig = curveBetween(start, tip, new THREE.Vector3(0, .09, 0), -.03);
        branches.tube(worldCurve(twig), .005, .0009, { radial: 4, steps: 4, shade: .82 });
        this._spray(twig, matrices, colors, rnd, .96, 8);
      }
      const secondaryCount = 4 + (i % 3 === 0 ? 1 : 0);
      for (let j = 0; j < secondaryCount; j++) {
        const t = .31 + j / secondaryCount * .65;
        const from = limb.getPoint(t), wing = (j % 2 ? -1 : 1);
        const branchAngle = angle + wing * (.45 + rnd() * .65);
        const length = .42 + rnd() * .50;
        const to = from.clone().add(new THREE.Vector3(Math.cos(branchAngle) * length,
          -.33 + rnd() * .92 - crownLayer * crownDroop, Math.sin(branchAngle) * length));
        const secondary = curveBetween(from, to, new THREE.Vector3(0, .14, 0), -.04 - rnd() * .12);
        branches.tube(worldCurve(secondary), .018 + (1 - t) * .007, .004, { radial: 6, steps: 7, shade: .9 });
        this._spray(secondary, matrices, colors, rnd, .9, 5);
        // Several divergent terminal shoots fill lobes without a solid ball crown.
        const shoots = 5 + (j % 2);
        for (let k = 0; k < shoots; k++) {
          const start = secondary.getPoint(.28 + k / shoots * .69);
          const shootAngle = branchAngle + (k % 2 ? -1 : 1) * (.45 + rnd() * 1.05);
          const shootLength = .32 + rnd() * .43;
          const tip = start.clone().add(new THREE.Vector3(Math.cos(shootAngle) * shootLength,
            (rnd() - .46) * .86, Math.sin(shootAngle) * shootLength));
          const twig = curveBetween(start, tip, new THREE.Vector3(0, .06, 0), -.055);
          branches.tube(worldCurve(twig), .0045, .0011, { radial: 4, steps: 4, shade: .79 });
          this._spray(twig, matrices, colors, rnd, .86 + rnd() * .28, 8 + Math.floor(rnd() * 3));
        }
      }
    }
    // Deterministic shuffle makes count-based LOD spatially uniform. No branch
    // or tree disappears merely because it was authored later in the array.
    for (let i = matrices.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [matrices[i], matrices[j]] = [matrices[j], matrices[i]];
      [colors[i], colors[j]] = [colors[j], colors[i]];
    }
    return { position, matrices, colors, index };
  }

  _shrub(branches, position, height, spread, rnd, matrices, colors) {
    const origin = arrayVector(position), h = THREE.MathUtils.clamp(height, .25, 1.6), radius = THREE.MathUtils.clamp(spread, .2, 1.2);
    for (let i = 0; i < 15; i++) {
      const angle = rnd() * TAU, extent = radius * Math.sqrt(rnd());
      const end = origin.clone().add(new THREE.Vector3(Math.cos(angle) * extent, h * (.65 + rnd() * .4), Math.sin(angle) * extent));
      const stem = curveBetween(origin, end, new THREE.Vector3(0, h * .1, 0), 0);
      branches.tube(stem, .009, .0015, { radial: 5, steps: 5, shade: .75 });
      for (let j = 0; j < 4; j++) {
        const start = stem.getPoint(.28 + j * .19), a = angle + (j % 2 ? -1 : 1) * (.6 + rnd());
        const tip = start.clone().add(new THREE.Vector3(Math.cos(a) * radius * .6, h * (.09 + rnd() * .18), Math.sin(a) * radius * .6));
        const twig = curveBetween(start, tip, new THREE.Vector3(0, .03, 0), -.025);
        branches.tube(twig, .003, .0008, { radial: 4, steps: 3, shade: .8 });
        this._spray(twig, matrices, colors, rnd, .55 + rnd() * .14, 5);
      }
    }
  }

  async _loadTextures() {
    const loader = new THREE.TextureLoader();
    const specs = [
      [this.bark, 'map', 'bark-diffuse.jpg', true],
      [this.bark, 'normalMap', 'bark-normal-gl.jpg', false],
      [this.bark, 'roughnessMap', 'bark-roughness.jpg', false],
      [this.leaves, 'map', 'leaves-diffuse.jpg', true],
      [this.leaves, 'alphaMap', 'leaves-alpha.png', false],
      [this.leaves, 'normalMap', 'leaves-normal-gl.jpg', false],
      [this.leaves, 'roughnessMap', 'leaves-arm.jpg', false],
    ];
    await Promise.all(specs.map(async ([material, slot, file, srgb]) => {
      try {
        const texture = await loader.loadAsync(ASSET_ROOT + file);
        if (this.disposed) { texture.dispose(); return; }
        texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.anisotropy = Math.min(8, this.renderer?.capabilities?.getMaxAnisotropy?.() ?? 1);
        if (material === this.bark) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.channel = 0; this.textures.add(texture); this.loadedTextures++;
        material[slot] = texture;
        if (material === this.leaves && (slot === 'map' || slot === 'alphaMap')) this.depth[slot] = texture;
        if (material === this.leaves && slot === 'roughnessMap') { material.aoMap = texture; material.aoMapIntensity = .6; }
        material.needsUpdate = true; this.depth.needsUpdate = true;
      } catch (error) { if (!this.disposed) this.assetErrors.push({ file, message: String(error?.message || 'texture load failed') }); }
    }));
    if (!this.disposed) {
      this.bark.normalScale.set(.55, .55); this.leaves.normalScale.set(.38, .38);
      const ready = !!(this.leaves.map && this.leaves.alphaMap);
      for (const item of this.foliage) item.mesh.visible = ready;
    }
    return { loaded: this.loadedTextures, expected: specs.length, errors: [...this.assetErrors], disposed: this.disposed };
  }

  setLighting(mode = 'day', sunDirection) {
    if (this.disposed) return;
    this.lighting = mode;
    this._uniforms.hqTranslucency.value = mode === 'night' ? 0 : mode === 'dusk' ? .28 : .42;
    if (sunDirection?.isVector3) this._uniforms.hqSunDirection.value.copy(sunDirection).normalize();
    else if (validPosition(sunDirection)) this._uniforms.hqSunDirection.value.fromArray(sunDirection).normalize();
  }

  setQuality(level = 'high') {
    const quality = String(level).toLowerCase();
    if (!Object.hasOwn(QUALITY_DENSITIES, quality)) throw new TypeError('Unknown vegetation quality profile');
    if (this.disposed) return;
    this.quality = quality;
    for (const item of this.foliage) this._applyDensity(item);
  }

  _applyDensity(item) {
    // One spatially shuffled buffer serves every distance and quality profile.
    // Alpha-tested individual blades keep depth writes; there are no layered
    // full-crown transparent cards or per-switch geometry/texture allocations.
    item.mesh.count = Math.max(1, Math.floor(item.fullCount * QUALITY_DENSITIES[this.quality] * (item.shrub ? 1 : LOD_DENSITIES[item.level])));
  }

  update(camera, time = 0, options) {
    if (this.disposed || !this.root.visible || !camera) return;
    this._uniforms.hqWindTime.value = Number.isFinite(time) ? time : 0;
    if (Number.isFinite(options?.wind)) this._uniforms.hqWindStrength.value = THREE.MathUtils.clamp(options.wind, 0, 2);
    camera.getWorldPosition(this._cameraWorld);
    for (const item of this.foliage) {
      if (item.shrub) continue;
      item.mesh.getWorldPosition(this._treeWorld); this._treeWorld.y += 5;
      const distance = this._treeWorld.distanceTo(this._cameraWorld);
      // Hysteresis avoids count oscillation at a threshold; all levels reuse the
      // same buffers and preserve all trees. No allocations in this frame path.
      let level = item.level;
      if (level === 0 && distance > 92) level = 1;
      else if (level === 1 && distance < 82) level = 0;
      else if (level === 1 && distance > 157) level = 2;
      else if (level === 2 && distance < 142) level = 1;
      if (level !== item.level) {
        item.level = level;
        this._applyDensity(item);
      }
    }
  }

  stats() {
    return {
      trees: this.treeCount, shrubs: this.shrubCount, branches: this.branchCount,
      leaves: this.leafCount, renderedLeaves: this.foliage.reduce((sum, p) => sum + p.mesh.count, 0),
      geometries: this.geometries.size, materials: this.materials.size, textures: this.textures.size,
      drawCalls: this.disposed ? 0 : this.foliage.length + 1,
      loadedTextures: this.loadedTextures, assetErrors: [...this.assetErrors], disposed: this.disposed,
      evidence: VEGETATION_EVIDENCE, method: 'continuous curved tapered wood + instanced cupped PBR atlas leaves',
      quality: this.quality, density: QUALITY_DENSITIES[this.quality], alphaMode: 'opaque alpha-test depth-writing leaves',
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.root.removeFromParent();
    for (const item of this.foliage) item.mesh.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.foliage.length = 0;
    this.root.clear();
  }
}
