import {assertSafeData,normalizeEvent,clone} from './contracts.js';
import {configurationInventory,mergeInventory,IdentityMappingService} from './identity.js';
import {TelemetryStore} from './telemetry.js';
import {HealthStateEngine} from './health.js';

// A read-only coordinator: this module never invokes a ConfigStore write command.
export class DigitalTwinService {
  constructor({adapter,getConfiguration,configStore,clock=()=>Date.now(),staleAfterMs=15000,offlineAfterMs=5000,maxRetries=3,retryBaseMs=250}={}){
    if(typeof clock!=='function'||!Number.isInteger(maxRetries)||maxRetries<0||maxRetries>8||!Number.isFinite(retryBaseMs)||retryBaseMs<0||retryBaseMs>10000||!getConfiguration&&!configStore)throw Error('Invalid read-only service configuration');
    this.adapter=adapter;this.getConfiguration=getConfiguration||(()=>configStore.document);this.clock=clock;this.maxRetries=maxRetries;this.retryBaseMs=retryBaseMs;
    this.identity=new IdentityMappingService();this.telemetry=new TelemetryStore({clock});this.healthEngine=new HealthStateEngine({staleAfterMs,offlineAfterMs});
    this.entities=new Map();this.inventory={nodes:[],bindings:[]};this.unmapped=[];this.listeners=new Set();this.generation=0;this.revision=0;this.states=null;this.queuePending=false;this.disposed=false;this.sessionKey=null;this.autoReconnectAttempts=0;
    this.connection={state:'disconnected',connected:false,sinceMs:this.clock(),at:new Date(this.clock()).toISOString(),message:'Monitoring has not connected'};
    this.configUnsubscribe=configStore?.subscribe(()=>this.reconcile());this.reconcile();
  }
  get provider(){return this.adapter?.provider||'UNCONFIGURED';}
  get mode(){return this.adapter?.mode||'pending';}
  reconcile(){
    // Mock inventory is a synchronous projection of the current configuration;
    // refreshing it does not manufacture telemetry for newly added equipment.
    if(this.adapter?.mode==='mock'&&typeof this.adapter.inventory==='function'&&this.sessionKey)this.inventory=clone(this.adapter.inventory());
    const configured=configurationInventory(this.getConfiguration()),merged=mergeInventory(configured,this.inventory);
    this.identity.reconcile(merged.entities,this.inventory.bindings||[]);this.entities=merged.entities;this.inventoryPending=[...merged.pending,...this.identity.pending];this.changed();return this.entities;
  }
  changed(){this.revision++;this.states=null;if(this.queuePending||this.disposed)return;this.queuePending=true;queueMicrotask(()=>{this.queuePending=false;if(this.disposed)return;const snapshot=this.snapshot();for(const listener of this.listeners){try{listener(snapshot);}catch{/* A view cannot invalidate accepted monitoring data. */}}});}
  subscribe(listener){this.listeners.add(listener);listener(this.snapshot());return()=>this.listeners.delete(listener);}
  tick(){this.changed();return this.snapshot();}
  stateFor(id){this.refresh();return this.states.has(id)?clone(this.states.get(id)):null;}
  refresh(){const now=this.clock();if(!this.states||this.stateTime!==now){this.states=this.healthEngine.derive(this.entities,this.telemetry,{now,connection:this.connection});this.stateTime=now;}}
  snapshot(){this.refresh();return{mode:this.mode,provider:this.provider,connection:clone(this.connection),entities:[...this.states.values()].map(clone),history:this.telemetry.history.map(clone),unmapped:[...this.unmapped,...this.inventoryPending||[]].map(clone),rejected:this.telemetry.rejected.map(clone),revision:this.revision};}
  connectionChanged(input){
    assertSafeData(input);const state=typeof input==='string'?input:input.state||input.status;
    if(!['connecting','connected','disconnected','reconnecting','retrying','offline','failed','pending'].includes(state))throw Error('Unknown connection state');
    if(input.provider&&input.provider!==this.provider||input.mode&&input.mode!==this.mode)throw Error('Connection namespace mismatch');
    const connected=state==='connected',now=this.clock(),wasConnected=this.connection.connected;
    this.connection={state,connected,sinceMs:connected?now:wasConnected?now:this.connection.sinceMs,at:new Date(now).toISOString(),message:typeof input.message==='string'?input.message.slice(0,500):state,attempt:input.attempt||0};this.changed();
    if(['disconnected','offline'].includes(state)&&!this.controller?.signal.aborted)this.scheduleReconnect();
  }
  accept(input){
    if(input?.provider!==this.provider||input?.mode!==this.mode)return this.telemetry.reject('namespace',input?.id,'Adapter namespaces cannot mix');
    let event;try{event=normalizeEvent(input,{now:this.clock()});}catch(error){const result=this.telemetry.reject('invalid',input?.id,error.message);this.changed();return result;}
    const entityId=this.identity.resolve(event);
    if(!entityId){this.unmapped.push({event,reason:'unresolved-identity'});if(this.unmapped.length>200)this.unmapped.shift();this.changed();return{accepted:false,reason:'unmapped'};}
    const result=this.telemetry.ingest({...event,entityId});this.changed();return result;
  }
  stopTransport(){this.generation++;this.controller?.abort();this.controller=null;try{this.unsubscribe?.();}catch{}this.unsubscribe=null;clearTimeout(this.retryTimer);this.retryTimer=null;}
  disconnect(){this.stopTransport();this.connection={state:'disconnected',connected:false,sinceMs:this.clock(),at:new Date(this.clock()).toISOString(),message:'Read-only monitoring disconnected'};this.changed();}
  async connect(adapter=this.adapter,{automatic=false}={}){
    if(this.disposed)throw Error('DigitalTwinService is disposed');if(!adapter)throw Error('A read-only adapter is required');
    const previous=this.adapter,key=JSON.stringify([adapter.provider,adapter.mode,adapter.resetRevision||0]);this.stopTransport();this.adapter=adapter;if(!automatic)this.autoReconnectAttempts=0;
    if(previous!==adapter||key!==this.sessionKey){this.telemetry.clear();this.unmapped=[];this.inventory={nodes:[],bindings:[]};this.reconcile();}this.sessionKey=key;
    const generation=this.generation,controller=new AbortController();this.controller=controller;
    for(let attempt=0;attempt<=this.maxRetries;attempt++){
      if(controller.signal.aborted||generation!==this.generation)return false;
      this.connectionChanged({state:attempt?'retrying':'connecting',attempt,message:attempt?'Retrying read-only monitoring':'Connecting read-only monitoring'});
      try{
        const inventory=await adapter.getInventory({signal:controller.signal});
        if(controller.signal.aborted||generation!==this.generation)return false;
        if(inventory.provider&&inventory.provider!==this.provider||inventory.mode&&inventory.mode!==this.mode)throw Error('Inventory namespace mismatch');
        assertSafeData(inventory);this.inventory=clone(inventory);this.reconcile();
        const snapshot=await adapter.getSnapshot({signal:controller.signal});
        if(controller.signal.aborted||generation!==this.generation)return false;
        if(!snapshot||!Array.isArray(snapshot.events))throw Error('Telemetry snapshot events are required');
        for(const event of snapshot.events)this.accept(event);
        this.connectionChanged({state:'connected',message:this.mode==='mock'?'DEMO / MOCK connected':'Read-only adapter connected'});
        const current=()=>!controller.signal.aborted&&generation===this.generation;
        const unsubscribe=await adapter.subscribe({signal:controller.signal,onEvent:event=>{if(current())this.accept(event);},onConnection:connection=>{if(current()){try{this.connectionChanged(connection);}catch{this.telemetry.reject('connection-namespace',null);this.changed();}}}});
        if(!current()){unsubscribe?.();return false;}this.unsubscribe=typeof unsubscribe==='function'?unsubscribe:()=>{};return true;
      }catch(error){
        if(controller.signal.aborted||generation!==this.generation)return false;
        if(attempt===this.maxRetries){this.connectionChanged({state:error?.code==='PENDING'?'pending':'failed',attempt,message:'Read-only adapter unavailable; no live integration has been verified'});return false;}
        const resumed=await new Promise(resolve=>{const timer=setTimeout(()=>{controller.signal.removeEventListener('abort',abort);resolve(true);},this.retryBaseMs*2**attempt);const abort=()=>{clearTimeout(timer);resolve(false);};controller.signal.addEventListener('abort',abort,{once:true});});if(!resumed)return false;
      }
    }
    return false;
  }
  reconnect(){return this.connect(this.adapter);}
  async refreshInventory(){
    const generation=this.generation,inventory=await this.adapter.getInventory({signal:this.controller?.signal});
    if(generation!==this.generation||this.disposed)return false;
    if(inventory.provider!==this.provider||inventory.mode!==this.mode)throw Error('Inventory namespace mismatch');assertSafeData(inventory);this.inventory=clone(inventory);this.reconcile();return true;
  }
  scheduleReconnect(){
    // Mock outage is deliberately operator-controlled so an Offline demonstration
    // cannot reconnect itself. Live automatic attempts are bounded across sessions.
    if(this.mode==='mock'||this.retryTimer||this.disposed)return;
    if(this.autoReconnectAttempts>=this.maxRetries){this.connectionChanged({state:'failed',message:'Automatic reconnect limit reached; explicit reconnect required'});return;}
    const generation=this.generation,delay=this.retryBaseMs*2**this.autoReconnectAttempts;this.autoReconnectAttempts++;
    this.retryTimer=setTimeout(()=>{this.retryTimer=null;if(generation===this.generation&&!this.disposed)this.connect(this.adapter,{automatic:true});},delay);
  }
  dispose(){this.disconnect();this.disposed=true;this.configUnsubscribe?.();this.listeners.clear();}
}
