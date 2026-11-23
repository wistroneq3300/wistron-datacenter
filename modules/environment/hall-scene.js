import * as THREE from 'three';
import {normalizeFacility,validateFacility,rackEnvelopeMm} from '../domain/facility.js';

// Architectural planning assets only. These are not equipment inventory and do
// not claim a surveyed Wistron hall or a verified cooling/power topology.
export class HallEnvironment {
  constructor(parent){
    this.parent=parent;this.root=new THREE.Group();this.root.name='Draft data center environment';parent.add(this.root);
    this.depth=0;this.signature='';this.disposed=false;this.hallBounds=new Map();this.rowBounds=new Map();this.resources=null;
  }
  sync(doc){
    if(this.disposed)throw new Error('HallEnvironment is disposed');
    const facility=normalizeFacility(doc),signature=JSON.stringify([facility,doc.rows,doc.racks,doc.rackProfiles]);
    if(signature===this.signature)return false;
    const result=validateFacility({...doc,facility});if(!result.valid)throw new Error(result.errors.map(e=>e.message).join('\n'));
    const replacement=buildEnvironment(doc,facility);
    this.root.add(replacement.group);const old=this.resources;this.resources=replacement;
    this.hallBounds=replacement.hallBounds;this.rowBounds=replacement.rowBounds;this.signature=signature;
    old?.dispose();this.setDepth(this.depth);return true;
  }
  setDepth(depth){
    this.depth=depth;this.root.visible=depth>=2&&depth<=3;
    if(this.resources){this.resources.ceiling.visible=false;this.resources.overhead.visible=depth<=3;}
  }
  bounds(entityId){
    const specific=this.hallBounds.get(entityId)||this.rowBounds.get(entityId);if(specific)return specific.clone();
    const result=new THREE.Box3();for(const b of this.hallBounds.values())result.union(b);return result;
  }
  get stats(){return {halls:this.hallBounds.size,rows:this.rowBounds.size,drawBatches:this.resources?.batches||0,instances:this.resources?.instances||0,geometries:this.resources?.geometries.size||0,materials:this.resources?.materials.size||0,textures:this.resources?.textures.size||0,visible:this.root.visible,draft:true};}
  dispose(){if(this.disposed)return;this.resources?.dispose();this.resources=null;this.hallBounds.clear();this.rowBounds.clear();this.root.removeFromParent();this.disposed=true;}
}

function buildEnvironment(doc,facility){
  const group=new THREE.Group(),ceiling=new THREE.Group(),overhead=new THREE.Group();group.add(ceiling,overhead);
  const geometries=new Set(),materials=new Set(),textures=new Set(),hallBounds=new Map(),rowBounds=new Map(),batches=new Map();
  const unit=new THREE.BoxGeometry(1,1,1);geometries.add(unit);
  const material=(color,roughness=.6,metalness=.1,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});materials.add(m);return m;};
  const grainData=new Uint8Array(64*64*4);let seed=98745;
  for(let i=0;i<grainData.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=220+(seed>>>28);grainData.set([v,v,v,255],i);}
  const grain=new THREE.DataTexture(grainData,64,64);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.colorSpace=THREE.SRGBColorSpace;grain.needsUpdate=true;textures.add(grain);
  const M={floor:material(0x77868a,.48,.12,{map:grain}),floorAlt:material(0x748387,.5,.12,{map:grain}),base:material(0x25353b,.8,.16),edge:material(0x25333a,.4,.66),wall:material(0xb3bec0,.69,.04),wallAlt:material(0x9eacae,.66,.06),metal:material(0x69787d,.34,.8),black:material(0x131f23,.7,.18),white:material(0xc5d1d0,.43,.15),glass:material(0x799f9e,.18,.14,{transparent:true,opacity:.12,depthWrite:false}),light:material(0xe1efec,.34,.15,{emissive:0xdcefe8,emissiveIntensity:1.5}),cold:material(0x477c88,.52,.32),brass:material(0xa99b61,.48,.62),screen:material(0x153c41,.22,.18,{emissive:0x257d7f,emissiveIntensity:.4}),blue:material(0x316680,.35,.6),red:material(0x834c44,.4,.5)};
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3();
  const add=(target,mat,size,pos,meta,rotation=0)=>{
    const key=`${target.id}:${mat.id}:${meta.rowId||meta.hallId||''}:${meta.kind||''}`;
    if(!batches.has(key))batches.set(key,{target,mat,items:[],meta});
    position.fromArray(pos);scale.fromArray(size);quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),rotation);matrix.compose(position,quaternion,scale);batches.get(key).items.push(matrix.clone());
  };
  const box3=b=>new THREE.Box3(new THREE.Vector3().fromArray(b.min).multiplyScalar(.001),new THREE.Vector3().fromArray(b.max).multiplyScalar(.001));
  try{
    for(const hall of facility.halls){
      hallBounds.set(hall.id,box3(hall.boundsMm));const min=hall.boundsMm.min.map(v=>v/1000),max=hall.boundsMm.max.map(v=>v/1000),width=max[0]-min[0],depth=max[2]-min[2],cx=(max[0]+min[0])/2,cz=(max[2]+min[2])/2;
      const rows=doc.rows.filter(r=>r.hallId===hall.id),rowIds=new Set(rows.map(r=>r.id)),racks=doc.racks.filter(r=>rowIds.has(r.rowId));
      const floorY=racks.length?Math.min(...racks.map(r=>r.positionMm[1]/1000)):min[1]+.13,roofY=max[1],meta={kind:'hall',hallId:hall.id,entityId:hall.id,draft:true};
      add(group,M.base,[width,.16,depth],[cx,floorY-.10,cz],meta);
      // 600 mm access-floor module; coarsen the render tile grid only for very
      // large planning bounds so imported dimensions cannot allocate millions.
      const tile=Math.max(.6,Math.ceil(width/128/.6)*.6,Math.ceil(depth/128/.6)*.6),nx=Math.ceil(width/tile),nz=Math.ceil(depth/tile);
      for(let x=0;x<nx;x++)for(let z=0;z<nz;z++){
        const w=Math.min(tile,width-x*tile),d=Math.min(tile,depth-z*tile);
        add(group,(x+z)%3?M.floor:M.floorAlt,[Math.max(.01,w-.006),.035,Math.max(.01,d-.006)],[min[0]+x*tile+w/2,floorY-.0175,min[2]+z*tile+d/2],meta);
      }
      // Rear and side enclosure is deliberately cut away at the entrance.
      const wallH=roofY-floorY,panels=Math.ceil(width/1.2);
      for(let x=0;x<panels;x++){
        const w=Math.min(1.2,width-x*1.2),px=min[0]+x*1.2+w/2;
        add(group,x%3?M.wall:M.wallAlt,[w-.008,wallH,.12],[px,floorY+wallH/2,min[2]-.065],meta);
        add(group,M.edge,[w-.008,.11,.14],[px,floorY+.07,min[2]-.055],meta);
        add(group,M.metal,[w-.035,.018,.025],[px,roofY-.22,min[2]+.008],meta);
      }
      for(const x of [min[0]-.06,max[0]+.06]){
        add(group,M.wall,[.12,wallH,depth],[x,floorY+wallH/2,cz],meta);
        add(group,M.edge,[.14,.11,depth],[x,floorY+.07,cz],meta);
        add(group,M.metal,[.17,.08,depth],[x,roofY-.12,cz],meta);
      }
      add(ceiling,M.wallAlt,[width,.12,depth],[cx,roofY+.06,cz],meta);
      // Suspended ceiling seams and linear luminaires remain in the cutaway.
      for(let x=min[0]+.6;x<max[0];x+=1.2)add(ceiling,M.edge,[.018,.03,depth],[x,roofY-.025,cz],meta);
      for(let z=min[2]+.6;z<max[2];z+=1.2)add(ceiling,M.edge,[width,.03,.018],[cx,roofY-.025,z],meta);
      for(let x=min[0]+1.7;x<max[0]-1;x+=3.4)for(let z=min[2]+1.2;z<max[2]-.8;z+=2.8){
        add(overhead,M.white,[.28,.065,1.5],[x,roofY-.33,z],meta);
        add(overhead,M.light,[.23,.012,1.42],[x,roofY-.368,z],meta);
        for(const zz of [-.55,.55])add(overhead,M.metal,[.012,.3,.012],[x,roofY-.15,z+zz],meta);
      }
      for(const row of rows){
        const selected=racks.filter(r=>r.rowId===row.id);if(!selected.length)continue;
        const bound=new THREE.Box3();for(const rack of selected){const envelope=rackEnvelopeMm(rack,doc.rackProfiles.find(p=>p.id===rack.profileId));if(envelope)bound.union(box3(envelope));}rowBounds.set(row.id,bound);
        const rowWidth=bound.max.x-bound.min.x,rowX=(bound.max.x+bound.min.x)/2,rowZ=(bound.max.z+bound.min.z)/2,rowMeta={...meta,kind:'row',rowId:row.id,entityId:row.id};
        // Clear aisle and end markers are layout guides, never topology claims.
        const aisleZ=Math.min(max[2]-.7,bound.max.z+.6);
        add(group,M.cold,[rowWidth+.35,.006,.9],[rowX,floorY+.004,aisleZ],rowMeta);
        for(const z of [aisleZ-.46,aisleZ+.46])add(group,M.brass,[rowWidth+.36,.008,.018],[rowX,floorY+.006,z],rowMeta);
        for(const x of [bound.min.x-.12,bound.max.x+.12])add(group,M.white,[.035,.009,.28],[x,floorY+.008,aisleZ],rowMeta);
        const trayY=Math.max(bound.max.y+.45,roofY-.9);
        for(const z of [rowZ-.23,rowZ+.23])add(overhead,M.metal,[rowWidth+.6,.07,.025],[rowX,trayY,z],rowMeta);
        for(let x=bound.min.x-.2;x<bound.max.x+.3;x+=.24)add(overhead,M.metal,[.035,.025,.48],[x,trayY-.018,rowZ],rowMeta);
        for(let x=bound.min.x;x<bound.max.x+.1;x+=2.2)for(const z of [rowZ-.23,rowZ+.23])add(overhead,M.metal,[.012,roofY-trayY,.012],[x,(roofY+trayY)/2,z],rowMeta);
        // Thin framing indicates an optional Draft containment canopy without
        // inventing pipes from each rack to unrelated cooling equipment.
        for(const x of [bound.min.x-.16,bound.max.x+.16]){
          add(overhead,M.edge,[.035,2.9,.035],[x,floorY+1.45,aisleZ-.5],rowMeta);
          add(overhead,M.edge,[.035,.035,1],[x,floorY+2.9,aisleZ],rowMeta);
        }
        add(overhead,M.edge,[rowWidth+.35,.035,.035],[rowX,floorY+2.9,aisleZ+.5],rowMeta);
        add(overhead,M.glass,[rowWidth+.3,.012,.96],[rowX,floorY+2.88,aisleZ],rowMeta);
      }
      for(const item of hall.infrastructure){
        const [x,y,z]=item.positionMm.map(v=>v/1000),[w,h,d]=item.sizeMm.map(v=>v/1000),front=z+d/2,infraMeta={...meta,kind:'infrastructure',infrastructureId:item.id,entityId:item.id};
        add(group,M.edge,[w,.12,d],[x,y+.06,z],infraMeta);
        add(group,M.white,[w-.025,h-.13,d-.025],[x,y+.12+(h-.13)/2,z],infraMeta);
        for(const side of [-1,1])add(group,M.metal,[.035,h-.1,.045],[x+side*(w/2-.04),y+h/2,front-.005],infraMeta);
        add(group,M.black,[w-.12,h*.59,.026],[x,y+h*.4,front+.003],infraMeta);
        const slots=item.type==='cooling'?23:15;
        for(let j=0;j<slots;j++)add(group,M.metal,[w-.16,.013,.035],[x,y+h*.12+j*h*.54/slots,front+.019],infraMeta);
        add(group,M.black,[w*.47,h*.13,.035],[x-w*.12,y+h*.83,front+.006],infraMeta);
        add(group,M.screen,[w*.38,h*.09,.012],[x-w*.12,y+h*.83,front+.03],infraMeta);
        for(let j=0;j<3;j++)add(group,M.light,[w*.2,.006,.004],[x-w*.17,y+h*.805+j*.027,front+.039],infraMeta);
        add(group,M.black,[.017,.16,.026],[x+w*.34,y+h*.78,front+.033],infraMeta);
        add(group,M.metal,[w-.055,.025,d-.055],[x,y+h+.005,z],infraMeta);
        // Local terminated ports identify extensible equipment families; no
        // invented routes to any rack, building loop or actual electrical feed.
        if(item.type==='cooling')for(const [i,m] of [M.blue,M.red].entries()){
          add(group,m,[.065,.25,.065],[x+(i-.5)*w*.45,y+h+.13,z-.12],infraMeta);
          add(group,M.metal,[.1,.035,.1],[x+(i-.5)*w*.45,y+h+.25,z-.12],infraMeta);
        }else for(let j=0;j<4;j++)add(group,M.brass,[.055,.018,.12],[x+(j-1.5)*w*.18,y+h+.026,z-.16],infraMeta);
      }
    }
    let instances=0;
    for(const batch of batches.values()){
      const mesh=new THREE.InstancedMesh(unit,batch.mat,batch.items.length);batch.items.forEach((m,i)=>mesh.setMatrixAt(i,m));
      mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=!batch.mat.transparent&&batch.mat!==M.floor&&batch.mat!==M.floorAlt;mesh.receiveShadow=true;
      mesh.userData={...batch.meta,environment:true};mesh.name=`${batch.meta.kind} ${batch.meta.entityId}`;mesh.computeBoundingSphere();batch.target.add(mesh);instances+=batch.items.length;
    }
    let disposed=false;
    return {group,ceiling,overhead,hallBounds,rowBounds,geometries,materials,textures,batches:batches.size,instances,dispose(){if(disposed)return;disposed=true;group.removeFromParent();group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());geometries.clear();materials.clear();textures.clear();hallBounds.clear();rowBounds.clear();}};
  }catch(error){group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());throw error;}
}
