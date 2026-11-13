import {InventoryAdapter,assertSafeData,ENTITY_KINDS,isId,clone} from './contracts.js';

export class ConfigInventoryAdapter extends InventoryAdapter {
  constructor(documentOrGetter){super();this.getConfiguration=typeof documentOrGetter==='function'?documentOrGetter:()=>documentOrGetter;this.provider='configuration';this.mode='configuration';}
  async getInventory({signal}={}){if(signal?.aborted)throw new DOMException('Aborted','AbortError');return configurationInventory(this.getConfiguration());}
}

export function configurationInventory(doc){
  const entities=[],add=entity=>entities.push(entity),siteId=doc.site.id;
  add({id:siteId,kind:'site',name:doc.site.name,parentId:null});add({id:`${siteId}::interior`,kind:'interior',name:'Building Interior',parentId:siteId});
  const halls=new Map((doc.facility?.halls||[]).map(hall=>[hall.id,hall]));for(const row of doc.rows)if(!halls.has(row.hallId))halls.set(row.hallId,{id:row.hallId,name:'Data Center Hall'});
  for(const hall of halls.values())add({id:hall.id,kind:'hall',name:hall.name,parentId:`${siteId}::interior`});
  for(const row of doc.rows)add({id:row.id,kind:'row',name:row.name,parentId:row.hallId,hallId:row.hallId});
  for(const rack of doc.racks){const row=doc.rows.find(row=>row.id===rack.rowId);add({id:rack.id,kind:'rack',name:rack.name,parentId:rack.rowId,rackId:rack.id,rowId:rack.rowId,hallId:row?.hallId});}
  for(const equipment of doc.equipment){
    const model=doc.catalog.find(model=>model.id===equipment.modelId),rack=doc.racks.find(rack=>rack.id===equipment.rackId),row=doc.rows.find(row=>row.id===rack?.rowId);
    const context={rackId:equipment.rackId,systemId:equipment.id,rowId:rack?.rowId,hallId:row?.hallId};
    add({id:equipment.id,kind:model.kind,name:equipment.name,parentId:equipment.rackId,modelId:equipment.modelId,deviceId:equipment.deviceId,...context});
    for(const child of equipment.children){const definition=model.childDefinitions.find(def=>def.key===child.definitionKey);if(!definition)continue;const boardDef=model.childDefinitions.find(def=>def.kind==='board'&&def.boardIndex===definition.boardIndex),board=equipment.children.find(c=>c.definitionKey===boardDef?.key);add({id:child.id,kind:definition.kind,name:definition.label,parentId:definition.kind==='component'?board?.id||equipment.id:equipment.id,boardId:board?.id,definitionKey:definition.key,...context});}
  }
  return{provider:'configuration',mode:'configuration',revision:doc.revision,entities,nodes:[],bindings:[]};
}

const mappingKey=(provider,kind,id)=>JSON.stringify([provider,kind,id]);
const ip=value=>/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)||/^\[?[0-9a-f]*:[0-9a-f:]+\]?$/i.test(value);
export class IdentityMappingService {
  constructor(){this.bindings=new Map();this.entities=new Map();this.pending=[];}
  reconcile(entities,bindings=[]){
    const next=entities instanceof Map?new Map(entities):new Map(entities.map(entity=>[entity.id,clone(entity)])),mapped=new Map(),pending=[];
    for(const binding of bindings){
      assertSafeData(binding);if(!binding||typeof binding.provider!=='string'||!binding.provider||!ENTITY_KINDS.includes(binding.externalKind)||typeof binding.externalId!=='string'||!binding.externalId||binding.externalId.length>180||ip(binding.externalId)||!isId(binding.entityId))throw Error('Invalid explicit identity binding');
      const key=mappingKey(binding.provider,binding.externalKind,binding.externalId);
      if(mapped.has(key)&&mapped.get(key).entityId!==binding.entityId)throw Error('Ambiguous external identity mapping');
      if(!next.has(binding.entityId)){pending.push({...clone(binding),reason:'entity-not-in-inventory'});continue;}
      mapped.set(key,Object.freeze({...clone(binding)}));
    }
    this.entities=next;this.bindings=mapped;this.pending=pending;return this;
  }
  resolve({provider,externalKind,externalId,entityId}){
    const mapped=externalId!==undefined?this.bindings.get(mappingKey(provider,externalKind,externalId))?.entityId:null;
    if(externalId!==undefined&&!mapped)return null;
    if(entityId&&mapped&&entityId!==mapped)return null;
    if(entityId&&this.entities.has(entityId))return entityId;
    return mapped||null;
  }
  bindingsFor(entityId){return[...this.bindings.values()].filter(binding=>binding.entityId===entityId).map(clone);}
}

export function mergeInventory(configuration,inventory={}){
  assertSafeData(inventory);const entities=new Map(configuration.entities.map(entity=>[entity.id,Object.freeze(clone(entity))])),pending=[];
  for(const node of inventory.nodes||[]){
    if(!node||!isId(node.id)||node.kind!=='node'||!isId(node.systemId||node.parentId))throw Error('Invalid provider node inventory');
    const parent=entities.get(node.systemId||node.parentId);
    if(!parent||parent.kind!=='system'){pending.push({...clone(node),reason:'system-not-in-configuration'});continue;}
    if(entities.has(node.id))throw Error('Provider node ID conflicts with configured inventory');
    if(node.rackId&&node.rackId!==parent.rackId)pending.push({id:node.id,reason:'provider-location-differs-from-configuration'});
    const board=node.boardId&&entities.get(node.boardId);if(node.boardId&&(!board||board.kind!=='board'||board.systemId!==parent.id)){pending.push({...clone(node),reason:'board-not-in-system'});continue;}
    entities.set(node.id,Object.freeze({id:node.id,name:typeof node.name==='string'?node.name:node.id,kind:'node',parentId:parent.id,systemId:parent.id,rackId:parent.rackId,rowId:parent.rowId,hallId:parent.hallId,boardId:node.boardId||null,demo:inventory.mode==='mock'||node.demo===true}));
  }
  return{entities,pending};
}
