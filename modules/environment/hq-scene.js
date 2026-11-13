import * as THREE from 'three';
import {ArchitectureBuilder} from './hq5-architecture.js';
import {HQVegetation} from './hq5-vegetation.js';
import {HQLighting} from './hq5-lighting.js';

export const HQ_EVIDENCE=Object.freeze({status:'draft',reference:'Wistron 2011/2012 official overviews; UDN 2025 entrance photograph',referenceUrl:'https://udn.com/news/story/7240/8775190',observed:['grey stone recessed window bands','blue-green corner curtain wall','stepped silhouette','central convex glass bay','radial entrance canopy','granite entrance sign'],pending:['user original photo unavailable','survey dimensions','complete window schedule','current rear and roof','exact landscaping']});
const random=seed=>()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
export class HQEnvironment {
  constructor(scene,renderer){
    this.scene=scene;this.renderer=renderer;this.disposed=false;this.depth=0;this.mode='day';this.geometry=new Set();this.materials=new Set();this.textures=new Set();this.rnd=random(1582025);
    this.root=new THREE.Group();this.root.name='Wistron 158 · photo-informed architectural study / DRAFT';this.root.userData.evidence=HQ_EVIDENCE;scene.add(this.root);
    this.building=new THREE.Group();this.city=new THREE.Group();this.root.add(this.building,this.city);
    this.createMaterials();new ArchitectureBuilder(this).build();this.building.traverse(o=>{if(o.material===this.glass)o.castShadow=false;});this.buildSite();
    this.plants=new HQVegetation(this.city,renderer,{roots:[[-23,.03,1.5],[-17,.03,1.5],[-1,.03,1.5],[7,.03,1.5],[17.8,.03,1.0],[19,.03,-9],[19,.03,-19],[19,.03,-28],[-28,.03,-16],[-28,.03,-26]],shrubs:[{position:[-14,.05,2.1],height:.65,spread:.8},{position:[-12.3,.05,2.1],height:.55,spread:.8}]});
    this.lighting=new HQLighting(this);this.lighting.set('day');
    this.journeyEntry={approach:[-8.15,1.8,.5],door:[-8.15,1.8,-4.5],target:[-8.15,1.8,-7]};
    this.loading=Promise.all([this.loadPBR(),this.plants.ready,this.lighting.ready]);
  }
  get vegetation(){return this.plants.stats();}
  get envTarget(){return this.lighting.envTarget;}
  get sky(){return this.lighting.sky;}
  own(g){this.geometry.add(g);return g;}
  material(color,roughness,metalness=0,extra={}){const m=new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});this.materials.add(m);return m;}
  texture(c,color=true){const t=new THREE.CanvasTexture(c);t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.textures.add(t);return t;}
  tileTexture(kind,bump=false){
    const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');const isStone=kind==='stone',w=isStone?512:128,h=isStone?320:64;
    ctx.fillStyle=bump?'#6d6d6d':isStone?'#797d7c':'#454a49';ctx.fillRect(0,0,1024,1024);
    for(let row=-1;row<1024/h+1;row++)for(let col=-1;col<1024/w+1;col++){const x=col*w+(row%2)*w/2,y=row*h,v=bump?205+this.rnd()*12:isStone?181+this.rnd()*10:105+this.rnd()*13;ctx.fillStyle=`rgb(${v},${v},${v-1})`;ctx.fillRect(x+2,y+2,w-4,h-4);}
    const pixels=ctx.getImageData(0,0,1024,1024);for(let i=0;i<pixels.data.length;i+=4){const n=(this.rnd()-.5)*(bump?20:isStone?80:22);for(let k=0;k<3;k++)pixels.data[i+k]+=n;}ctx.putImageData(pixels,0,0);
    const t=this.texture(c,!bump);t.repeat.set(1/2.4,1/2.4);return t;
  }
  graniteGrain(color=true){
    // Authored granular granite, not a photograph or surveyed surface. No panel
    // joints: the entrance marker is one rough stone, unlike facade cladding.
    const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');ctx.fillStyle='#8d918c';ctx.fillRect(0,0,1024,1024);
    for(let n=0;n<220000;n++){const value=65+this.rnd()*135;ctx.fillStyle=`rgb(${value},${value+2},${value})`;const size=1+this.rnd()*3;ctx.fillRect(this.rnd()*1024,this.rnd()*1024,size,size*.7);}
    const t=this.texture(c,color);t.repeat.set(.8,.8);return t;
  }
  createMaterials(){
    this.stone=this.material(0xc4c8c4,.82,0,{map:this.tileTexture('stone'),bumpMap:this.tileTexture('stone',true),bumpScale:.025});
    this.trim=this.material(0xb8bdbb,.48,.12);this.frame=this.material(0x293a3c,.35,.72);this.metal=this.material(0x546367,.31,.82);
    this.glass=new THREE.MeshPhysicalMaterial({color:0x93b0aa,roughness:.08,metalness:0,transmission:.8,thickness:.015,ior:1.5,clearcoat:1,clearcoatRoughness:.11,envMapIntensity:3.0});this.materials.add(this.glass);
    this.canopyGlass=new THREE.MeshPhysicalMaterial({color:0x7b9994,roughness:.2,metalness:0,transparent:true,opacity:.76,side:THREE.DoubleSide,clearcoat:1});this.materials.add(this.canopyGlass);
    this.interior=this.material(0x192a2b,.95);this.roof=this.material(0x828b87,.94,0,{bumpMap:this.tileTexture("stone",true),bumpScale:.006});this.roughStone=this.material(0xc8ccc6,.97,0,{map:this.graniteGrain(),bumpMap:this.graniteGrain(false),bumpScale:.08});
    this.canopyMetal=this.material(0x202b2d,.4,.65);this.paving=this.material(0xe3e6e4,.9,0,{map:this.tileTexture('paving'),bumpMap:this.tileTexture('paving',true),bumpScale:.018});
    this.road=this.material(0xffffff,.96);this.road.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>","#include <map_fragment>\n diffuseColor.rgb=mix(diffuseColor.rgb,vec3(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))),.92)*.72;");};this.soil=this.material(0x34362a,1);this.lamp=this.material(0xffe4be,.35,0,{emissive:0xffcc89,emissiveIntensity:.2});
  }
  mesh(g,m,parent=this.city){this.own(g);const mesh=new THREE.Mesh(g,m);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  ground(w,h,m,x,y,z){const g=new THREE.PlaneGeometry(w,h);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w,uv.getY(i)*h);g.rotateX(-Math.PI/2);g.translate(x,y,z);(this.groundParts??=[]).push({g,m});return null;}
  sign(text,position,width,height,color){const c=document.createElement('canvas');c.width=1536;c.height=256;const ctx=c.getContext('2d');ctx.font='italic 600 190px Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='#111414aa';ctx.shadowOffsetY=4;ctx.shadowBlur=3;ctx.fillStyle=color;ctx.fillText(text,768,139,1460);const map=this.texture(c),material=new THREE.MeshStandardMaterial({map,transparent:true,alphaTest:.1,roughness:.45,metalness:.45,depthWrite:false});this.materials.add(material);const mesh=new THREE.Mesh(this.own(new THREE.PlaneGeometry(width,height)),material);mesh.position.fromArray(position);this.building.add(mesh);}
  buildSite(){
    this.ground(600,600,this.road,0,-.26,-12);this.ground(51,46,this.paving,-3.5,.015,-19);
    const trim=this.material(0xb5b9b4,.85),stripe=this.material(0xc7c9bb,.9),drain=this.material(0x34413f,.75,.7);
    const b=new ArchitectureBuilder(this);const previous=this.building;this.building=this.city;
    for(let x=-29;x<22;x+=1.2)b.rect(1.18,.26,.35,trim,x,-.10,3.96,0,.04);
    for(let z=-42;z<4;z+=1.2)b.rect(.35,.26,1.18,trim,22,-.10,z,0,.04);
    for(let x=-90;x<90;x+=7)this.ground(3.6,.12,stripe,x,-.249,12);
    for(let z=-90;z<90;z+=7)this.ground(.12,3.6,stripe,32,-.249,z);
    for(let z=6;z<11;z+=1)this.ground(4.7,.43,stripe,-21,-.245,z);
    for(const x of [-23,-17,-1,7,17.8]){this.ground(2.2,1.5,this.soil,x,.026,1.6);for(const dx of [-1.15,1.15])b.rect(.12,.12,1.7,trim,x+dx,.07,.75);}
    for(const x of [-10.8,-5.5])this.ground(.15,7.5,trim,x,.028,-.1);
    for(let x=-25;x<21;x+=3){this.ground(.6,.23,drain,x,.027,3.55);for(let j=0;j<9;j++)this.ground(.028,.20,trim,x-.26+j*.065,.029,3.55);}
    this.streetLamps=[];
    for(const [x,z]of[[-28,3.3],[22.4,3.3],[22.4,-24]]){b.tube([[x,0,z],[x,4.8,z],[x+.2,6.4,z],[x+1.3,6.5,z]],.065,this.metal);b.rect(1.05,.08,.35,this.frame,x+1.25,6.5,z-.17,0,.045);const light=new THREE.PointLight(0xffdfb2,0,12,2);light.position.set(x+1.3,6.35,z);this.city.add(light);this.streetLamps.push(light);}
    for(const {g,m} of this.groundParts)b.add(g,m,this.city);this.groundParts=[];b.flush();this.building=previous;
  }
  async loadPBR(){
    const loader=new THREE.TextureLoader();const response=await fetch('./assets/environment/manifest.json');if(!response.ok)throw Error('HQ material manifest unavailable');const manifest=await response.json();
    await Promise.all(manifest.materials.flatMap(spec=>Object.entries(spec.maps).map(async([slot,path])=>{if(!['map','normalMap','roughnessMap'].includes(slot)||!/^assets\/environment\/[A-Za-z0-9._-]+$/.test(path))return;const tex=await loader.loadAsync('./'+path);if(this.disposed){tex.dispose();return;}tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(1/spec.sourceTileWidthMeters,1/spec.sourceTileWidthMeters);tex.colorSpace=slot==='map'?THREE.SRGBColorSpace:THREE.NoColorSpace;tex.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.textures.add(tex);const material=spec.id==='stone'?this.stone:this.road;material[slot]=tex;material.normalScale?.setScalar(spec.id==='stone'?.21:.55);material.needsUpdate=true;})));return true;
  }
  setLighting(mode){if(!['day','dusk','night'].includes(mode))throw Error('Unknown HQ lighting preset');this.mode=mode;this.lighting.set(mode);this.plants.setLighting?.(mode);return mode;}
  setDepth(depth){this.depth=depth;this.root.visible=depth===0;this.lighting?.activate(depth===0);}
  update(camera){if(!this.root.visible)return;this.plants.update(camera,performance.now()/1000);this.lighting.update(camera);}
  pose(angle='quarter'){const poses={front:{position:[-6,5.5,46],target:[-4,9,-7],fov:36},side:{position:[60,10,-18],target:[1,9,-23],fov:35},quarter:{position:[33,10,35],target:[-3,9,-18],fov:36},aerial:{position:[42,38,31],target:[-3,7,-19],fov:38},entrance:{position:[-6,1.65,8],target:[-8.15,5,-4],fov:52}};return poses[angle]||poses.quarter;}
  dispose(){if(this.disposed)return;this.disposed=true;this.root.removeFromParent();this.plants.dispose();this.lighting.dispose();for(const g of this.geometry)g.dispose();for(const m of this.materials)m.dispose();for(const t of this.textures)t.dispose();this.geometry.clear();this.materials.clear();this.textures.clear();}
}
