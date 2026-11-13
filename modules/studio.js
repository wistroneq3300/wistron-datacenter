import * as THREE from 'three';
import {ConfigStore,extractionClearance} from './domain/configuration.js';
import {PAStudio} from './scene/pa-material.js';
import {RackProjection} from './scene/projection.js';
import {L10Library,attachL10} from './scene/l10-assets.js';
import {cinematicClearance} from './scene/motion-clearance.js';
import {CameraDirector} from './navigation/camera-director.js';
import {keepCameraOutside} from './navigation/camera-envelope.js';
import {resolveJourney,NavigationUnavailable} from './navigation/journey.js';
import {EquipmentEditor} from './ui/equipment-editor.js';
import {FacilityEditor} from './ui/facility-editor.js';
import {MockAdapter,PAManagerAdapter} from './twin/adapters.js';
import {DigitalTwinService} from './twin/service.js';
import {SceneStateSynchronizer} from './scene/twin-synchronizer.js';
import {TwinPanel} from './ui/twin-panel.js';

const $=id=>document.getElementById(id),v=a=>new THREE.Vector3(...a);
const labels=['Wistron HQ','Building Interior','Data Center Hall','Rack Row','Rack','System','Tray / Board','Component'];
const titles=['緯創總部 · 歷史照片參考 / Draft','建築內部 · 概念剖面','Data Center Hall','Rack Row','Rack configuration','System inspection','Tray / Board','Component'];
export async function startStudio({scene,camera,renderer,controls,groups,reducedMotion,environment}){
  const {building,upperShell,city,cityFar,campus,shell,environmentRacks,core}=groups;
  let twinService,twinSync,twinPanel,monitoringTimer,adapter;
  let toastTimer,raf,last=performance.now(),disposed=false;
  const toast=message=>{$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),6000);};
  const studio=new PAStudio(renderer,scene),projection=new RackProjection(studio,core),library=new L10Library(studio),director=new CameraDirector(camera,controls,{reducedMotion});
  const response=await fetch('./data/demo-config.json');if(!response.ok)throw Error('示範配置無法載入');
  const base=await response.json();let storage;try{storage=localStorage;}catch{toast('瀏覽器禁止儲存，請用 JSON 匯出備份。');}
  const store=new ConfigStore(base,storage);store.load();await studio.loading;projection.sync(store.document);environment.hall.sync(store.document);await environment.hq.loading;
  const state={depth:0,hallId:null,rowId:null,rackId:null,equipmentId:null,mode:'journey',boardKey:null,componentKey:null,pending:false};
  const film={active:false,playing:false,progress:0,clock:0,spin:false};
  const metrics={frames:[],errors:[],started:performance.now(),contextLosses:0};
  let navToken=0,assetAbort=null,activeDetail=null;
  const editor=new EquipmentEditor(store,{toast,onSelect:id=>selectEquipment(id),onInspect:id=>inspect(id),onExtract:id=>extract(id),onRackRemoved:()=>go(3)});
  const facilityEditor=new FacilityEditor(store,{go,toast,hqView:async angle=>{await go(0);const p=environment.hq.pose(angle);await director.move(p.position,p.target,{fov:43});}});
  const selectedRig=()=>projection.rigs.get(state.rackId);
  const selectedItem=()=>projection.item(state.equipmentId);
  const previousCamera=camera.position.clone();
  director.constrain=()=>{const rig=selectedRig();if(state.depth>=4&&rig?.frame.visible){rig.group.updateWorldMatrix(true,true);const bounds=new THREE.Box3().setFromObject(rig.frame).expandByScalar(.025);keepCameraOutside(camera,controls.target,bounds,previousCamera);}previousCamera.copy(camera.position);};
  function clearDetails(){assetAbort?.abort();assetAbort=null;activeDetail?.dispose();activeDetail=null;for(const rig of projection.rigs.values())rig.extracted=null;}
  function applyVisibility(){
    const focus=state.depth>=4;
    environment.setDepth(state.depth);core.visible=state.depth>=1;projection.isolate(focus?state.rackId:null,state.depth===3?{rowId:state.rowId}:state.depth===2?{hallId:state.hallId}:{});
    scene.background=state.depth===0?environment.hq.sky:new THREE.Color(focus?0x091116:0x152630);scene.fog=state.depth===0?new THREE.Fog(0xd5e0df,95,240):focus?null:new THREE.Fog(0x152630,65,160);
    $('scene').classList.toggle('daylight',state.depth===0);
    controls.minDistance=state.depth===7?.035:state.depth>=5?.2:focus?.8:2;controls.maxDistance=focus?25:155;controls.maxPolarAngle=Math.PI*.485;camera.near=focus?.002:.05;camera.updateProjectionMatrix();
    $('scene').classList.toggle('is-inspecting',focus);$('sceneMeta').hidden=state.depth!==0;$('sceneSideinfo').hidden=focus;$('detailHeader').hidden=state.depth===0;
    $('detailIndex').textContent=String(state.depth+1).padStart(2,'0');$('detailEnglish').textContent=labels[state.depth];$('detailTitle').textContent=focus?(selectedItem()?.item.instance.name||selectedRig()?.rack.name||titles[state.depth]):titles[state.depth];
    $('scaleLabel').textContent=labels[state.depth].toUpperCase();$('footerMessage').textContent=focus?'PA Cinematic geometry · Draft hardware dimensions':'HQ 歷史照片參考 · Hall 虛擬配置 · Draft / 未測繪';
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',['hq','cutaway','hall','row'].indexOf(b.dataset.view)===state.depth));
    if(focus)editor.show(state.rackId);else editor.hide();
    renderJourney();renderParts();renderLabels();setFlow(flowMode);if(twinSync&&twinService)twinSync.sync(twinService.snapshot());
  }
  function renderJourney(){
    $('tourControls').hidden=false;$('journeyStep').textContent=`${String(state.depth+1).padStart(2,'0')} / 08`;$('journeyRange').value=state.depth;$('journeyName').textContent=labels[state.depth];
    $('tourPrev').disabled=state.depth===0;$('tourNext').disabled=state.depth>=7;$('exitTour').textContent=state.mode==='journey'?'自由':'導覽';$('exitTour').title=state.mode==='journey'?'自由探索：滾輪縮放，保留目前層級':'繼續導覽：滾輪逐層進退';
    $('sceneHint').textContent=state.mode==='journey'?'拖曳旋轉 · 滾輪逐層進退 · Ctrl + 滾輪縮放':'自由探索 · 拖曳旋轉 · 滾輪／雙指縮放 · 導覽進度保留';
    const crumbs=$('breadcrumbs');crumbs.replaceChildren();for(let i=0;i<=state.depth;i++){if(i){const sep=document.createElement('span');sep.textContent='›';crumbs.append(sep);}const b=document.createElement('button');b.textContent=i===4?selectedRig()?.rack.name||labels[i]:labels[i];b.dataset.depth=i;if(i===state.depth)b.setAttribute('aria-current','step');b.onclick=()=>go(i);crumbs.append(b);}
  }
  function renderParts(){
    let panel=$('partList');if(!panel){panel=document.createElement('section');panel.id='partList';panel.className='part-list';panel.setAttribute('aria-label','已提供的內部部件');$('scene').append(panel);}panel.replaceChildren();panel.hidden=state.depth<5;if(panel.hidden)return;
    const model=selectedItem()?.item.model;if(!model?.internalAsset)return;
    const title=document.createElement('h3');title.textContent='模型內可識別部件';panel.append(title);
    for(const definition of model.childDefinitions){if(definition.kind==='component'&&state.depth<6)continue;if(definition.kind==='component'&&definition.boardIndex!==model.childDefinitions.find(d=>d.key===state.boardKey)?.boardIndex)continue;const button=document.createElement('button');button.textContent=definition.label;button.dataset.part=definition.key;button.onclick=()=>go(definition.kind==='board'?6:7,definition.kind==='board'?{boardKey:definition.key,componentKey:null}:{componentKey:definition.key});panel.append(button);}
  }
  function pose(depth){
    const fixed=[{position:[38,27,48],target:[0,8,-7],fov:43},{position:[24,19,30],target:[0,1,-5],fov:43},{position:[19,17,27],target:[0,1,-4],fov:43},{position:[9,5.2,22],target:[0,1.25,7],fov:35}];
    if(depth===0)return {...environment.hq.pose(),fov:43};
    if(depth<4){const bounds=environment.hall.bounds(depth===3?state.rowId:state.hallId);if(!bounds.isEmpty()){const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),span=Math.max(size.x,size.z);if(depth===1)return{position:[center.x,1.85,bounds.max.z+2.5],target:[center.x,1.4,center.z],fov:52};const offset=depth===3?[span*.45,3.7,Math.max(8,span*1.35)]:[span*.85,span*.85,span*1.2];return{position:center.clone().add(v(offset)).toArray(),target:[center.x,1.3,center.z],fov:depth===3?35:43};}return fixed[depth];}const rig=selectedRig();if(depth===4){const target=rig.group.position.toArray();return{position:rig.group.position.clone().add(v([-2.7,.45,5.6])).toArray(),target,fov:28.65};}
    const item=selectedItem().item,model=item.model,definition=model.childDefinitions?.find(d=>d.key===(depth===7?state.componentKey:state.boardKey));
    let bounds=activeDetail?(depth>=6?activeDetail.bounds(depth===7?'packages':'board',definition?.sourceComponent,definition?.boardIndex):activeDetail.bounds()):new THREE.Box3().setFromObject(item.group);
    if(bounds.isEmpty())throw new NavigationUnavailable('此部件的幾何資產缺失，無法聚焦。',depth-1);
    const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
    const yaw=(item.instance.placement.face==='rear'?Math.PI:0)+(item.instance.placement.yawDeg||0)*Math.PI/180;
    center.add(v([Math.sin(yaw),0,Math.cos(yaw)]).multiplyScalar((1-item.extract)*7.4*rig.unit*.802));
    const distance=Math.max(depth===7?.10:.65,Math.max(size.x,size.y,size.z)*(depth===7?2.2:1.75));
    controls.minDistance=Math.max(.025,size.length()*.55);
    const offset=v([-.3,.82,.68]).normalize().multiplyScalar(distance).applyAxisAngle(v([0,1,0]),yaw);
    return{position:center.clone().add(offset).toArray(),target:center.toArray(),fov:32};
  }
  async function go(depth,selection={}){
    const token=++navToken;if(!selection.nodeId)state.nodeId=null;stopFilm();director.cancel();assetAbort?.abort();state.pending=false;$('toast').classList.remove('show');
    let next;try{next=resolveJourney(store.document,state,depth,selection);}catch(e){if(e instanceof NavigationUnavailable){$('assetStatus').hidden=false;$('assetStatus').textContent=e.message;toast(e.message);return false;}throw e;}
    if(next.depth>=5){const hit=projection.item(next.equipmentId),clear=extractionClearance(store.document,next.equipmentId,7.4*hit.rig.unit*.802*1000);if(!clear.valid){toast('抽出路徑會碰撞其他設備；請調整安裝位置。');return false;}}
    if(next.depth<5||next.equipmentId!==state.equipmentId||activeDetail&&activeDetail.entityId!==next.equipmentId)clearDetails();Object.assign(state,next);$('assetStatus').hidden=true;applyVisibility();
    if(state.depth>=5){
      const hit=selectedItem();editor.select(state.equipmentId);hit.rig.extracted=state.equipmentId;hit.rig.doorTarget=1;
      if(hit.item.model.internalAsset){if(!activeDetail&&!(await ensureDetail(hit,token)))return false;if(token!==navToken)return false;activeDetail.setMode(state.depth>=6?'board':'system');}
      else{$('assetStatus').hidden=false;$('assetStatus').textContent='此型號尚無 Tray / Board 與 Component 資產。可配置外形與安裝位置；未虛構內部零件。';}
    }
    if(token!==navToken)return false;
    if(twinPanel){const id=state.nodeId||state.path?.at(-1)?.entityId;if(id)twinPanel.select(id);}
    const p=pose(state.depth),completed=await director.move(p.position,p.target,{fov:p.fov,duration:state.depth>=5?1000:850});return completed&&token===navToken;
  }
  function rackAngle(yaw){const rig=selectedRig();if(!rig)return;stopFilm();const target=rig.group.position.clone();director.move(target.clone().add(v([Math.sin(yaw)*5.9,.45,Math.cos(yaw)*5.9])).toArray(),target.toArray(),{fov:28.65});}
  function selectEquipment(id){const hit=projection.item(id);if(!hit)return;if(state.depth>=5&&id!==state.equipmentId){inspect(id);return;}state.equipmentId=id;state.rackId=hit.rig.rack.id;editor.show(state.rackId);editor.select(id);$('detailTitle').textContent=hit.item.instance.name;twinPanel?.select(id);}
  function extract(id){stopFilm();const hit=projection.item(id);if(!hit)return;const clear=extractionClearance(store.document,id,7.4*hit.rig.unit*.802*1000);if(hit.rig.extracted!==id&&!clear.valid){toast('抽出路徑會碰撞其他設備；請調整安裝位置。');return;}selectEquipment(id);hit.rig.extract(id);toast(hit.rig.extracted?'抽出檢視；安裝配置不變':'設備歸位');}
  function inspect(id){const hit=projection.item(id);return hit?go(5,{rackId:hit.rig.rack.id,equipmentId:id}):Promise.resolve(false);}
  async function ensureDetail(hit,token){
    // Cinematic can be requested again while its GLBs are loading. Give the
    // newest request the single detail lease, just as navigation does.
    assetAbort?.abort();assetAbort=new AbortController();const signal=assetAbort.signal;state.pending=true;$('assetStatus').hidden=false;$('assetStatus').textContent='載入並驗證主機板與液冷資產…';
    try{const detail=await attachL10(library,hit.rig,hit.item,{signal});if(signal.aborted||token!==navToken){detail.dispose();return false;}activeDetail=detail;$('assetStatus').hidden=true;return true;}
    catch(e){if(e.name!=='AbortError'){$('assetStatus').hidden=false;$('assetStatus').textContent=`模型無法載入：${e.message}。可再次點選深入設備重試。`;metrics.errors.push(e.message);}return false;}finally{if(!signal.aborted)state.pending=false;}
  }
  function stopFilm(){
    if(!film.active&&!film.spin)return;film.active=false;film.playing=false;film.spin=false;film.intro=null;projection.rigs.forEach(r=>r.setCinematic(null));activeDetail?.setMode(state.depth>=6?'board':'system');director.cancel();$('cinematicControls').hidden=true;$('rackSpin').classList.remove('active');
  }
  async function beginFilm(){
    if(state.depth<4&&!(await go(4)))return;
    const selected=selectedItem(),candidate=selected?.item.model.internalAsset?selected.item:[...selectedRig().items.values()].find(i=>i.model.internalAsset);
    // L10 binding requires the real PA RackRig. Overview handles retain stable
    // identity but do not own shader bindings or loaded child assets.
    const hit=candidate?projection.item(candidate.instance.id):{rig:selectedRig(),item:null};
    if(hit.item){if(state.equipmentId!==hit.item.instance.id||activeDetail&&activeDetail.entityId!==hit.item.instance.id)clearDetails();Object.assign(state,resolveJourney(store.document,state,state.depth,{equipmentId:hit.item.instance.id}));if(!activeDetail&&!(await ensureDetail(hit,navToken)))return;hit.rig.filmPrimary=hit.item.instance.id;applyVisibility();}
    else toast('此機櫃沒有 L10 內部資產；播放設備入櫃段落。');
    const clearance=cinematicClearance(selectedRig());film.clearance=clearance;if(!clearance.valid){toast('此配置的 Cinematic 路徑會碰撞設備；請改用個別設備檢視。');return;}
    film.intro=reducedMotion?null:{position:camera.position.clone(),target:controls.target.clone(),fov:camera.fov,started:performance.now()};seekFilm(0);film.playing=!reducedMotion;$('playCinematic').textContent=film.playing?'暫停 Cinematic':'播放 Cinematic';
  }
  function seekFilm(progress){
    const rig=selectedRig();if(!rig)return;film.active=true;film.spin=false;film.progress=progress;film.clock=window.PAL10Timeline.timeAt(progress,'coolingV2');if(director.owner!=='timeline')director.timeline();$('cinematicControls').hidden=false;$('cinematicRange').value=progress;
    rig.setCinematic(activeDetail?progress:.56+progress*.44);activeDetail?.cinematic(progress);
    $('cinematicTime').textContent=`${(film.clock/1000).toFixed(1)} s`;
  }
  function filmFrame(dt){
    const rig=selectedRig();if(!rig)return;
    if(film.spin){film.progress+=dt*.16;const a=film.progress;camera.position.copy(rig.group.position).add(v([Math.sin(a)*5.9,.45,Math.cos(a)*5.9]));controls.target.copy(rig.group.position);camera.lookAt(controls.target);}
    if(film.active){if(film.playing&&!film.intro){film.clock=Math.min(39700,film.clock+dt*1000);const p=window.PAL10Timeline.progressAt(film.clock,'coolingV2');seekFilm(p);if(film.clock>=39700)film.playing=false;}
      const a=-.45+film.progress*.9,rackEye=rig.group.position.clone().add(v([Math.sin(a)*6.1,.7,Math.cos(a)*6.1]));
      if(activeDetail){
        const weights=window.PACoreScene.coolingAssemblyCamera(film.progress),center=activeDetail.bounds('board').getCenter(new THREE.Vector3());
        const chip=activeDetail.bounds('packages','Board1/CPU',0).getCenter(new THREE.Vector3());center.lerp(chip,weights.detail*.55);
        const eye=center.clone().add(v([-.35,.6+weights.reveal*.15,.7]).multiplyScalar(1-weights.detail*.35));
        const q=Math.max(0,Math.min(1,(film.progress-.407)/.31)),blend=q*q*(3-2*q);
        camera.position.copy(eye).lerp(rackEye,blend);controls.target.copy(center).lerp(rig.group.position,blend);
      }else{camera.position.copy(rackEye);controls.target.copy(rig.group.position);}
      camera.fov=30;if(film.intro){const t=Math.min(1,(performance.now()-film.intro.started)/850),s=t*t*(3-2*t);camera.position.lerpVectors(film.intro.position,camera.position.clone(),s);controls.target.lerpVectors(film.intro.target,controls.target.clone(),s);camera.fov=film.intro.fov+(30-film.intro.fov)*s;if(t===1)film.intro=null;}camera.updateProjectionMatrix();camera.lookAt(controls.target);
    }
  }
  async function setupMonitoring(){
    const response=await fetch('./data/monitoring.json');if(!response.ok)throw Error('Monitoring configuration unavailable');const config=await response.json();
    if(!config||!['mock','pa-gateway'].includes(config.mode)||Object.keys(config).some(k=>!['mode','staleAfterMs','routes','pollIntervalMs'].includes(k)))throw Error('Invalid public monitoring configuration; credentials are forbidden');
    adapter=config.mode==='mock'?new MockAdapter({getConfiguration:()=>store.document,staleAfterMs:config.staleAfterMs}):new PAManagerAdapter({routes:config.routes,pollIntervalMs:config.pollIntervalMs});
    twinService=new DigitalTwinService({adapter,getConfiguration:()=>store.document,clock:()=>adapter.now(),staleAfterMs:config.staleAfterMs});
    twinSync=new SceneStateSynchronizer({parent:core,projection,getNavigation:()=>state});twinPanel=new TwinPanel({service:twinService,adapter,focusEntity,toast});
    twinService.subscribe(snapshot=>twinSync.sync(snapshot));
    const connection=twinService.connect().catch(error=>toast('監測連線失敗：'+error.message+'；3D 配置仍可使用。'));
    // An unavailable external gateway must not block the independent 3D workbench.
    if(adapter.mode==='mock')await connection;
    if(adapter.mode!=='mock')document.querySelector('.demo-controls').hidden=true;
    monitoringTimer=setInterval(()=>twinService.tick(),1000);
  }
  async function focusEntity(id,{overview=false}={}){
    const entity=twinService?.entities.get(id);if(!entity)return false;twinPanel?.select(id);
    if(overview)return go(2,{hallId:store.document.rows.find(r=>r.id===store.document.racks.find(r=>r.id===entity.rackId)?.rowId)?.hallId,rackId:null,rowId:null});
    if(entity.kind==='rack')return go(4,{rackId:id});
    if(['system','switch','powerShelf','equipment'].includes(entity.kind))return inspect(id);
    if(entity.kind==='node'){
      if(state.depth<4||state.rackId!==entity.rackId)if(!await go(4,{rackId:entity.rackId}))return false;
      if(!await go(5,{rackId:entity.rackId,equipmentId:entity.systemId,nodeId:id}))return false;
      const config=store.document.equipment.find(e=>e.id===entity.systemId),board=config?.children.find(c=>c.id===entity.boardId);
      if(board){if(!await go(6,{rackId:entity.rackId,equipmentId:entity.systemId,boardKey:board.definitionKey,nodeId:id}))return false;}
      else toast('此 Node 沒有獨立模型；顯示所屬 System 與唯讀狀態。');
      twinPanel?.select(id);return true;
    }
    if(entity.kind==='board'||entity.kind==='component'){
      const system=store.document.equipment.find(e=>e.children.some(c=>c.id===id));if(!system)return false;const child=system.children.find(c=>c.id===id),model=store.document.catalog.find(m=>m.id===system.modelId),def=model.childDefinitions.find(d=>d.key===child.definitionKey),board=model.childDefinitions.find(d=>d.kind==='board'&&d.boardIndex===def.boardIndex);
      return go(entity.kind==='board'?6:7,{rackId:system.rackId,equipmentId:system.id,boardKey:board.key,componentKey:entity.kind==='component'?def.key:null});
    }
    return false;
  }
  let flowMode='off',flowObjects=[];
  function buildFlows(){
    for(const o of flowObjects){o.geometry.dispose();o.material.dispose();o.removeFromParent();}flowObjects=[];
    for(const rack of store.document.racks){const [x,y,z]=rack.positionMm.map(n=>n/1000);for(const [mode,color,dx] of [['cooling',0x43c8ed,-.2],['power',0xd9b16a,0],['network',0x75d9c0,.2]]){
      const points=[[x+dx,y+2.4,z-.5],[x+dx,3.8,z-.5],[x+dx,3.8,-16],[dx,3.8,-19]].map(v);
      const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,.018,6,false),m=new THREE.MeshBasicMaterial({color});const o=new THREE.Mesh(g,m);o.userData.flow=mode;scene.add(o);flowObjects.push(o);
    }}setFlow(flowMode);
  }
  function setFlow(mode){flowMode=mode;for(const o of flowObjects)o.visible=state.depth<4&&mode===o.userData.flow;document.querySelectorAll('[data-flow]').forEach(b=>b.classList.toggle('active',b.dataset.flow===mode));}
  const labelNodes=new Map();
  function renderLabels(){
    for(const [id,b] of labelNodes)if(!projection.rigs.has(id)){b.remove();labelNodes.delete(id);}
    for(const [id,rig] of projection.rigs){let b=labelNodes.get(id);if(!b){b=document.createElement('button');b.className='rack-label';b.dataset.rackId=id;b.onclick=()=>go(4,{rackId:id});$('labels').append(b);labelNodes.set(id,b);}b.textContent=rig.rack.name;b.hidden=state.depth<2||state.depth>=4||!rig.visible;}
  }
  function updateLabels(){const w=$('scene').clientWidth,h=$('scene').clientHeight;for(const [id,b] of labelNodes){if(b.hidden)continue;const rig=projection.rigs.get(id);const pos=rig.group.position.clone();pos.y+=rig.height/2+.1;pos.project(camera);b.style.left=`${(pos.x*.5+.5)*w}px`;b.style.top=`${(-pos.y*.5+.5)*h}px`;b.style.visibility=pos.z>1||Math.abs(pos.x)>1||Math.abs(pos.y)>1?'hidden':'visible';}}
  function summary(){const doc=store.document;$('configSummary').textContent=`${doc.racks.length} 個機櫃 · ${doc.equipment.length} 台設備 · revision ${doc.revision} · 本機自動儲存`;$('rackSummary').replaceChildren(...doc.racks.map(r=>{const b=document.createElement('span');b.textContent=`${r.name} · ${doc.equipment.filter(e=>e.rackId===r.id).length}`;return b;}));}
  store.subscribe((doc)=>{
    navToken++;clearDetails();state.pending=false;stopFilm();projection.sync(doc);environment.hall.sync(doc);facilityEditor.render();
    if(!projection.rigs.has(state.rackId)){state.rackId=null;state.equipmentId=null;if(state.depth>=4)state.depth=3;}
    if(state.equipmentId&&!projection.item(state.equipmentId)){state.equipmentId=null;if(state.depth>=5)state.depth=4;}
    try{Object.assign(state,resolveJourney(doc,state,state.depth));}catch(e){if(!(e instanceof NavigationUnavailable))throw e;Object.assign(state,resolveJourney(doc,state,e.depth));}
    buildFlows();applyVisibility();editor.render();summary();twinService?.reconcile();
    if(state.depth>=5)queueMicrotask(()=>go(state.depth));
  });
  // UI commands use the same configuration store as JSON import and migration.
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>go(['hq','cutaway','hall','row'].indexOf(b.dataset.view)));
  $('startTour').onclick=()=>{state.mode='journey';go(1);};$('hallDirect').onclick=()=>go(3);$('tourPrev').onclick=()=>go(state.depth-1);$('tourNext').onclick=()=>go(state.depth+1);$('journeyRange').oninput=e=>go(+e.target.value);
  $('exitTour').onclick=()=>{state.mode=state.mode==='journey'?'explore':'journey';renderJourney();};$('resetBtn').onclick=()=>go(state.depth);$('closeInspector').onclick=()=>editor.hide();
  $('openRack').onclick=()=>{const rig=selectedRig();if(rig){rig.toggleDoor();$('openRack').classList.toggle('active',!!rig.doorTarget);}};
  $('deviceView').onclick=()=>{const item=selectedItem()?.item||[...selectedRig()?.items.values()||[]].find(i=>i.model.internalAsset);if(item)inspect(item.instance.id);else toast('這個機櫃尚無含內部資產的 System');};
  $('rackFront').onclick=()=>rackAngle(0);$('rackRear').onclick=()=>rackAngle(Math.PI);$('rackSide').onclick=()=>rackAngle(Math.PI/2);$('rackQuarter').onclick=()=>rackAngle(-.48);
  $('rackSpin').onclick=()=>{if(film.spin){stopFilm();return;}stopFilm();film.spin=true;film.progress=0;director.timeline();$('rackSpin').classList.add('active');};
  $('explodeBtn').onclick=async()=>{if(film.active){stopFilm();go(state.depth);}else await beginFilm();};$('playCinematic').onclick=()=>{film.playing=!film.playing;$('playCinematic').textContent=film.playing?'暫停 Cinematic':'播放 Cinematic';};$('cinematicRange').oninput=e=>{film.playing=false;seekFilm(+e.target.value);};$('stopCinematic').onclick=()=>{stopFilm();go(state.depth);};
  const addRack=id=>{try{const created=store.addRack(id,state.rowId);go(4,{rackId:created});toast('機櫃已新增並儲存');}catch(e){toast(e.message);}};$('addRackBtn').onclick=()=>addRack();$('duplicateRack').onclick=()=>addRack(state.rackId);
  $('configBtn').onclick=()=>{summary();$('configDialog').showModal();};$('helpBtn').onclick=()=>$('helpDialog').showModal();document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
  $('exportConfig').onclick=()=>{const url=URL.createObjectURL(new Blob([store.export()],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='wistron-datacenter-config-v2.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  $('importConfig').onchange=async e=>{const file=e.target.files[0];try{if(file){if(file.size>4*1024*1024)throw Error('配置檔超過 4 MB');store.import(await file.text());toast('配置已驗證、匯入並儲存');}}catch(error){toast(error.message);}finally{e.target.value='';}};
  $('resetConfig').onclick=()=>{try{store.reset();go(3);toast('已恢復 Draft 示範配置');}catch(e){toast(e.message);}};
  $('networkBtn').onclick=()=>{$('flowPanel').hidden=!$('flowPanel').hidden;$('networkBtn').setAttribute('aria-expanded',String(!$('flowPanel').hidden));};$('closeFlow').onclick=()=>{$('flowPanel').hidden=true;$('networkBtn').setAttribute('aria-expanded','false');};document.querySelectorAll('[data-flow]').forEach(b=>b.onclick=()=>setFlow(b.dataset.flow));
  let high=false;$('qualityBtn').onclick=()=>{high=!high;renderer.setPixelRatio(high?Math.min(devicePixelRatio,2):Math.min(devicePixelRatio,1.65));$('qualityLabel').textContent=high?'HIGH QUALITY':'AUTO QUALITY';resize();};$('fullscreenBtn').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else $('scene').requestFullscreen().catch(()=>toast('此瀏覽器無法進入全螢幕'));};
  const raycaster=new THREE.Raycaster();let down=null;
  const pointerDown=e=>{if(e.button===0)down={x:e.clientX,y:e.clientY};if(director.owner!=='orbit'){stopFilm();director.cancel();}};
  const pointerUp=e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6){down=null;return;}down=null;const rect=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
    const hits=[...raycaster.intersectObject(core,true),...(state.depth<4?raycaster.intersectObject(environment.hall.root,true):[])].filter(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return true;});const hit=hits.find(h=>h.object.userData.entityId&&h.object.userData.kind!=='door'||h.object.userData.kind==='rack-lod');if(!hit)return;const meta=projection.resolveHit(hit)||hit.object.userData;if(meta.kind==='twin-status'){focusEntity(meta.entityId);return;}if(meta.kind==='hall'){go(2,{hallId:meta.hallId,rackId:null,rowId:null});return;}if(meta.kind==='row'){go(3,{hallId:meta.hallId,rowId:meta.rowId,rackId:null});return;}if(state.depth<4&&meta.rackId)go(4,{rackId:meta.rackId});else if(meta.childId){const item=selectedItem()?.item,definition=item?.model.childDefinitions.find(d=>item.instance.children.find(c=>c.id===meta.childId)?.definitionKey===d.key);if(definition)go(definition.kind==='component'?7:6,{boardKey:item.model.childDefinitions.find(d=>d.kind==='board'&&d.boardIndex===definition.boardIndex)?.key,componentKey:definition.kind==='component'?definition.key:null});}else if(meta.entityId!==state.rackId)inspect(meta.entityId);
  };
  renderer.domElement.addEventListener('pointerdown',pointerDown,{capture:true});renderer.domElement.addEventListener('pointerup',pointerUp);
  let lastWheel=0,wheelSum=0;const wheel=e=>{if(state.mode!=='journey'||e.ctrlKey){if(director.owner!=='orbit'){stopFilm();director.cancel();}return;}e.preventDefault();e.stopImmediatePropagation();const now=performance.now();if(now-lastWheel<600)return;wheelSum+=e.deltaY*(e.deltaMode===1?16:1);if(Math.abs(wheelSum)>=60){const direction=Math.sign(wheelSum);wheelSum=0;lastWheel=now;go(state.depth+direction);}};
  renderer.domElement.addEventListener('wheel',wheel,{capture:true,passive:false});
  // Rack labels are part of the spatial canvas; hovering one must not swallow journey input.
  $('labels').addEventListener('wheel',wheel,{capture:true,passive:false});
  const key=e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||document.querySelector('dialog[open]'))return;if(e.key==='Home'){e.preventDefault();go(state.depth);}if(e.key==='Escape'){editor.close();$('flowPanel').hidden=true;stopFilm();}if(e.key==='ArrowDown'){e.preventDefault();go(state.depth+1);}if(e.key==='ArrowUp'){e.preventDefault();go(state.depth-1);}};document.addEventListener('keydown',key);
  function resize(){const rect=$('scene').getBoundingClientRect();camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();renderer.setSize(rect.width,rect.height,false);}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe($('scene'));resize();
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();metrics.contextLosses++;toast('GPU context 已中斷；配置已保留，請重新整理恢復。');});
  function animate(now){if(disposed)return;const dt=Math.min(.05,(now-last)/1000);if(metrics.frames.length<2000)metrics.frames.push(now-last);last=now;projection.update(dt);environment.hq.update(camera);director.update(now);filmFrame(dt);twinSync?.update();updateLabels();studio.shadow();renderer.render(scene,camera);raf=requestAnimationFrame(animate);}
  buildFlows();summary();applyVisibility();await setupMonitoring();raf=requestAnimationFrame(animate);await go(0);$('loading').classList.add('done');if(store.notice)toast(store.notice);
  const api={store,projection,environment,facilityEditor,studio,library,scene,camera,renderer,controls,director,state,film,metrics,editor,go,inspect,extract,selectEquipment,seekFilm,beginFilm,stopFilm,rackAngle,twin:twinService,adapter,twinPanel,twinSync,focusEntity,
    snapshot(){return{state:structuredClone(state),owner:director.owner,revision:store.document.revision,rigs:[...projection.rigs.values()].map(r=>({id:r.rack.id,visible:r.group.visible,equipment:[...r.equipmentIds]})),memory:{...renderer.info.memory},pool:projection.pool.size,materials:studio.materials.size,assets:library.refs};},
    dispose(){disposed=true;cancelAnimationFrame(raf);clearInterval(monitoringTimer);twinPanel?.dispose();twinSync?.dispose();twinService?.dispose();adapter?.dispose();clearTimeout(toastTimer);director.cancel();clearDetails();resizeObserver.disconnect();renderer.domElement.removeEventListener('pointerdown',pointerDown,true);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('wheel',wheel,true);$('labels').removeEventListener('wheel',wheel,true);document.removeEventListener('keydown',key);projection.dispose();environment.dispose();studio.dispose();for(const o of flowObjects){o.geometry.dispose();o.material.dispose();}controls.dispose();renderer.dispose();}
  };window.studio=api;return api;
}
