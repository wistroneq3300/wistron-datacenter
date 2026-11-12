import {GeometryPool,RackRig} from './rack-adapter.js';

// The configuration is the only inventory. A transaction builds its replacement
// off scene before releasing the previous graph; rejected edits keep the graph.
export class RackProjection {
  constructor(studio,parent){this.studio=studio;this.parent=parent;this.pool=new GeometryPool();this.rigs=new Map();this.signatures=new Map();}
  sync(doc){
    const next=new Map(),signatures=new Map(),created=[];
    try{for(const rack of doc.racks){
      const profile=doc.rackProfiles.find(p=>p.id===rack.profileId),equipment=doc.equipment.filter(e=>e.rackId===rack.id);
      const catalog=doc.catalog.filter(m=>equipment.some(e=>e.modelId===m.id));
      const signature=JSON.stringify([rack,profile,equipment,catalog]);signatures.set(rack.id,signature);
      if(this.signatures.get(rack.id)===signature)next.set(rack.id,this.rigs.get(rack.id));
      else {const rig=new RackRig(this.studio,this.pool,rack,profile,equipment,catalog);created.push(rig);next.set(rack.id,rig);}
    }}catch(e){created.forEach(r=>r.dispose());throw e;}
    for(const [id,rig] of this.rigs)if(next.get(id)!==rig)rig.dispose();
    for(const rig of created)this.parent.add(rig.group);
    this.rigs=next;this.signatures=signatures;
  }
  isolate(id=null){for(const [key,rig] of this.rigs)rig.group.visible=!id||key===id;this.studio.setFocus(this.rigs.get(id)||null);}
  item(id){for(const rig of this.rigs.values())if(rig.items.has(id))return{rig,item:rig.items.get(id)};return null;}
  update(dt){for(const rig of this.rigs.values())if(rig.group.visible)rig.update(dt);}
  dispose(){for(const rig of this.rigs.values())rig.dispose();this.rigs.clear();this.signatures.clear();this.pool.dispose();}
}
