import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {ConfigStore,canonicalJSON,importDocument,validateConfiguration,STORAGE_KEY,LEGACY_KEY} from '../../modules/domain/configuration.js';
import {buildLayout} from '../../modules/domain/facility.js';
import {assertSafeData,isId,normalizeEvent,safeLink} from '../../modules/twin/contracts.js';
import {MockAdapter,PAManagerAdapter} from '../../modules/twin/adapters.js';
import {TelemetryStore} from '../../modules/twin/telemetry.js';
import {DigitalTwinService} from '../../modules/twin/service.js';

const root=new URL('../../',import.meta.url);
const base=JSON.parse(fs.readFileSync(new URL('data/demo-config.json',root),'utf8'));
const copy=()=>structuredClone(base);
const findSystem=doc=>doc.equipment.find(e=>e.children.length);
const secret='SYNTHETIC_SECURITY_TEST_VALUE';

test('configuration rejects unexpected credential fields at every nested domain boundary',()=>{
  const changes=[
    ['site',d=>d.site.token=secret],
    ['row',d=>d.rows[0].password=secret],
    ['profile evidence',d=>d.rackProfiles[0].evidence.token=secret],
    ['catalog evidence',d=>d.catalog[0].evidence.token=secret],
    ['catalog dimensions',d=>d.catalog[0].dimensionsMm.password=secret],
    ['equipment dimensions',d=>d.equipment[0].dimensionsMm.password=secret],
    ['catalog child definition',d=>d.catalog.find(m=>m.childDefinitions?.length).childDefinitions[0].token=secret],
    ['equipment child',d=>findSystem(d).children[0].token=secret],
    ['hall evidence',d=>{d.facility.halls[0].evidence.token=secret;}],
    ['infrastructure evidence',d=>{d.facility.halls[0].infrastructure[0].evidence.token=secret;}],
    ['evidence note object',d=>d.catalog[0].evidence.note={token:secret}],
    ['evidence source object',d=>d.rackProfiles[0].evidence.source={token:secret}],
    ['evidence status object',d=>d.rackProfiles[0].evidence.status={password:secret}],
    ['inventory state object',d=>d.racks[0].inventoryState={token:secret}],
  ];
  for(const [label,change] of changes){
    const doc=buildLayout(copy(),{totalRacks:4,rows:2});change(doc);
    assert.equal(validateConfiguration(doc).valid,false,`${label} unexpectedly accepted`);
    assert.throws(()=>importDocument(JSON.stringify(doc),base),undefined,label);
  }
});

test('configuration import cannot introduce telemetry state or control commands',()=>{
  for(const change of [d=>d.telemetry={status:'Healthy'},d=>d.equipment[0].status='Healthy',d=>d.equipment[0].powerControl={command:'restart'},d=>d.facility.halls[0].health='Healthy']){
    const doc=buildLayout(copy(),{totalRacks:4,rows:2});change(doc);
    assert.throws(()=>importDocument(JSON.stringify(doc),base));
  }
});

test('rejected nested import leaves persisted configuration and revision unchanged',()=>{
  const persisted=new Map(),storage={getItem:key=>persisted.get(key)??null,setItem:(key,value)=>persisted.set(key,value)};
  const store=new ConfigStore(base,storage);store.reset();const before=store.export(),stored=JSON.stringify([...persisted]);
  const incoming=copy();incoming.site.token=secret;
  assert.throws(()=>store.import(JSON.stringify(incoming)));
  assert.equal(store.export(),before);assert.equal(JSON.stringify([...persisted]),stored);
});

test('legacy migration copies approved configuration fields and drops legacy credentials',()=>{
  const legacy={version:1,token:secret,racks:[{id:'legacy-rack',name:'Legacy',purpose:'Migration check',position:0,password:secret}]};
  const migrated=importDocument(JSON.stringify(legacy),base),encoded=canonicalJSON(migrated);
  assert.equal(migrated.racks[0].id,'legacy-rack');assert.equal(migrated.equipment.length,0);
  assert.equal(encoded.includes(secret),false);assert.equal(validateConfiguration(migrated).valid,true);
});

test('JSON prototype-like nested keys are rejected without changing object prototypes',()=>{
  const doc=copy();doc.site=JSON.parse('{"id":"site-test","name":"Safe site","__proto__":{"securityProbe":true}}');
  assert.throws(()=>importDocument(JSON.stringify(doc),base));
  assert.equal(Object.prototype.securityProbe,undefined);assert.equal(({}).securityProbe,undefined);
});

test('all downloaded outdoor texture bytes match provenance and valid JPEG signatures',()=>{
  const provenance=JSON.parse(fs.readFileSync(new URL('assets/environment/provenance.json',root),'utf8'));
  assert.equal(provenance.files.length,6);let total=0;
  for(const file of provenance.files){
    assert.match(file.file,/^[a-z0-9-]+\.jpg$/);assert.equal(file.license,'CC0-1.0');
    const bytes=fs.readFileSync(new URL(`assets/environment/${file.file}`,root));
    assert.equal(bytes.length,file.bytes);assert.equal(bytes[0],255);assert.equal(bytes[1],216);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256);
    assert.deepEqual(file.resolution,[1024,1024]);total+=bytes.length;
  }
  assert.ok(total<6*1024*1024);assert.equal(total,4297335);
});

test('runtime outdoor manifest references only checked-in local files and keeps facade albedo independent',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('assets/environment/manifest.json',root),'utf8'));
  assert.deepEqual(manifest.materials.map(m=>m.id),['asphalt03','stone']);
  for(const material of manifest.materials)for(const [slot,path] of Object.entries(material.maps)){
    assert.ok(['map','normalMap','roughnessMap'].includes(slot));
    assert.match(path,/^assets\/environment\/[a-z0-9-]+\.jpg$/);
    assert.equal(fs.existsSync(new URL(path,root)),true);
  }
  assert.equal(manifest.materials.find(m=>m.id==='stone').maps.map,undefined);
});

test('trace URLs reject active content, credential channels and private management destinations',()=>{
  const forbidden=[
    'javascript:alert(1)','data:text/html,<script>alert(1)</script>','//example.com/log',
    'http://example.com/log','https://user:password@example.com/log','https://127.0.0.1/log',
    'https://192.168.1.1/log','https://[::1]/log','https://2130706433/log',
    'https://localhost./log','https://bmc.internal./log','https://rack.local/log','https://console.corp/log',
    'https://example.com/log?access_token=value','https://example.com/log?apiKey=value',
    'https://example.com/log#token=value','https://example.com/log#access%5ftoken=value',
  ];
  for(const url of forbidden)assert.throws(()=>safeLink(url),undefined,url);
  assert.deepEqual(safeLink({label:'Public log',url:'https://example.com/log/test-42'}),{label:'Public log',url:'https://example.com/log/test-42'});
  assert.equal(safeLink('/logs/test-42').url,'/logs/test-42');
});

test('monitoring contracts reject nested secrets, executable data and IP identity while assigning receivedAt',()=>{
  const now=Date.UTC(2026,10,13),event={id:'event-1',entityId:'system-1',provider:'PA_MANAGER',mode:'live',source:'pa-manager',observedAt:new Date(now-1000).toISOString(),receivedAt:'2000-01-01T00:00:00Z',health:'fail',metrics:[]};
  for(const key of ['token','apiKey','api_key','privateKey','private_key','password','managementIp'])assert.throws(()=>assertSafeData({wrapper:{[key]:secret}}));
  const cyclic={};cyclic.self=cyclic;assert.throws(()=>assertSafeData(cyclic));assert.throws(()=>assertSafeData({callback(){}}));assert.throws(()=>assertSafeData({value:new Date()}));
  assert.throws(()=>normalizeEvent({...event,metrics:[{name:'temperature',value:42,apiKey:secret}]},{now}));
  assert.throws(()=>normalizeEvent({...event,test:{id:'test-1',name:'Synthetic test',status:'FAIL',privateKey:secret}},{now}));
  assert.throws(()=>normalizeEvent({...event,entityId:'192.168.1.1'},{now}));
  assert.equal(isId('192.168.1.1'),false);assert.equal(isId('fe80::1'),false);assert.equal(isId('system-1::node-0'),true);
  const normalized=normalizeEvent(event,{now});assert.equal(normalized.receivedAt,new Date(now).toISOString());assert.equal(event.receivedAt,'2000-01-01T00:00:00Z');
});

test('rejection history does not preserve credentials hidden inside an invalid event ID',()=>{
  const telemetry=new TelemetryStore();const result=telemetry.ingest({id:{token:secret},provider:'PA_MANAGER'});
  assert.equal(result.accepted,false);assert.equal(JSON.stringify(telemetry.snapshot()).includes(secret),false);
  telemetry.reject('namespace',{password:secret},'Adapter namespace mismatch');
  assert.equal(JSON.stringify(telemetry.snapshot()).includes(secret),false);
});

const relayOptions={origin:'https://twin.example.com',routes:{inventory:'/relay/inventory',snapshot:'/relay/snapshot',testStatus:'/relay/tests'},maxRetries:0};
const response=data=>({ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify(data)});

test('PA adapter independently rejects sensitive nested inventory, test and telemetry payloads',async()=>{
  const cases=[
    ['getInventory',{provider:'PA_MANAGER',mode:'live',nodes:[],bindings:[],entities:[{id:'system-1',kind:'system',name:'System',apiKey:secret}]}],
    ['getTestStatus',{provider:'PA_MANAGER',mode:'live',tests:[{entityId:'system-1',id:'test-1',name:'Test',status:'FAIL',source:'pa-manager',observedAt:'2026-01-01T00:00:00Z',privateKey:secret}]}],
    ['getSnapshot',{provider:'PA_MANAGER',mode:'live',events:[{id:'event-1',entityId:'system-1',externalId:'system-1',externalKind:'system',provider:'PA_MANAGER',mode:'live',source:'pa-manager',observedAt:'2026-01-01T00:00:00Z',health:'fail',metrics:[{name:'temperature',value:42,token:secret}]}]}],
  ];
  for(const [method,data]of cases){const adapter=new PAManagerAdapter({...relayOptions,fetchImpl:async()=>response(data)});try{await assert.rejects(()=>adapter[method]());}finally{adapter.dispose();}}
});

test('PA transport accepts only explicit local routes, uses GET and never sends bearer credentials',async()=>{
  for(const path of ['https://example.com/api','//example.com/api','/relay/../restart','/relay/snapshot?token=value','/relay/snapshot#fragment'])assert.throws(()=>new PAManagerAdapter({...relayOptions,routes:{inventory:'/relay/inventory',snapshot:path}}));
  assert.throws(()=>new PAManagerAdapter({...relayOptions,token:secret}));
  const requests=[],adapter=new PAManagerAdapter({...relayOptions,fetchImpl:async(url,init)=>{requests.push({url,init});return response({provider:'PA_MANAGER',mode:'live',events:[]});}});
  try{await adapter.getSnapshot({ids:['system-1']});assert.equal(requests.length,1);const {url,init}=requests[0];assert.equal(new URL(url).origin,relayOptions.origin);assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.equal(init.credentials,'same-origin');assert.equal(init.body,undefined);assert.equal(Object.keys(init.headers).some(key=>key.toLowerCase()==='authorization'),false);assert.equal(JSON.stringify(requests).includes(secret),false);}finally{adapter.dispose();}
});

test('switching from MOCK to live clears synthetic health and cannot mutate persisted equipment configuration',async()=>{
  const store=new ConfigStore(base),before=store.export(),mock=new MockAdapter({getConfiguration:()=>store.document});
  const service=new DigitalTwinService({adapter:mock,configStore:store,clock:()=>mock.now(),maxRetries:0});
  try{
    assert.equal(await service.connect(),true);mock.scenario('healthy');
    const system=findSystem(base).id;assert.equal(service.stateFor(system).health,'healthy');
    const event=mock.scenario('fail').events[0];assert.equal(service.stateFor(event.entityId).health,'fail');
    const live={provider:'PA_MANAGER',mode:'live',getInventory:async()=>({provider:'PA_MANAGER',mode:'live',nodes:[],bindings:[]}),getSnapshot:async()=>({provider:'PA_MANAGER',mode:'live',events:[]}),subscribe:()=>()=>{}};
    assert.equal(await service.connect(live),true);assert.equal(service.stateFor(system).health,'unknown');
    assert.equal(service.accept(event).accepted,false);assert.equal(service.telemetry.history.length,0);assert.equal(store.export(),before);
  }finally{service.dispose();mock.dispose();}
});

test('startup keeps the original recovery data without duplicating sensitive payloads into backups',()=>{
  const samples=[
    JSON.stringify({...copy(),token:secret}),
    JSON.stringify({...copy(),privateKey:secret}),
    JSON.stringify({...copy(),access_token:secret}),
    JSON.stringify({...copy(),token:secret}).replace('"token"','"to\\u006ben"'),
  ];
  for(const raw of samples){const records=new Map([[STORAGE_KEY,raw]]),storage={getItem:key=>records.get(key),setItem:(key,value)=>records.set(key,value)},store=new ConfigStore(base,storage);store.load();assert.equal(records.get(STORAGE_KEY),raw);assert.equal(records.has(STORAGE_KEY+'.invalid-backup'),false);assert.equal(store.export().includes(secret),false);}
  const raw=JSON.stringify({version:1,apiKey:secret,racks:[{id:'legacy-safe',purpose:'Migration',position:0}]}),records=new Map([[LEGACY_KEY,raw]]),store=new ConfigStore(base,{getItem:key=>records.get(key),setItem:(key,value)=>records.set(key,value)});
  store.load();assert.equal(records.get(LEGACY_KEY),raw);assert.equal(records.has(LEGACY_KEY+'.backup'),false);assert.equal(records.get(STORAGE_KEY).includes(secret),false);
});
