// Read-only monitoring contract. No transport endpoint or company credentials.
export const HEALTH_STATES=Object.freeze(['healthy','warning','fail','recovering','unknown','offline','stale']);
export const ENTITY_KINDS=Object.freeze(['site','interior','hall','row','rack','system','switch','powerShelf','equipment','node','board','component']);
export const SOURCES=Object.freeze(['pa-manager','prometheus','grafana','dcgm','node-exporter','redfish','bug-finder','mock']);
export const clone=value=>structuredClone(value);
export const isId=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/.test(value)&&!isAddress(value);
const isAddress=value=>/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)||/^\[?[0-9a-f]*:[0-9a-f:]+\]?$/i.test(value);
const text=(value,max=2000)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const sensitive=key=>/(?:password|passwd|credential|secret|token|api.?key|authorization|private.?key|management.?ip|bmc.?ip)/i.test(key);

export function assertSafeData(value){
  const ancestors=new Set();let count=0;
  const visit=(item,depth)=>{
    if(++count>250000||depth>16)throw Error('Monitoring data exceeds safety bounds');
    if(item===null||['string','boolean','undefined'].includes(typeof item))return;
    if(typeof item==='number'){if(!Number.isFinite(item))throw Error('Monitoring numbers must be finite');return;}
    if(typeof item!=='object'||ancestors.has(item)||!Array.isArray(item)&&![Object.prototype,null].includes(Object.getPrototypeOf(item)))throw Error('Monitoring data must be acyclic plain data');
    ancestors.add(item);for(const [key,child] of Object.entries(item)){if(sensitive(key)||['__proto__','prototype','constructor'].includes(key))throw Error(`Sensitive or unsafe monitoring field: ${key}`);visit(child,depth+1);}ancestors.delete(item);
  };visit(value,0);return value;
}

export function safeLink(value){
  const raw=typeof value==='string'?value:value?.url;
  if(!text(raw,2048)||/[\u0000-\u0020\\]/.test(raw))throw Error('Invalid trace link');
  const relative=raw.startsWith('/')&&!raw.startsWith('//'),url=new URL(raw,'https://twin.invalid');
  if((!relative&&(!/^https:\/\//i.test(raw)||url.protocol!=='https:'))||url.username||url.password)throw Error('Trace links require a safe public HTTPS URL or same-origin path');
  const hostname=url.hostname.replace(/\.+$/,'');
  if(!relative&&(/^[\d.]+$/.test(hostname)||hostname.includes(':')||!hostname.includes('.')||/(?:^|\.)(?:localhost|local|internal|invalid|lan|home|corp)$/.test(hostname)))throw Error('Private management hosts are not allowed in browser trace links');
  for(const key of url.searchParams.keys())if(sensitive(key)||/^(?:auth|signature|sig)$/i.test(key))throw Error('Credentials are not allowed in trace links');
  if(sensitive(decodeURIComponent(url.hash))||/(?:^|[&#])(?:auth|signature|sig)=/i.test(url.hash))throw Error('Credentials are not allowed in trace fragments');
  return Object.freeze({label:text(value?.label,160)?value.label:'Trace',url:raw});
}

export function timestamp(value){if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('An ISO observation timestamp is required');return Date.parse(value);}
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export function normalizeEvent(input,{now=Date.now(),maxFutureSkewMs=60000}={}){
  assertSafeData(input);if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Monitoring event must be an object');
  const allowed=['id','provider','mode','source','entityId','externalId','externalKind','observedAt','receivedAt','sequence','health','metrics','test','links','message','demo','causeCode'];
  for(const key of Object.keys(input))if(!allowed.includes(key))throw Error(`Unknown monitoring event field: ${key}`);
  if(!isId(input.id)||!text(input.provider,80)||!['mock','live'].includes(input.mode)||!text(input.source,120))throw Error('Event identity, provider, source or mode is invalid');
  if(input.mode==='live'&&(input.demo===true||input.provider==='MOCK'))throw Error('MOCK events cannot enter a live namespace');
  if(input.entityId!==undefined&&!isId(input.entityId))throw Error('Invalid entity ID');
  if(!input.entityId&&(!text(input.externalId,180)||!ENTITY_KINDS.includes(input.externalKind)))throw Error('Event needs an explicit stable entity or external mapping');
  const observed=timestamp(input.observedAt);if(observed>now+maxFutureSkewMs)throw Error('Future observation timestamp rejected');
  if(input.sequence!==undefined&&(!Number.isSafeInteger(input.sequence)||input.sequence<0))throw Error('Invalid source sequence');
  if(input.health!==undefined&&!HEALTH_STATES.includes(input.health))throw Error('Unknown health state');
  if(input.message!==undefined&&typeof input.message!=='string'||input.message?.length>2000)throw Error('Invalid event message');
  if(input.causeCode!==undefined&&!text(input.causeCode,120))throw Error('Invalid cause code');
  if(!Array.isArray(input.metrics)||input.metrics.length>128)throw Error('Metrics must be a bounded array');
  const metrics=input.metrics.map(metric=>{
    if(!metric||!text(metric.name,120)||typeof metric.value!=='number'||!Number.isFinite(metric.value))throw Error('Invalid metric');
    for(const key of Object.keys(metric))if(!['name','value','unit','quality'].includes(key))throw Error(`Unknown metric field: ${key}`);
    if(metric.unit!==undefined&&typeof metric.unit!=='string'||metric.quality!==undefined&&!text(metric.quality,60))throw Error('Invalid metric unit or quality');
    return {...metric};
  });
  let test;if(input.test!==undefined){const t=input.test;if(!t||!isId(t.id)||!text(t.name,240)||!text(t.status,80))throw Error('Invalid test result');for(const key of Object.keys(t))if(!['id','name','status','updatedAt'].includes(key))throw Error(`Unknown test field: ${key}`);if(t.updatedAt!==undefined)timestamp(t.updatedAt);test={...t};}
  if(input.links!==undefined&&(!Array.isArray(input.links)||input.links.length>16))throw Error('Trace links must be a bounded array');
  return freeze({...clone(input),health:input.health||'unknown',metrics,test,links:(input.links||[]).map(safeLink),receivedAt:new Date(now).toISOString()});
}

export class InventoryAdapter {
  async getInventory(){throw Error('InventoryAdapter.getInventory must be implemented');}
  async getSnapshot(){return{events:[]};}
  subscribe(){return()=>{};}
}
