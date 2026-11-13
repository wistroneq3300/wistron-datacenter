// Facility configuration is millimetres, independent of Three and telemetry.
// PA envelope is measured from pinned f484253a authored geometry, not OEM CAD.
export const PA_FRAME_BOUNDS = Object.freeze({min:Object.freeze([-2.28,-7.78,-3.875]),max:Object.freeze([2.28,7.79,3.296])});
const finite=n=>typeof n==='number'&&Number.isFinite(n),vector=v=>Array.isArray(v)&&v.length===3&&v.every(finite);
const identity=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(v);
const label=v=>typeof v==='string'&&v.trim().length>0&&v.length<=120;
const epsilon=.001;
const copy=v=>structuredClone(v);
const draftEvidence=()=>({source:'Synthetic planning layout; PA visual envelope at standard pitch. Not a surveyed Wistron facility or OEM installation.',status:'unverified'});

export function rackEnvelopeMm(rack,profile){
  if(!profile||!vector(rack?.positionMm)||!finite(profile.pitchMm)||!finite(profile.capacity))return null;
  const unit=profile.pitchMm/.3,scale=[unit*.688,unit*(profile.capacity*.3+1.18)/(48*.3+1.18),unit*.802];
  const origin=[...rack.positionMm];origin[1]+=(profile.capacity*.3/2+.59)*unit;
  // Closed door hinge and handle extend beyond the pinned frame mesh.
  const min=[-2.32,PA_FRAME_BOUNDS.min[1],PA_FRAME_BOUNDS.min[2]].map((n,i)=>origin[i]+n*scale[i]);
  const max=[PA_FRAME_BOUNDS.max[0],PA_FRAME_BOUNDS.max[1],3.52].map((n,i)=>origin[i]+n*scale[i]);
  return {min,max,center:min.map((n,i)=>(n+max[i])/2),size:min.map((n,i)=>max[i]-n),status:'draft'};
}

function rackBoxes(doc,racks=doc.racks||[]){return racks.map(rack=>({rack,box:rackEnvelopeMm(rack,doc.rackProfiles?.find(p=>p.id===rack.profileId))})).filter(e=>e.box);}
function combined(boxes){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const box of boxes)for(let i=0;i<3;i++){min[i]=Math.min(min[i],box.min[i]);max[i]=Math.max(max[i],box.max[i]);}
  return {min,max};
}
function defaultHall(doc,hallId,index){
  const rowIds=new Set((doc.rows||[]).filter(r=>r.hallId===hallId).map(r=>r.id));
  const boxes=rackBoxes(doc,(doc.racks||[]).filter(r=>rowIds.has(r.rowId))).map(e=>e.box);
  const extent=boxes.length?combined(boxes):{min:[-4000,0,-4000],max:[4000,2400,7000]};
  const min=[Math.floor((extent.min[0]-2000)/600)*600,Math.min(0,Math.floor(extent.min[1]/100)),Math.floor((extent.min[2]-2200)/600)*600];
  const max=[Math.ceil((extent.max[0]+2000)/600)*600,0,Math.ceil((extent.max[2]+2200)/600)*600];
  if(max[0]-min[0]<7200){const center=(max[0]+min[0])/2;min[0]=center-3600;max[0]=center+3600;}
  if(max[2]-min[2]<12000)min[2]=max[2]-12000;
  const ceilingHeightMm=Math.max(4200,Math.ceil((extent.max[1]-min[1]+1500)/600)*600);max[1]=min[1]+ceilingHeightMm;
  return {id:hallId,name:`Data Center Hall ${index+1} · Draft`,boundsMm:{min,max},ceilingHeightMm,status:'draft',evidence:draftEvidence(),infrastructure:[]};
}

// Reading a legacy document does not mutate it or silently persist new fields.
export function normalizeFacility(doc){
  if(doc.facility!==undefined)return copy(doc.facility);
  const ids=[...new Set((doc.rows||[]).map(r=>r.hallId).filter(identity))];
  return {halls:(ids.length?ids:['hall-1']).map((id,i)=>defaultHall(doc,id,i))};
}

const intersects=(a,b)=>[0,1,2].every(i=>a.min[i]<b.max[i]-epsilon&&b.min[i]<a.max[i]-epsilon);
const contains=(outer,inner)=>[0,1,2].every(i=>inner.min[i]>=outer.min[i]-epsilon&&inner.max[i]<=outer.max[i]+epsilon);
export function validateFacility(doc){
  const errors=[],warnings=[],add=(code,message,entityId,conflictsWith)=>errors.push({code,message,entityId,conflictsWith});
  if(doc.facility===undefined)return {valid:true,errors,warnings};
  const facility=doc.facility;
  if(!facility||typeof facility!=='object'||Array.isArray(facility)||!Array.isArray(facility.halls)||!facility.halls.length||facility.halls.length>16){add('facility','Facility 必須包含 1–16 個 Hall');return{valid:false,errors,warnings};}
  if(Object.keys(facility).some(k=>k!=='halls'))add('facility-field','Facility 僅接受 halls 配置');
  const reserved=new Set([doc.site?.id,...['rows','racks','rackProfiles','catalog','equipment'].flatMap(k=>(doc[k]||[]).map(e=>e?.id)),...(doc.equipment||[]).flatMap(e=>(e.children||[]).map(c=>c.id))]);
  const hallIds=new Set(),validHalls=new Map(),infrastructure=[];
  for(const hall of facility.halls){
    if(!hall||!identity(hall.id)||reserved.has(hall.id)||hallIds.has(hall.id)){add('hall-id','Hall ID 無效或與其他實體重複',hall?.id);continue;}hallIds.add(hall.id);
    if(Object.keys(hall).some(k=>!['id','name','boundsMm','ceilingHeightMm','status','evidence','infrastructure'].includes(k)))add('hall-field','Hall 含不支援的欄位',hall.id);
    if(!label(hall.name)||hall.status!=='draft'||hall.evidence?.status!=='unverified'||typeof hall.evidence?.source!=='string'||!hall.evidence.source.trim()||hall.evidence.source.length>2000)add('hall-evidence','Hall 必須明示 Draft 與未驗證的場地來源',hall.id);
    const b=hall.boundsMm;
    if(!b||Object.keys(b).some(k=>!['min','max'].includes(k))||!vector(b.min)||!vector(b.max)||b.min.some((n,i)=>n>=b.max[i]||Math.abs(n)>1000000||Math.abs(b.max[i])>1000000)||!finite(hall.ceilingHeightMm)||hall.ceilingHeightMm<1000||hall.ceilingHeightMm>20000||Math.abs((b.max[1]-b.min[1])-hall.ceilingHeightMm)>epsilon){add('hall-bounds','Hall 邊界或天花板高度無效',hall.id);continue;}
    validHalls.set(hall.id,hall);warnings.push({code:'draft-hall',entityId:hall.id,message:'Draft：Hall 尺寸、走道及設施不是緯創現場測繪。'});
    if(!Array.isArray(hall.infrastructure)||hall.infrastructure.length>128){add('infrastructure','Hall infrastructure 必須是最多 128 筆的陣列',hall.id);continue;}
    for(const item of hall.infrastructure){
      if(!item||!identity(item.id)||reserved.has(item.id)||hallIds.has(item.id)){add('infrastructure-id','設施 ID 無效或重複',item?.id);continue;}reserved.add(item.id);
      if(Object.keys(item).some(k=>!['id','name','type','positionMm','sizeMm','status','evidence'].includes(k))||!label(item.name)||!['cooling','power'].includes(item.type)||!vector(item.positionMm)||!vector(item.sizeMm)||!item.sizeMm.every(n=>n>0&&n<=20000)||item.status!=='draft') {add('infrastructure','設施類型、Draft 標記或尺寸無效',item.id);continue;}
      const box={min:item.positionMm.map((n,i)=>n-(i===1?0:item.sizeMm[i]/2)),max:item.positionMm.map((n,i)=>n+(i===1?item.sizeMm[i]:item.sizeMm[i]/2))};
      if(!contains(b,box))add('infrastructure-boundary','設施超出 Hall 邊界',item.id,hall.id);
      infrastructure.push({id:item.id,hallId:hall.id,box});
    }
  }
  // IDs are checked after all halls too, so order cannot hide a collision.
  for(const item of infrastructure)if(hallIds.has(item.id))add('infrastructure-id','設施 ID 與 Hall 重複',item.id);
  const rows=new Map((doc.rows||[]).map(r=>[r.id,r]));
  for(const row of doc.rows||[])if(!hallIds.has(row.hallId))add('hall-reference','Row 參照不存在的 Hall',row.id,row.hallId);
  const boxes=rackBoxes(doc);
  for(const entry of boxes){
    const hallId=rows.get(entry.rack.rowId)?.hallId,hall=validHalls.get(hallId);
    if(hall&&!contains(hall.boundsMm,entry.box))add('rack-hall-boundary','Rack 外框超出 Hall 可用邊界',entry.rack.id,hallId);
    for(const item of infrastructure)if(item.hallId===hallId&&intersects(entry.box,item.box))add('rack-infrastructure-collision','Rack 外框與設施碰撞',entry.rack.id,item.id);
  }
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(intersects(boxes[i].box,boxes[j].box))add('rack-collision','Rack 實體外框互相碰撞',boxes[i].rack.id,boxes[j].rack.id);
  for(let i=0;i<infrastructure.length;i++)for(let j=i+1;j<infrastructure.length;j++)if(intersects(infrastructure[i].box,infrastructure[j].box))add('infrastructure-collision','設施實體外框互相碰撞',infrastructure[i].id,infrastructure[j].id);
  return {valid:errors.length===0,errors,warnings};
}

// Explicit planning operation. Retained racks and all their equipment keep IDs;
// newly added racks are empty. Removing a rack removes only its configuration.
export function buildLayout(doc,{rows=1,countPerRow,totalRacks,aisleMm=1600,pitchMm=1100}={}){
  if(!Number.isInteger(rows)||rows<1||rows>16)throw new RangeError('Row 數必須為 1–16');
  const total=totalRacks??rows*(countPerRow??8);
  if(!Number.isInteger(total)||total<1||total>128||total<rows)throw new RangeError('Rack 數必須為 Row 數至 128');
  if(countPerRow!==undefined&&(!Number.isInteger(countPerRow)||countPerRow<1||countPerRow>128||total>countPerRow*rows))throw new RangeError('每 Row 的 Rack 容量不足');
  if(!finite(pitchMm)||pitchMm<=0||pitchMm>20000||!finite(aisleMm)||aisleMm<600||aisleMm>10000)throw new RangeError('Draft Rack 間距與走道數值無效');
  const next=copy(doc),profiles=new Map(next.rackProfiles.map(p=>[p.id,p])),reference=next.racks[0];
  if(!profiles.size)throw new RangeError('必須先定義 Rack Profile');
  const sampleProfiles=reference?[profiles.get(reference.profileId),...next.racks.slice(1,total).map(r=>profiles.get(r.profileId))]:[next.rackProfiles[0]];
  const extents=sampleProfiles.map(p=>rackEnvelopeMm({positionMm:[0,0,0]},p));
  if(extents.some(b=>!b))throw new RangeError('Rack Profile 不存在');
  const width=Math.max(...extents.map(b=>b.size[0])),depth=Math.max(...extents.map(b=>b.size[2]));
  if(pitchMm<width-epsilon)throw new RangeError('Rack 間距小於實際模型外框寬度');
  const existingIds=new Set([next.site?.id,...['rows','racks','equipment','catalog','rackProfiles'].flatMap(k=>next[k].map(e=>e.id)),...(next.facility?.halls||[]).map(h=>h.id)]);
  const fresh=(prefix,index)=>{let candidate=`${prefix}-${index}`,n=1;while(existingIds.has(candidate))candidate=`${prefix}-${index}-${n++}`;existingIds.add(candidate);return candidate;};
  const hallId=next.rows[0]?.hallId||'hall-1',columns=countPerRow??Math.ceil(total/rows),oldRows=next.rows,oldRacks=next.racks;
  next.rows=[];next.racks=[];
  let cursor=0;
  for(let r=0;r<rows;r++){
    const remainingRows=rows-r,remaining=total-cursor,count=countPerRow?Math.min(columns,remaining-(remainingRows-1)):Math.ceil(remaining/remainingRows);
    const row={...(oldRows[r]||{}),id:oldRows[r]?.id||fresh('row',r+1),name:oldRows[r]?.name||`Row ${String.fromCharCode(65+r)}`,hallId,capacity:Math.max(count,oldRows[r]?.capacity||0)};next.rows.push(row);
    for(let c=0;c<count;c++){
      const old=oldRacks[cursor],rack=old?copy(old):{id:fresh('rack',cursor+1),name:`R${String(cursor+1).padStart(2,'0')}`,purpose:'Draft configurable hall; no observed inventory',profileId:reference?.profileId||next.rackProfiles[0].id,inventoryState:'empty'};
      rack.rowId=row.id;rack.position=c;rack.positionMm=[(c-(count-1)/2)*pitchMm,reference?.positionMm?.[1]??130,7000-r*(depth+aisleMm)];next.racks.push(rack);cursor++;
    }
  }
  const retained=new Set(next.racks.map(r=>r.id));next.equipment=next.equipment.filter(e=>retained.has(e.rackId));delete next.facility;
  next.facility=normalizeFacility(next);const hall=next.facility.halls[0];
  hall.evidence.source+=` Draft layout pitch ${pitchMm} mm, clear aisle ${aisleMm} mm; no OEM service-clearance certification.`;
  const [lo,hi]=[hall.boundsMm.min,hall.boundsMm.max],y=Math.min(...next.racks.map(r=>r.positionMm[1]));
  hall.infrastructure=[['cooling',lo[0]+650],['power',hi[0]-650]].map(([type,x],index)=>({id:fresh(type==='cooling'?'cdu':'pdu',index+1),name:type==='cooling'?'CDU · Draft':'Power distribution · Draft',type,positionMm:[x,y,lo[2]+1600],sizeMm:type==='cooling'?[900,2100,1000]:[800,2250,900],status:'draft',evidence:draftEvidence()}));
  const result=validateFacility(next);if(!result.valid)throw new Error(result.errors.map(e=>e.message).join('\n'));
  return next;
}
