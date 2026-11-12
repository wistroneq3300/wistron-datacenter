import {clone,newId,childInstances,validateConfiguration} from '../domain/configuration.js';
const $=id=>document.getElementById(id);
const label={system:'System',switch:'Switch',powerShelf:'Power Shelf'};
const option=(value,text)=>{const o=document.createElement('option');o.value=value;o.textContent=text;return o;};

export class EquipmentEditor {
  constructor(store,{toast,onSelect,onInspect,onExtract,onRackRemoved}){
    Object.assign(this,{store,toast,onSelect,onInspect,onExtract,onRackRemoved});this.rackId=null;this.editId=null;this.selectedId=null;
    const aside=document.createElement('section');aside.id='equipmentEditor';aside.className='equipment-editor';aside.hidden=true;aside.setAttribute('aria-label','編輯設備');
    aside.innerHTML=`<header><div><span class="eyebrow">EQUIPMENT CONFIGURATION</span><h2 id="equipmentHeading">新增設備</h2></div><button id="cancelEquipment" class="iconBtn" aria-label="關閉設備編輯">×</button></header>
    <p class="draft-note">Draft · 視覺外形與使用者尺寸，未經 OEM 驗證。</p>
    <form id="equipmentForm"><label class="field">類型<select id="eqKind"><option value="system">System</option><option value="switch">Switch</option><option value="powerShelf">Power Shelf</option></select></label>
    <label class="field">Catalog 型號<select id="eqModel"></select></label><label class="field">型號名稱<input id="eqModelName" maxlength="120" required></label>
    <label class="field">設備名稱<input id="eqName" maxlength="120" required></label><label class="field">唯一設備 ID<input id="eqDeviceId" maxlength="96" required></label>
    <label class="field">機櫃<select id="eqRack"></select></label><div class="field-grid three"><label class="field">寬 mm<input id="eqWidth" type="number" min="0.001" step="any" required></label><label class="field">高 mm<input id="eqHeight" type="number" min="0.001" step="any" required></label><label class="field">深 mm<input id="eqDepth" type="number" min="0.001" step="any" required></label></div>
    <div class="field-grid"><label class="field">安裝方式<select id="eqMode"><option value="grid">U 位</option><option value="xyz">實際座標</option></select></label><label class="field">安裝面<select id="eqFace"><option value="front">正面</option><option value="rear">背面</option></select></label></div>
    <div id="gridFields" class="field-grid"><label class="field">起始 U（由下往上）<input id="eqStart" type="number" min="1" step="0.5"></label><label class="field">占用 U 數<input id="eqSpan" type="number" min="0.5" step="0.5"></label></div>
    <p id="coordinateHint" class="field-hint">U 位偏移 mm：X 左右、Y 上下、Z 前後。</p><div class="field-grid three"><label class="field">X mm<input id="eqX" type="number" step="any" required></label><label class="field">Y mm<input id="eqY" type="number" step="any" required></label><label class="field">Z mm<input id="eqZ" type="number" step="any" required></label></div>
    <label class="field">水平旋轉 °<input id="eqYaw" type="number" min="-180" max="180" step="any" value="0" required></label>
    <p id="equipmentError" class="form-error" role="alert"></p><div class="form-actions"><button id="saveEquipment" class="primary" type="submit">儲存設備</button><button id="deleteEquipment" class="textDanger" type="button">移除設備</button></div><p id="entityIdentity" class="identity-note"></p></form>`;
    $('scene').append(aside);
    $('equipmentForm').onsubmit=e=>{e.preventDefault();this.save();};$('cancelEquipment').onclick=()=>this.close();
    $('eqKind').onchange=()=>this.models();$('eqModel').onchange=()=>this.modelDefaults();$('eqMode').onchange=()=>this.modeFields();
    $('deleteEquipment').onclick=()=>this.action(()=>{this.store.removeEquipment(this.editId);this.selectedId=null;this.close();this.render();this.toast('設備已移除並儲存');});
    $('addEquipment').onclick=()=>this.open();
    $('profileForm').onsubmit=e=>{e.preventDefault();this.action(()=>{const rack=this.rack();this.store.updateProfile(rack.profileId,{capacity:+$('profileCapacity').value,grid:$('profileGrid').value,pitchMm:$('profileGrid').value==='RU'?44.45:48,usableWidthMm:+$('profileWidth').value,usableDepthMm:+$('profileDepth').value});this.toast('Profile 已儲存；規格仍為 Draft');});};
    $('removeRack').onclick=()=>this.action(()=>{const id=this.rackId;this.store.removeRack(id);this.close();this.onRackRemoved(id);});
    $('renameRack').onchange=()=>this.action(()=>this.store.updateRack(this.rackId,{name:$('renameRack').value.trim()}));
    $('rackPurpose').onchange=()=>this.action(()=>this.store.updateRack(this.rackId,{purpose:$('rackPurpose').value.trim()}));
  }
  action(fn){try{fn();$('profileError').textContent='';}catch(e){$('profileError').textContent=e.message;this.toast(e.message);this.render();}}
  rack(){return this.store.document.racks.find(r=>r.id===this.rackId);}
  show(rackId){this.rackId=rackId;$('rackInspector').hidden=false;this.render();}
  hide(){this.close();$('rackInspector').hidden=true;}
  render(){
    const rack=this.rack();if(!rack){this.hide();return;}
    const doc=this.store.document,profile=doc.rackProfiles.find(p=>p.id===rack.profileId),equipment=doc.equipment.filter(e=>e.rackId===rack.id);
    $('rackName').textContent=rack.name;$('renameRack').value=rack.name;$('rackPurpose').value=rack.purpose;$('rackNodes').textContent=equipment.length;
    document.querySelector('.rackHeight').textContent=`${profile.capacity} ${profile.grid}`;$('rackState').textContent=rack.inventoryState==='not-provided'?'舊資料未提供設備清單':'Draft · 規格尚未驗證';
    $('rackIdentity').textContent=`Entity ID: ${rack.id}`;
    $('profileCapacity').value=profile.capacity;$('profileGrid').value=profile.grid;$('profileWidth').value=profile.usableWidthMm;$('profileDepth').value=profile.usableDepthMm;
    const list=$('equipmentList');list.replaceChildren();
    for(const e of equipment.slice().sort((a,b)=>(b.placement.start||0)-(a.placement.start||0))){
      const m=doc.catalog.find(m=>m.id===e.modelId),row=document.createElement('div');row.className='equipment-row';row.dataset.entityId=e.id;row.classList.toggle('selected',this.selectedId===e.id);
      const select=document.createElement('button');select.className='equipment-select';select.title=e.deviceId;select.dataset.selectEquipment=e.id;
      const name=document.createElement('strong');name.textContent=e.name;const detail=document.createElement('small');detail.textContent=`${label[m.kind]} · ${e.placement.mode==='grid'?`${profile.grid} ${e.placement.start} / ${e.placement.span}U`:'XYZ'} · ${e.placement.face==='rear'?'背面':'正面'}`;select.append(name,detail);select.onclick=()=>{this.selectedId=e.id;this.onSelect(e.id);this.render();};
      const edit=document.createElement('button');edit.className='edit-equipment';edit.textContent='編輯';edit.setAttribute('aria-label',`編輯 ${e.name}`);edit.onclick=()=>this.open(e.id);
      row.append(select,edit);list.append(row);
    }
    if(!equipment.length){const p=document.createElement('p');p.className='empty-note';p.textContent='此機櫃沒有設備。新增 System、Switch 或 Power Shelf 開始配置。';list.append(p);}
    const selected=equipment.find(e=>e.id===this.selectedId);$('selectionTools').hidden=!selected;
    if(selected){$('selectedEquipmentName').textContent=selected.name;$('extractEquipment').onclick=()=>this.onExtract(selected.id);$('inspectEquipment').onclick=()=>this.onInspect(selected.id);$('editSelectedEquipment').onclick=()=>this.open(selected.id);}
  }
  select(id){this.selectedId=id;this.render();}
  models(preferred){const models=this.store.document.catalog.filter(m=>m.kind===$('eqKind').value);$('eqModel').replaceChildren(...models.map(m=>option(m.id,m.name)));if(preferred)$('eqModel').value=preferred;this.modelDefaults();}
  modelDefaults(){const m=this.store.document.catalog.find(m=>m.id===$('eqModel').value);if(!m)return;$('eqModelName').value=m.name;$('eqWidth').value=m.dimensionsMm.width;$('eqHeight').value=m.dimensionsMm.height;$('eqDepth').value=m.dimensionsMm.depth;$('eqSpan').value=m.span;if(!this.editId)$('eqName').value=label[m.kind];}
  modeFields(){const grid=$('eqMode').value==='grid';$('gridFields').hidden=!grid;$('coordinateHint').textContent=grid?'U 位偏移 mm：X 左右、Y 上下、Z 前後。':'安裝原點 mm：X / Z 相對機櫃中心；Y 從可用安裝區底部量起。';}
  open(id=null){
    this.editId=id;const doc=this.store.document,e=doc.equipment.find(e=>e.id===id),model=doc.catalog.find(m=>m.id===e?.modelId)||doc.catalog[0];
    $('equipmentHeading').textContent=e?'編輯設備':'新增設備';$('equipmentError').textContent='';$('eqKind').value=model.kind;this.models(model.id);
    $('eqRack').replaceChildren(...doc.racks.map(r=>option(r.id,r.name)));$('eqRack').value=e?.rackId||this.rackId;
    $('eqName').value=e?.name||label[model.kind];$('eqDeviceId').value=e?.deviceId||newId('device').slice(0,20);
    for(const [field,key] of [['eqWidth','width'],['eqHeight','height'],['eqDepth','depth']])$(field).value=(e?.dimensionsMm||model.dimensionsMm)[key];
    $('eqMode').value=e?.placement.mode||'grid';$('eqFace').value=e?.placement.face||'front';$('eqSpan').value=e?.placement.span||model.span;$('eqYaw').value=e?.placement.yawDeg||0;
    let start=1;if(!e){const occupied=doc.equipment.filter(e=>e.rackId===this.rackId&&e.placement.mode==='grid');while(occupied.some(e=>start>=e.placement.start&&start<e.placement.start+e.placement.span))start++;}
    $('eqStart').value=e?.placement.start||start;const xyz=e?.placement.mode==='xyz'?e.placement.positionMm:e?.placement.offsetMm||[0,0,0];['eqX','eqY','eqZ'].forEach((key,i)=>$(key).value=xyz[i]);
    $('deleteEquipment').hidden=!e;$('entityIdentity').textContent=e?`Stable Entity ID: ${e.id}`:'Entity ID 於建立時產生；修改名稱或安裝位置不會變更。';
    this.modeFields();$('equipmentEditor').hidden=false;$('eqName').focus();
  }
  close(){$('equipmentEditor').hidden=true;this.editId=null;}
  save(){
    try{
      const doc=this.store.document,profile=doc.rackProfiles.find(p=>p.id===doc.racks.find(r=>r.id===$('eqRack').value).profileId);
      const mode=$('eqMode').value,xyz=['eqX','eqY','eqZ'].map(k=>+$(k).value),placement={mode,face:$('eqFace').value,yawDeg:+$('eqYaw').value};
      if(mode==='grid')Object.assign(placement,{grid:profile.grid,start:+$('eqStart').value,span:+$('eqSpan').value,offsetMm:xyz});else placement.positionMm=xyz;
      const patch={name:$('eqName').value.trim(),deviceId:$('eqDeviceId').value.trim(),rackId:$('eqRack').value,modelId:$('eqModel').value,dimensionsMm:{width:+$('eqWidth').value,height:+$('eqHeight').value,depth:+$('eqDepth').value},placement};
      let entityId=this.editId||newId('eq');
      this.store.transact(next=>{
        let model=next.catalog.find(m=>m.id===patch.modelId);
        if($('eqModelName').value.trim()!==model.name){model=clone(model);model.id=newId('model');model.name=$('eqModelName').value.trim();model.revision='user-draft';model.specificationState='draft';model.evidence={status:'unverified',source:'User named catalog derivative of PA authored geometry'};next.catalog.push(model);patch.modelId=model.id;}
        const old=next.equipment.find(e=>e.id===entityId);
        if(old){const changedModel=old.modelId!==patch.modelId;Object.assign(old,patch);if(changedModel)old.children=childInstances(model,entityId);}
        else next.equipment.push({id:entityId,...patch,children:childInstances(model,entityId)});
      });
      this.rackId=patch.rackId;this.selectedId=entityId;this.close();this.render();this.toast('設備已驗證配置邊界並儲存 · OEM 規格仍為 Draft');
    }catch(e){$('equipmentError').textContent=e.message;}
  }
}
