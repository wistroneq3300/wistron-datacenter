import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { paGeometry } from './pa-material.js';

const BARE_HASH='6c78c6d9d62415de8e5888986bc5b2cd95d5a4a30d147b861f10ecc4650ecc29';
const COOLING_HASH='88eec60c20e775a431b446da311f3a1476cc2774173e628adc170ae3ac1f5a3f';
async function glb(url,expected) {
  const response=await fetch(url);if(!response.ok)throw new Error(`資產載入失敗 ${response.status}`);
  const buffer=await response.arrayBuffer();if(buffer.byteLength>64*1024*1024)throw new Error('模型超過 64 MB 限制');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),n=>n.toString(16).padStart(2,'0')).join('');
  if(hash!==expected)throw new Error('模型 hash 與資產契約不符');
  return new GLTFLoader().parseAsync(buffer,'');
}
function disposeObjects(objects,materials){
  const geometry=new Set(),textures=new Set(),mats=new Set(materials||[]);
  objects.forEach(root=>root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));}));
  mats.forEach(m=>{Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});if(m.uniforms)Object.values(m.uniforms).forEach(u=>{if(u.value?.isTexture&&u.value.userData.l10Owned)textures.add(u.value);});m.dispose();});
  geometry.forEach(g=>g.dispose());textures.forEach(t=>{t.dispose();t.source?.data?.close?.();});
}

export class L10Library {
  constructor(studio){this.studio=studio;this.refs=0;this.asset=null;this.pending=null;this.loads=0;}
  async acquire(){
    this.refs++;
    try{if(!this.pending&&!this.asset)this.pending=this.load().then(a=>(this.asset=a,this.pending=null,a)).catch(e=>{this.pending=null;throw e;});const asset=this.asset||await this.pending;return asset;}
    catch(e){this.refs--;throw e;}
  }
  release(){if(this.refs<=0)return;this.refs--;if(!this.refs&&this.asset){this.asset.dispose();this.asset=null;}}
  async load(){
    this.loads++;const settled=await Promise.allSettled([
      glb(new URL('../../assets/pa/bare-compute-boards.glb',import.meta.url),BARE_HASH),
      glb(new URL('../../assets/cooling-assembly.glb',import.meta.url),COOLING_HASH)
    ]);
    if(settled.some(s=>s.status==='rejected')){disposeObjects(settled.filter(s=>s.status==='fulfilled').map(s=>s.value.scene));throw settled.find(s=>s.status==='rejected').reason;}
    const [bare,cooling]=settled.map(s=>s.value),extras=cooling.parser.json.extras;
    if(extras.sourceBareGLBSHA256!==BARE_HASH){disposeObjects([bare.scene,cooling.scene]);throw new Error('液冷組件與主機板版本不匹配');}
    const prototype=new THREE.Group(),materials=[],sources=[bare.scene,cooling.scene],materialMap=new Map();
    try{const bindings=window.PACoreScene.coolingFlowBindings(extras.flowRoutes);
    for(const [source,isCooling,parsed] of [[bare.scene,false,bare],[cooling.scene,true,cooling]]){
      // GLTFLoader retains nodes, child primitives, normals, tangents and extras.
      source.traverse(o=>{
        if(!o.isMesh)return;
        let parent=o;while(parent&&!parent.userData.l10Layer)parent=parent.parent;
        const meta=parent?.userData;if(!meta)throw new Error('模型缺少語意 layer');
        const nodeIndex=parsed.parser.associations.get(parent)?.nodes;
        const originalNode=nodeIndex!==undefined?parsed.parser.json.nodes[nodeIndex].name:parent.name;
        const original=o.material,g=o.geometry,count=g.attributes.position.count;
        if(!g.attributes.normal||!g.attributes.uv||count>3000000)throw new Error('模型 attribute 契約不符');
        const rgba=new Float32Array(count*4),mr=new Float32Array(count*2);
        for(let i=0;i<count;i++){rgba.set([original.color.r,original.color.g,original.color.b,original.opacity],i*4);mr.set([original.metalness,0],i*2);}
        g.setAttribute('paColor',new THREE.BufferAttribute(rgba,4));g.setAttribute('paMaterial',new THREE.BufferAttribute(mr,2));
        if(!g.attributes.tangent){if(g.index)g.computeTangents();else{const t=new Float32Array(count*4);for(let i=0;i<count;i++)t.set([Math.abs(g.attributes.normal.getX(i))>.9?0:1,0,Math.abs(g.attributes.normal.getX(i))>.9?1:0,1],i*4);g.setAttribute('tangent',new THREE.BufferAttribute(t,4));}}
        for(const key of ['map','metalnessMap','normalMap','roughnessMap','aoMap'])if(original[key]){original[key].userData.l10Owned=true;original[key].colorSpace=THREE.NoColorSpace;original[key].needsUpdate=true;}
        // Separate shader instances per primitive keep semantic ghosting local.
        const material=this.studio.material({asset:original,cooling:isCooling});materials.push(material);materialMap.set(original,material);
        material.uniforms.uCoolingFinish.value=original.name==='CPU satin nickel cover'?1:original.name==='GPU machined nickel cover'?2:0;
        const routeKey=originalNode.replace(/^Cooling V1 \/ cooling-fluid \/ /,'').replace(/#\d+$/,'');
        if(meta.l10Layer==='cooling-fluid'&&bindings[routeKey]){material.uniforms.uCoolingFlow.value=1;material.uniforms.uCoolingRoute.value.fromArray(bindings[routeKey].route);material.uniforms.uCoolingPhase.value.fromArray(bindings[routeKey].phase);}
        o.material=material;o.userData={...o.userData,semantic:meta.l10Layer,boardIndex:meta.boardIndex,component:meta.component,originalNode};
        g.computeBoundingBox();g.computeBoundingSphere();
      });prototype.add(source);
    }
    const procedural=window.PAL10Hardware.build(window.PAL10Hardware.profile,{omitBareBoards:true,replaceServiceGeometry:true,replaceNetworking:true});
    for(const name of ['l10-chassis','l10-network-cover','l10-lid']){
      const geometry=paGeometry(procedural.meshes[name].data,12),material=this.studio.material({l10:true,cooling:name==='l10-lid'});materials.push(material);
      const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.userData.semantic=name.slice(4);prototype.add(mesh);
    }
    // Original material wrappers have no ownership of the shared texture data.
    for(const m of materialMap.keys())m.dispose();
    return {prototype,extras,bareExtras:bare.parser.json.extras,dispose:()=>disposeObjects([prototype],materials)};
    }catch(e){disposeObjects([prototype,...sources],[...materials,...materialMap.keys()]);throw e;}
  }
}

export async function attachL10(library,rig,item,{signal}={}){
  if(item.model.internalAsset!=='pa-l10-bare-cooling')throw new Error('此型號缺少內部模型資產');
  const originalVisibility=item.mesh.visible,asset=await library.acquire();
  let group=null;
  try{
  if(signal?.aborted)throw new DOMException('Navigation cancelled','AbortError');
  group=asset.prototype.clone(true);group.name=`L10 / ${item.instance.id}`;group.scale.copy(item.mesh.scale);
  const meshes=[];group.traverse(o=>{if(o.isMesh){
    o.userData.entityId=item.instance.id;o.userData.rackId=rig.rack.id;
    const definition=item.model.childDefinitions?.find(d=>d.sourceComponent===o.userData.component&&d.boardIndex===o.userData.boardIndex);
    o.userData.childId=definition?item.instance.children.find(c=>c.definitionKey===definition.key)?.id:null;
    o.userData.baseY=o.position.y;o.userData.baseZ=o.position.z;rig.studio.bind(o,rig);if(rig.studio.focus===rig)o.layers.enable(1);meshes.push(o);
  }});
  item.mount.add(group);item.mesh.visible=false;
  let disposed=false;
  const api={group,meshes,entityId:item.instance.id,mode:'system',
    setMode(mode){this.mode=mode;for(const o of meshes){const s=o.userData.semantic;o.visible=mode==='system'?s!=='lid'&&s!=='cooling-fluid':!s?.startsWith('cooling')&&s!=='lid'&&s!=='network-cover';o.position.y=o.userData.baseY;o.position.z=o.userData.baseZ;o.material.uniforms.uOpacity.value=1;o.material.transparent=false;o.material.depthWrite=true;}rig.studio.dirty=true;},
    cinematic(progress){const pose=window.PACoreScene.coolingAssemblyState(progress);for(const o of meshes){const s=o.userData.semantic;let opacity=1,lift=0;o.visible=true;
      if(s==='lid'){lift=.5*(1-pose.lid);opacity=progress>=.37?Math.min(1,(progress-.37)/.006):0;}
      else if(s==='cooling-mounts')opacity=pose.coolingVisibility;
      else if(s==='cooling-frame'||s==='cooling-channels'){lift=pose.coolingLift;opacity=pose.coolingVisibility;}
      else if(s==='cooling'){lift=pose.coolingLift;opacity=pose.coolingVisibility*(1-pose.flow*.94);}
      else if(s==='cooling-plumbing'){lift=pose.plumbingLift;opacity=pose.plumbingVisibility*(1-pose.flow*.94);}
      else if(s==='cooling-fluid')opacity=pose.flow;
      o.position.y=o.userData.baseY+lift;o.position.z=o.userData.baseZ+(s==='cooling-plumbing'?pose.plumbingZ||0:0);o.visible=opacity>.001;o.material.uniforms.uOpacity.value=opacity;o.material.uniforms.uCoolingTravel.value=pose.flowTravel||0;o.material.transparent=opacity<1||s==='cooling-fluid';o.material.depthWrite=opacity>.99&&s!=='cooling-fluid';
    }rig.studio.dirty=true;return pose;},
    bounds(semantic,component,boardIndex){group.updateWorldMatrix(true,true);const box=new THREE.Box3();for(const m of meshes)if((!semantic||m.userData.semantic===semantic)&&(!component||m.userData.component===component)&&(boardIndex===undefined||m.userData.boardIndex===boardIndex))box.union(new THREE.Box3().setFromObject(m));return box;},
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();if(item.details===api){item.mesh.visible=true;item.details=null;}library.release();}
  };api.setMode('system');item.details=api;return api;
  }catch(error){
    // Clones borrow the library's geometry/material/texture resources. Detach
    // only this attempted mount, then release exactly its acquired reference;
    // never dispose shared assets still used by another equipment detail.
    try{group?.removeFromParent();item.mesh.visible=originalVisibility;}
    finally{library.release();}
    throw error;
  }
}
