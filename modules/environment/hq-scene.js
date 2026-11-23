import * as THREE from 'three';
import {ArchitectureBuilder} from './hq5-architecture.js';
import {HQVegetation} from './hq5-vegetation.js';
import {HQLighting} from './hq5-lighting.js';
import {SiteContext,HQ_TREE_ROOTS,STREET_TREES} from './hq5b-site.js';

export const HQ_EVIDENCE=Object.freeze({status:'draft',reference:'Wistron 2011/2012 official overviews; UDN 2025 entrance photograph',referenceUrl:'https://udn.com/news/story/7240/8775190',observed:['grey stone recessed window bands','blue-green corner curtain wall','stepped silhouette','central convex glass bay','radial entrance canopy','granite entrance sign'],pending:['user original photo unavailable','survey dimensions','complete window schedule','current rear and roof','exact landscaping']});
const random=seed=>()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
export class HQEnvironment {
  constructor(scene,renderer){
    this.scene=scene;this.renderer=renderer;this.disposed=false;this.depth=0;this.mode='day';this.geometry=new Set();this.materials=new Set();this.textures=new Set();this.rnd=random(1582025);
    this.root=new THREE.Group();this.root.name='Wistron 158 · photo-informed architectural study / DRAFT';this.root.userData.evidence=HQ_EVIDENCE;scene.add(this.root);
    this.building=new THREE.Group();this.city=new THREE.Group();this.root.add(this.building,this.city);
    this.createMaterials();new ArchitectureBuilder(this).build();this.building.traverse(o=>{if(o.material===this.glass)o.castShadow=false;});this.buildSite();this.site=new SiteContext(this);
    this.plants=new HQVegetation(this.city,renderer,{roots:[...HQ_TREE_ROOTS,...STREET_TREES],shrubs:[{position:[-14,.05,2.1],height:.65,spread:.8},{position:[-12.3,.05,2.1],height:.55,spread:.8}]});
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
    this.stone=this.material(0x8f979f,.79,0,{map:this.tileTexture('stone'),bumpMap:this.tileTexture('stone',true),bumpScale:.028});
    this.trim=this.material(0x858d95,.54,.11);this.frame=this.material(0x252e35,.38,.66);this.metal=this.material(0x536069,.35,.76);
    this.glass=new THREE.MeshPhysicalMaterial({color:0xa7bac0,vertexColors:true,roughness:.10,metalness:0,transmission:.74,thickness:.017,ior:1.5,clearcoat:.81,clearcoatRoughness:.105,envMapIntensity:2.4});this.materials.add(this.glass);
    this.canopyGlass=new THREE.MeshPhysicalMaterial({color:0x7b9994,roughness:.2,metalness:0,transparent:true,opacity:.76,side:THREE.DoubleSide,clearcoat:1});this.materials.add(this.canopyGlass);
    this.interior=this.material(0x202c34,.95);this.roof=this.material(0x7a8286,.94,0,{bumpMap:this.tileTexture("stone",true),bumpScale:.006});this.roughStone=this.material(0xbfc3c7,.97,0,{map:this.graniteGrain(),bumpMap:this.graniteGrain(false),bumpScale:.08});
    this.canopyMetal=this.material(0x23292e,.4,.65);this.paving=this.material(0xd3d7d9,.9,0,{map:this.tileTexture('paving'),bumpMap:this.tileTexture('paving',true),bumpScale:.018});
    this.road=this.material(0xffffff,.96);this.road.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>","#include <map_fragment>\n diffuseColor.rgb=mix(diffuseColor.rgb,vec3(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))),.92)*.72;");};this.soil=this.material(0x34362a,1);this.lamp=this.material(0xffe4be,.35,0,{emissive:0xffcc89,emissiveIntensity:.2});
  }
  mesh(g,m,parent=this.city){this.own(g);const mesh=new THREE.Mesh(g,m);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  ground(w,h,m,x,y,z){const g=new THREE.PlaneGeometry(w,h);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w,uv.getY(i)*h);g.rotateX(-Math.PI/2);g.translate(x,y,z);(this.groundParts??=[]).push({g,m});return null;}
  sign(text,position,width,height,color,{roofWordmark=false}={}){
    const c=document.createElement('canvas');c.width=1536;c.height=256;
    const ctx=c.getContext('2d');ctx.font=roofWordmark?'700 216px Arial, sans-serif':'600 190px Arial, sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='#111414aa';ctx.shadowOffsetY=4;ctx.shadowBlur=3;ctx.fillStyle=color;
    if(roofWordmark){
      const measured=ctx.measureText(text).width;
      let x=(c.width-measured)/2;ctx.textAlign='left';
      for(const glyph of text){ctx.fillStyle=glyph==='i'?'#53a86d':color;ctx.fillText(glyph,x,139);x+=ctx.measureText(glyph).width;}
    }else ctx.fillText(text,768,139,1460);
    const map=this.texture(c),material=new THREE.MeshStandardMaterial({map,transparent:true,alphaTest:.1,roughness:.49,metalness:.18,depthWrite:false});
    if(roofWordmark){material.emissive.set(0xffffff);material.emissiveMap=map;material.emissiveIntensity=0;this.roofWordmark=material;}
    this.materials.add(material);const mesh=new THREE.Mesh(this.own(new THREE.PlaneGeometry(width,height)),material);mesh.position.fromArray(position);this.building.add(mesh);
  }
  buildSite(){
    const ground=this.material(0x656d63,.99);
    this.ground(600,600,ground,0,-.28,-12);
    this.ground(45.6,45.9,this.paving,-5.85,.015,-19.05);
    this.ground(52,10,this.paving,-54.6,-.030,-1.1);
    const trim=this.material(0xa7adaf,.85),walkAccent=this.material(0xb7b3a4,.91);
    const b=new ArchitectureBuilder(this);const previous=this.building;this.building=this.city;
    for(const x of [-23,-17,-1,7,16]){this.ground(1.75,1.45,this.soil,x,.026,1.6);for(const dx of [-.92,.92])b.rect(.11,.10,1.55,trim,x+dx,.06,.82);}
    for(const x of [-10.8,-5.5])this.ground(.24,7.5,walkAccent,x,.028,-.1);
    this.streetLamps=[];
    for(const [x,z]of[[-28,3.3],[26,3.3],[40,-24]]){b.tube([[x,0,z],[x,4.8,z],[x,6.4,z+.2],[x,6.5,z+1.3]],.065,this.metal);b.rect(.35,.08,1.05,this.frame,x,6.5,z+.85,0,.045);const light=new THREE.PointLight(0xffdfb2,0,12,2);light.position.set(x,6.35,z+1.3);this.city.add(light);this.streetLamps.push(light);}
    for(const {g,m} of this.groundParts)b.add(g,m,this.city);this.groundParts=[];b.flush();this.building=previous;
  }
  async loadPBR(){
    const loader=new THREE.TextureLoader();const response=await fetch('./assets/environment/manifest.json');if(!response.ok)throw Error('HQ material manifest unavailable');const manifest=await response.json();
    await Promise.all(manifest.materials.flatMap(spec=>Object.entries(spec.maps).map(async([slot,path])=>{if(!['map','normalMap','roughnessMap'].includes(slot)||!/^assets\/environment\/[A-Za-z0-9._-]+$/.test(path))return;const tex=await loader.loadAsync('./'+path);if(this.disposed){tex.dispose();return;}tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(1/spec.sourceTileWidthMeters,1/spec.sourceTileWidthMeters);tex.colorSpace=slot==='map'?THREE.SRGBColorSpace:THREE.NoColorSpace;tex.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.textures.add(tex);const material=spec.id==='stone'?this.stone:this.road;material[slot]=tex;material.normalScale?.setScalar(spec.id==='stone'?.21:.55);material.needsUpdate=true;})));return true;
  }
  setLighting(mode){if(!['day','dusk','night'].includes(mode))throw Error('Unknown HQ lighting preset');this.mode=mode;this.lighting.set(mode);this.plants.setLighting?.(mode);this.site.setLighting(mode);return mode;}
  setQuality(profile,level){this.lighting.setQuality(profile);this.plants.setQuality(level);this.site.setQuality(level);}
  setDepth(depth){this.depth=depth;this.root.visible=depth===0;this.lighting?.activate(depth===0);}
  update(camera,dt=0){if(!this.root.visible)return;this.plants.update(camera,performance.now()/1000);this.lighting.update(camera,dt);}
  pose(angle='quarter'){const poses={front:{position:[-6,5.5,46],target:[-4,9,-7],fov:36},side:{position:[60,10,-18],target:[1,9,-23],fov:35},quarter:{position:[33,10,35],target:[-3,9,-18],fov:36},aerial:{position:[42,38,31],target:[-3,7,-19],fov:38},entrance:{position:[-6,1.65,8],target:[-8.15,5,-4],fov:52}};const pose=poses[angle]||poses.quarter;
    // A portrait lens needs horizontal room without retreating into the fog.
    // Keep the desktop evidence lens fixed; fit mobile with a wider lens and
    // lower composition target so controls remain below the complete facade.
    if(this.viewportAspect<1&&angle!=='entrance'){const target=new THREE.Vector3(...pose.target),offset=new THREE.Vector3(...pose.position).sub(target);offset.multiplyScalar(1.4);target.y=Math.max(2,target.y-7);const position=target.clone().add(offset);position.y=Math.max(2.8,position.y);return{...pose,position:position.toArray(),target:target.toArray(),fov:Math.min(90,2*Math.atan(Math.tan(76*Math.PI/360)*.514/this.viewportAspect)*180/Math.PI)};}return pose;}
  dispose(){if(this.disposed)return;this.disposed=true;this.root.removeFromParent();this.plants.dispose();this.site.dispose();this.lighting.dispose();for(const g of this.geometry)g.dispose();for(const m of this.materials)m.dispose();for(const t of this.textures)t.dispose();this.geometry.clear();this.materials.clear();this.textures.clear();}
}
