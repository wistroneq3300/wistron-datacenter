import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ConfigInventoryAdapter,configurationInventory,IdentityMappingService} from '../../modules/twin/identity.js';
import {normalizeEvent} from '../../modules/twin/contracts.js';
import {TelemetryStore} from '../../modules/twin/telemetry.js';
import {HealthStateEngine} from '../../modules/twin/health.js';
import {DigitalTwinService} from '../../modules/twin/service.js';
import {MockAdapter} from '../../modules/twin/adapters.js';

const base=JSON.parse(fs.readFileSync(new URL('../../data/demo-config.json',import.meta.url),'utf8'));
const epoch=Date.UTC(2026,0,1),systemId='editorial-compute-01',nodeId=`${systemId}::node-0`,componentId=`${systemId}::Board1-CPU`;
const event=(patch={})=>({id:'event-1',provider:'MOCK',mode:'mock',source:'unit-source',entityId:systemId,observedAt:new Date(epoch).toISOString(),sequence:1,health:'healthy',metrics:[],...patch});
async function fixture(t,options={}){const doc=structuredClone(base),adapter=new MockAdapter({getConfiguration:()=>doc}),service=new DigitalTwinService({adapter,getConfiguration:()=>doc,clock:()=>adapter.now(),...options});t.after(()=>{service.dispose();adapter.dispose();});assert.equal(await service.connect(),true);return{doc,adapter,service};}

test('configuration inventory preserves all stable Rack, Equipment and model child IDs',async()=>{
  const adapter=new ConfigInventoryAdapter(base),inventory=await adapter.getInventory(),ids=new Set(inventory.entities.map(entity=>entity.id));
  for(const rack of base.racks)assert.ok(ids.has(rack.id));for(const equipment of base.equipment){assert.ok(ids.has(equipment.id));for(const child of equipment.children)assert.ok(ids.has(child.id));}
  assert.equal(ids.size,inventory.entities.length);assert.equal(inventory.nodes.length,0);assert.equal(inventory.entities.find(entity=>entity.id===componentId).parentId,`${systemId}::board-0`);
});

test('one System maps to multiple explicit Nodes and existing Board IDs without generating Component observations',async t=>{
  const {service}=await fixture(t),nodes=[...service.entities.values()].filter(entity=>entity.systemId===systemId&&entity.kind==='node');assert.equal(nodes.length,2);assert.equal(new Set(nodes.map(node=>node.boardId)).size,2);
  assert.equal(service.stateFor(nodeId).health,'unknown');assert.equal(service.stateFor(componentId).health,'unknown');assert.equal(service.telemetry.history.length,0);
});

test('identity mapping rejects ambiguous, IP-based and unresolved identities without name fallback',()=>{
  const entities=configurationInventory(base).entities,mapping=new IdentityMappingService();const binding={provider:'PA_MANAGER',externalKind:'system',externalId:'external-system-1',entityId:systemId};mapping.reconcile(entities,[binding]);
  assert.equal(mapping.resolve(binding),systemId);assert.equal(mapping.resolve({...binding,externalId:'unknown',entityId:systemId}),null);assert.equal(mapping.resolve({...binding,entityId:'editorial-compute-02'}),null);
  assert.throws(()=>mapping.reconcile(entities,[binding,{...binding,entityId:'editorial-compute-02'}]),/Ambiguous/);assert.throws(()=>mapping.reconcile(entities,[{...binding,externalId:'192.0.2.4'}]),/Invalid/);
  mapping.reconcile(entities,[{...binding,entityId:'missing-system'}]);assert.equal(mapping.pending.length,1);assert.equal(mapping.resolve(binding),null);
});

test('deterministic Warning → FAIL → Recovering → Healthy updates Node, System and Rack together',async t=>{
  const {adapter,service}=await fixture(t);const results=[];
  for(const step of ['healthy','warning','fail','recovering','recovered']){adapter.scenario(step);service.tick();results.push(service.stateFor('rack-1').health);assert.equal(service.stateFor(componentId).health,'unknown');}
  assert.deepEqual(results,['healthy','warning','fail','recovering','healthy']);assert.equal(service.stateFor(nodeId).health,'healthy');assert.equal(service.stateFor(systemId).health,'healthy');
  assert.ok(service.stateFor(nodeId).lastUpdatedAt);assert.match(service.stateFor(nodeId).sources[0].source,/MOCK/);assert.ok(service.stateFor(nodeId).tests.length);assert.ok(service.telemetry.history.some(item=>item.entityId===nodeId&&item.health==='fail'));
});

test('no observations remain Unknown; stale uses observedAt rather than receipt time',()=>{
  let now=epoch+30000;const telemetry=new TelemetryStore({clock:()=>now}),entities=new Map([['system-1',{id:'system-1',kind:'system'}],['component-1',{id:'component-1',kind:'component'}]]),engine=new HealthStateEngine({staleAfterMs:15000});
  assert.equal(engine.derive(entities,telemetry,{now,connection:{state:'connected'}}).get('system-1').health,'unknown');
  assert.equal(telemetry.ingest(event({entityId:'system-1'})).accepted,true);const state=engine.derive(entities,telemetry,{now,connection:{state:'connected'}}).get('system-1');assert.equal(state.health,'stale');assert.equal(state.sources[0].receivedAt,new Date(now).toISOString());assert.equal(state.sources[0].ageMs,30000);
});

test('multiple independent sources preserve an active FAIL until that source explicitly recovers',async t=>{
  const {adapter,service}=await fixture(t);adapter.scenario('healthy');const time=new Date(adapter.now()).toISOString();
  service.accept(event({id:'source-a-fail',entityId:nodeId,source:'dcgm',health:'fail',observedAt:time}));service.accept(event({id:'source-b-healthy',entityId:nodeId,source:'redfish',observedAt:time}));assert.equal(service.stateFor(nodeId).health,'fail');
  adapter.advance(16000);service.tick();assert.equal(service.stateFor(nodeId).health,'fail');assert.equal(service.stateFor(nodeId).freshness,'stale');
  adapter.scenario('healthy');service.accept(event({id:'source-a-recovered',entityId:nodeId,source:'dcgm',observedAt:new Date(adapter.now()).toISOString(),sequence:2}));service.accept(event({id:'source-b-fresh',entityId:nodeId,source:'redfish',observedAt:new Date(adapter.now()).toISOString(),sequence:2}));assert.equal(service.stateFor(nodeId).health,'healthy');
});

test('an explicit Component observation may aggregate upward but never invents a Node failure',async t=>{
  const {adapter,service}=await fixture(t);adapter.scenario('healthy');service.accept(event({id:'observed-component-fail',entityId:componentId,health:'fail',observedAt:new Date(adapter.now()).toISOString()}));
  assert.equal(service.stateFor(componentId).health,'fail');assert.equal(service.stateFor(systemId).health,'fail');assert.equal(service.stateFor('rack-1').health,'fail');assert.equal(service.stateFor(nodeId).health,'healthy');assert.equal(service.stateFor(`${systemId}::Board1-GPU_A`).health,'unknown');
});

test('duplicate, older timestamp, older sequence and future events cannot overwrite current telemetry',()=>{
  let now=epoch+1000;const store=new TelemetryStore({clock:()=>now});const latest=event({id:'new',observedAt:new Date(now).toISOString(),sequence:10,health:'fail'});assert.equal(store.ingest(latest).accepted,true);
  assert.equal(store.ingest(latest).reason,'duplicate');assert.equal(store.ingest(event({id:'old-time',sequence:11})).reason,'out-of-order');assert.equal(store.ingest(event({id:'old-sequence',observedAt:new Date(now+1).toISOString(),sequence:9})).reason,'out-of-order');assert.equal(store.ingest(event({id:'future',observedAt:new Date(now+61000).toISOString(),sequence:11})).reason,'invalid');
  assert.equal(store.forEntity(systemId)[0].health,'fail');assert.equal(store.history.length,1);
});

test('source timestamp and finite metrics are mandatory; source text remains plain immutable data',()=>{
  assert.throws(()=>normalizeEvent(event({observedAt:'yesterday'}),{now:epoch}));assert.throws(()=>normalizeEvent(event({metrics:[{name:'temperature',value:NaN}]}),{now:epoch}));
  const value=normalizeEvent(event({message:'<img src=x onerror=alert(1)>',metrics:[{name:'temperature',value:58.5,unit:'C'}],receivedAt:'1999-01-01T00:00:00Z'}),{now:epoch});assert.equal(value.message,'<img src=x onerror=alert(1)>');assert.equal(value.receivedAt,new Date(epoch).toISOString());assert.throws(()=>{value.metrics[0].value=0;});
});

test('bounded history and rejected diagnostics never retain arbitrary raw payloads',()=>{
  let now=epoch;const store=new TelemetryStore({clock:()=>now,historyLimit:3,maxStreams:2});for(let i=0;i<6;i++){now+=1000;store.ingest(event({id:`e-${i}`,sequence:i,observedAt:new Date(now).toISOString()}));}assert.equal(store.history.length,3);
  store.ingest({id:{token:'SYNTHETIC_SECRET'},provider:'MOCK'});assert.equal(store.rejected.at(-1).id,null);assert.ok(!JSON.stringify(store.snapshot()).includes('SYNTHETIC_SECRET'));
  assert.equal(store.ingest(event({id:'source-2',source:'second',observedAt:new Date(now).toISOString()})).accepted,true);assert.equal(store.ingest(event({id:'source-3',source:'third',observedAt:new Date(now).toISOString()})).reason,'capacity');
});

test('configuration content is unchanged by all Mock scenarios and view snapshots are defensive copies',async t=>{
  const {doc,adapter,service}=await fixture(t),before=JSON.stringify(doc);for(const step of ['healthy','warning','fail','recovering','recovered','delayed','duplicate','stale'])adapter.scenario(step);assert.equal(JSON.stringify(doc),before);
  const snapshot=service.snapshot();snapshot.entities.find(entity=>entity.id===nodeId).name='Modified view copy';snapshot.history[0].health='fail';assert.notEqual(service.stateFor(nodeId).name,'Modified view copy');assert.equal(service.telemetry.history[0].health,'healthy');
});

test('configuration reconciliation adds new Mock Nodes as Unknown and preserves surviving alert history',async t=>{
  const {doc,adapter,service}=await fixture(t);adapter.scenario('healthy');adapter.scenario('fail');const before=service.telemetry.history.length;
  const source=structuredClone(doc.equipment.find(e=>e.id===systemId)),added=structuredClone(source);added.id='added-system';added.name='Added System';added.deviceId='ADDED-SYSTEM';added.rackId='rack-2';added.children=added.children.map(child=>({...child,id:child.id.replace(systemId,added.id),parentId:added.id}));doc.equipment.push(added);service.reconcile();
  assert.equal(service.stateFor('added-system::node-0').health,'unknown');assert.equal(service.stateFor(nodeId).health,'fail');assert.equal(service.telemetry.history.length,before);
  doc.equipment.find(e=>e.id===systemId).rackId='rack-2';service.reconcile();assert.equal(service.stateFor(nodeId).rackId,'rack-2');assert.equal(service.stateFor('rack-2').health,'fail');assert.equal(service.stateFor(nodeId).health,'fail');
  doc.equipment=doc.equipment.filter(e=>e.id!==systemId);service.reconcile();assert.equal(service.stateFor(nodeId),null);assert.equal(service.telemetry.history.length,before);
});

test('unknown entities are retained in reconciliation diagnostics and never guessed by display name',async t=>{
  const {service}=await fixture(t);const result=service.accept(event({entityId:'unknown-node'}));assert.equal(result.reason,'unmapped');assert.equal(service.snapshot().unmapped.length,1);assert.equal(service.telemetry.history.length,0);assert.equal(service.stateFor(systemId).health,'unknown');
});

test('Mock transport interruption becomes Offline and does not create an automatic reconnect loop',async t=>{
  const {adapter,service}=await fixture(t,{retryBaseMs:1,maxRetries:2});adapter.scenario('healthy');adapter.scenario('offline');adapter.advance(5001);service.tick();assert.equal(service.stateFor(nodeId).health,'offline');await new Promise(resolve=>setTimeout(resolve,25));assert.equal(service.connection.state,'disconnected');assert.equal(service.retryTimer,null);assert.equal(service.autoReconnectAttempts,0);
  adapter.scenario('reconnect');assert.equal(service.connection.state,'connected');assert.equal(service.stateFor(nodeId).health,'healthy');adapter.scenario('stale');service.tick();assert.equal(service.stateFor(nodeId).health,'stale');
});

test('same-adapter reconnect preserves history, while explicit Mock reset returns Unknown',async t=>{
  const {adapter,service}=await fixture(t);adapter.scenario('healthy');const length=service.telemetry.history.length;assert.equal(await service.reconnect(),true);assert.equal(service.telemetry.history.length,length);assert.equal(service.stateFor(nodeId).health,'healthy');service.disconnect();adapter.reset();assert.equal(await service.connect(),true);assert.equal(service.telemetry.history.length,0);assert.equal(service.stateFor(nodeId).health,'unknown');
});

test('switching adapter mode clears namespace and late old subscriptions cannot contaminate live data',async t=>{
  const {adapter,service}=await fixture(t);adapter.scenario('healthy');const live={provider:'PA_MANAGER',mode:'live',getInventory:async()=>({provider:'PA_MANAGER',mode:'live',nodes:[],bindings:[]}),getSnapshot:async()=>({events:[]}),subscribe:()=>()=>{}};
  assert.equal(await service.connect(live),true);assert.equal(service.telemetry.history.length,0);adapter.scenario('fail');assert.equal(service.telemetry.history.length,0);assert.equal(service.accept(event()).reason,'namespace');assert.equal(service.stateFor(systemId).health,'unknown');
  assert.equal(service.accept(event({id:'live-demo',provider:'PA_MANAGER',mode:'live',demo:true})).reason,'invalid');
});

test('connection retries are bounded and successful explicit reconnect is observable',async t=>{
  let attempts=0,ready=false;const adapter={provider:'PA_MANAGER',mode:'live',getInventory:async()=>{attempts++;if(!ready)throw Error('offline');return{provider:'PA_MANAGER',mode:'live',nodes:[],bindings:[]};},getSnapshot:async()=>({events:[]}),subscribe:()=>()=>{}};
  const service=new DigitalTwinService({adapter,getConfiguration:()=>base,clock:()=>epoch,maxRetries:2,retryBaseMs:1});t.after(()=>service.dispose());assert.equal(await service.connect(),false);assert.equal(attempts,3);assert.equal(service.connection.state,'failed');ready=true;assert.equal(await service.reconnect(),true);assert.equal(attempts,4);assert.equal(service.connection.state,'connected');
});

test('repeated immediate live disconnects exhaust a cross-session auto reconnect budget',async t=>{
  let attempts=0;const adapter={provider:'PA_MANAGER',mode:'live',getInventory:async()=>{attempts++;return{provider:'PA_MANAGER',mode:'live',nodes:[],bindings:[]};},getSnapshot:async()=>({events:[]}),subscribe:({onConnection})=>{onConnection({provider:'PA_MANAGER',mode:'live',state:'disconnected'});return()=>{};}};
  const service=new DigitalTwinService({adapter,getConfiguration:()=>base,clock:()=>epoch,maxRetries:2,retryBaseMs:1});t.after(()=>service.dispose());await service.connect();await new Promise(resolve=>setTimeout(resolve,35));assert.equal(attempts,3);assert.equal(service.connection.state,'failed');assert.equal(service.autoReconnectAttempts,2);assert.equal(service.retryTimer,null);await new Promise(resolve=>setTimeout(resolve,20));assert.equal(attempts,3);
});

test('cancelled asynchronous snapshot cannot publish after disconnect or take ownership of a later session',async t=>{
  let resolveSnapshot;const adapter={provider:'MOCK',mode:'mock',getInventory:async()=>({provider:'MOCK',mode:'mock',nodes:[],bindings:[]}),getSnapshot:()=>new Promise(resolve=>{resolveSnapshot=resolve;}),subscribe:()=>{throw Error('Cancelled connection must not subscribe');}};
  const service=new DigitalTwinService({adapter,getConfiguration:()=>base,clock:()=>epoch,maxRetries:0});t.after(()=>service.dispose());const connection=service.connect();while(!resolveSnapshot)await Promise.resolve();service.disconnect();resolveSnapshot({events:[event()]});assert.equal(await connection,false);assert.equal(service.telemetry.history.length,0);assert.equal(service.connection.state,'disconnected');
});

test('a failing view subscriber cannot roll back accepted source state',async t=>{
  const {adapter,service}=await fixture(t);let notifications=0;service.subscribe(()=>{notifications++;if(notifications>1)throw Error('View failure');});adapter.scenario('healthy');await Promise.resolve();assert.ok(notifications>=2);assert.equal(service.stateFor(nodeId).health,'healthy');assert.ok(service.telemetry.history.length>0);
});
