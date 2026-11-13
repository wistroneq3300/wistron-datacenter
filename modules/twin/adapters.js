// Read-only transport boundary. No hardware controls or frontend credentials.
import {assertSafeData,normalizeEvent,safeLink,InventoryAdapter} from './contracts.js';
const copy=value=>structuredClone(value);
const aborted=signal=>{if(signal?.aborted)throw signal.reason||new DOMException('Aborted','AbortError');};
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(value,allowed,label)=>{if(!plain(value))throw new TypeError(`${label} must be an object`);for(const key of Object.keys(value))if(!allowed.includes(key))throw new TypeError(`${label}: unsupported field ${key}`);};
const iso=time=>new Date(time).toISOString();
const opaque=value=>typeof value==='string'&&value.length>0&&value.length<=200&&!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)&&!(value.includes(':')&&/^[a-f\d:]+$/i.test(value))&&/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
const normalizeArgs=(idsOrOptions,options)=>Array.isArray(idsOrOptions)?{ids:idsOrOptions,...options}:idsOrOptions||{};
const subscriptionArgs=(idsOrOptions,onEvent,onConnection)=>Array.isArray(idsOrOptions)?{ids:idsOrOptions,onEvent,onConnection}:idsOrOptions||{};
const abortError=()=>new DOMException('Aborted','AbortError');
const safeHealth=new Set(['healthy','warning','fail','recovering','unknown','offline','stale']);
const kinds=new Set(['rack','system','node','component','equipment','board','row','hall','site']);

function checkBindings(bindings,provider){
  if(!Array.isArray(bindings)||bindings.length>20000)throw new TypeError('Invalid inventory bindings');
  for(const b of bindings){keys(b,['provider','externalKind','externalId','entityId','mappingRevision'],'Binding');if(b.provider!==provider||!kinds.has(b.externalKind)||!opaque(b.externalId)||!opaque(b.entityId))throw new TypeError('Invalid identity binding');}
}
function rejectSensitive(value){assertSafeData(value);}
function checkEnvelope(data,provider,mode){
  if(!plain(data)||data.provider!==provider||data.mode!==mode)throw new TypeError('Adapter provider/mode mismatch');rejectSensitive(data);
}
function checkEvent(e,provider,mode,now){
  keys(e,['id','provider','mode','source','entityId','externalKind','externalId','sequence','observedAt','receivedAt','health','metrics','test','message','links','demo'],'Event');
  if(e.provider!==provider||e.mode!==mode||!opaque(e.id)||!opaque(e.externalId)||!kinds.has(e.externalKind)||typeof e.source!=='string'||!e.source.trim()||e.source.length>240||!Number.isFinite(Date.parse(e.observedAt))||e.entityId!==undefined&&!opaque(e.entityId)||e.sequence!==undefined&&(!Number.isSafeInteger(e.sequence)||e.sequence<0)||e.health!==undefined&&!safeHealth.has(String(e.health).toLowerCase())||e.metrics!==undefined&&!Array.isArray(e.metrics)||mode==='live'&&e.demo===true)throw new TypeError('Invalid read-only event contract');
  return copy(normalizeEvent(e,{now}));
}

export class MockAdapter extends InventoryAdapter {
  constructor(options){
    super();
    keys(options,['getConfiguration','clock','epochMs','staleAfterMs'],'MockAdapter options');
    if(typeof options.getConfiguration!=='function')throw new TypeError('getConfiguration callback is required');
    this.mode='mock';this.provider='MOCK';this.getConfiguration=options.getConfiguration;this.clock=options.clock||null;this.epochMs=options.epochMs??Date.UTC(2026,0,1,0,0,0);this.offsetMs=0;this.staleAfterMs=options.staleAfterMs??15000;
    if(!Number.isFinite(this.epochMs)||!Number.isFinite(this.staleAfterMs)||this.staleAfterMs<1||this.clock!==null&&typeof this.clock!=='function')throw new TypeError('Invalid deterministic clock');
    this.sequence=0;this.resetRevision=0;this.latest=new Map();this.history=[];this.subscriptions=new Set();this.connectionState='connected';this.disposed=false;
  }
  now(){return (this.clock?this.clock():this.epochMs)+this.offsetMs;}
  nowMs(){return this.now();}
  advance(ms){if(!Number.isFinite(ms)||ms<0||ms>86400000)throw new RangeError('Mock advance must be 0–86400000 ms');this.offsetMs+=ms;return this.now();}
  inventory(){
    const config=this.getConfiguration(),catalog=new Map(config.catalog.map(m=>[m.id,m])),rackIds=new Set(config.racks.map(r=>r.id));
    const entities=[...config.racks.map(r=>({id:r.id,name:r.name,kind:'rack',rackId:r.id})),...config.equipment.filter(e=>rackIds.has(e.rackId)).map(e=>({id:e.id,name:e.name,kind:catalog.get(e.modelId)?.kind==='system'?'system':'equipment',rackId:e.rackId}))];
    const nodes=[];
    for(const system of config.equipment.filter(e=>catalog.get(e.modelId)?.kind==='system'&&rackIds.has(e.rackId))){
      const defs=catalog.get(system.modelId).childDefinitions||[],boards=system.children.filter(c=>defs.some(d=>d.key===c.definitionKey&&d.kind==='board'));
      for(let index=0;index<2;index++)nodes.push({id:`${system.id}::node-${index}`,systemId:system.id,parentId:system.id,rackId:system.rackId,...(boards[index]?{boardId:boards[index].id}:{}),name:`DEMO Node ${index+1} · ${system.deviceId}`,kind:'node',demo:true});
    }
    entities.push(...nodes);
    return {provider:this.provider,mode:this.mode,observedAt:iso(this.now()),entities,nodes,bindings:entities.map(e=>({provider:this.provider,externalKind:e.kind,externalId:e.id,entityId:e.id,mappingRevision:'mock-v1'})),demo:true};
  }
  async getInventory({signal}={}){aborted(signal);if(this.connectionState==='disconnected')throw new Error('DEMO / MOCK transport is offline');return copy(this.inventory());}
  async getSnapshot(idsOrOptions={},options){const {ids,signal}=normalizeArgs(idsOrOptions,options);aborted(signal);if(this.connectionState==='disconnected')throw new Error('DEMO / MOCK transport is offline');const known=new Set(this.inventory().entities.map(e=>e.id));return{provider:this.provider,mode:this.mode,events:[...this.latest.values()].filter(e=>known.has(e.entityId)&&(!ids||ids.includes(e.entityId))).map(copy)};}
  async getTestStatus(idsOrOptions={},options){const snapshot=await this.getSnapshot(idsOrOptions,options);return{provider:this.provider,mode:this.mode,tests:snapshot.events.filter(e=>e.test).map(e=>({entityId:e.entityId,source:e.source,observedAt:e.observedAt,...copy(e.test)}))};}
  async getHealthEvents(idsOrOptions={},options){const {ids,signal}=normalizeArgs(idsOrOptions,options);aborted(signal);return{provider:this.provider,mode:this.mode,events:this.history.filter(e=>!ids||ids.includes(e.entityId)).map(copy)};}
  connection(state=this.connectionState,message='DEMO / MOCK monitoring only'){return{provider:this.provider,mode:this.mode,state,at:iso(this.now()),message,demo:true};}
  emitConnection(state,message){this.connectionState=state;const event=this.connection(state,message);for(const sub of this.subscriptions)sub.onConnection?.(copy(event));return event;}
  subscribe(idsOrOptions={},onEvent,onConnection){
    if(this.disposed)throw new Error('MockAdapter disposed');const options=subscriptionArgs(idsOrOptions,onEvent,onConnection);aborted(options.signal);
    const sub={ids:options.ids,onEvent:options.onEvent,onConnection:options.onConnection};this.subscriptions.add(sub);let closed=false;
    const unsubscribe=()=>{if(closed)return;closed=true;this.subscriptions.delete(sub);options.signal?.removeEventListener('abort',unsubscribe);};sub.unsubscribe=unsubscribe;options.signal?.addEventListener('abort',unsubscribe,{once:true});sub.onConnection?.(this.connection());return unsubscribe;
  }
  publish(event){
    const e=checkEvent(event,this.provider,this.mode,this.now()),previous=this.latest.get(e.entityId);
    if(!previous||Date.parse(e.observedAt)>Date.parse(previous.observedAt)||e.observedAt===previous.observedAt&&e.sequence>previous.sequence)this.latest.set(e.entityId,copy(e));
    this.history.push(copy(e));if(this.history.length>2048)this.history.shift();
    for(const sub of this.subscriptions)if(!sub.ids||sub.ids.includes(e.entityId))sub.onEvent?.(copy(e));return e;
  }
  event(entity,health,message){
    const sequence=++this.sequence,observedAt=iso(this.now());
    // Fixed demonstration values are not sensor readings, OEM thresholds or
    // an explanation of failure. Only logical DEMO Nodes receive these metrics.
    const sample={healthy:[47,62],warning:[74,83],fail:[84,97],recovering:[61,38]}[health];
    const metrics=entity.kind==='node'&&sample?[
      {name:'demo.node.temperature',value:sample[0],unit:'°C',quality:'synthetic'},
      {name:'demo.node.utilisation',value:sample[1],unit:'%',quality:'synthetic'},
    ]:[];
    return {id:`mock-event-${sequence}`,provider:this.provider,mode:this.mode,source:'MOCK / deterministic demonstration',entityId:entity.id,externalKind:entity.kind,externalId:entity.id,sequence,observedAt,receivedAt:observedAt,health,metrics,message,test:{id:`mock-test-${entity.id}`,name:'DEMO synthetic health check',status:health==='fail'?'FAIL':health==='warning'?'WARNING':health==='recovering'?'RUNNING':'PASS',updatedAt:observedAt},links:[],demo:true};
  }
  scenario(name,{systemId,nodeId}={}){
    if(this.disposed)throw new Error('MockAdapter disposed');
    const inventory=this.inventory(),system=inventory.entities.find(e=>e.id===systemId&&e.kind==='system')||(!systemId?inventory.entities.find(e=>e.kind==='system'):null);
    const node=inventory.nodes.find(n=>n.id===nodeId&&(!systemId||n.systemId===systemId))||(!nodeId?inventory.nodes.find(n=>n.systemId===system?.id):null),actualSystem=systemId?system:inventory.entities.find(e=>e.id===node?.systemId)||system;
    if(systemId&&!system||nodeId&&!node)throw new RangeError('Mock scenario target does not exist');
    const target={systemId:actualSystem?.id,nodeId:node?.id,rackId:node?.rackId||actualSystem?.rackId,boardId:node?.boardId},events=[];
    const emit=(entity,health,message)=>{if(!entity)throw new RangeError('No System / Node exists for this scenario');events.push(this.publish(this.event(entity,health,`DEMO / MOCK: ${message}`)));};
    if(['healthy','allHealthy'].includes(name)){this.advance(1000);this.emitConnection('connected');for(const e of inventory.entities)emit(e,'healthy','explicit synthetic baseline');}
    else if(['warning','warningSystem'].includes(name)){this.advance(1000);emit(actualSystem,'warning','System warning from synthetic test');}
    else if(['fail','failNode'].includes(name)){this.advance(1000);emit(node,'fail','Node failed synthetic test; no Component failure inference');}
    else if(['recovering','recoveringNode','recovery'].includes(name)){this.advance(1000);emit(actualSystem,'healthy','System warning cleared by explicit synthetic sample');emit(node,'recovering','Node recovery in progress');}
    else if(['recovered','recoveredNode'].includes(name)){this.advance(1000);emit(actualSystem,'healthy','System remains healthy');emit(node,'healthy','Node recovered by explicit synthetic sample');}
    else if(['disconnected','offline'].includes(name))this.emitConnection('disconnected','DEMO / MOCK simulated transport interruption');
    else if(name==='stale'){this.emitConnection('connected','DEMO / MOCK transport connected but samples paused');this.advance(this.staleAfterMs+1);}
    else if(['delayed','outOfOrder','duplicate'].includes(name)){
      if(!node)throw new RangeError('No Node exists for this scenario');const previous=this.latest.get(node.id);if(!previous)throw new Error('Run healthy or a Node scenario before delay/duplicate demonstration');
      const e=copy(previous);if(name!=='duplicate'){e.id=`mock-late-${++this.sequence}`;e.sequence=Math.max(0,previous.sequence-1);e.observedAt=iso(Date.parse(previous.observedAt)-5000);e.receivedAt=iso(this.now());e.health='fail';e.message='DEMO / MOCK intentionally late event; must not overwrite current state';}events.push(this.publish(e));
    }else if(name==='reconnect'){this.emitConnection('reconnecting','DEMO / MOCK reconnect');this.emitConnection('connected','DEMO / MOCK connected; historical data is not refreshed automatically');}
    else throw new RangeError(`Unknown Mock scenario: ${name}`);
    return{events,connection:this.connection(),now:this.now(),target};
  }
  async connect({signal}={}){aborted(signal);this.emitConnection('connected');return this.getInventory({signal});}
  disconnect(){return this.emitConnection('disconnected');}
  async reconnect(options={}){aborted(options.signal);this.emitConnection('reconnecting');return this.connect(options);}
  reset(){this.latest.clear();this.history=[];this.offsetMs=0;this.resetRevision++;this.emitConnection('connected','DEMO / MOCK reset: no observations');return{resetRevision:this.resetRevision,now:this.now()};}
  dispose(){if(this.disposed)return;this.disconnect();for(const sub of [...this.subscriptions])sub.unsubscribe();this.disposed=true;}
}

function routePath(value){
  if(typeof value!=='string'||value.length>512||!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(value))throw new TypeError('PA relay routes must be explicit same-origin paths without query, URL, credentials or traversal');return value;
}
const delay=(ms,signal)=>new Promise((resolve,reject)=>{aborted(signal);const timer=setTimeout(done,ms);function done(){signal?.removeEventListener('abort',cancel);resolve();}function cancel(){clearTimeout(timer);signal?.removeEventListener('abort',cancel);reject(signal.reason||abortError());}signal?.addEventListener('abort',cancel,{once:true});});

export class PAManagerAdapter extends InventoryAdapter {
  constructor(options){
    super();
    keys(options,['routes','fetchImpl','origin','pollIntervalMs','maxRetries','retryBaseMs','retryMaxMs','clock','sleep'],'PAManagerAdapter options');
    keys(options.routes,['inventory','snapshot','testStatus','healthEvents'],'PA relay routes');
    if(!options.routes.inventory||!options.routes.snapshot)throw new TypeError('Explicit inventory and snapshot relay routes are required; no real PA API is assumed');
    this.routes=Object.fromEntries(Object.entries(options.routes).map(([key,path])=>[key,routePath(path)]));
    const origin=new URL(options.origin||globalThis.location?.origin||'http://localhost');
    if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new TypeError('Invalid same-origin application origin');
    if(globalThis.location?.origin&&origin.origin!==globalThis.location.origin)throw new TypeError('PA relay must use the current application origin');
    this.origin=origin.origin;this.fetchImpl=options.fetchImpl||globalThis.fetch?.bind(globalThis);this.clock=options.clock||(()=>Date.now());this.sleep=options.sleep||delay;
    this.pollIntervalMs=options.pollIntervalMs??2000;this.maxRetries=options.maxRetries??2;this.retryBaseMs=options.retryBaseMs??250;this.retryMaxMs=options.retryMaxMs??4000;
    if(typeof this.fetchImpl!=='function'||typeof this.clock!=='function'||typeof this.sleep!=='function'||!Number.isFinite(this.pollIntervalMs)||this.pollIntervalMs<250||this.pollIntervalMs>60000||!Number.isInteger(this.maxRetries)||this.maxRetries<0||this.maxRetries>5||!Number.isFinite(this.retryBaseMs)||this.retryBaseMs<0||this.retryBaseMs>10000||!Number.isFinite(this.retryMaxMs)||this.retryMaxMs<this.retryBaseMs||this.retryMaxMs>60000)throw new TypeError('Invalid bounded polling/retry configuration');
    this.provider='PA_MANAGER';this.mode='live';this.connectionState='disconnected';this.subscriptions=new Set();this.controllers=new Set();this.disposed=false;
  }
  now(){return this.clock();}
  connection(state=this.connectionState,message='Read-only PA relay',attempt){return{provider:this.provider,mode:this.mode,state,at:iso(this.now()),message,...(attempt===undefined?{}:{attempt})};}
  emitConnection(state,message,attempt){this.connectionState=state;const event=this.connection(state,message,attempt);for(const sub of this.subscriptions)sub.onConnection?.(copy(event));return event;}
  async request(key,{ids,signal}={}){
    if(this.disposed)throw new Error('PAManagerAdapter disposed');aborted(signal);const route=this.routes[key];if(!route)throw new Error(`Pending PA relay contract: ${key} route is not configured`);
    if(ids!==undefined&&(!Array.isArray(ids)||ids.length>4096||!ids.every(opaque)))throw new TypeError('Invalid opaque entity IDs');
    const url=new URL(route,this.origin);if(ids?.length)url.searchParams.set('ids',ids.join(','));
    for(let attempt=0;attempt<=this.maxRetries;attempt++){
      aborted(signal);const controller=new AbortController(),cancel=()=>controller.abort(signal?.reason||abortError());signal?.addEventListener('abort',cancel,{once:true});this.controllers.add(controller);
      try{
        const response=await this.fetchImpl(url.href,{method:'GET',headers:{Accept:'application/json'},credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal});aborted(controller.signal);
        if(!response.ok){const error=new Error(`Read-only relay HTTP ${response.status}`);error.retryable=response.status===429||response.status>=500;throw error;}
        const length=Number(response.headers?.get?.('content-length')||0);if(length>4*1024*1024)throw new TypeError('Relay response exceeds 4 MiB');
        const text=await response.text();aborted(controller.signal);if(text.length>4*1024*1024)throw new TypeError('Relay response exceeds 4 MiB');const data=JSON.parse(text);checkEnvelope(data,this.provider,this.mode);return data;
      }catch(error){
        if(signal?.aborted||controller.signal.aborted||error.name==='AbortError')throw signal?.reason||error;
        const retryable=error.retryable===true||error.name==='TypeError'&&/^fetch failed|Failed to fetch|NetworkError|network/i.test(error.message);
        if(!retryable||attempt===this.maxRetries){this.emitConnection('disconnected',`Read-only relay unavailable (${error.retryable===undefined?'contract/network error':error.message})`);throw error;}
        this.emitConnection('reconnecting','Read-only relay retry',attempt+1);await this.sleep(Math.min(this.retryMaxMs,this.retryBaseMs*2**attempt),controller.signal);aborted(controller.signal);
      }finally{signal?.removeEventListener('abort',cancel);this.controllers.delete(controller);}
    }
  }
  async getInventory(options={}){
    const data=await this.request('inventory',options);keys(data,['provider','mode','observedAt','entities','nodes','bindings'],'Inventory response');if(!Array.isArray(data.nodes)||data.nodes.length>8192||data.entities!==undefined&&!Array.isArray(data.entities))throw new TypeError('Invalid inventory entities');checkBindings(data.bindings,this.provider);
    for(const n of data.nodes){keys(n,['id','systemId','parentId','rackId','boardId','name','kind'],'Node');if(n.kind!=='node'||!opaque(n.id)||!opaque(n.systemId||n.parentId)||!opaque(n.rackId)||n.boardId!==undefined&&!opaque(n.boardId)||typeof n.name!=='string'||n.name.length>240)throw new TypeError('Invalid inventory Node');}
    for(const e of data.entities||[]){keys(e,['id','name','kind','rackId','systemId','parentId','boardId'],'Inventory entity');if(!opaque(e.id)||!kinds.has(e.kind)||typeof e.name!=='string'||e.name.length>240)throw new TypeError('Invalid inventory entity');}
    this.emitConnection('connected');return copy(data);
  }
  async getSnapshot(idsOrOptions={},options){const data=await this.request('snapshot',normalizeArgs(idsOrOptions,options));keys(data,['provider','mode','observedAt','events'],'Snapshot response');if(!Array.isArray(data.events)||data.events.length>20000)throw new TypeError('Invalid snapshot events');const result={...data,events:data.events.map(e=>checkEvent(e,this.provider,this.mode,this.now()))};this.emitConnection('connected');return result;}
  async getTestStatus(idsOrOptions={},options){
    const args=normalizeArgs(idsOrOptions,options);if(!this.routes.testStatus){const data=await this.getSnapshot(args);return{provider:this.provider,mode:this.mode,tests:data.events.filter(e=>e.test).map(e=>({entityId:e.entityId,source:e.source,observedAt:e.observedAt,...copy(e.test)}))};}
    const data=await this.request('testStatus',args);keys(data,['provider','mode','observedAt','tests'],'Test response');if(!Array.isArray(data.tests)||data.tests.length>20000)throw new TypeError('Invalid test status response');
    for(const test of data.tests){keys(test,['entityId','source','observedAt','id','name','status','updatedAt','links'],'Test result');if(!opaque(test.entityId)||!opaque(test.id)||typeof test.name!=='string'||!test.name.trim()||test.name.length>240||typeof test.status!=='string'||!test.status.trim()||test.status.length>80||typeof test.source!=='string'||!test.source.trim()||!Number.isFinite(Date.parse(test.observedAt))||test.updatedAt!==undefined&&!Number.isFinite(Date.parse(test.updatedAt)))throw new TypeError('Invalid test status record');if(test.links!==undefined){if(!Array.isArray(test.links)||test.links.length>16)throw new TypeError('Invalid test trace links');test.links=test.links.map(safeLink);}}
    return copy(data);
  }
  async getHealthEvents(idsOrOptions={},options){const args=normalizeArgs(idsOrOptions,options),key=this.routes.healthEvents?'healthEvents':'snapshot',data=await this.request(key,args);keys(data,['provider','mode','observedAt','events'],'Health response');if(!Array.isArray(data.events)||data.events.length>20000)throw new TypeError('Invalid health history response');return{...data,events:data.events.map(e=>checkEvent(e,this.provider,this.mode,this.now()))};}
  subscribe(idsOrOptions={},onEvent,onConnection){
    if(this.disposed)throw new Error('PAManagerAdapter disposed');const options=subscriptionArgs(idsOrOptions,onEvent,onConnection);aborted(options.signal);
    const sub={onEvent:options.onEvent,onConnection:options.onConnection,controller:new AbortController(),timer:null,closed:false};this.subscriptions.add(sub);let failures=0;
    const unsubscribe=()=>{if(sub.closed)return;sub.closed=true;clearTimeout(sub.timer);sub.controller.abort();this.subscriptions.delete(sub);options.signal?.removeEventListener('abort',unsubscribe);};sub.unsubscribe=unsubscribe;options.signal?.addEventListener('abort',unsubscribe,{once:true});
    const poll=async()=>{
      if(sub.closed)return;
      try{const result=await this.getSnapshot({ids:options.ids,signal:sub.controller.signal});if(sub.closed)return;failures=0;this.emitConnection('connected');for(const event of result.events)sub.onEvent?.(event);}
      catch(error){if(sub.closed||error.name==='AbortError')return;failures++;if(failures>this.maxRetries){this.emitConnection('disconnected','Read-only polling stopped after bounded retries; explicit reconnect required');return;}this.emitConnection('reconnecting','Read-only polling will reconnect',failures);}
      if(!sub.closed){sub.timer=setTimeout(poll,this.pollIntervalMs);sub.timer.unref?.();}
    };
    sub.onConnection?.(this.connection());sub.timer=setTimeout(poll,0);sub.timer.unref?.();return unsubscribe;
  }
  async connect({signal}={}){this.emitConnection('reconnecting');const inventory=await this.getInventory({signal});this.emitConnection('connected');return inventory;}
  disconnect(){const state=this.emitConnection('disconnected');for(const sub of [...this.subscriptions])sub.unsubscribe();for(const controller of this.controllers)controller.abort();return state;}
  async reconnect(options={}){this.disconnect();return this.connect(options);}
  dispose(){if(this.disposed)return;this.disconnect();this.disposed=true;}
}
