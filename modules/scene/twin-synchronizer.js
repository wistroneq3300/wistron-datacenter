import * as THREE from 'three';
export const HEALTH_COLORS=Object.freeze({healthy:0x73cfaa,warning:0xf2bd62,fail:0xf07d70,recovering:0x7ebdec,unknown:0x8497a1,offline:0x9c92b4,stale:0xc1a57b});
// State overlays have their own resources; PA chassis materials are untouched.
// Telemetry never calls ConfigStore, RackProjection.sync or ensureDetailed.
export class SceneStateSynchronizer {
  constructor({parent,projection,getNavigation,onSelect}){this.parent=parent;this.projection=projection;this.getNavigation=getNavigation;this.onSelect=onSelect;this.root=new THREE.Group();this.root.name='Read-only twin state indicators';parent.add(this.root);this.geometry=new THREE.SphereGeometry(.045,12,8);this.materials=new Map(Object.entries(HEALTH_COLORS).map(([key,color])=>[key,new THREE.MeshBasicMaterial({color,depthTest:false,toneMapped:false})]));this.markers=new Map();this.states=new Map();this.revision=0;}
  sync(snapshot){this.states=new Map(snapshot.entities.map(e=>[e.id,e]));this.revision=snapshot.revision;
    for(const [id,marker]of this.markers)if(!this.states.has(id)){marker.removeFromParent();this.markers.delete(id);}
    for(const entity of snapshot.entities){if(!['rack','system','switch','powerShelf','node'].includes(entity.kind))continue;let marker=this.markers.get(entity.id);if(!marker){marker=new THREE.Mesh(this.geometry,this.materials.get('unknown'));marker.renderOrder=20;marker.userData={kind:'twin-status',entityId:entity.id,monitoring:true};this.root.add(marker);this.markers.set(entity.id,marker);}marker.material=this.materials.get(entity.health)||this.materials.get('unknown');marker.userData.health=entity.health;}
    this.lastPaint=0;this.update();
  }
  update(){const nav=this.getNavigation();this.root.visible=nav.depth>=2;
    for(const [id,marker]of this.markers){const entity=this.states.get(id);marker.visible=false;if(!entity)continue;const rackId=entity.kind==='rack'?id:entity.rackId,handle=this.projection.rigs.get(rackId);if(!handle||!handle.visible)continue;
      if(entity.kind==='rack'){marker.visible=nav.depth<=4;marker.position.copy(handle.group.position);marker.position.y+=handle.height/2+.13;marker.scale.setScalar(1.2);}
      else if(entity.kind==='node'){if(nav.depth<5||nav.equipmentId!==entity.systemId)continue;const item=handle.detail?.items.get(entity.systemId);if(!item)continue;const child=item.instance.children.find(c=>c.id===entity.boardId),def=item.model.childDefinitions?.find(c=>c.key===child?.definitionKey);if(item.details&&def){const box=item.details.bounds('board',def.sourceComponent,def.boardIndex);if(!box.isEmpty()){box.getCenter(marker.position);marker.position.y=box.max.y+.025;marker.visible=true;marker.scale.setScalar(.4);}}}
      else if(nav.depth===4&&entity.health!=='unknown'){const item=handle.detail?.items.get(id);if(!item)continue;item.group.getWorldPosition(marker.position);marker.position.x+=.26;marker.position.z+=.41;marker.scale.setScalar(.52);marker.visible=true;}
    }
    if(performance.now()-(this.lastPaint||0)<250)return;this.lastPaint=performance.now();
    // The same state snapshot supplies labels, list and detail, including Unknown.
    document.querySelectorAll('.rack-label[data-rack-id]').forEach(label=>{const entity=this.states.get(label.dataset.rackId);if(entity){label.dataset.health=entity.health;label.textContent=`${entity.name} · ${entity.health.toUpperCase()}`;label.title=`${entity.name}: ${entity.health} · ${entity.lastUpdatedAt||'尚無資料'}`;}});
    document.querySelectorAll('.equipment-row[data-entity-id]').forEach(row=>{const entity=this.states.get(row.dataset.entityId);if(entity){row.dataset.health=entity.health;row.setAttribute('aria-label',`${entity.name} ${entity.health}`);let badge=row.querySelector('.equipment-health');if(!badge){badge=document.createElement('span');badge.className='equipment-health';row.append(badge);}badge.textContent=entity.health.toUpperCase();}});
  }
  dispose(){this.root.removeFromParent();this.geometry.dispose();this.materials.forEach(m=>m.dispose());this.markers.clear();this.states.clear();}
}
