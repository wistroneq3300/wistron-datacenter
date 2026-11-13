import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MockAdapter,PAManagerAdapter} from '../../modules/twin/adapters.js';
import {InventoryAdapter} from '../../modules/twin/contracts.js';
const base=JSON.parse(fs.readFileSync(new URL('../../data/demo-config.json',import.meta.url),'utf8'));
const mock=()=>new MockAdapter({getConfiguration:()=>base});
const now=Date.UTC(2026,0,1),provider='PA_MANAGER',mode='live';
const liveEvent=(fields={})=>({id:'event-1',provider,mode,source:'Synthetic relay contract test',entityId:'editorial-server-1',externalKind:'system',externalId:'pa-system-1',observedAt:new Date(now).toISOString(),sequence:1,health:'warning',metrics:[],test:{id:'test-1',name:'Synthetic result',status:'WARNING',updatedAt:new Date(now).toISOString()},links:[],...fields});
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const envelope=events=>({provider,mode,events});
const inventory=()=>({provider,mode,entities:[],nodes:[{id:'node-1',systemId:'editorial-server-1',rackId:'rack-1',kind:'node',name:'Synthetic Node'}],bindings:[{provider,externalKind:'node',externalId:'pa-node-1',entityId:'node-1'}]});
const adapter=fetchImpl=>new PAManagerAdapter({routes:{inventory:'/relay/inventory',snapshot:'/relay/snapshot'},origin:'https://twin.example',fetchImpl,clock:()=>now,retryBaseMs:0,retryMaxMs:0});

test('Mock starts without observations and creates stable logical Nodes without fabricating components',async()=>{
  const a=mock();assert.ok(a instanceof InventoryAdapter);const inv=await a.getInventory();assert.equal(inv.mode,'mock');assert.equal(inv.provider,'MOCK');assert.equal(inv.nodes.length,36);assert.ok(inv.nodes.every(n=>n.demo&&n.name.includes('DEMO')&&n.id===`${n.systemId}::node-${n.id.endsWith('1')?1:0}`));assert.ok(inv.nodes.every(n=>base.equipment.find(e=>e.id===n.systemId).children.some(c=>c.id===n.boardId)));assert.deepEqual((await a.getSnapshot()).events,[]);assert.equal(inv.entities.some(e=>e.kind==='component'),false);
});
test('Mock inventory renames preserve Node IDs; unknown internals leave boardId absent',async()=>{
  const config=structuredClone(base),a=new MockAdapter({getConfiguration:()=>config}),original=(await a.getInventory()).nodes;
  config.equipment.find(e=>e.modelId==='pa-system').name='Renamed';assert.deepEqual((await a.getInventory()).nodes.map(n=>n.id),original.map(n=>n.id));
  const model=config.catalog.find(m=>m.id==='pa-system');model.childDefinitions=[];model.internalAsset=null;for(const e of config.equipment.filter(e=>e.modelId===model.id))e.children=[];assert.ok((await a.getInventory()).nodes.every(n=>n.boardId===undefined));
});
test('Mock deterministic Warning → FAIL → Recovering → Healthy explicitly clears parent warning',async()=>{
  const a=mock(),b=mock(),received=[];const stop=a.subscribe({onEvent:e=>received.push(e)});
  const runs=['healthy','warningSystem','failNode','recoveringNode','recovered'].map(step=>a.scenario(step));const again=['healthy','warningSystem','failNode','recoveringNode','recovered'].map(step=>b.scenario(step));assert.deepEqual(runs,again);
  assert.equal(runs[0].events.length,81);assert.equal(runs[1].events[0].health,'warning');assert.equal(runs[2].events[0].externalKind,'node');assert.equal(runs[2].events[0].health,'fail');assert.deepEqual(runs[3].events.map(e=>e.health),['healthy','recovering']);assert.deepEqual(runs[4].events.map(e=>e.health),['healthy','healthy']);assert.ok(received.every(e=>e.demo&&e.source.startsWith('MOCK')&&e.observedAt&&e.test));assert.equal(received.some(e=>e.externalKind==='component'),false);stop();
});
test('Mock wrong mode, nonexistent scenario target and arbitrary controls are rejected',()=>{
  const a=mock();assert.throws(()=>a.publish(liveEvent()),/contract/);assert.throws(()=>a.scenario('failNode',{nodeId:'not-in-inventory'}),/does not exist/);assert.throws(()=>a.scenario('restartServer'),/Unknown/);assert.equal(a.powerControl,undefined);assert.equal(a.execute,undefined);
});
test('Mock offline, connected-but-stale and reconnect never fabricate fresh observations',async()=>{
  const a=mock(),states=[];a.subscribe({onConnection:c=>states.push(c.state)});a.scenario('healthy');const before=await a.getSnapshot(),oldTime=a.now();a.scenario('offline');assert.equal(a.connectionState,'disconnected');await assert.rejects(a.getInventory(),/offline/);await assert.rejects(a.getSnapshot(),/offline/);a.scenario('stale');assert.equal(a.connectionState,'connected');assert.ok(a.now()-oldTime>15000);a.scenario('reconnect');assert.deepEqual(await a.getSnapshot(),before);assert.ok(states.includes('reconnecting'));
});
test('Mock duplicate and out-of-order delivery preserves current snapshot and records bounded history',async()=>{
  const a=mock();a.scenario('healthy');a.scenario('recovered');const before=await a.getSnapshot(),latest=before.events.find(e=>e.externalKind==='node');const duplicate=a.scenario('duplicate');assert.equal(duplicate.events[0].id,latest.id);const late=a.scenario('outOfOrder');assert.ok(late.events[0].sequence<latest.sequence);assert.ok(Date.parse(late.events[0].observedAt)<Date.parse(latest.observedAt));assert.deepEqual(await a.getSnapshot(),before);assert.ok((await a.getHealthEvents()).events.length>before.events.length);
});
test('Mock abort and unsubscribe stop callbacks; reset is explicit Unknown-ready namespace',async()=>{
  const a=mock(),controller=new AbortController();let count=0;a.subscribe({signal:controller.signal,onEvent:()=>count++});controller.abort();a.scenario('healthy');assert.equal(count,0);const beforeRevision=a.resetRevision;a.reset();assert.equal(a.resetRevision,beforeRevision+1);assert.deepEqual((await a.getSnapshot()).events,[]);assert.equal(a.now(),now);await assert.rejects(a.getInventory({signal:controller.signal}),{name:'AbortError'});a.dispose();assert.throws(()=>a.scenario('healthy'),/disposed/);
});
test('Mock targeted snapshot and test results are projections, never configuration mutations',async()=>{
  const before=JSON.stringify(base),a=mock(),run=a.scenario('failNode'),id=run.target.nodeId;const snapshot=await a.getSnapshot([id]);assert.equal(snapshot.events.length,1);assert.equal(snapshot.events[0].entityId,id);assert.equal((await a.getTestStatus([id])).tests[0].status,'FAIL');assert.equal(JSON.stringify(base),before);
});
test('Mock Node temperature and utilisation are explicit deterministic synthetic metrics, never sensor or Component observations',async()=>{
  const a=mock(),runs=['healthy','failNode','recoveringNode','recovered'].map(name=>a.scenario(name));
  const expected=[[47,62],[84,97],[61,38],[47,62]];
  for(const [index,run] of runs.entries()){
    const nodes=run.events.filter(e=>e.externalKind==='node');assert.ok(nodes.length>0);
    for(const event of nodes){assert.equal(event.provider,'MOCK');assert.equal(event.mode,'mock');assert.equal(event.demo,true);assert.equal(event.source,'MOCK / deterministic demonstration');assert.deepEqual(event.metrics.map(m=>m.name),['demo.node.temperature','demo.node.utilisation']);assert.deepEqual(event.metrics.map(m=>m.value),expected[index]);assert.deepEqual(event.metrics.map(m=>m.unit),['°C','%']);assert.ok(event.metrics.every(m=>m.quality==='synthetic'&&Number.isFinite(m.value)));}
    assert.ok(run.events.filter(e=>e.externalKind!=='node').every(e=>e.metrics.length===0));assert.equal(run.events.some(e=>e.externalKind==='component'),false);
  }
  const snapshot=await a.getSnapshot([runs.at(-1).target.nodeId]);snapshot.events[0].metrics[0].value=-100;assert.equal((await a.getSnapshot([runs.at(-1).target.nodeId])).events[0].metrics[0].value,47);
});
test('PA adapter has no assumed endpoint and rejects remote paths, credentials and control fields',()=>{
  for(const options of [{},{routes:{}},{routes:{inventory:'https://pa.example/inventory',snapshot:'/snapshot'}},{routes:{inventory:'//evil.example/a',snapshot:'/snapshot'}},{routes:{inventory:'/api/../private',snapshot:'/snapshot'}},{routes:{inventory:'/api?token=x',snapshot:'/snapshot'}},{routes:{inventory:'/inventory',snapshot:'/snapshot',powerControl:'/power'}},{routes:{inventory:'/inventory',snapshot:'/snapshot'},token:'x'},{routes:{inventory:'/inventory',snapshot:'/snapshot'},managementIp:'10.0.0.1'}])assert.throws(()=>new PAManagerAdapter(options));
});
test('PA transport performs only same-origin GET with no token/Authorization or redirect following',async()=>{
  const calls=[],a=adapter(async(url,options)=>{calls.push({url,options});return response(url.includes('inventory')?inventory():envelope([liveEvent()]));});assert.ok(a instanceof InventoryAdapter);await a.getInventory();await a.getSnapshot(['editorial-server-1']);assert.equal(calls.length,2);for(const call of calls){assert.equal(new URL(call.url).origin,'https://twin.example');assert.equal(call.options.method,'GET');assert.deepEqual(call.options.headers,{Accept:'application/json'});assert.equal(call.options.credentials,'same-origin');assert.equal(call.options.redirect,'error');assert.equal(call.options.body,undefined);}assert.equal(new URL(calls[1].url).searchParams.get('ids'),'editorial-server-1');
});
test('PA transport rejects MOCK provider, unknown fields and sensitive nested payloads',async()=>{
  for(const payload of [{provider:'MOCK',mode:'mock',events:[]},envelope([liveEvent({mode:'mock',provider:'MOCK'})]),envelope([liveEvent({metrics:[{name:'temperature',value:20,token:'secret'}]})]),envelope([liveEvent({test:{id:'test-1',name:'test',status:'FAIL',apiKey:'secret'}})]),{provider,mode,events:[],password:'secret'}])await assert.rejects(adapter(async()=>response(payload)).getSnapshot());
  const result=inventory();result.nodes[0].credentials={privateKey:'secret'};await assert.rejects(adapter(async()=>response(result)).getInventory());
});
test('PA event validation refuses unsafe links, IP identities and arbitrary test fields',async()=>{
  for(const event of [liveEvent({links:[{url:'http://10.0.0.1/log',label:'secret'}]}),liveEvent({links:[{url:'https://logs.example/read?token=secret'}]}),liveEvent({externalId:'10.0.0.1'}),liveEvent({test:{id:'test-1',name:'Synthetic',status:'FAIL',command:'restart'}})])await assert.rejects(adapter(async()=>response(envelope([event]))).getSnapshot());
});
test('PA inventory IDs, external mappings and optional Node board bindings are validated',async()=>{
  const good=inventory();good.nodes[0].boardId='editorial-server-1::board-0';assert.deepEqual((await adapter(async()=>response(good)).getInventory()).nodes,good.nodes);
  for(const mutate of [d=>d.nodes[0].id='10.0.0.1',d=>d.bindings[0].provider='MOCK',d=>d.entities.push({id:'rack-1',kind:'rack',name:'Rack',apiKey:'secret'}),d=>d.nodes[0].kind='component']){const bad=inventory();mutate(bad);await assert.rejects(adapter(async()=>response(bad)).getInventory());}
});
test('PA bounded transient retry succeeds with exponential backoff and reconnect notification',async()=>{
  let count=0;const waits=[],a=new PAManagerAdapter({routes:{inventory:'/inventory',snapshot:'/snapshot'},origin:'https://twin.example',clock:()=>now,fetchImpl:async()=>response(envelope([]),++count<3?503:200),sleep:async ms=>waits.push(ms),maxRetries:2,retryBaseMs:5,retryMaxMs:20});
  await a.getSnapshot();assert.equal(count,3);assert.deepEqual(waits,[5,10]);assert.equal(a.connectionState,'connected');
});
test('PA exhausted/unauthorized/invalid-contract errors terminate without infinite retry',async()=>{
  for(const [status,expected] of [[503,3],[401,1]]){let calls=0;const a=adapter(async()=>{calls++;return response({error:'synthetic'},status);});await assert.rejects(a.getSnapshot());assert.equal(calls,expected);assert.equal(a.connectionState,'disconnected');}
  let calls=0;await assert.rejects(adapter(async()=>{calls++;return response({provider,mode,events:[],api_key:'secret'});}).getSnapshot());assert.equal(calls,1);
});
test('PA AbortSignal and disconnect cancel in-flight reads rather than retrying',async()=>{
  let calls=0;const a=adapter((url,{signal})=>{calls++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}),controller=new AbortController(),pending=a.getSnapshot({signal:controller.signal});controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(calls,1);
  const next=a.getSnapshot();a.disconnect();await assert.rejects(next,{name:'AbortError'});assert.equal(calls,2);
});
test('PA polling emits actual synthetic response, supports unsubscribe and explicit reconnect',async()=>{
  let calls=0;const events=[],states=[],a=adapter(async url=>{calls++;return response(url.includes('inventory')?inventory():envelope([liveEvent()]));});const received=new Promise(resolve=>a.subscribe({onEvent:e=>{events.push(e);resolve();},onConnection:c=>states.push(c.state)}));await received;a.disconnect();const stopped=calls;await new Promise(resolve=>setTimeout(resolve,30));assert.equal(calls,stopped);assert.equal(events.length,1);assert.ok(states.includes('connected'));assert.ok(states.includes('disconnected'));await a.reconnect();assert.equal(a.connectionState,'connected');a.dispose();
});
test('PA test status and health history routes validate read-only payloads',async()=>{
  const testResult={entityId:'editorial-server-1',source:'Synthetic relay',observedAt:new Date(now).toISOString(),id:'test-1',name:'Synthetic test',status:'FAIL',updatedAt:new Date(now).toISOString(),links:[{label:'Public test log',url:'https://logs.example/report/123'}]};
  const a=new PAManagerAdapter({routes:{inventory:'/inventory',snapshot:'/snapshot',testStatus:'/tests',healthEvents:'/events'},origin:'https://twin.example',clock:()=>now,fetchImpl:async url=>response(url.includes('/tests')?{provider,mode,tests:[testResult]}:envelope([liveEvent()]))});assert.equal((await a.getTestStatus()).tests[0].status,'FAIL');assert.equal((await a.getHealthEvents()).events.length,1);testResult.apiKey='secret';await assert.rejects(a.getTestStatus());delete testResult.apiKey;testResult.extra='unvalidated';await assert.rejects(a.getTestStatus());
});
test('PA missing optional test/history routes safely project snapshot results',async()=>{
  const a=adapter(async()=>response(envelope([liveEvent()])));assert.equal((await a.getTestStatus()).tests[0].status,'WARNING');assert.equal((await a.getHealthEvents()).events[0].health,'warning');
});
