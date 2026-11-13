import {normalizeEvent,clone,isId} from './contracts.js';

export class TelemetryStore {
  constructor({clock=()=>Date.now(),historyLimit=2000,maxStreams=20000,maxFutureSkewMs=60000}={}){this.clock=clock;this.historyLimit=historyLimit;this.maxStreams=maxStreams;this.maxFutureSkewMs=maxFutureSkewMs;this.streams=new Map();this.byEntity=new Map();this.history=[];this.seen=new Map();this.rejected=[];this.revision=0;}
  ingest(input){
    let event;try{event=normalizeEvent(input,{now:this.clock(),maxFutureSkewMs:this.maxFutureSkewMs});}catch(error){return this.reject('invalid',input?.id,error.message);}
    if(!event.entityId)return this.reject('unmapped',event.id,'Resolve identity before telemetry ingest');
    const key=JSON.stringify([event.entityId,event.provider,event.source]),identity=JSON.stringify([event.provider,event.source,event.id]);
    if(this.seen.has(identity))return this.reject('duplicate',event.id);
    const previous=this.streams.get(key);
    if(previous){const time=Date.parse(event.observedAt)-Date.parse(previous.observedAt);
      if(time<0||previous.sequence!==undefined&&event.sequence!==undefined&&event.sequence<=previous.sequence||time===0&&!(event.sequence!==undefined&&(previous.sequence===undefined||event.sequence>previous.sequence)))return this.reject('out-of-order',event.id);
    }
    if(!previous&&this.streams.size>=this.maxStreams)return this.reject('capacity',event.id);
    this.streams.set(key,event);if(!this.byEntity.has(event.entityId))this.byEntity.set(event.entityId,new Map());this.byEntity.get(event.entityId).set(key,event);this.seen.set(identity,true);while(this.seen.size>this.historyLimit*4)this.seen.delete(this.seen.keys().next().value);
    this.history.push(event);if(this.history.length>this.historyLimit)this.history.splice(0,this.history.length-this.historyLimit);this.revision++;return{accepted:true,event};
  }
  reject(reason,id){const messages={invalid:'Invalid monitoring data rejected',unmapped:'Identity mapping required',duplicate:'Duplicate event ignored','out-of-order':'Older source observation ignored',capacity:'Monitoring stream capacity reached',namespace:'Adapter namespaces cannot mix','connection-namespace':'Invalid connection namespace'};const safeReason=Object.hasOwn(messages,reason)?reason:'invalid';const result={accepted:false,reason:safeReason,id:isId(id)?id:null,message:messages[safeReason]};this.rejected.push(result);if(this.rejected.length>200)this.rejected.shift();return result;}
  forEntity(id){return[...this.byEntity.get(id)?.values()||[]];}
  historyFor(id){return this.history.filter(event=>event.entityId===id).map(clone);}
  snapshot(){return{revision:this.revision,latest:[...this.streams.values()].map(clone),history:this.history.map(clone),rejected:this.rejected.map(clone)};}
  clear(){this.streams.clear();this.byEntity.clear();this.history=[];this.seen.clear();this.rejected=[];this.revision++;}
}
