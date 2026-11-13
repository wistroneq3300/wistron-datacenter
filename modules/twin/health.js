const severity={healthy:0,unknown:1,stale:2,offline:3,recovering:4,warning:5,fail:6};
const strongest=states=>states.reduce((health,state)=>severity[state]>severity[health]?state:health,'healthy');

export class HealthStateEngine {
  constructor({staleAfterMs=15000,offlineAfterMs=5000}={}){if(!(staleAfterMs>0)||!(offlineAfterMs>=0))throw Error('Invalid health freshness policy');this.staleAfterMs=staleAfterMs;this.offlineAfterMs=offlineAfterMs;}
  derive(entities,telemetry,{now=Date.now(),connection={state:'disconnected'}}={}){
    const states=new Map(),children=new Map();for(const entity of entities.values()){if(!children.has(entity.parentId))children.set(entity.parentId,[]);children.get(entity.parentId).push(entity.id);}
    const disconnected=connection.connected===false||connection.connected===undefined&&connection.state!=='connected',offline=connection.state==='offline'||disconnected&&now-(connection.sinceMs??now)>=this.offlineAfterMs;
    for(const entity of entities.values()){
      const events=telemetry.forEntity(entity.id),sources=events.map(event=>{
        const ageMs=Math.max(0,now-Date.parse(event.observedAt)),stale=ageMs>this.staleAfterMs;
        const freshness=offline?'offline':stale?'stale':'fresh';
        // A missing heartbeat cannot resolve an active failure. Retain it while
        // exposing lost freshness separately; only that source may recover it.
        const health=event.health==='fail'||event.health==='warning'||event.health==='recovering'?event.health:offline?'offline':stale?'stale':event.health;
        return{provider:event.provider,source:event.source,health,lastKnownHealth:event.health,freshness,ageMs,observedAt:event.observedAt,receivedAt:event.receivedAt,eventId:event.id,sequence:event.sequence,metrics:event.metrics,test:event.test,links:event.links,message:event.message};
      });
      const lastUpdatedAt=events.length?events.reduce((latest,event)=>Date.parse(event.observedAt)>Date.parse(latest)?event.observedAt:latest,events[0].observedAt):null;
      const freshness=!sources.length?'unknown':sources.some(source=>source.freshness==='offline')?'offline':sources.some(source=>source.freshness==='stale')?'stale':'fresh';
      states.set(entity.id,{...entity,health:sources.length?strongest(sources.map(source=>source.health)):'unknown',ownHealth:sources.length?strongest(sources.map(source=>source.health)):'unknown',hasObservation:!!sources.length,lastUpdatedAt,freshness,sources,tests:sources.filter(source=>source.test).map(source=>({...source.test,source:source.source,observedAt:source.observedAt})),alerts:sources.filter(source=>['warning','fail','recovering','offline','stale'].includes(source.health)).map(source=>({entityId:entity.id,...source})),derivedFrom:[]});
    }
    const visiting=new Set(),done=new Set();
    const aggregate=id=>{
      if(done.has(id))return states.get(id);if(visiting.has(id))throw Error('Inventory hierarchy cycle');visiting.add(id);const state=states.get(id);
      const childStates=(children.get(id)||[]).map(aggregate).filter(child=>{
        if(state.kind==='system')return child.kind==='node'||child.hasObservation;
        if(state.kind==='board')return child.hasObservation;
        return ['site','interior','hall','row','rack'].includes(state.kind)&&!['board','component'].includes(child.kind);
      });
      if(childStates.length){const candidates=[...childStates.map(child=>child.health),...(state.sources.length?[state.ownHealth]:[])];state.health=strongest(candidates);state.hasObservation||=childStates.some(child=>child.hasObservation);state.derivedFrom=childStates.filter(child=>child.health===state.health).map(child=>child.id);state.alerts=[...state.alerts,...childStates.flatMap(child=>child.alerts)];
        const times=[state.lastUpdatedAt,...childStates.map(child=>child.lastUpdatedAt)].filter(Boolean);if(times.length)state.lastUpdatedAt=times.reduce((a,b)=>Date.parse(a)>Date.parse(b)?a:b);
        const freshness=[...(state.sources.length?[state.freshness]:[]),...childStates.map(child=>child.freshness)];state.freshness=freshness.includes('offline')?'offline':freshness.includes('stale')?'stale':freshness.includes('unknown')?'unknown':'fresh';
      }
      visiting.delete(id);done.add(id);return state;
    };for(const id of states.keys())aggregate(id);return states;
  }
}
