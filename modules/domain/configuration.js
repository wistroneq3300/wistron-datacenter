// Domain-only code: no DOM, Three objects, network credentials or camera state.
export const STORAGE_KEY='wistron-studio-config-v2';
export const LEGACY_KEY='wistron-studio-config-v1';
export const KINDS=Object.freeze(['system','switch','powerShelf']);
const VARIANTS={system:['server'],switch:['switch','nvlink'],powerShelf:['powershelf']};
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const positive=v=>finite(v)&&v>0&&v<=100000;
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(finite);
const text=(v,max=120)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(v);
export const clone=value=>structuredClone(value);
export const newId=prefix=>`${prefix}-${crypto.randomUUID()}`;
const epsilon=1e-4;

export class ConfigurationError extends Error {
  constructor(issues){super(issues.map(i=>i.message).join('\n'));this.name='ConfigurationError';this.issues=issues;}
}

export function placementBox(e,model,profile){
  const p=e.placement,d=e.dimensionsMm,ratio=[d.width/model.dimensionsMm.width,d.height/model.dimensionsMm.height,d.depth/model.dimensionsMm.depth];
  const origin=(model.originMm||[0,0,0]).map((v,i)=>v*ratio[i]);
  const yaw=((p.face==='rear'?180:0)+(p.yawDeg||0))*Math.PI/180,c=Math.cos(yaw),s=Math.sin(yaw);
  const base=p.mode==='grid'?[p.offsetMm[0],(p.start-1+p.span/2)*profile.pitchMm+p.offsetMm[1],p.offsetMm[2]]:p.positionMm;
  const center=[base[0]+c*origin[0]+s*origin[2],base[1]+origin[1],base[2]-s*origin[0]+c*origin[2]];
  const half=[d.width/2,d.height/2,d.depth/2],axes=[[c,-s],[s,c]];
  const reach=[Math.abs(c)*half[0]+Math.abs(s)*half[2],half[1],Math.abs(s)*half[0]+Math.abs(c)*half[2]];
  return {center,half,axes,min:center.map((n,i)=>n-reach[i]),max:center.map((n,i)=>n+reach[i])};
}
export function overlaps(a,b){
  if(a.max[1]<=b.min[1]+epsilon||b.max[1]<=a.min[1]+epsilon)return false;
  const dx=b.center[0]-a.center[0],dz=b.center[2]-a.center[2];
  for(const axis of [...a.axes,...b.axes]){
    const distance=Math.abs(dx*axis[0]+dz*axis[1]);
    const radius=box=>Math.abs(box.axes[0][0]*axis[0]+box.axes[0][1]*axis[1])*box.half[0]+Math.abs(box.axes[1][0]*axis[0]+box.axes[1][1]*axis[1])*box.half[2];
    if(distance>=radius(a)+radius(b)-epsilon)return false;
  }return true;
}

export function validateConfiguration(doc){
  const errors=[],warnings=[],add=(code,message,entityId,field,conflictsWith)=>errors.push({code,message,entityId,field,conflictsWith});
  if(!doc||typeof doc!=='object'||doc.schemaVersion!==2||doc.units!=='mm'){add('schema','只接受 schemaVersion 2、mm 單位的配置');return{valid:false,errors,warnings};}
  if(!id(doc.documentId)||!Number.isInteger(doc.revision)||doc.revision<0)add('identity','文件 ID 或 revision 無效');
  for(const [key,limit] of [['rows',64],['racks',128],['catalog',256],['rackProfiles',64],['equipment',4096]])if(!Array.isArray(doc[key])||doc[key].length>limit){add('schema',`${key} 必須是陣列且不超過 ${limit} 筆`);return{valid:false,errors,warnings};}
  for(const key of ['rows','catalog','rackProfiles'])if(!doc[key].length)add('schema',`${key} 至少需要一筆定義`);
  // Reject unexpected top-level data rather than leaking imported credentials in exports.
  for(const key of Object.keys(doc))if(!['schemaVersion','documentId','revision','units','site','rows','racks','rackProfiles','catalog','equipment'].includes(key))add('unknown-field',`不支援的配置欄位：${key}`);
  const allIds=new Set(),unique=(items,label)=>{const map=new Map();for(const item of items){if(!item||!id(item.id)||allIds.has(item.id)){add('duplicate-id',`${label} ID 無效或重複：${item?.id||'空值'}`,item?.id);continue;}allIds.add(item.id);map.set(item.id,item);}return map;};
  const profiles=unique(doc.rackProfiles,'Rack Profile'),models=unique(doc.catalog,'Catalog'),rows=unique(doc.rows,'Row'),racks=unique(doc.racks,'Rack');unique(doc.equipment,'Equipment');
  if(!doc.site||!id(doc.site.id)||!text(doc.site.name))add('site','Site 資料缺少 ID 或名稱');
  else if(allIds.has(doc.site.id))add('duplicate-id','Site ID 與其他實體重複');else allIds.add(doc.site.id);
  const allowedFields=(object,keys,label)=>{if(!object||typeof object!=='object')return;for(const key of Object.keys(object))if(!keys.includes(key))add('unknown-field',`${label} 不支援欄位 ${key}`,object.id);};
  for(const p of doc.rackProfiles){
    if(!p)continue;
    allowedFields(p,['id','name','specificationState','grid','pitchMm','capacity','increment','usableWidthMm','usableDepthMm','evidence'],'Profile');
    if(!text(p.name)||!Number.isInteger(p.capacity)||p.capacity<1||p.capacity>60||!positive(p.usableWidthMm)||!positive(p.usableDepthMm)||!['RU','OU'].includes(p.grid)||p.pitchMm!==({RU:44.45,OU:48}[p.grid])||![1,.5].includes(p.increment??1))add('profile','Rack Profile 容量、RU／OU 或可用寬深無效',p.id);
    if(!['draft','validated'].includes(p.specificationState))add('profile-status','Profile 規格狀態無效',p.id);
    if(p.specificationState==='validated'&&(!text(p.evidence?.source,2000)||p.evidence?.status!=='verified'))add('evidence','已驗證 Profile 必須附規格來源',p.id);
    if(p.specificationState!=='validated')warnings.push({entityId:p.id,code:'draft-profile',message:'Draft：Rack 容量／外形與安裝介面未經 OEM 驗證。'});
  }
  for(const m of doc.catalog){
    if(!m)continue;
    allowedFields(m,['id','revision','kind','renderVariant','name','span','dimensionsMm','originMm','specificationState','evidence','internalAsset','childDefinitions'],'Catalog');
    if(!KINDS.includes(m.kind)||!VARIANTS[m.kind]?.includes(m.renderVariant)||!text(m.name)||!text(m.revision)||!positive(m.span)||!m.dimensionsMm||!['width','height','depth'].every(k=>positive(m.dimensionsMm[k]))||!vector(m.originMm||[0,0,0]))add('model','Catalog 型號、類型或尺寸無效',m.id);
    if(!['draft','validated'].includes(m.specificationState)||m.specificationState==='validated'&&(m.evidence?.status!=='verified'||!text(m.evidence?.source,2000)))add('model-evidence','型號的規格驗證狀態不完整',m.id);
    if(m.internalAsset!==null&&m.internalAsset!=='pa-l10-bare-cooling')add('asset','不支援的內部模型參照',m.id);
    if(m.internalAsset&&m.kind!=='system')add('asset','只有對應 System 可使用 L10 內部模型',m.id);
    if(m.childDefinitions!==undefined&&(!Array.isArray(m.childDefinitions)||m.childDefinitions.length>64))add('children','型號 children 定義無效',m.id);
    const keys=new Set();for(const c of Array.isArray(m.childDefinitions)?m.childDefinitions:[]){if(!c||!id(c.key)||keys.has(c.key)||!['board','component'].includes(c.kind)||!text(c.label)||!Number.isInteger(c.boardIndex)||c.boardIndex<0||c.boardIndex>1||!text(c.sourceComponent)||!m.internalAsset)add('child-definition','子部件定義缺少穩定識別、類型或來源',m.id);keys.add(c?.key);}
    if(m.internalAsset==='pa-l10-bare-cooling')for(const c of Array.isArray(m.childDefinitions)?m.childDefinitions:[]){if(!c)continue;const available=c.kind==='board'?['board']:[`Board${c.boardIndex+1}/CPU`,`Board${c.boardIndex+1}/GPU_A`,`Board${c.boardIndex+1}/GPU_B`];if(!available.includes(c.sourceComponent))add('child-asset','子部件沒有對應的真實 GLB 節點',m.id);}
  }
  for(const row of doc.rows)if(!row||!text(row.name)||!id(row.hallId)||!Number.isInteger(row.capacity)||row.capacity<1||row.capacity>128)add('row','Row 容量或識別資料無效',row?.id);
  const slots=new Set();
  for(const rack of doc.racks){
    if(!rack)continue;
    allowedFields(rack,['id','name','purpose','profileId','rowId','position','positionMm','inventoryState'],'Rack');
    const row=rows.get(rack.rowId);
    if(!text(rack.name)||typeof rack.purpose!=='string'||rack.purpose.length>240||!profiles.has(rack.profileId)||!row||!Number.isInteger(rack.position)||rack.position<0||rack.position>=row.capacity||!vector(rack.positionMm)||rack.positionMm.some(v=>Math.abs(v)>1000000))add('rack','機櫃名稱、Profile、位置或 Row 參照無效',rack.id);
    const key=`${rack.rowId}:${rack.position}`;if(slots.has(key))add('rack-slot','同一 Row 的機位重複',rack.id);slots.add(key);
  }
  const ids=new Set(),boxes=[];
  for(const e of doc.equipment){
    if(!e)continue;
    allowedFields(e,['id','deviceId','name','modelId','rackId','dimensionsMm','placement','children'],'Equipment');
    const model=models.get(e.modelId),rack=racks.get(e.rackId),p=e.placement,d=e.dimensionsMm,profile=profiles.get(rack?.profileId);
    if(!text(e.name)||!text(e.deviceId,96)||ids.has(e.deviceId)){add('device-id','設備 ID 必須唯一且名稱不可留空',e.id,'deviceId');}ids.add(e.deviceId);
    if(!model||!rack||!profile){add('reference','設備參照不存在的型號或機櫃',e.id);continue;}
    if(!d||!['width','height','depth'].every(k=>positive(d[k]))){add('dimensions','設備尺寸必須為正數 mm',e.id);continue;}
    if(!p||!['grid','xyz'].includes(p.mode)||!['front','rear'].includes(p.face)||p.yawDeg!==undefined&&(!finite(p.yawDeg)||Math.abs(p.yawDeg)>180)){add('placement','安裝座標或朝向無效',e.id);continue;}
    allowedFields(p,p.mode==='grid'?['mode','grid','start','span','face','offsetMm','yawDeg']:['mode','positionMm','face','yawDeg'],'Placement');
    if(p.mode==='grid'){
      const increment=profile.increment??1;
      if(p.grid!==profile.grid||!finite(p.start)||!finite(p.span)||p.span<=0||p.start<1||p.start-1+p.span>profile.capacity+epsilon||Math.abs((p.start-1)/increment-Math.round((p.start-1)/increment))>epsilon||Math.abs(p.span/increment-Math.round(p.span/increment))>epsilon||!vector(p.offsetMm)){add('capacity','U 位超出容量、步距不符或 RU／OU 不相容',e.id,'placement');continue;}
      if(d.height>p.span*profile.pitchMm+epsilon)add('slot-height','設備高度超過保留 U 位，請增加 U 數',e.id,'dimensionsMm.height');
    }else if(!vector(p.positionMm)){add('coordinates','實際安裝座標必須是三個有限 mm 數值',e.id);continue;}
    if(!model.dimensionsMm||!vector(model.originMm||[0,0,0]))continue;
    const box=placementBox(e,model,profile);
    const min=[-profile.usableWidthMm/2,0,-profile.usableDepthMm/2],max=[profile.usableWidthMm/2,profile.capacity*profile.pitchMm,profile.usableDepthMm/2];
    if(box.min.some((n,i)=>n<min[i]-epsilon)||box.max.some((n,i)=>n>max[i]+epsilon))add('boundary','設備外形超出機櫃可用空間',e.id,'placement');
    for(const previous of boxes)if(previous.rackId===e.rackId&&overlaps(box,previous.box))add('collision',`設備與 ${previous.deviceId} 碰撞`,e.id,'placement',previous.id);
    boxes.push({box,id:e.id,deviceId:e.deviceId,rackId:e.rackId});
    if(!Array.isArray(e.children)||e.children.length>64)add('children','設備 children 資料無效',e.id);
    else {const defs=Array.isArray(model.childDefinitions)?model.childDefinitions:[],seen=new Set();for(const child of e.children){if(!child||!text(child.id,180)||allIds.has(child.id)||child.parentId!==e.id||seen.has(child.definitionKey)||!defs.some(c=>c?.key===child.definitionKey)){add('child-reference','子部件 identity 或模型參照無效',e.id);}allIds.add(child?.id);seen.add(child?.definitionKey);}if(defs.length!==e.children.length)add('child-reference','子部件清單與 Catalog 不一致',e.id);}
    if(model.specificationState!=='validated'||['width','height','depth'].some(k=>Math.abs(d[k]-model.dimensionsMm[k])>epsilon))warnings.push({entityId:e.id,code:'draft-equipment',message:'Draft：尺寸來自視覺模型／使用者輸入，尚未驗證 OEM 相容性。'});
  }
  return {valid:errors.length===0,errors,warnings};
}

export function assertConfiguration(doc){const result=validateConfiguration(doc);if(!result.valid)throw new ConfigurationError(result.errors);return result;}
// Continuous translation of a body along its own depth axis. Door/rail
// certification remains dependent on OEM CAD, separate from body collisions.
export function extractionClearance(doc,entityId,distanceMm){
  const e=doc.equipment.find(e=>e.id===entityId);if(!e)return{valid:false,conflicts:[]};const model=doc.catalog.find(m=>m.id===e.modelId),rack=doc.racks.find(r=>r.id===e.rackId),profile=doc.rackProfiles.find(p=>p.id===rack.profileId),box=placementBox(e,model,profile);
  const axis=box.axes[1],swept={...box,center:[box.center[0]+axis[0]*distanceMm/2,box.center[1],box.center[2]+axis[1]*distanceMm/2],half:[box.half[0],box.half[1],box.half[2]+distanceMm/2]};
  const conflicts=doc.equipment.filter(other=>other.id!==e.id&&other.rackId===e.rackId&&overlaps(swept,placementBox(other,doc.catalog.find(m=>m.id===other.modelId),profile))).map(e=>e.id);return{valid:conflicts.length===0,conflicts};
}
export function canonicalJSON(doc){const ordered=v=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;return JSON.stringify(ordered(doc),null,2);}
export function childInstances(model,entityId){return(model.childDefinitions||[]).map(def=>({id:`${entityId}::${def.key}`,definitionKey:def.key,parentId:entityId}));}
export function migrateV1(input,base){
  if(input?.version!==1||!Array.isArray(input.racks)||input.racks.length<1||input.racks.length>10)throw new ConfigurationError([{code:'legacy',message:'V1 必須包含 1–10 個機櫃'}]);
  const doc=clone(base);doc.documentId='migrated-v1';doc.revision=0;doc.equipment=[];const seen=new Set(),positions=new Set();
  doc.racks=input.racks.map(r=>{if(!r||!id(r.id)||seen.has(r.id)||!Number.isInteger(r.position)||r.position<0||r.position>9||positions.has(r.position)||typeof r.purpose!=='string')throw new ConfigurationError([{code:'legacy',message:'V1 ID／機位重複或欄位格式錯誤'}]);seen.add(r.id);positions.add(r.position);return{id:r.id,name:typeof r.name==='string'&&r.name.trim()?r.name.slice(0,120):r.id,purpose:r.purpose.slice(0,240),profileId:doc.rackProfiles[0].id,rowId:doc.rows[0].id,position:r.position,positionMm:[(r.position-3.5)*1100,130,7000],inventoryState:'not-provided'};});
  assertConfiguration(doc);return doc;
}
export function importDocument(textValue,base){if(typeof textValue!=='string'||textValue.length>4*1024*1024)throw new ConfigurationError([{code:'file-size',message:'配置必須是小於 4 MB 的 JSON'}]);let doc;try{doc=JSON.parse(textValue);}catch{throw new ConfigurationError([{code:'json',message:'JSON 格式錯誤，原配置未變更'}]);}if(doc?.version===1)doc=migrateV1(doc,base);assertConfiguration(doc);return doc;}

export class ConfigStore {
  constructor(base,storage){this.base=clone(base);assertConfiguration(this.base);this.document=clone(base);this.storage=storage;this.listeners=new Set();this.notice='';}
  load(){
    try{const raw=this.storage?.getItem(STORAGE_KEY),legacy=this.storage?.getItem(LEGACY_KEY);if(raw)this.document=importDocument(raw,this.base);else if(legacy){const next=migrateV1(JSON.parse(legacy),this.base);this.storage.setItem(LEGACY_KEY+'.backup',legacy);this.persist(next);this.document=next;this.notice='V1 已遷移；舊檔已備份。原資料沒有設備 inventory，未自動補入設備。';}}
    catch(e){this.notice=`儲存資料未載入：${e.message}。已保留原檔，暫用 Draft 示範。`;try{const raw=this.storage?.getItem(STORAGE_KEY);if(raw)this.storage.setItem(STORAGE_KEY+'.invalid-backup',raw);}catch{}}
    return this.document;
  }
  persist(doc){if(this.storage)this.storage.setItem(STORAGE_KEY,canonicalJSON(doc));}
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  commit(next,{imported=false}={}){
    if(!imported)next.revision=this.document.revision+1;
    const validation=assertConfiguration(next),old=this.document;
    // Persist first: quota failure never commits an unpersisted partial edit.
    try{this.persist(next);}catch{throw new ConfigurationError([{code:'storage',message:'本機儲存失敗，變更已取消。請先匯出備份或釋放空間。'}]);}
    this.document=next;
    try{for(const fn of this.listeners)fn(next,old);}catch(e){this.document=old;this.persist(old);for(const fn of this.listeners)try{fn(old,next);}catch{}throw e;}
    return validation;
  }
  transact(change){const next=clone(this.document);const result=change(next);this.commit(next);return result;}
  import(textValue){return this.commit(importDocument(textValue,this.base),{imported:true});}
  export(){return canonicalJSON(this.document);}
  reset(){return this.commit(clone(this.base),{imported:true});}
  addEquipment({rackId,modelId,name,deviceId,dimensionsMm,placement}){
    return this.transact(doc=>{const model=doc.catalog.find(m=>m.id===modelId);if(!model)throw Error('找不到型號');const entityId=newId('eq');doc.equipment.push({id:entityId,deviceId,name,modelId,rackId,dimensionsMm:clone(dimensionsMm||model.dimensionsMm),placement:clone(placement),children:childInstances(model,entityId)});return entityId;});
  }
  updateEquipment(entityId,patch){return this.transact(doc=>{const e=doc.equipment.find(e=>e.id===entityId);if(!e)throw Error('設備不存在');for(const key of ['deviceId','name','modelId','rackId','dimensionsMm','placement'])if(patch[key]!==undefined)e[key]=clone(patch[key]);if(patch.modelId)e.children=childInstances(doc.catalog.find(m=>m.id===e.modelId)||{},e.id);});}
  removeEquipment(entityId){return this.transact(doc=>{if(!doc.equipment.some(e=>e.id===entityId))throw Error('設備不存在');doc.equipment=doc.equipment.filter(e=>e.id!==entityId);});}
  addRack(sourceId){return this.transact(doc=>{const source=doc.racks.find(r=>r.id===sourceId),row=doc.rows.find(r=>r.id===(source?.rowId||doc.rows[0].id));const used=new Set(doc.racks.filter(r=>r.rowId===row.id).map(r=>r.position));let position=0;while(used.has(position)&&position<row.capacity)position++;if(position===row.capacity)throw new ConfigurationError([{code:'row-capacity',message:'此 Row 沒有可用機位'}]);const entityId=newId('rack');doc.racks.push({id:entityId,name:`R${String(position+1).padStart(2,'0')}`,purpose:source?.purpose||'Draft configuration',profileId:source?.profileId||doc.rackProfiles[0].id,rowId:row.id,position,positionMm:[(position-3.5)*1100,130,7000],inventoryState:source?'draft':'empty'});if(source)for(const e of doc.equipment.filter(e=>e.rackId===sourceId)){const copy=clone(e);copy.id=newId('eq');copy.deviceId=`${e.deviceId.slice(0,60)}-${copy.id.slice(-8)}`;copy.rackId=entityId;copy.children=childInstances(doc.catalog.find(m=>m.id===copy.modelId),copy.id);doc.equipment.push(copy);}return entityId;});}
  updateRack(entityId,patch){return this.transact(doc=>{const rack=doc.racks.find(r=>r.id===entityId);if(!rack)throw Error('機櫃不存在');for(const key of ['name','purpose','position','positionMm','profileId'])if(patch[key]!==undefined)rack[key]=clone(patch[key]);});}
  removeRack(entityId){return this.transact(doc=>{doc.racks=doc.racks.filter(r=>r.id!==entityId);doc.equipment=doc.equipment.filter(e=>e.rackId!==entityId);});}
  updateProfile(profileId,patch){return this.transact(doc=>{const p=doc.rackProfiles.find(p=>p.id===profileId);if(!p)throw Error('Profile 不存在');Object.assign(p,clone(patch));p.specificationState='draft';p.evidence={source:'User edited draft profile',status:'unverified'};});}
  addModel(model){return this.transact(doc=>{doc.catalog.push(clone(model));return model.id;});}
}
