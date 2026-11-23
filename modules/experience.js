import * as THREE from 'three';
import {FreeExplore} from './navigation/free-explore.js';
import {ShowcaseController} from './navigation/showcase.js';
import {QualityGovernor} from './scene/quality.js';
import {ExplorationHUD} from './ui/exploration-hud.js';
import {rackEnvelopeMm,normalizeFacility} from './domain/facility.js';
import {CONTEXT_MASSES} from './environment/hq5b-site.js';

const $=id=>document.getElementById(id),vec=a=>new THREE.Vector3(...a);
const box=(min,max)=>new THREE.Box3(vec(min),vec(max));
export function createExperience(ctx){
  const {scene,camera,controls,director,renderer,state,store,environment,projection,hqJourney,film,go,beginFilm,stopFilm,focusEntity,resize,toast,getDetail,cancelMotion}=ctx;
  let motionPaused=false,pauseStarted=0,hotspotKey='',disposed=false,showcase,freeExplore,hover=null,lastHover=0;
  const selection=()=>{
    const doc=store.document,preferred=doc.equipment.find(e=>e.id===state.equipmentId),item=preferred&&doc.catalog.find(m=>m.id===preferred.modelId)?.internalAsset?preferred:doc.equipment.find(e=>doc.catalog.find(m=>m.id===e.modelId)?.internalAsset);
    const model=doc.catalog.find(m=>m.id===item?.modelId),board=model?.childDefinitions?.find(d=>d.kind==='board'),component=model?.childDefinitions?.find(d=>d.kind==='component'&&d.boardIndex===board?.boardIndex);
    return{rackId:item?.rackId||state.rackId||doc.racks[0]?.id,equipmentId:item?.id||null,boardKey:board?.key||null,componentKey:component?.key||null,hasInternalAsset:!!model?.internalAsset};
  };
  function envelope(){
    if(state.depth===0)return{bounds:box([-72,.55,-70],[65,48,70]),obstacles:[box([-24.1,0,-41.1],[15.25,20.4,-3.35]),...CONTEXT_MASSES.map(m=>box([m.x-m.width/2,0,m.z-m.depth/2],[m.x+m.width/2,m.height+m.roof,m.z+m.depth/2]))],safePosition:[-6,1.7,18],radius:.25};
    if(state.depth===1)return environment.interior.envelope();
    const doc=store.document,facility=normalizeFacility(doc),hall=facility.halls.find(h=>h.id===state.hallId)||facility.halls[0],b=hall.boundsMm;
    const bounds=box(b.min.map(n=>n/1000),b.max.map(n=>n/1000));const rackBases=doc.racks.filter(r=>doc.rows.find(row=>row.id===r.rowId)?.hallId===hall.id).map(r=>r.positionMm[1]/1000);bounds.min.y=(rackBases.length?Math.min(...rackBases):bounds.min.y+.13)+.55;bounds.max.y-=.25;
    const obstacles=doc.racks.filter(r=>doc.rows.find(row=>row.id===r.rowId)?.hallId===hall.id).map(r=>{const b=rackEnvelopeMm(r,doc.rackProfiles.find(p=>p.id===r.profileId));return box(b.min.map(n=>n/1000),b.max.map(n=>n/1000));});
    for(const item of hall.infrastructure){const p=item.positionMm.map(n=>n/1000),s=item.sizeMm.map(n=>n/1000);obstacles.push(box([p[0]-s[0]/2,p[1],p[2]-s[2]/2],[p[0]+s[0]/2,p[1]+s[1],p[2]+s[2]/2]));}
    // The detail model can be extracted outside the configured cabinet envelope.
    if(state.depth>=5&&getDetail()){const b=getDetail().bounds();if(!b.isEmpty())obstacles.push(b);}
    return{bounds,obstacles,safePosition:[bounds.min.x+.8,Math.min(bounds.max.y-.3,bounds.min.y+1.2),bounds.max.z-.8],radius:.18};
  }
  function renderFree(s){$('exploreHUD').hidden=!s.active;$('scene').classList.toggle('free-exploring',s.active);$('exploreToggle').setAttribute('aria-pressed',String(s.active));$('exploreToggle').textContent=s.active?'返回導覽':'自由探索';$('explorePause').textContent=s.paused?'繼續':'暫停';$('exploreSpeedValue').textContent=`${s.speed} m/s`;$('exploreHint').textContent=s.inputMode==='touch'?'雙指縮放、拖曳旋轉 · 相機限制在安全範圍':s.pointerLocked?'WASD 移動 · Q/E 高度 · Shift 加速 · Esc 離開':'WASD 移動 · Q/E 高度 · Shift 加速 · 點畫面鎖定滑鼠';}
  freeExplore=new FreeExplore({camera,controls,director,canvas:renderer.domElement,getEnvelope:envelope,onChange:renderFree});freeExplore.setSpeed(3);
  function pauseMotion(paused){if(paused===motionPaused)return;motionPaused=paused;if(paused){pauseStarted=performance.now();director.pause();}else{director.resume();if(film.intro)film.intro.started+=performance.now()-pauseStarted;}}
  function renderShow(s){
    $('showcaseHUD').hidden=!s.active&&!s.canRestore&&s.status!=='error';$('scene').classList.toggle('showcase-playing',s.active||s.status==='restoring');
    $('showcaseChapter').textContent=s.label;$('showcaseState').textContent=`${s.status==='paused'?'已暫停':s.status==='loading'?'鏡頭轉場':s.status==='completed'?'播放完成':s.status==='error'?'播放失敗':s.status==='restoring'?'返回視角':'播放中'} · ${Math.max(1,s.index+1)} / ${s.chapterCount}`;
    $('showcaseProgress').value=s.progress;$('showcasePause').textContent=s.paused?'繼續':'暫停';$('showcasePause').disabled=!s.active;$('showcaseSkip').disabled=!s.active;
  }
  const valid=ctx=>!ctx||ctx.isCurrent();
  showcase=new ShowcaseController({
    capture:()=>{freeExplore.exit();return{state:structuredClone(state),position:camera.position.toArray(),target:controls.target.toArray(),fov:camera.fov,light:environment.hq.mode};},
    restore:async(saved,op)=>{if(!valid(op))return false;const result=await go(saved.state.depth,saved.state,{showcaseHandoff:true,operation:op});if(!result||!valid(op))return false;state.mode=saved.state.mode;environment.hq.setLighting(saved.light);return director.move(saved.position,saved.target,{fov:saved.fov,duration:850});},
    getSelection:selection,
    go:(depth,s,op)=>valid(op)?go(depth,s,{showcaseHandoff:true,operation:op}):false,
    viewHQ:(view,op)=>{if(!valid(op))return false;if(view==='low')return director.move([-12,1.7,32],[-5,13,-9],{fov:40,duration:1700});return hqJourney.view(view);},
    setLighting:(mode,op)=>{if(!valid(op))return false;const hq=environment.hq;if(mode==='dusk'){hq.mode=mode;hq.lighting.transitionTo(mode);hq.plants.setLighting(mode);hq.site.setLighting(mode);}else hq.setLighting(mode);document.querySelectorAll('[data-hq-light]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.hqLight===mode)));return true;},
    startHQ:async(mode,op)=>{if(!valid(op))return false;const reduced=hqJourney.reducedMotion;hqJourney.reducedMotion=false;try{return await hqJourney.play(mode);}finally{hqJourney.reducedMotion=reduced;}},hqState:()=>hqJourney.snapshot(),stopHQ:()=>hqJourney.cancel(),
    beginFilm:async(s,op)=>{if(!valid(op))return false;await beginFilm({operation:op,playExplicit:true});if(!valid(op))return false;return film.active;},filmState:()=>film,stopFilm,pauseMotion,
    cancelMotion:()=>{cancelMotion();director.cancel();},onChange:renderShow,onError:error=>toast('Showcase 已停止：'+error.message+'。可重播或返回導覽。')
  });
  const quality=new QualityGovernor({apply:(profile,level)=>{renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,profile.pixelRatio));environment.hq.setQuality(profile,level);resize();},onChange:s=>{$('qualitySelect').value=s.mode;$('qualityLabel').textContent=`畫質 · ${s.mode==='auto'?'Auto / ':''}${s.level}`;}});
  const hud=new ExplorationHUD({container:$('hotspots'),camera,onActivate:item=>item.nodeId?focusEntity(item.nodeId):go(item.depth,item.selection||{})});
  const highlight=new THREE.Box3Helper(new THREE.Box3(),0xc4dfc2);highlight.material.depthTest=false;highlight.material.transparent=true;highlight.material.opacity=.6;highlight.visible=false;highlight.renderOrder=30;scene.add(highlight);
  const hoverLabel=document.createElement('div');hoverLabel.className='equipment-hover';hoverLabel.hidden=true;$('scene').append(hoverLabel);
  const ray=new THREE.Raycaster();
  const clearHover=()=>{hover=null;hoverLabel.hidden=true;renderer.domElement.style.cursor='';};
  const pointerHover=e=>{
    if(state.depth<4||showcase.active||freeExplore.active||film.active){clearHover();return;}const now=performance.now();if(now-lastHover<80)return;lastHover=now;
    const rig=projection.rigs.get(state.rackId);if(!rig)return;const rect=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
    const hits=ray.intersectObject(rig.group,true).filter(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return true;});const hit=hits.find(h=>h.object.userData.entityId&&h.object.userData.kind!=='door');if(!hit){clearHover();return;}
    const meta=projection.resolveHit(hit)||hit.object.userData,id=meta.entityId,record=projection.record(id),child=record?.equipment?.children?.find(c=>c.id===meta.childId);
    hover={object:meta.childId?hit.object:record?projection.item(id)?.item.group:hit.object,id};hoverLabel.textContent=child?.name||record?.equipment?.name||meta.label||'選取設備 · 深入檢視';hoverLabel.hidden=false;hoverLabel.style.left=`${Math.min(rect.width-240,Math.max(12,e.clientX-rect.left+16))}px`;hoverLabel.style.top=`${Math.max(16,e.clientY-rect.top-42)}px`;renderer.domElement.style.cursor='pointer';
  };
  renderer.domElement.addEventListener('pointermove',pointerHover);renderer.domElement.addEventListener('pointerleave',clearHover);
  function centerForEquipment(id){const record=projection.record(id);if(!record)return null;const item=projection.item(id)?.item;return item?new THREE.Box3().setFromObject(item.group).getCenter(new THREE.Vector3()):null;}
  function rebuildHotspots(){
    const doc=store.document,items=[];const add=(id,label,position,depth,selection={})=>items.push({id,label,position,depth,selection});
    const hall=normalizeFacility(doc).halls.find(h=>h.id===state.hallId)||normalizeFacility(doc).halls[0];
    if(state.depth===0)add('hq-entrance','HQ Entrance · 進入',vec([-8.15,2.8,-2.2]),1);
    if(state.depth===1)add(hall.id,'Data Center Hall · 進入',environment.interior.hallAnchor,2,{hallId:hall.id});
    if(state.depth===2)for(const row of doc.rows.filter(r=>r.hallId===hall.id).slice(0,8)){const b=environment.hall.bounds(row.id);add(row.id,`Rack Row · ${row.name}`,b.getCenter(new THREE.Vector3()).setY(2.7),3,{rowId:row.id});}
    if(state.depth===3){const rack=doc.racks.find(r=>r.id===state.rackId)||doc.racks.find(r=>r.rowId===state.rowId);if(rack)add(rack.id,'Rack · 深入',projection.rigs.get(rack.id).group.position.clone().add(vec([0,0,1])),4,{rackId:rack.id});}
    if(state.depth===4){const equipment=doc.equipment.filter(e=>e.rackId===state.rackId),kinds=matchMedia('(max-width:760px)').matches?['system']:['system','switch','powerShelf'];for(const kind of kinds){const e=equipment.find(e=>doc.catalog.find(m=>m.id===e.modelId)?.kind===kind);if(e)add(e.id,`${kind==='system'?'System':kind==='switch'?'Switch':'Power Shelf'} · 探索`,()=>centerForEquipment(e.id),5,{equipmentId:e.id});}}
    if(state.depth>=5){const e=doc.equipment.find(e=>e.id===state.equipmentId),model=doc.catalog.find(m=>m.id===e?.modelId),detail=getDetail();
      if(e&&model?.internalAsset&&detail){const definitions=model.childDefinitions.filter(d=>state.depth===5?d.kind==='board':d.kind==='component'&&d.boardIndex===model.childDefinitions.find(b=>b.key===state.boardKey)?.boardIndex);
        for(const def of definitions.slice(0,2)){const child=e.children.find(c=>c.definitionKey===def.key);if(child)add(child.id,def.label,()=>detail.bounds(def.kind==='board'?'board':'packages',def.sourceComponent,def.boardIndex).getCenter(new THREE.Vector3()),def.kind==='board'?6:7,{boardKey:def.kind==='board'?def.key:state.boardKey,componentKey:def.kind==='component'?def.key:null});}
      }
      if(state.depth===5)for(const node of ctx.getTwin()?.entities.values()||[])if(node.kind==='node'&&node.systemId===e?.id){const p=detail?detail.bounds('board').getCenter(new THREE.Vector3()):centerForEquipment(e.id);if(p)items.push({id:node.id,label:`Node · ${node.name||node.id}`,position:p,nodeId:node.id});break;}
    }
    hud.setHotspots(items);
  }
  async function enterExplore(){if(showcase.active||showcase.snapshot().canRestore)await showcase.stop({restore:false});hqJourney.cancel();stopFilm();cancelMotion();freeExplore.enter();}
  $('exploreToggle').onclick=()=>freeExplore.active?freeExplore.exit():enterExplore();$('exploreExit').onclick=()=>freeExplore.exit();$('explorePause').onclick=()=>freeExplore.paused?freeExplore.resume():freeExplore.pause();$('exploreReset').onclick=()=>freeExplore.reset();$('exploreSpeed').oninput=e=>freeExplore.setSpeed(+e.target.value);
  $('playDemo').onclick=()=>{freeExplore.exit();showcase.play();};$('showcasePause').onclick=()=>showcase.paused?showcase.resume():showcase.pause();$('showcaseStop').onclick=()=>showcase.stop();$('showcaseSkip').onclick=()=>showcase.skip();$('showcaseReplay').onclick=()=>showcase.replay();
  $('immersiveToggle').onclick=()=>{const value=$('scene').classList.toggle('immersive');$('immersiveToggle').setAttribute('aria-pressed',String(value));};
  $('qualitySelect').onchange=e=>quality.set(e.target.value);$('qualityBtn').onclick=()=>quality.set(quality.mode==='auto'?'high':'auto');
  return{freeExplore,showcase,quality,hud,get motionPaused(){return motionPaused;},
    cancel(){if(showcase.active||showcase.snapshot().canRestore||showcase.status==='restoring')showcase.stop({restore:false});freeExplore.exit();},
    update(dt,ms){
      if(disposed)return;freeExplore.update(dt);showcase.update(dt);quality.update(ms,{visible:!document.hidden,busy:state.pending||director.owner==='transition'});
      const key=[store.document.revision,state.depth,state.hallId,state.rowId,state.rackId,state.equipmentId,state.nodeId,state.boardKey,state.componentKey,!!getDetail()].join(':');if(key!==hotspotKey){hotspotKey=key;rebuildHotspots();}
      hud.hidden=showcase.active||freeExplore.active;hud.update();highlight.visible=false;if(showcase.active||freeExplore.active||state.depth<4)clearHover();
      if(state.depth>=4&&!film.active&&!freeExplore.active&&!showcase.active){const item=state.equipmentId?projection.item(state.equipmentId)?.item:null;if(item){const detail=getDetail();const definition=item.model.childDefinitions?.find(d=>d.key===(state.depth===7?state.componentKey:state.boardKey));const bounds=state.depth>=6&&detail?detail.bounds(state.depth===7?'packages':'board',definition?.sourceComponent,definition?.boardIndex):new THREE.Box3().setFromObject(item.group);highlight.box.copy(bounds).expandByScalar(.005);highlight.visible=!bounds.isEmpty();}}
      if(hover?.object?.parent&&!film.active&&!showcase.active&&!freeExplore.active){highlight.box.setFromObject(hover.object).expandByScalar(.005);highlight.visible=!highlight.box.isEmpty();}
    },
    dispose(){disposed=true;showcase.dispose();freeExplore.dispose();hud.dispose();renderer.domElement.removeEventListener('pointermove',pointerHover);renderer.domElement.removeEventListener('pointerleave',clearHover);hoverLabel.remove();highlight.removeFromParent();highlight.geometry.dispose();highlight.material.dispose();}
  };
}
