import * as THREE from 'three';
import { paGeometry } from './pa-material.js';

export const PA_ASPECT = Object.freeze([.688,1,.802]);
export class GeometryPool {
  constructor(){this.entries=new Map();}
  acquire(key,build){let e=this.entries.get(key);if(!e){e={geometry:build(),refs:0};this.entries.set(key,e);}e.refs++;return e.geometry;}
  release(key){const e=this.entries.get(key);if(e&&--e.refs===0){e.geometry.dispose();this.entries.delete(key);}}
  get size(){return this.entries.size;}
  dispose(){for(const e of this.entries.values())e.geometry.dispose();this.entries.clear();}
}

const shapeCache=new Map();
export function shapeFor(variant,span=1){
  const size=Math.max(1,Math.min(48,Math.ceil(span))),key=`${variant}:${size}`;
  if(!shapeCache.has(key)){
    const result=window.PARackScene.buildEditorialParts([{name:'template',mgx_type:variant,rack_u:size,rack_size:size}]);
    shapeCache.set(key,result.equipment[key]);
    if(shapeCache.size>32)shapeCache.delete(shapeCache.keys().next().value);
  }
  return shapeCache.get(key);
}

export class RackRig {
  constructor(studio,pool,rack,profile,equipment,catalog){
    this.studio=studio;this.pool=pool;this.rack=rack;this.profile=profile;this.unit=profile.pitchMm/.3/1000;
    this.height=(profile.capacity*.3+1.18)*this.unit;this.group=new THREE.Group();this.group.name=rack.name;
    this.group.userData={entityId:rack.id,rackId:rack.id,kind:'rack'};
    this.group.position.fromArray(rack.positionMm.map(v=>v/1000));this.group.position.y+=(profile.capacity*.3/2+.59)*this.unit;
    this.authored=new THREE.Group();this.authored.scale.set(this.unit*.688,this.unit,this.unit*.802);this.group.add(this.authored);
    this.items=new Map();this.blanks=[];this.keys=[];this.ownedGeometry=[];this.ownedMaterials=[];this.material=studio.material();this.ownedMaterials.push(this.material);
    this.doorValue=0;this.doorTarget=0;this.extracted=null;this.poseDirty=true;
    const byModel=new Map(catalog.map(m=>[m.id,m]));
    const sourceRouting=profile.capacity===48&&equipment.every(e=>e.placement.mode==='grid'&&e.placement.face==='front'&&!e.placement.yawDeg&&e.placement.offsetMm.every(n=>n===0));
    const records=(sourceRouting?equipment:[]).filter(e=>e.placement.mode==='grid'&&Number.isInteger(e.placement.start)&&Number.isInteger(e.placement.span)&&e.placement.start+e.placement.span-1<=48)
      .map(e=>({name:e.id,mgx_type:byModel.get(e.modelId).renderVariant,rack_u:e.placement.start+e.placement.span-1,rack_size:e.placement.span}));
    // The original structure includes sockets and service routes. Unknown xyz or
    // front/rear overlaps cannot be fed to its 48-slot validator; render chassis
    // only in that case, rather than inventing physical cabling.
    let built;try{built=window.PARackScene.buildEditorialParts(records);}catch{built=window.PARackScene.buildEditorialParts([]);}
    const structureKey=JSON.stringify(records.map(r=>[r.mgx_type,r.rack_u,r.rack_size]));
    for(const key of ['frame','infrastructure','connections']){
      const cacheKey=`${key}:${key==='frame'?'canonical':structureKey}`;
      const geometry=pool.acquire(cacheKey,()=>paGeometry(built[key].data));this.keys.push(cacheKey);
      const mesh=new THREE.Mesh(geometry,this.material);mesh.name=key;mesh.userData={entityId:rack.id,rackId:rack.id,kind:'rack'};
      if(profile.capacity!==48)mesh.scale.y=(profile.capacity*.3+1.18)/(48*.3+1.18);
      this.authored.add(mesh);studio.bind(mesh,this);this[key]=mesh;
    }
    const occupied=new Set();
    for(const e of equipment){
      const model=byModel.get(e.modelId),shape=shapeFor(model.renderVariant,model.span),size=Math.max(1,Math.ceil(model.span));
      const cacheKey=`equipment:${model.renderVariant}:${size}`;
      const geometry=pool.acquire(cacheKey,()=>paGeometry(shape.data));this.keys.push(cacheKey);
      const group=new THREE.Group();group.name=e.name;group.userData={entityId:e.id,rackId:rack.id,kind:model.kind};
      const material=studio.material();this.ownedMaterials.push(material);const mesh=new THREE.Mesh(geometry,material);mesh.userData={...group.userData};mesh.name=e.deviceId;
      const extent=shape.max.map((v,i)=>v-shape.min[i]);
      const dims=e.dimensionsMm;mesh.scale.set(dims.width/(extent[0]*this.unit*.688*1000),dims.height/(extent[1]*this.unit*1000),dims.depth/(extent[2]*this.unit*.802*1000));
      // Retain the authored origin and front plane. Catalog originMm records
      // the asymmetric body envelope; nothing is centered on its own bounds.
      mesh.userData.sourceBounds={min:shape.min,max:shape.max};
      // Rotation is in physical coordinates, before the authored anisotropic
      // aspect transform. Otherwise an arbitrary yaw shears the body envelope.
      const mount=new THREE.Group();const yaw=(e.placement.face==='rear'?Math.PI:0)+(e.placement.yawDeg||0)*Math.PI/180;
      mount.matrixAutoUpdate=false;mount.matrix.makeScale(1/.688,1,1/.802).multiply(new THREE.Matrix4().makeRotationY(yaw)).multiply(new THREE.Matrix4().makeScale(.688,1,.802));
      mount.add(mesh);group.add(mount);this.authored.add(group);studio.bind(mesh,this);
      if(e.placement.mode==='grid'){
        group.position.set((e.placement.offsetMm?.[0]||0)/(this.unit*.688*1000),(e.placement.start-1+e.placement.span/2-profile.capacity/2)*.3+(e.placement.offsetMm?.[1]||0)/(this.unit*1000),(e.placement.offsetMm?.[2]||0)/(this.unit*.802*1000));
        for(let u=e.placement.start;u<e.placement.start+e.placement.span;u++)occupied.add(u);
      }else group.position.set(e.placement.positionMm[0]/(this.unit*.688*1000),e.placement.positionMm[1]/(this.unit*1000)-profile.capacity*.15,e.placement.positionMm[2]/(this.unit*.802*1000));
      this.items.set(e.id,{instance:e,model,group,mount,mesh,base:group.position.clone(),baseRotation:0,extract:0,details:null});
    }
    // Blanks fill unused grid locations; they are decoration, never equipment.
    const blank=shapeFor('blanking'),blankKey='equipment:blanking:1';
    if(profile.capacity<=48&&equipment.every(e=>e.placement.mode==='grid'&&e.placement.offsetMm.every(v=>v===0)))for(let u=1;u<=profile.capacity;u++)if(!occupied.has(u)){
      const geom=pool.acquire(blankKey,()=>paGeometry(blank.data));this.keys.push(blankKey);
      const mesh=new THREE.Mesh(geom,this.material);mesh.position.y=(u-.5-profile.capacity/2)*.3;mesh.userData={entityId:rack.id,rackId:rack.id,kind:'blank'};
      this.authored.add(mesh);studio.bind(mesh,this);this.blanks.push(mesh);
    }
    this.addDoor();
  }
  addDoor(){
    const p=this.profile,door=new THREE.Group();door.position.set(-2.21,0,3.39);this.authored.add(door);this.door=door;
    const mat=new THREE.MeshStandardMaterial({color:0x283336,metalness:.84,roughness:.33});this.ownedMaterials.push(mat);
    const add=(x,y,z,w,h,d,m=mat)=>{const g=new THREE.BoxGeometry(w,h,d);this.ownedGeometry.push(g);const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.userData={entityId:this.rack.id,rackId:this.rack.id,kind:'door'};door.add(mesh);};
    const h=p.capacity*.3+.46;
    add(0,0,0,.065,h,.075);add(4.42,0,0,.065,h,.075);add(2.21,h/2,0,4.48,.065,.075);add(2.21,-h/2,0,4.48,.065,.075);
    const glass=new THREE.MeshPhysicalMaterial({color:0xa5bec0,metalness:.2,roughness:.2,transparent:true,opacity:.045,depthWrite:false,side:THREE.DoubleSide});this.ownedMaterials.push(glass);
    add(2.21,0,.005,4.31,h-.10,.018,glass);add(4.19,-.1,.09,.045,.55,.08);
    for(const y of [-h*.36,0,h*.36])add(-.045,y,-.015,.13,.22,.11);
    door.userData.draft=true;
  }
  toggleDoor(){if(this.doorTarget&&[...this.items.values()].some(i=>i.extract>.001)){this.extracted=null;this.closeAfterRetract=true;}else this.doorTarget=this.doorTarget?0:1;return this.doorTarget;}
  extract(id){this.doorTarget=1;this.extracted=this.extracted===id?null:id;this.studio.dirty=true;}
  update(dt){
    let dirty=false;const step=1-Math.exp(-dt*7);
    if(Math.abs(this.doorTarget-this.doorValue)>.0001){this.doorValue+=(this.doorTarget-this.doorValue)*step;this.door.rotation.y=-this.doorValue*Math.PI*.72;dirty=true;}
    for(const [id,item] of this.items){
      if(this.cinematic)continue;
      const target=id===this.extracted&&this.doorValue>.85?1:0;
      if(Math.abs(item.extract-target)>.0001){item.extract+=(target-item.extract)*step;dirty=true;}
      const yaw=(item.instance.placement.face==='rear'?Math.PI:0)+(item.instance.placement.yawDeg||0)*Math.PI/180;
      item.group.position.copy(item.base);item.group.position.x+=item.extract*7.4*.802/.688*Math.sin(yaw);item.group.position.z+=item.extract*7.4*Math.cos(yaw);
      if(item.details)item.mesh.visible=false;
    }
    this.connections.visible=!this.cinematic&&!this.extracted;
    if(this.closeAfterRetract&&[...this.items.values()].every(i=>i.extract<.001)){this.closeAfterRetract=false;this.doorTarget=0;}
    this.studio.dirty ||= dirty;return dirty;
  }
  setCinematic(progress){
    this.cinematic=progress!==null;
    if(progress===null){this.material.transparent=false;this.door.visible=true;for(const m of [this.frame,this.infrastructure,...this.blanks]){m.visible=true;m.userData.paOpacity=1;}for(const item of this.items.values()){item.group.position.copy(item.base);item.group.rotation.y=item.baseRotation;item.group.visible=true;item.mesh.userData.paOpacity=1;item.mesh.material.transparent=false;}this.studio.dirty=true;return;}
    this.doorTarget=1;const snapshot=window.PACoreScene.assemblySnapshot(progress,{coolingV1:true});
    this.material.transparent=snapshot.rackOpacity<.999;for(const m of [this.frame,this.infrastructure,...this.blanks]){m.userData.paOpacity=snapshot.rackOpacity;m.visible=snapshot.rackOpacity>.001;}this.door.visible=snapshot.rackOpacity>.99;
    const samples=snapshot.placements;
    let i=0;for(const item of this.items.values()){
      const family=samples.filter(s=>s.type===item.model.renderVariant&&!s.primary);
      const candidate=item.instance.id===this.filmPrimary?samples.find(s=>s.primary):samples.find(s=>s.name===item.instance.id&&(!s.primary||!this.filmPrimary))||family[i++%Math.max(1,family.length)];
      if(candidate){item.group.position.set(item.base.x+candidate.x,item.base.y,candidate.z*(item.instance.placement.face==='rear'?-1:1)+item.base.z);item.group.visible=candidate.opacity>.001;item.mesh.userData.paOpacity=candidate.opacity;item.mesh.material.transparent=candidate.opacity<.999;}
    }
    this.studio.dirty=true;
  }
  dispose(){
    if(this.studio.focus===this)this.studio.setFocus(null);
    this.group.removeFromParent();for(const item of this.items.values())item.details?.dispose();
    this.keys.forEach(k=>this.pool.release(k));this.ownedGeometry.forEach(g=>g.dispose());this.ownedMaterials.forEach(m=>m.dispose());this.items.clear();
  }
}
