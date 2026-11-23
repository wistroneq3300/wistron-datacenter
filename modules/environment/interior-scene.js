import * as THREE from 'three';

// A fictional visitor lobby aligned to the modeled HQ door. This layout is
// independent of inventory and does not represent actual Wistron interiors.
export class InteriorEnvironment {
  constructor(parent) {
    this.root = new THREE.Group();
    this.root.name = 'Visitor Lobby · Draft';
    this.root.userData.draft = true;
    this.root.position.set(-8.15, 0, -4.4);
    this.root.visible = false;
    parent.add(this.root);
    this.geometry = new THREE.BoxGeometry();
    this.materials = [];
    this.textures = [];
    const material = (color, roughness = .65, extra = {}) => {
      const m = new THREE.MeshStandardMaterial({color, roughness, ...extra});
      this.materials.push(m);
      return m;
    };
    const stone = material(0xc4c0b4, .78);
    const porcelain = material(0xa5a99f, .43);
    const joint = material(0x656c64, .82);
    const ceiling = material(0xd7dbd2, .8);
    const woodGrain = this.woodGrain();
    const timber = material(0x956b4b, .68, {map:woodGrain, bumpMap:woodGrain, bumpScale:.012});
    const timberEdge = material(0x513923);
    const metal = material(0x283c39, .36, {metalness:.38});
    const glass = material(0x466c67, .28, {metalness:.27});
    const cloth = material(0x485652, .93);
    const lamp = material(0xe0eddc, .38, {emissive:0xe8dea9, emissiveIntensity:.85});
    this.root.add(new THREE.HemisphereLight(0xf4f0e3,0x53635c,1.15));
    for (const [x,z,intensity] of [[-2.1,-10.4,42],[2.1,-10.9,33],[0,-4.0,30]]) {
      const light = new THREE.PointLight(0xffefd6,intensity,12,2);
      light.position.set(x,3.72,z);
      this.root.add(light);
    }
    const box = (name, mat, size, at) => {
      const mesh = new THREE.Mesh(this.geometry, mat);
      mesh.name = name;
      mesh.scale.set(...size);
      mesh.position.set(...at);
      this.root.add(mesh);
      return mesh;
    };
    box('Porcelain floor', porcelain, [12,.17,15], [0,-.086,-7.5]);
    for (let x=-5; x<=5; x++) box('Floor joint', joint, [.013,.001,14.9], [x,.001,-7.5]);
    for (let z=-1; z>-15; z--) box('Floor joint', joint, [11.9,.001,.013], [0,.002,z]);
    box('Ceiling', ceiling, [12,.18,15], [0,4.07,-7.5]);
    box('Entry glazing', glass, [12,4,.15], [0,2,.07]);
    for (const side of [-1,1]) {
      box('Side wall', stone, [.15,4,15], [side*6,2,-7.5]);
      box('Recessed skirting', metal, [.09,.14,15], [side*5.91,.07,-7.5]);
      for (let z=-2; z>-15; z-=2) box('Wall panel reveal', joint, [.009,3.83,.013], [side*5.92,2.03,z]);
      box('Wall cornice', stone, [.18,.10,14.9], [side*5.87,3.85,-7.5]);
      box('Ceiling rail', metal, [.16,.045,12.9], [side*2.1,3.96,-7.5]);
      box('Linear luminaire', lamp, [.055,.012,12.55], [side*2.1,3.928,-7.5]);
    }
    for (let x=-5; x<=5; x++) box('Glazing mullion', metal, [.045,4,.06], [x,2,-.03]);
    box('Destination wall', stone, [12,4,.16], [0,2,-15]);
    box('Reception feature wall', timberEdge, [4.4,3.7,.09], [-3.44,1.85,-14.865]);
    for (let i=0;i<35;i++) box('Timber slat', timber, [.082,3.68,.065], [-5.57+i*.124,1.85,-14.795]);
    box('Reception desk', timber, [3.6,1.04,.91], [-3.42,.58,-11.64]);
    box('Desk top', stone, [3.72,.09,1.02], [-3.42,1.14,-11.64]);
    box('Desk recess', metal, [3.35,.14,.8], [-3.42,.07,-11.64]);
    box('Bench upholstery', cloth, [.67,.17,3.18], [5.04,.49,-7.45]);
    for (const z of [-8.65,-6.25]) box('Bench pedestal', metal, [.45,.43,.082], [5.04,.215,z]);
    this.contacts();

    box('Hall portal surround', metal, [2.78,3.05,.19], [1.46,1.525,-14.83]);
    for (const x of [.86,2.06]) box('Hall door', glass, [1.16,2.48,.052], [x,1.25,-14.71]);
    for (const x of [1.36,1.56]) box('Pull handle', stone, [.026,.45,.07], [x,1.16,-14.635]);
    box('Portal threshold', metal, [2.42,.016,.24], [1.46,.01,-14.61]);
    this.sign('VISITOR RECEPTION', 'ILLUSTRATIVE LOBBY  /  DRAFT', [-3.45,2.74,-14.744], [3.7,.76]);
    this.sign('DATA CENTER HALL', 'ENTER  →', [1.46,2.74,-14.694], [2.48,.5]);
    this.hallAnchor = this.world([1.46,1.53,-14.6]);
    this.bounds = new THREE.Box3(this.world([-5.86,.18,-14.53]), this.world([5.86,3.88,-.16]));
    this.obstacles = [
      new THREE.Box3(this.world([-5.28,0,-12.15]), this.world([-1.56,1.19,-11.13])),
      new THREE.Box3(this.world([4.70,0,-9.04]), this.world([5.38,.58,-5.86]))
    ];
  }

  world(local) { return new THREE.Vector3(...local).add(this.root.position); }

  woodGrain() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(128,128);
    for(let y=0;y<128;y++) for(let x=0;x<128;x++) {
      const grain = 223 + 14*Math.sin(x*.44+Math.sin(y*.038+x*.08)*.92)+5*Math.sin(x*1.8+y*.031);
      const i=(y*128+x)*4;
      image.data.set([grain,grain,grain,255],i);
    }
    ctx.putImageData(image,0,0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.push(texture);
    return texture;
  }

  contacts() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const mask = ctx.createRadialGradient(32,32,10,32,32,31);
    mask.addColorStop(0,'rgba(0,0,0,.34)');
    mask.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=mask;
    ctx.fillRect(0,0,64,64);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false});
    this.textures.push(texture);
    this.materials.push(material);
    this.contactGeometry = new THREE.PlaneGeometry();
    for(const [x,z,width,depth] of [[-3.42,-11.64,5.6,2.2],[5.04,-7.45,1.35,4.1]]) {
      const mesh=new THREE.Mesh(this.contactGeometry,material);
      mesh.rotation.x=-Math.PI/2;
      mesh.scale.set(width,depth,1);
      mesh.position.set(x,.004,z);
      this.root.add(mesh);
    }
  }

  sign(heading, subtitle, at, size) {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 144;
    const context = canvas.getContext('2d');
    context.fillStyle = '#263b35';
    context.fillRect(0,0,640,144);
    context.fillStyle = '#ecf0df';
    context.font = '500 43px sans-serif';
    context.fillText(heading, 24, 65);
    context.fillStyle = '#b9ceba';
    context.font = '24px sans-serif';
    context.fillText(subtitle, 26, 110);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({map:texture});
    const mesh = new THREE.Mesh(this.geometry, material);
    this.textures.push(texture);
    this.materials.push(material);
    mesh.position.set(...at);
    mesh.scale.set(...size,.004);
    this.root.add(mesh);
  }

  pose(portrait, approach = false) {
    const eye = approach ? [.82,1.67,-6.5] : [-.85,1.65,-2.15];
    return {position:this.world(eye).toArray(),target:this.world([.38,1.68,-13.6]).toArray(),fov:portrait?72:49};
  }

  envelope() {
    return {bounds:this.bounds,obstacles:this.obstacles,safePosition:this.world([0,1.65,-2.3]),radius:.2};
  }

  setDepth(depth) { this.root.visible = depth === 1; }

  dispose() {
    this.root.removeFromParent();
    this.geometry.dispose();
    this.contactGeometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
  }
}
