import * as THREE from 'three';
import {rackEnvelopeMm} from '../domain/facility.js';

// These are distant cabinet enclosures, never equipment inventory. The detailed
// RackRig and PA material remain the only inspection / cinematic representation.
export function rackEnvelope(profile){
  // Share the exact Draft world envelope with placement / aisle validation.
  // No PA geometry is generated or uploaded for distant cabinets.
  const source=rackEnvelopeMm({positionMm:[0,0,0]},profile),centerY=(profile.capacity*.3/2+.59)*profile.pitchMm/.3/1000;
  const min=source.min.map((value,i)=>value/1000-(i===1?centerY:0)),max=source.max.map((value,i)=>value/1000-(i===1?centerY:0));
  return{min,max,size:max.map((value,i)=>value-min[i]),center:max.map((value,i)=>(value+min[i])/2)};
}

function grilleTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#526067';ctx.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=8)for(let x=0;x<256;x+=8){ctx.fillStyle='#172329';ctx.beginPath();ctx.arc(x+(y%16?4:0),y,2.2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#6e7a7e';ctx.fillRect(x+(y%16?4:0)-1,y+2,2,.6);}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(2,8);texture.anisotropy=4;return texture;
}

export class RackLOD {
  constructor(parent){
    this.parent=parent;this.group=new THREE.Group();this.group.name='Configured cabinet LOD instances';parent.add(this.group);
    this.geometry=new THREE.BoxGeometry(1,1,1);this.texture=grilleTexture();this.rows=new Map();this.rackParts=new Map();this.visibleIds=new Set();
    this.materials={
      body:new THREE.MeshStandardMaterial({color:0x202a30,metalness:.76,roughness:.42}),
      rail:new THREE.MeshStandardMaterial({color:0x718089,metalness:.88,roughness:.28}),
      grille:new THREE.MeshStandardMaterial({color:0x607078,map:this.texture,bumpMap:this.texture,bumpScale:.0006,metalness:.73,roughness:.48}),
      seam:new THREE.MeshStandardMaterial({color:0x101a20,metalness:.50,roughness:.62})
    };
    this.dummy=new THREE.Object3D();this.hiddenMatrix=new THREE.Matrix4().makeScale(0,0,0);
  }
  rebuild(handles){
    this.clearInstances();const rows=new Map();
    for(const handle of handles){const id=handle.rack.rowId;if(!rows.has(id))rows.set(id,[]);rows.get(id).push(handle);}
    for(const [rowId,racks] of rows){
      const group=new THREE.Group();group.name=`Rack Row LOD ${rowId}`;group.userData={rowId,kind:'row'};group.visible=false;this.group.add(group);
      const parts={body:[],rail:[],grille:[],seam:[]};
      for(const handle of racks){
        const envelope=rackEnvelope(handle.profile),[w,h,d]=envelope.size,[cx,cy,cz]=envelope.center,origin=handle.proxy.position;
        const add=(family,x,y,z,width,height,depth)=>parts[family].push({rackId:handle.rack.id,position:[origin.x+cx+x,origin.y+cy+y,origin.z+cz+z],scale:[width,height,depth]});
        const t=Math.min(.014,w*.035),post=Math.min(.025,w*.055),margin=post*1.4;
        // Folded side skins, roof / plinth, front and rear service-door grilles.
        for(const side of [-1,1])add('body',side*(w-t)/2,0,0,t,h,d);
        for(const side of [-1,1])add('body',0,side*(h-t)/2,0,w,t,d);
        for(const face of [-1,1]){
          add('grille',0,0,face*(d-t)/2,w-margin*2,h-margin*2,t*.6);
          for(const side of [-1,1])add('rail',side*(w-post)/2,0,face*(d-post)/2,post,h,post);
          for(const side of [-1,1])add('rail',0,side*(h-post)/2,face*(d-post)/2,w,post,post);
          // Door folds and integrated pulls are enclosure detail, not fake U slots.
          add('seam',0,0,face*(d-t*.2)/2,.004,h-margin*2,t*.3);
          add('rail',w*.34,-h*.04,face*(d/2+t*.25),.009,h*.12,.012);
          for(let i=0;i<9;i++)add('seam',0,-h*.36+i*h*.09,face*(d-t*.35)/2,w-margin*2,.003,t*.3);
        }
      }
      const meshes=[];
      for(const [family,list] of Object.entries(parts)){
        const mesh=new THREE.InstancedMesh(this.geometry,this.materials[family],list.length);mesh.name=`${rowId} ${family}`;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;
        mesh.userData={kind:'rack-lod',rowId,rackIds:list.map(part=>part.rackId)};
        for(let index=0;index<list.length;index++){
          const part=list[index];this.dummy.position.fromArray(part.position);this.dummy.scale.fromArray(part.scale);this.dummy.updateMatrix();const matrix=this.dummy.matrix.clone();mesh.setMatrixAt(index,this.hiddenMatrix);
          if(!this.rackParts.has(part.rackId))this.rackParts.set(part.rackId,[]);this.rackParts.get(part.rackId).push({mesh,index,matrix});
        }
        mesh.instanceMatrix.needsUpdate=true;group.add(mesh);meshes.push(mesh);
      }
      this.rows.set(rowId,{group,meshes});
    }
  }
  setVisible(id,visible){
    if(this.visibleIds.has(id)===visible)return;
    if(visible)this.visibleIds.add(id);else this.visibleIds.delete(id);
    for(const part of this.rackParts.get(id)||[]){part.mesh.setMatrixAt(part.index,visible?part.matrix:this.hiddenMatrix);part.mesh.instanceMatrix.needsUpdate=true;}
    for(const {group,meshes} of this.rows.values())group.visible=meshes.some(mesh=>mesh.userData.rackIds.some(rackId=>this.visibleIds.has(rackId)));
  }
  hit(hit){const rackId=hit.object.userData.kind==='rack-lod'?hit.object.userData.rackIds[hit.instanceId]:null;return rackId&&this.visibleIds.has(rackId)?{entityId:rackId,rackId,kind:'rack'}:null;}
  clearInstances(){for(const {group,meshes} of this.rows.values()){group.removeFromParent();for(const mesh of meshes)mesh.dispose();}this.rows.clear();this.rackParts.clear();this.visibleIds.clear();}
  stats(){return{batches:[...this.rows.values()].reduce((total,row)=>total+row.meshes.length,0),instances:[...this.rows.values()].reduce((total,row)=>total+row.meshes.reduce((n,mesh)=>n+mesh.count,0),0),visibleRacks:this.visibleIds.size,rows:this.rows.size};}
  dispose(){this.clearInstances();this.group.removeFromParent();this.geometry.dispose();this.texture.dispose();Object.values(this.materials).forEach(material=>material.dispose());}
}
