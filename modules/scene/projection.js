import {GeometryPool,RackRig} from './rack-adapter.js';
import * as THREE from 'three';
import {RackLOD} from './rack-lod.js';

// Stable handles exist for all inventory. Only explicit inspection promotes a
// handle to the original PA RackRig; telemetry and overview never allocate one.
class RackHandle {
  constructor(projection,rack,profile,equipment,catalog){
    this.projection=projection;this.rack=rack;this.profile=profile;this.equipment=equipment;this.catalog=catalog;this.equipmentIds=equipment.map(e=>e.id);this.detail=null;this.visible=true;
    this.unit=profile.pitchMm/.3/1000;this.height=(profile.capacity*.3+1.18)*this.unit;
    this.proxy=new THREE.Group();this.proxy.name=rack.name;this.proxy.userData={entityId:rack.id,rackId:rack.id,kind:'rack'};
    this.proxy.position.fromArray(rack.positionMm.map(value=>value/1000));this.proxy.position.y+=this.height/2;
  }
  ensure(){return this.projection.ensureDetailed(this.rack.id);}
  get group(){return this.detail?.group||this.proxy;}
  get items(){return this.ensure().items;}
  get authored(){return this.ensure().authored;}
  get frame(){return this.ensure().frame;}
  get infrastructure(){return this.ensure().infrastructure;}
  get connections(){return this.ensure().connections;}
  get material(){return this.ensure().material;}
  get door(){return this.ensure().door;}
  get doorValue(){return this.detail?.doorValue||0;}
  get doorTarget(){return this.detail?.doorTarget||0;}
  set doorTarget(value){this.ensure().doorTarget=value;}
  get extracted(){return this.detail?.extracted||null;}
  set extracted(value){if(this.detail)this.detail.extracted=value;else if(value)this.ensure().extracted=value;}
  get filmPrimary(){return this.detail?.filmPrimary;}
  set filmPrimary(value){this.ensure().filmPrimary=value;}
  toggleDoor(){return this.ensure().toggleDoor();}
  extract(id){return this.ensure().extract(id);}
  setCinematic(progress){if(progress===null)this.detail?.setCinematic(null);else this.ensure().setCinematic(progress);}
  update(dt){if(this.detail&&this.visible)this.detail.update(dt);}
  demote(){if(this.detail){this.detail.dispose();this.detail=null;}this.proxy.visible=this.visible;}
  dispose(){this.demote();this.proxy.removeFromParent();}
}

export class RackProjection {
  constructor(studio,parent){this.studio=studio;this.parent=parent;this.pool=new GeometryPool();this.rigs=new Map();this.signatures=new Map();this.lod=new RackLOD(parent);this.focusId=null;this.filter={};this.equipmentIndex=new Map();this.document=null;}
  sync(doc){
    const next=new Map(),signatures=new Map(),created=[],equipmentIndex=new Map();
    try{for(const rack of doc.racks){
      const profile=doc.rackProfiles.find(p=>p.id===rack.profileId),equipment=doc.equipment.filter(e=>e.rackId===rack.id);
      const catalog=doc.catalog.filter(m=>equipment.some(e=>e.modelId===m.id));
      const signature=JSON.stringify([rack,profile,equipment,catalog]);signatures.set(rack.id,signature);
      if(this.signatures.get(rack.id)===signature)next.set(rack.id,this.rigs.get(rack.id));
      else {const handle=new RackHandle(this,rack,profile,equipment,catalog);created.push(handle);next.set(rack.id,handle);}
      for(const item of equipment)equipmentIndex.set(item.id,rack.id);
    }}catch(e){created.forEach(r=>r.dispose());throw e;}
    // Build batches off scene before releasing the old projection. Rack geometry
    // validation still runs through ConfigStore before this rendering transaction.
    const nextLOD=new RackLOD(this.parent);
    try{nextLOD.rebuild(next.values());}catch(error){nextLOD.dispose();created.forEach(r=>r.dispose());throw error;}
    for(const [id,rig] of this.rigs)if(next.get(id)!==rig)rig.dispose();
    for(const handle of created)this.parent.add(handle.proxy);
    this.lod.dispose();this.lod=nextLOD;this.rigs=next;this.signatures=signatures;this.equipmentIndex=equipmentIndex;this.document=doc;
    if(!this.rigs.has(this.focusId))this.focusId=null;
    this.applyVisibility();
  }
  ensureDetailed(id){
    const handle=this.rigs.get(id);if(!handle)return null;
    if(!handle.detail){
      const rig=new RackRig(this.studio,this.pool,handle.rack,handle.profile,handle.equipment,handle.catalog);
      rig.group.visible=handle.visible;this.parent.add(rig.group);handle.detail=rig;handle.proxy.visible=false;this.lod.setVisible(id,false);
    }
    return handle.detail;
  }
  applyVisibility(){
    for(const [id,handle] of this.rigs){
      const row=this.document?.rows.find(row=>row.id===handle.rack.rowId);
      handle.visible=this.focusId?id===this.focusId:(!this.filter.rowId||handle.rack.rowId===this.filter.rowId)&&(!this.filter.hallId||row?.hallId===this.filter.hallId);
      handle.proxy.visible=handle.visible&&!handle.detail;if(handle.detail)handle.detail.group.visible=handle.visible;
      this.lod.setVisible(id,handle.visible&&!handle.detail);
    }
    this.studio.setFocus(this.rigs.get(this.focusId)?.detail||null);
  }
  isolate(id=null,filter={}){
    this.focusId=id&&this.rigs.has(id)?id:null;this.filter={...filter};
    // Caller cancels/releases active GLB navigation before changing isolation.
    for(const [key,handle] of this.rigs)if(key!==this.focusId)handle.demote();
    if(this.focusId)this.ensureDetailed(this.focusId);this.applyVisibility();
  }
  item(id){const rackId=this.equipmentIndex.get(id);if(!rackId)return null;const rig=this.ensureDetailed(rackId);return{rig,item:rig.items.get(id)};}
  record(id){const rackId=this.equipmentIndex.get(id),handle=this.rigs.get(rackId);return handle?{rack:handle.rack,equipment:handle.equipment.find(e=>e.id===id),handle}:null;}
  resolveHit(hit){return this.lod.hit(hit)||hit.object.userData;}
  update(dt){for(const handle of this.rigs.values())handle.update(dt);}
  stats(){return{racks:this.rigs.size,detailed:[...this.rigs.values()].filter(handle=>handle.detail).length,visible:[...this.rigs.values()].filter(handle=>handle.visible).length,pool:this.pool.size,...this.lod.stats()};}
  dispose(){for(const handle of this.rigs.values())handle.dispose();this.rigs.clear();this.signatures.clear();this.equipmentIndex.clear();this.lod.dispose();this.pool.dispose();}
}
