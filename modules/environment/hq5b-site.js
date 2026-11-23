import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';

export const SITE_EVIDENCE = Object.freeze({
  status: 'draft', provenance: 'Observed public map topology, photo-referenced entry paving, authored geometry and CC0 surfaces',
  reference: 'https://www.openstreetmap.org/way/244450531',
  verified: ['Xingshan Road fronts the HQ', 'a separate access drive is on the east side', 'offset T junctions', '2024 orthophoto shows crossings, red curb, intermittent center paint and tree-lined roadside'],
  unverified: ['current paint, exact widths and stripe counts', 'all neighboring massing', 'street furniture positions', 'planting survey'],
  representation: 'Interpreted road layout at the HQ display scale',
});

// Model XY is already aligned to the frontage. Fit the observed junction
// relationships to the authored footprint; these are presentation metres.
export const STREET_PLAN = Object.freeze({
  main: Object.freeze({near:3.9,far:15.1}),
  access: Object.freeze({x:20.1,width:4.5}),
  lane168: Object.freeze({x:35.4,width:6.6}),
  oppositeAlley: Object.freeze({x:-31,width:4.8}),
});
export const HQ_TREE_ROOTS = Object.freeze([
  [-23,.03,1.5],[-17,.03,1.5],[-1,.03,1.5],[7,.03,1.5],[16,.03,1.0],
  [16.45,.03,-9],[16.45,.03,-19],[16.45,.03,-28],[-28,.03,-16],[-28,.03,-26]
]);

export const STREET_TREES = Object.freeze([
  {position:[26.5,-.025,-4.3],height:5.4,spread:.9},
  {position:[26,-.025,-12.8],height:6.3,spread:.98},
  {position:[27.5,-.025,-22.1],height:5.4,spread:.94},
  {position:[25.6,-.025,-31.4],height:6.1,spread:.97},
  {position:[-28,-.025,19.7],height:4.95,spread:.92},
  {position:[-18,-.025,19.25],height:5.6,spread:.90},
  {position:[-4,-.025,19.75],height:4.8,spread:.91},
  {position:[10.5,-.025,19.35],height:5.25,spread:.85},
  {position:[23.5,-.025,20],height:5.1,spread:.9},
]);

// Low-rise massing is deliberately below the HQ roofline. These are authored
// background volumes, not real neighboring buildings, and carry no business
// signs, addresses or fabricated survey identity.
export const CONTEXT_MASSES = Object.freeze([
  { id: 'draft-context-west', x: -63, z: -26, width: 24, depth: 24, height: 9.5, roof: .7 },
  { id: 'draft-context-north-west', x: -53, z: -75, width: 32, depth: 17, height: 12.2, roof: .5 },
  { id: 'draft-context-north', x: -6, z: -79, width: 31, depth: 20, height: 8.2, roof: .6 },
  { id: 'draft-context-east', x: 61, z: -44, width: 20, depth: 26, height: 10.8, roof: .5 },
  { id: 'draft-context-south-east', x: 65, z: 42, width: 27, depth: 19, height: 8.4, roof: .6 },
].map(Object.freeze));

const PROFILES = new Set(['ultra', 'high', 'medium', 'low']);

/**
 * Supplemental streetscape. Owns and disposes its geometry, materials and one
 * tiny authored contact mask independently. owner.city and owner.paving are
 * borrowed; neither is disposed here. No asynchronous loads or RAF loops.
 */
export class SiteContext {
  constructor(owner) {
    if (!owner?.city?.isObject3D || !owner.paving?.isMaterial) throw new TypeError('SiteContext requires a city group and paving material');
    this.owner = owner; this.disposed = false; this.quality = 'high';
    this.geometries = new Set(); this.materials = new Set(); this.textures = new Set(); this.parts = new Map();
    this.root = new THREE.Group(); this.root.name = 'P5B streetscape · generic city context DRAFT';
    this.root.userData.evidence = SITE_EVIDENCE; owner.city.add(this.root);
    this.near = new THREE.Group(); this.fine = new THREE.Group(); this.distant = new THREE.Group(); this.distantFine = new THREE.Group();
    this.root.add(this.near, this.fine, this.distant, this.distantFine);
    this.concrete = this.material(0x9b9f98, .92);
    this.joint = this.material(0x59635e, .97);
    this.steel = this.material(0x495855, .72, .55);
    this.mulch = this.material(0x535247, 1);
    this.patch = this.material(0x333b3c, .96);
    this.contextStone = this.material(0x7d8a87, .94);
    this.contextShadow = this.material(0x6a7775, .94);
    this.contextGlass = this.material(0x687d7c, .58, .08, { emissive: 0x82988a, emissiveIntensity: 0 });
    this.softGround = this.material(0x747e71, .98);
    this.walkway = owner.paving;
    if(owner.road){this.softGround.map=this.groundGrain();this.buildStreets();}
    this.buildForecourt(); this.buildDistrict(); this.flush(); this.setQuality('high');
  }

  material(color, roughness, metalness = 0, options = {}) {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...options });
    this.materials.add(material); return material;
  }

  add(geometry, material, parent = this.near) {
    const key = material.uuid + parent.uuid;
    if (!this.parts.has(key)) this.parts.set(key, { geometries: [], material, parent });
    this.parts.get(key).geometries.push(geometry.index ? geometry.toNonIndexed() : geometry);
    if (geometry.index) geometry.dispose();
  }

  surface(width, depth, x, y, z, material, parent = this.near) {
    const g = new THREE.PlaneGeometry(width, depth), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * width, uv.getY(i) * depth);
    g.rotateX(-Math.PI / 2); g.translate(x, y, z); this.add(g, material, parent);
  }

  groundOutline(points, y, material, parent = this.near) {
    const g = new THREE.ShapeGeometry(new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z))));
    g.rotateX(-Math.PI/2);
    g.translate(0,y,0);
    this.add(g,material,parent);
  }

  groundGrain() {
    const size=128, data=new Uint8Array(size*size*4);
    let seed=168158;
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const broad=8*Math.sin(x*Math.PI/32)*Math.sin(y*Math.PI/64+1.2);
      const tone=213+broad+(seed>>>28)*2;
      data.set([tone,tone+3,tone-7,255],(y*size+x)*4);
    }
    const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(.42,.42);
    texture.magFilter=THREE.LinearFilter;
    texture.minFilter=THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps=true;
    texture.needsUpdate=true;
    this.textures.add(texture);
    return texture;
  }

  edge(points, material) {
    // The outer curb follows the corner. Use UV-bearing segments so this can
    // share a material batch with the rest of the public-realm details.
    for(let i=1;i<points.length;i++){
      const [ax,az]=points[i-1], [bx,bz]=points[i];
      const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);
      const g=new THREE.BoxGeometry(length+.008,.20,.17);
      g.rotateY(-Math.atan2(dz,dx));
      g.translate((ax+bx)/2,-.12,(az+bz)/2);
      this.add(g,material);
    }
  }

  buildStreets() {
    const {main,access,lane168,oppositeAlley}=STREET_PLAN;
    const asphalt=this.owner.road,paint=this.material(0xb6bab1,.95),drain=this.joint;
    const yellow=this.material(0xa78b47,.91);
    const red=this.material(0x985953,.92);
    const roadwayY=-.22;
    const center=(main.near+main.far)/2;
    this.surface(200,main.far-main.near,0,roadwayY,center,asphalt);
    const roundedMouth=(x,width,z,direction,radius)=>{
      const left=x-width/2,right=x+width/2;
      const leftCurve=[],rightCurve=[];
      for(let i=0;i<=8;i++){
        const angle=i*Math.PI/16;
        leftCurve.push([left-radius+radius*Math.sin(angle),z+direction*radius*(1-Math.cos(angle))]);
        rightCurve.push([right+radius-radius*Math.sin(angle),z+direction*radius*(1-Math.cos(angle))]);
      }
      return {left,right,leftCurve,rightCurve};
    };
    const accessMouth=roundedMouth(access.x,access.width,main.near,-1,.85);
    const laneMouth=roundedMouth(lane168.x,lane168.width,main.near,-1,2.9);
    const oppositeMouth=roundedMouth(oppositeAlley.x,oppositeAlley.width,main.far,1,1.8);
    const [accessWest,accessEast]=[accessMouth.leftCurve[0][0],accessMouth.rightCurve[0][0]];
    const [laneWest,laneEast]=[laneMouth.leftCurve[0][0],laneMouth.rightCurve[0][0]];
    const surfaces=[{...accessMouth,end:-48},{...laneMouth,end:-91},{...oppositeMouth,end:51}];
    for(const {left,right,leftCurve,rightCurve,end} of surfaces){
      this.groundOutline([...leftCurve,[left,end],[right,end],...rightCurve.slice().reverse()],roadwayY,asphalt);
      const raisedEdge=(curve,limit)=>[...curve,[limit,end]];
      this.edge(raisedEdge(leftCurve,left),this.concrete);
      this.edge(raisedEdge(rightCurve,right),this.concrete);
    }
    const northWest=[[-95,main.near],[accessWest,main.near]];
    const northIsland=[[accessEast,main.near],[laneWest,main.near]];
    const northEast=[[laneEast,main.near],[94,main.near]];
    const southWest=[[-95,main.far],oppositeMouth.leftCurve[0]];
    const southEast=[oppositeMouth.rightCurve[0],[94,main.far]];
    for(const edge of [northWest,northIsland,northEast,southWest,southEast])this.edge(edge,this.concrete);
    const island=[...accessMouth.rightCurve,[accessMouth.right,-48],[laneMouth.left,-48],...laneMouth.leftCurve.slice().reverse()];
    this.groundOutline(island,-.029,this.walkway);
    this.groundOutline([...laneMouth.rightCurve,[laneMouth.right,-91],[96,-91],[96,main.near]],-.03,this.walkway);
    this.groundOutline([...oppositeMouth.leftCurve,[oppositeMouth.left,51],[-96,51],[-96,main.far]],-.03,this.walkway);
    this.groundOutline([...oppositeMouth.rightCurve,[oppositeMouth.right,51],[96,51],[96,main.far]],-.03,this.walkway);
    // The open 2024 aerial image resolves an eastern green separator and an
    // opposite tree strip. The individual plants and parking bays are Draft.
    this.surface(6.7,42,26.5,-.012,-23,this.softGround);
    this.surface(81,3.35,9,-.012,19.9,this.softGround);
    for(const {position:[x,,z]} of STREET_TREES)this.surface(1.8,1.5,x,-.004,z,this.mulch);

    for(const [a,b] of [[-90,accessWest-1],[accessEast+1,laneWest-1],[laneEast+1,90]]){
      this.surface(b-a,.105,(a+b)/2,roadwayY+.004,main.near+.31,red);
    }
    for(let x=-91;x<=91;x+=6.4){
      if(Math.abs(x-lane168.x)<11||Math.abs(x-oppositeAlley.x)<8)continue;
      this.surface(2.25,.085,x,roadwayY+.006,center,yellow);
    }
    // Reconstruct the observed junction motifs. Crossings sit on the two
    // offset junctions, leaving the HQ's forecourt and access drive clear.
    const stripe=(x,z,w,d,yaw=0)=>{
      const g=new THREE.PlaneGeometry(w,d);
      g.rotateX(-Math.PI/2);g.rotateY(yaw);g.translate(x,roadwayY+.009,z);this.add(g,paint);
    };
    const crossMain=(x,yaw=0)=>{
      for(let i=-5;i<=5;i++)stripe(x+i*.79*Math.sin(yaw),center+i*.79,2.5,.36,yaw);
    };
    crossMain(laneWest-1.65);
    crossMain(oppositeMouth.leftCurve[0][0]-1.6);crossMain(oppositeMouth.rightCurve[0][0]+1.8,.19);
    for(let i=-3;i<=3;i++)stripe(lane168.x+i*.81,-.57,.38,2.25);
    for(let i=-2;i<=2;i++)stripe(oppositeAlley.x+i*.82,18.1,.37,2.0);
    // The aerial shows curb parking, but does not resolve painted stall extents.
    // Keep the south-side curb and planting rather than drawing guessed stalls.
    for(const x of [-25,-11,3,14,28,43])this.surface(.52,.19,x,roadwayY+.006,main.near+.2,drain,this.fine);
  }

  // Continuous chamfered perimeter, not stacks of building boxes.
  prism(width, height, depth, x, y, z, material, parent = this.near, bevel = .035) {
    const shape = new THREE.Shape();
    const b = Math.min(.24, width * .08, depth * .08);
    shape.moveTo(-width / 2 + b, -depth / 2);
    shape.lineTo(width / 2 - b, -depth / 2); shape.lineTo(width / 2, -depth / 2 + b);
    shape.lineTo(width / 2, depth / 2 - b); shape.lineTo(width / 2 - b, depth / 2);
    shape.lineTo(-width / 2 + b, depth / 2); shape.lineTo(-width / 2, depth / 2 - b);
    shape.lineTo(-width / 2, -depth / 2 + b); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, steps: 1 });
    g.rotateX(-Math.PI / 2); g.translate(x, y, z); this.add(g, material, parent);
  }

  curve(points, radius, material, parent = this.fine, segments = 12) {
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, 5, false);
    this.add(g, material, parent);
  }

  contactMask() {
    // Authored soft ground contact, not a baked claim about real site shadows.
    const size = 64, pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const r = Math.hypot((x + .5 - size / 2) / (size / 2), (y + .5 - size / 2) / (size / 2));
      const i = (y * size + x) * 4; pixels[i] = pixels[i + 1] = pixels[i + 2] = 30;
      pixels[i + 3] = Math.round(Math.pow(Math.max(0, 1 - r), 1.8) * 120);
    }
    const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
    texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
    this.textures.add(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.materials.add(material); return material;
  }

  buildForecourt() {
    // Existing P5A paving, curb and entry geometry remain authoritative. New
    // joints lie above it by 18 mm and have physical widths, rather than grids
    // of tall geometry. All additions are unverified design context.
    for (let x = -27; x < 17.4; x += 2.7) this.surface(.014, 7.4, x, .033, -.1, this.joint, this.fine);
    for (let z = -1.8; z < 3.6; z += 2.7) this.surface(47, .012, -6, .034, z, this.joint, this.fine);
    for (let z = -40; z < 3; z += 2.7) this.surface(2.4, .014, 16.3, .033, z, this.joint, this.fine);
    // Narrow continuous drainage channels with paired solid frames and open
    // grate gaps. These share four merged batches, not one Mesh per slot.
    this.surface(44, .10, -6, .033, 3.59, this.joint);
    this.surface(.10, 43.5, 17.35, .033, -18.2, this.joint);
    for (let x = -27.3; x < 16; x += .18) this.surface(.032, .11, x, .039, 3.59, this.steel, this.fine);
    for (let z = -39.8; z < 3.4; z += .18) this.surface(.11, .032, 17.35, .039, z, this.steel, this.fine);
    for (const z of [3.50, 3.68]) this.surface(44.1, .025, -6, .035, z, this.concrete);

    const contact = this.contactMask();
    for (const [x, ,z] of HQ_TREE_ROOTS) {
      // Rounded mulch pad, subtle radial contact and a beveled edging avoid a
      // tree visibly emerging from clean paving. No alpha foliage added here.
      this.prism(1.65, .025, 1.20, x, .029, z, this.mulch, this.near, .025);
      const g = new THREE.PlaneGeometry(1.7, 1.7); g.rotateX(-Math.PI / 2); g.translate(x, .084, z); this.add(g, contact);
      for (const dx of [-.87, .87]) this.prism(.07, .05, 1.28, x + dx, .035, z, this.steel, this.near, .012);
    }
    // Expansion gaps, road repairs and small inspection covers bring the large
    // asphalt plane into a human scale without bright, invented signage.
    for (const [x, z, angle] of [[-2, 8, .15], [14, 9.4, -.05], [35.4, -10, .27], [35.4, -31, -.1]]) {
      const g = new THREE.CircleGeometry(.36, 24); g.rotateX(-Math.PI / 2); g.translate(x, -.215, z); this.add(g, this.steel, this.fine);
      this.curve([[x - 1.9, -.218, z - .4], [x - .5, -.218, z + angle], [x + 1.1, -.218, z - .2]], .010, this.patch);
      for (let n = -2; n <= 2; n++) this.surface(.44, .018, x, -.212, z + n * .07, this.joint, this.fine);
    }
    // Low, plainly functional bollards at the forecourt ends, away from entry.
    for (const [x, z] of [[-26, 3.2], [16.8, 2.6], [16.8, -4]]) {
      const g = new THREE.CylinderGeometry(.055, .075, .75, 10); g.translate(x, .40, z); this.add(g, this.steel);
      const cap = new THREE.CylinderGeometry(.06, .06, .035, 10); cap.translate(x, .74, z); this.add(cap, this.concrete);
    }
  }

  buildDistrict() {
    // Layered public-realm ground outside the modeled roadway. Heights and
    // background block positions are illustrative.
    this.surface(98, 90, -86, -.21, -40, this.softGround, this.distant);
    this.surface(96, 50, -19, -.21, -87, this.softGround, this.distant);
    this.surface(86, 116, 83, -.24, -24, this.softGround, this.distant);
    this.surface(112, 70, 1, -.24, 63, this.softGround, this.distant);
    for (const [w, d, x, z] of [[4, 47, -38, -23], [91, 4, -12, -56]]) {
      this.surface(w, d, x, -.13, z, this.walkway, this.distant);
      if (w > d) this.prism(w, .14, .20, x, -.25, z - d / 2, this.concrete, this.distant, .025);
      else this.prism(.20, .14, d, x - w / 2, -.25, z, this.concrete, this.distant, .025);
    }
    for (const mass of CONTEXT_MASSES) {
      const { x, z, width, depth, height, roof } = mass;
      this.prism(width + 5, .15, depth + 5, x, -.20, z, this.concrete, this.distant);
      this.prism(width, height, depth, x, -.04, z, this.contextStone, this.distant, .07);
      this.prism(width + .25, .26, depth + .25, x, height, z, this.contextShadow, this.distant, .035);
      // Set-back cap stays shallow. No made-up AC units or rooftop towers.
      this.prism(width - 1.1, roof, depth - 1.1, x, height + .13, z, this.contextStone, this.distant, .035);
      for (let y = 2.7; y < height - .5; y += 3.0) {
        // Separate subdued bays replace the uninterrupted contrasting ribbons
        // that made the first render read as a striped wall beside the HQ.
        for (const sign of [-1, 1]) {
          let bay = 0;
          for (let dx = -width / 2 + 2; dx < width / 2 - 1; dx += 3.3) {
            const w = bay++ % 3 === 0 ? 1.8 : 2.35;
            const g = new THREE.PlaneGeometry(w, 1.25); g.rotateY(sign < 0 ? Math.PI : 0);
            g.translate(x + dx, y, z + sign * (depth / 2 + .13)); this.add(g, this.contextGlass, this.distantFine);
          }
          for (let dz = -depth / 2 + 2; dz < depth / 2 - 1; dz += 3.3) {
            const w = bay++ % 3 === 0 ? 1.8 : 2.35;
            const g = new THREE.PlaneGeometry(w, 1.25); g.rotateY(sign * Math.PI / 2);
            g.translate(x + sign * (width / 2 + .13), y, z + dz); this.add(g, this.contextGlass, this.distantFine);
          }
        }
      }
    }
  }

  flush() {
    for (const { geometries, material, parent } of this.parts.values()) {
      const geometry = mergeGeometries(geometries, false); geometries.forEach(g => g.dispose());
      if (!geometry) throw new Error('Site detail batch could not merge');
      geometry.computeBoundingSphere(); this.geometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, material); mesh.receiveShadow = true;
      mesh.castShadow = parent !== this.distantFine && material !== this.joint && !material.transparent;
      parent.add(mesh);
    }
    this.parts.clear();
  }

  setQuality(level = 'high') {
    const quality = String(level).toLowerCase();
    if (!PROFILES.has(quality)) throw new TypeError('Unknown streetscape quality profile');
    if (this.disposed) return;
    this.quality = quality; this.fine.visible = quality !== 'low';
    this.distantFine.visible = quality === 'ultra' || quality === 'high';
  }

  setLighting(mode = 'day') {
    if (this.disposed) return;
    this.contextGlass.emissiveIntensity = mode === 'night' ? .18 : mode === 'dusk' ? .045 : 0;
  }

  stats() {
    let triangles = 0, drawCalls = 0;
    this.root.traverseVisible(object => { if (object.isMesh) { drawCalls++; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3; } });
    return { quality: this.quality, geometries: this.geometries.size, materials: this.materials.size, textures: this.textures.size, drawCalls, triangles, masses: CONTEXT_MASSES.length, evidence: SITE_EVIDENCE, disposed: this.disposed };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.root.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.geometries.clear(); this.materials.clear(); this.textures.clear(); this.root.clear();
  }
}
