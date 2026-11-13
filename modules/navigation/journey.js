// A semantic path independent of zoom, camera pose, DOM or mesh array order.
export const STAGES=Object.freeze(['hq','interior','hall','row','rack','system','board','component']);
export class NavigationUnavailable extends Error {constructor(message,depth){super(message);this.name='NavigationUnavailable';this.depth=depth;}}
export function resolveJourney(doc,current,requested,selection={}){
  const depth=Math.max(0,Math.min(7,Math.round(requested))),next={...current,...selection,depth};
  if(selection.hallId&&selection.hallId!==current.hallId&&!selection.rackId){next.rowId=selection.rowId||null;next.rackId=null;next.equipmentId=null;}
  if(selection.rowId&&selection.rowId!==current.rowId&&!selection.rackId){next.rackId=null;next.equipmentId=null;}
  if(selection.rackId){const selected=doc.racks.find(r=>r.id===selection.rackId),row=doc.rows.find(r=>r.id===selected?.rowId);if(row){next.rowId=row.id;next.hallId=row.hallId;}if(selection.rackId!==current.rackId){next.equipmentId=selection.equipmentId||null;next.boardKey=null;next.componentKey=null;}}
  if(next.hallId&&!doc.rows.some(r=>r.hallId===next.hallId)&&!doc.facility?.halls?.some(h=>h.id===next.hallId))next.hallId=null;
  if(selection.equipmentId&&selection.equipmentId!==current.equipmentId){next.boardKey=selection.boardKey||null;next.componentKey=selection.componentKey||null;}
  let chosenRow=doc.rows.find(r=>r.id===next.rowId&&(!next.hallId||r.hallId===next.hallId))||doc.rows.find(r=>!next.hallId||r.hallId===next.hallId);
  if(depth>=3&&!chosenRow)throw new NavigationUnavailable('此 Hall 尚無 Row；請先配置機櫃列。',2);
  let rack=doc.racks.find(r=>r.id===next.rackId);if(!rack&&depth>=4){rack=doc.racks.find(r=>r.rowId===chosenRow?.id);next.rackId=rack?.id;}
  if(depth>=4&&!rack)throw new NavigationUnavailable('此 Row 沒有機櫃；請先新增機櫃。',3);
  let equipment=doc.equipment.find(e=>e.id===next.equipmentId&&e.rackId===rack?.id);
  if(depth>=5&&!equipment){equipment=doc.equipment.find(e=>e.rackId===rack.id&&doc.catalog.find(m=>m.id===e.modelId)?.internalAsset)||doc.equipment.find(e=>e.rackId===rack.id);next.equipmentId=equipment?.id;}
  if(depth>=5&&!equipment)throw new NavigationUnavailable('此機櫃尚無設備；新增設備後即可深入。',4);
  const model=doc.catalog.find(m=>m.id===equipment?.modelId);
  if(depth>=6&&!model?.internalAsset)throw new NavigationUnavailable('此型號尚無 Tray / Board 與 Component 資產。可配置外形與安裝位置；未虛構內部零件。',5);
  let board=model?.childDefinitions?.find(c=>c.kind==='board'&&c.key===next.boardKey);
  if(depth>=6&&!board){board=model.childDefinitions?.find(c=>c.kind==='board');next.boardKey=board?.key;}
  if(depth>=6&&!board)throw new NavigationUnavailable('此型號未提供可識別的 Tray / Board。',5);
  let component=model?.childDefinitions?.find(c=>c.kind==='component'&&c.key===next.componentKey&&c.boardIndex===board?.boardIndex);
  if(depth>=7&&!component){component=model.childDefinitions.find(c=>c.kind==='component'&&c.boardIndex===board.boardIndex);next.componentKey=component?.key;}
  if(depth>=7&&!component)throw new NavigationUnavailable('此 Board 沒有可識別的 Component 資產。',6);
  const row=doc.rows.find(r=>r.id===rack?.rowId)||chosenRow;next.rowId=row?.id;next.hallId=row?.hallId||next.hallId||doc.facility?.halls?.[0]?.id;
  const ids=[doc.site.id,`${doc.site.id}::interior`,next.hallId,row?.id,rack?.id,equipment?.id,equipment?.children.find(c=>c.definitionKey===board?.key)?.id,equipment?.children.find(c=>c.definitionKey===component?.key)?.id];
  next.path=ids.slice(0,depth+1).map((id,index)=>({stage:STAGES[index],entityId:id}));return next;
}
