import {buildLayout,normalizeFacility} from '../domain/facility.js';
const $=id=>document.getElementById(id);
export class FacilityEditor {
  constructor(store,{go,toast,hqView}){this.store=store;this.go=go;this.toast=toast;this.hqView=hqView;
    $('facilityBtn').onclick=()=>{$('facilityPanel').hidden=!$('facilityPanel').hidden;this.render();};$('closeFacility').onclick=()=>$('facilityPanel').hidden=true;
    $('layoutForm').onsubmit=e=>{e.preventDefault();try{const next=buildLayout(store.document,{rows:Number($('layoutRows').value),totalRacks:Number($('layoutCount').value),aisleMm:Number($('layoutAisle').value),pitchMm:Number($('layoutPitch').value)});store.commit(next);go(2,{rackId:null,rowId:null,hallId:next.rows[0].hallId});toast('Draft Hall 配置已驗證並儲存；現場硬體不受影響。');}catch(error){$('facilityError').textContent=error.message;}};
    $('rackPlacementForm').onsubmit=e=>{e.preventDefault();try{store.updateRack($('facilityRack').value,{rowId:$('facilityRow').value,position:Number($('facilitySlot').value),positionMm:['X','Y','Z'].map(axis=>Number($('rack'+axis).value))});toast('Rack 安裝座標已儲存');}catch(error){$('facilityError').textContent=error.message;}};
    $('facilityRack').onchange=()=>this.fillRack();
    document.querySelectorAll('[data-hq-angle]').forEach(b=>b.onclick=()=>hqView(b.dataset.hqAngle));
    this.render();
  }
  fillRack(){const r=this.store.document.racks.find(r=>r.id===$('facilityRack').value);if(!r)return;$('facilityRow').value=r.rowId;$('facilitySlot').value=r.position;['X','Y','Z'].forEach((axis,i)=>$('rack'+axis).value=r.positionMm[i]);}
  render(){const doc=this.store.document,selected=$('facilityRack').value;$('facilityError').textContent='';
    for(const [id,items] of [['facilityRack',doc.racks],['facilityRow',doc.rows]])$(id).replaceChildren(...items.map(r=>{const o=document.createElement('option');o.value=r.id;o.textContent=r.name;return o;}));
    if(doc.racks.some(r=>r.id===selected))$('facilityRack').value=selected;this.fillRack();
    $('facilityTree').replaceChildren();for(const hall of normalizeFacility(doc).halls){const h=document.createElement('button');h.textContent=hall.name;h.dataset.hallId=hall.id;h.onclick=()=>this.go(2,{hallId:hall.id,rowId:null,rackId:null});$('facilityTree').append(h);for(const row of doc.rows.filter(r=>r.hallId===hall.id)){const b=document.createElement('button');b.className='row-link';b.textContent=`${row.name} · ${doc.racks.filter(r=>r.rowId===row.id).length} Rack`;b.dataset.rowId=row.id;b.onclick=()=>this.go(3,{hallId:hall.id,rowId:row.id,rackId:null});$('facilityTree').append(b);}}
  }
}
