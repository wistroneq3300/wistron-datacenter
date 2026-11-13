const $=id=>document.getElementById(id);
const text=(tag,value,className)=>{const el=document.createElement(tag);el.textContent=value??'';if(className)el.className=className;return el;};
const STATUS={healthy:'Healthy',warning:'Warning',fail:'FAIL',recovering:'Recovering',unknown:'Unknown',offline:'Offline',stale:'Stale Data'};
const steps=[['healthy','全部設備 Healthy'],['warningSystem','System Warning'],['failNode','Node FAIL'],['locate','由 Hall 定位 Node'],['recoveringNode','Node Recovering'],['recovered','恢復 Healthy'],['offline','Telemetry Offline'],['stale','Telemetry Stale'],['outOfOrder','延遲／亂序事件'],['reconnect','重新連線']];
export class TwinPanel {
  constructor({service,adapter,focusEntity,toast}){this.service=service;this.adapter=adapter;this.focusEntity=focusEntity;this.toast=toast;this.selectedId=null;this.step=-1;this.playing=false;this.disposed=false;this.token=0;
    $('twinBtn').onclick=()=>{$('twinPanel').hidden=!$('twinPanel').hidden;$('facilityPanel').hidden=true;};$('closeTwin').onclick=()=>$('twinPanel').hidden=true;
    $('twinFilter').onchange=()=>this.render(service.snapshot());$('twinSearch').oninput=()=>this.render(service.snapshot());
    $('demoStep').onclick=()=>this.next();$('demoReset').onclick=()=>this.reset();$('demoPlay').onclick=()=>this.play();
    $('twinReconnect').onclick=async()=>{try{const connected=await service.reconnect();this.toast(connected?'監測 Adapter 已重新連線':'監測來源仍無法連線；保留最後狀態，請檢查來源或恢復 Mock。');}catch(error){this.toast(error.message);}};
    document.querySelectorAll('[data-demo-scenario]').forEach(b=>b.onclick=()=>this.run(b.dataset.demoScenario));
    this.unsubscribe=service.subscribe(snapshot=>this.render(snapshot));this.render(service.snapshot());
  }
  select(id){this.selectedId=id;this.render(this.service.snapshot());}
  target(){const entities=this.service.snapshot().entities,system=entities.find(e=>e.id===$('demoSystem').value)||entities.find(e=>e.kind==='system'),node=entities.find(e=>e.kind==='node'&&e.systemId===system?.id);return{systemId:system?.id,nodeId:node?.id,rackId:system?.rackId,boardId:node?.boardId};}
  async run(name){if(this.adapter.mode!=='mock')return;try{const target=this.target();if(name==='locate'){if(target.nodeId){if(!await this.focusEntity(target.rackId,{overview:true}))return false;if(!await this.focusEntity(target.nodeId))return false;this.select(target.nodeId);}else this.toast('這個 System 尚無 Node mapping。');return;}this.adapter.advance(1000);const result=this.adapter.scenario(name,target);if(name==='offline'||name==='disconnected')this.adapter.advance(6000);this.service.tick();if(target.nodeId&&['failNode','recoveringNode','recovered'].includes(name))this.select(target.nodeId);$('demoMessage').textContent=`DEMO / MOCK · ${name} · ${new Date(this.adapter.now()).toISOString()}`;return result;}catch(error){this.toast(error.message);}}
  async next(){this.step=(this.step+1)%steps.length;const [scenario,label]=steps[this.step];$('demoProgress').textContent=`${this.step+1} / ${steps.length} · ${label}`;await this.run(scenario);}
  async reset(){this.playing=false;this.token++;this.step=-1;this.selectedId=null;await this.service.disconnect();this.adapter.reset?.();await this.service.connect();$('demoProgress').textContent='尚未播放 · 初始狀態 Unknown';this.render(this.service.snapshot());}
  async play(){if(this.playing){this.playing=false;this.token++;$('demoPlay').textContent='自動播放';return;}this.playing=true;const token=++this.token;$('demoPlay').textContent='暫停示範';try{for(let i=0;i<steps.length&&this.playing&&!this.disposed&&token===this.token;i++){await this.next();await new Promise(resolve=>setTimeout(resolve,1200));}}finally{if(token===this.token){this.playing=false;$('demoPlay').textContent='自動播放';}}}
  render(snapshot){if(this.disposed)return;this.snapshot=snapshot;const mode=snapshot.mode==='mock'?'DEMO / MOCK':'PA GATEWAY · 未驗證';$('monitoringBadge').textContent=`${mode} · READ ONLY`;$('twinConnection').textContent=`${mode} · ${typeof snapshot.connection==='string'?snapshot.connection:snapshot.connection?.state||'unknown'}`;
    const systems=snapshot.entities.filter(e=>e.kind==='system'),old=$('demoSystem').value;if([...$('demoSystem').options].map(o=>o.value).join('|')!==systems.map(s=>s.id).join('|')){$('demoSystem').replaceChildren(...systems.map(s=>{const o=text('option',s.name);o.value=s.id;return o;}));if(systems.some(s=>s.id===old))$('demoSystem').value=old;}
    const query=$('twinSearch').value.toLowerCase(),filter=$('twinFilter').value,all=snapshot.entities.filter(e=>!['site','hall','row','interior','board','component'].includes(e.kind)),alarms=all.filter(e=>['warning','fail','recovering','offline','stale'].includes(e.health));
    $('twinCounts').textContent=`${all.length} 個監測實體 · ${alarms.length} 個異常／恢復 · ${all.filter(e=>e.health==='unknown').length} 個 Unknown`;
    const visible=(filter==='alerts'?alarms:all).filter(e=>`${e.name} ${e.id} ${e.health}`.toLowerCase().includes(query));$('twinList').replaceChildren();
    for(const entity of visible.slice(0,300)){const button=document.createElement('button');button.className='twin-entity';button.dataset.entityId=entity.id;button.dataset.health=entity.health;button.append(text('strong',entity.name),text('span',STATUS[entity.health]||entity.health,'health-word'),text('small',`${entity.kind} · ${entity.id}`));button.onclick=async()=>{this.select(entity.id);await this.focusEntity(entity.id);};$('twinList').append(button);}
    if(!visible.length)$('twinList').append(text('p',filter==='alerts'?'目前沒有告警；沒有資料的設備仍為 Unknown。':'沒有符合搜尋的實體。'));
    $('twinUnmapped').textContent=snapshot.unmapped?.length?`${snapshot.unmapped.length} 筆未對應來源；未套用到任何設備。`:'';
    const entity=snapshot.entities.find(e=>e.id===this.selectedId);this.renderDetails(entity,snapshot);
  }
  renderDetails(entity,snapshot){const panel=$('twinDetail');panel.replaceChildren();if(!entity){panel.append(text('p','從 3D 設備或監測清單選取實體，查看同一份狀態與來源。'));return;}
    panel.dataset.entityId=entity.id;panel.dataset.health=entity.health;panel.append(text('h3',entity.name),text('p',`${STATUS[entity.health]||entity.health} · ${entity.id}`),text('p',`最後更新：${entity.lastUpdatedAt||'尚無資料'} · ${entity.freshness||'unknown'}`));
    if(entity.kind==='node')panel.append(text('p',`邏輯 Node → System：${entity.systemId}。${entity.boardId?'DEMO mapping 至既有 Board 資產；不是 OEM Node 拆分認證。':'尚無獨立 Node 模型。'}`,'evidence-note'));
    if(entity.kind==='component'&&!entity.lastUpdatedAt)panel.append(text('p','此 Component 沒有直接 Telemetry；不從父設備推論故障。','evidence-note'));
    const children=snapshot.entities.filter(e=>e.parentId===entity.id&&['system','node'].includes(e.kind));for(const child of children){const b=text('button',`${child.name} · ${STATUS[child.health]||child.health}`,'node-link');b.dataset.nodeId=child.kind==='node'?child.id:'';b.onclick=async()=>{this.select(child.id);await this.focusEntity(child.id);};panel.append(b);}
    const sources=Array.isArray(entity.sources)?entity.sources:[];for(const source of sources){panel.append(text('p',`來源：${typeof source==='string'?source:source.source||source.name||'unknown'} · ${source.observedAt||source.lastUpdatedAt||''}`));for(const metric of source.metrics||[])panel.append(text('p',`${metric.name}: ${metric.value} ${metric.unit||''}${metric.quality==='synthetic'?' · DEMO 合成數值':''}`,'telemetry-metric'));}
    for(const test of entity.tests||[])panel.append(text('p',`測試：${test.name||test.id} · ${test.status||'unknown'}`));
    const history=(snapshot.history||[]).filter(e=>e.entityId===entity.id).slice(-16).reverse();if(history.length)panel.append(text('h3','狀態與告警歷史'));
    for(const event of history){panel.append(text('p',`${event.health||event.status||'event'} · ${event.observedAt||''}\n${event.source||''} · ${event.message||event.causeCode||''}`,'event-history'));for(const link of event.links||[]){try{const url=new URL(link.url,location.origin);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)continue;const a=text('a',link.label||'檢視來源');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';panel.append(a);}catch{}}}
  }
  dispose(){this.disposed=true;this.playing=false;this.token++;this.unsubscribe?.();}
}
