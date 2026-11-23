// Showcase is a semantic sequencer, not another renderer or animation loop.
// update(dt) must be called by the studio's existing RAF. All times are seconds
// at the public boundary and milliseconds internally, matching the PA film.
const clamp=value=>Math.max(0,Math.min(1,value));
const abortError=()=>Object.assign(new Error('Showcase operation cancelled'),{name:'AbortError'});
const copy=value=>value==null?value:structuredClone(value);

export const SHOWCASE_CHAPTERS=Object.freeze([
  {id:'hq-front',label:'HQ · Front',duration:3200,kind:'view',view:'front',depth:0},
  {id:'hq-low',label:'HQ · Low angle',duration:2800,kind:'view',view:'low'},
  {id:'hq-quarter',label:'HQ · 45°',duration:2400,kind:'view',view:'quarter'},
  {id:'hq-orbit',label:'HQ · Orbit',duration:30000,kind:'hq',mode:'orbit'},
  {id:'hq-dusk',label:'HQ · Dusk',duration:2800,kind:'lighting',mode:'dusk'},
  {id:'hq-entrance',label:'HQ · Entrance',duration:2800,kind:'view',view:'entrance'},
  {id:'hq-fly-in',label:'HQ · Enter',duration:11500,kind:'hq',mode:'fly-in'},
  {id:'interior-lobby',label:'Building Interior · Draft',duration:4500,kind:'go',depth:1},
  {id:'hall-arrival',label:'Data Center Hall',duration:3000,kind:'go',depth:2},
  {id:'row-approach',label:'Rack Row',duration:3000,kind:'go',depth:3},
  {id:'rack-arrival',label:'Rack · Detail',duration:2600,kind:'go',depth:4,requires:'rack'},
  {id:'pa-cinematic',label:'PA · Cinematic / 39.7 s',duration:39700,kind:'film',requires:'internal'},
  {id:'system-focus',label:'System',duration:3200,kind:'go',depth:5,requires:'system'},
  {id:'board-focus',label:'Tray / Board',duration:3200,kind:'go',depth:6,requires:'board'},
  {id:'component-focus',label:'Component',duration:3600,kind:'go',depth:7,requires:'component'},
  {id:'rack-return',label:'Rack · Return',duration:2600,kind:'go',depth:4,requires:'rack'},
  {id:'hall-finale',label:'Hall · Finale',duration:2800,kind:'go',depth:2},
].map(chapter=>Object.freeze(chapter)));

export class ShowcaseController {
  constructor(hooks={}){
    for(const name of ['capture','restore','getSelection','go','viewHQ','setLighting','startHQ','hqState','stopHQ','beginFilm','filmState','stopFilm','pauseMotion','cancelMotion']){
      if(typeof hooks[name]!=='function')throw new TypeError(`Showcase requires ${name}()`);
    }
    this.hooks={onChange:()=>{},onError:()=>{},...hooks};
    this.chapters=SHOWCASE_CHAPTERS;this.totalDuration=this.chapters.reduce((sum,item)=>sum+item.duration,0);
    this.runId=0;this.version=0;this.index=-1;this.elapsed=0;this.status='idle';this.phase='idle';this.paused=false;this.active=false;this.disposed=false;
    this.selection=null;this.original=null;this.skipped=[];this.error=null;this.controller=null;this.waiters=new Set();this.pending=Promise.resolve(false);this.chapterProgress=0;
  }
  snapshot(){
    const chapter=this.chapters[this.index],before=this.chapters.slice(0,Math.max(0,this.index)).reduce((sum,item)=>sum+item.duration,0);
    return{status:this.status,phase:this.phase,active:this.active,paused:this.paused,runId:this.runId,index:this.index,chapterId:chapter?.id||null,label:chapter?.label||'Showcase',chapterCount:this.chapters.length,
      chapterProgress:this.chapterProgress,progress:this.status==='completed'?1:clamp((before+(chapter?.duration||0)*this.chapterProgress)/this.totalDuration),elapsedMs:this.elapsed,
      selection:copy(this.selection),skipped:copy(this.skipped),error:this.error,canRestore:this.original!==null};
  }
  notify(){this.hooks.onChange(this.snapshot());}
  context(controller,version,chapterId,extra={}){
    const isCurrent=()=>!this.disposed&&!controller.signal.aborted&&version===this.version;
    return{signal:controller.signal,isCurrent,runId:this.runId,chapterId,...extra,waitUntilResumed:()=>{
      if(!isCurrent())return Promise.reject(abortError());
      if(!this.paused)return Promise.resolve();
      return new Promise((resolve,reject)=>{
        const waiter={finish:()=>{controller.signal.removeEventListener('abort',cancel);this.waiters.delete(waiter);isCurrent()?resolve():reject(abortError());}};
        const cancel=()=>{controller.signal.removeEventListener('abort',cancel);this.waiters.delete(waiter);reject(abortError());};
        controller.signal.addEventListener('abort',cancel,{once:true});this.waiters.add(waiter);
      });
    }};
  }
  releaseWaiters(){for(const waiter of [...this.waiters])waiter.finish();}
  // Abort is synchronous. Hooks must invalidate in-flight navigation before
  // this method returns; a late loader cannot regain camera ownership.
  halt(){
    this.controller?.abort();this.controller=null;this.version++;this.releaseWaiters();
    this.hooks.stopHQ();this.hooks.stopFilm();this.hooks.cancelMotion();
  }
  missing(chapter){
    const s=this.selection||{};
    if(chapter.requires==='rack'&&!s.rackId)return 'No configured Rack is available.';
    if(chapter.requires==='system'&&!s.equipmentId)return 'No configured System is available.';
    if(['internal','board','component'].includes(chapter.requires)&&(!s.equipmentId||s.hasInternalAsset!==true))return 'This System has no supplied internal asset; no parts were invented.';
    if(['board','component'].includes(chapter.requires)&&!s.boardKey)return 'No stable Tray / Board identity is supplied by the catalog.';
    if(chapter.requires==='component'&&!s.componentKey)return 'No stable Component identity is supplied by the catalog.';
    return null;
  }
  async execute(name,args,ctx){
    await ctx.waitUntilResumed();if(!ctx.isCurrent())throw abortError();
    const result=await this.hooks[name](...args,ctx);
    if(!ctx.isCurrent())throw abortError();await ctx.waitUntilResumed();
    if(result===false)throw new Error(`${name} did not complete for ${ctx.chapterId}`);
    if(result?.skipped)throw Object.assign(new Error(result.reason||'Asset unavailable'),{name:'ShowcaseUnavailable'});
    return result;
  }
  async enter(index){
    this.halt();
    if(this.disposed||!this.active)return false;
    if(index>=this.chapters.length){this.active=false;this.paused=false;this.phase='complete';this.status='completed';this.chapterProgress=1;this.hooks.pauseMotion(false);this.notify();return true;}
    this.index=index;this.elapsed=0;this.chapterProgress=0;this.phase='loading';this.status=this.paused?'paused':'loading';
    const chapter=this.chapters[index],controller=this.controller=new AbortController(),ctx=this.context(controller,this.version,chapter.id,{durationMs:chapter.duration});
    this.notify();
    const absent=this.missing(chapter);
    if(absent){this.skipped.push({chapterId:chapter.id,reason:absent});return this.enter(index+1);}
    try{
      if(chapter.id==='hq-front'){
        await this.execute('go',[0,{}],ctx);
        await this.execute('setLighting',['day'],ctx);
      }
      if(chapter.kind==='view')await this.execute('viewHQ',[chapter.view],ctx);
      if(chapter.kind==='go')await this.execute('go',[chapter.depth,copy(this.selection)],ctx);
      if(chapter.kind==='lighting')await this.execute('setLighting',[chapter.mode],ctx);
      if(chapter.kind==='hq')await this.execute('startHQ',[chapter.mode],ctx);
      if(chapter.kind==='film')await this.execute('beginFilm',[copy(this.selection)],ctx);
      if(!ctx.isCurrent())return false;
      this.phase='playing';this.status=this.paused?'paused':'playing';this.notify();return true;
    }catch(error){
      if(!ctx.isCurrent()||error.name==='AbortError')return false;
      if(error.name==='ShowcaseUnavailable'){this.skipped.push({chapterId:chapter.id,reason:error.message});return this.enter(index+1);}
      return this.fail(error,ctx);
    }
  }
  async play(){
    if(this.disposed)return false;
    if(this.active)return this.paused?this.resume():true;
    // A completed run retains the original return point until Stop or Replay.
    if(this.status==='restoring')await this.pending;
    if(this.disposed)return false;
    this.halt();this.runId++;this.index=-1;this.elapsed=0;this.chapterProgress=0;this.error=null;this.skipped=[];this.paused=false;
    try{if(this.original===null)this.original=this.hooks.capture();this.selection=copy(this.hooks.getSelection());}
    catch(error){this.error=error.message;this.status='error';this.hooks.onError(error);this.notify();return false;}
    this.active=true;this.hooks.pauseMotion(false);this.pending=this.enter(0);return this.pending;
  }
  pause(){
    if(!this.active||this.paused)return false;
    this.paused=true;this.status='paused';this.hooks.pauseMotion(true);this.notify();return true;
  }
  resume(){
    if(!this.active||!this.paused)return false;
    this.paused=false;this.status=this.phase==='loading'?'loading':'playing';this.hooks.pauseMotion(false);this.releaseWaiters();this.notify();return true;
  }
  async stop({restore=true}={}){
    if(this.disposed)return false;
    this.halt();this.active=false;this.paused=false;this.hooks.pauseMotion(false);this.phase='idle';
    if(!restore||this.original===null){this.status='stopped';if(!restore)this.original=null;this.notify();return true;}
    const original=this.original,controller=this.controller=new AbortController(),ctx=this.context(controller,this.version,'restore');
    this.status='restoring';this.notify();
    this.pending=(async()=>{
      try{
        const result=await this.hooks.restore(original,ctx);if(!ctx.isCurrent())return false;
        if(result===false)throw new Error('The previous view could not be restored.');
        this.original=null;this.status='stopped';this.notify();return true;
      }catch(error){if(!ctx.isCurrent()||error.name==='AbortError')return false;this.error=error.message;this.status='error';this.hooks.onError(error);this.notify();return false;}
    })();return this.pending;
  }
  async replay(){if(this.disposed)return false;if(!await this.stop())return false;return this.play();}
  skip(){
    if(!this.active||this.disposed)return Promise.resolve(false);
    this.skipped.push({chapterId:this.chapters[this.index]?.id,reason:'Skipped by viewer.'});
    this.pending=this.enter(this.index+1);return this.pending;
  }
  async fail(error,ctx){
    if(!ctx.isCurrent())return false;
    const failedChapter=ctx.chapterId;this.error=error.message;
    const restoring=this.stop(),restoreVersion=this.version,restored=await restoring;
    // A viewer can supersede the restore with Replay/Stop. Never publish an old
    // failure as the state of a newer run.
    if(ctx.runId!==this.runId||restoreVersion!==this.version||this.active||this.disposed)return false;
    this.status='error';this.phase='idle';this.error=`${failedChapter}: ${error.message}${restored?'':' (restore incomplete)'}`;this.notify();this.hooks.onError(Object.assign(new Error(this.error),{cause:error}));return false;
  }
  update(dt){
    if(!this.active||this.paused||this.phase!=='playing'||this.disposed||!Number.isFinite(dt)||dt<0)return;
    const chapter=this.chapters[this.index];this.elapsed+=dt*1000;let finished=false;
    try{
      if(chapter.kind==='hq'){
        const state=this.hooks.hqState();if(state?.error)throw new Error(state.error);
        this.chapterProgress=clamp(state?.progress??this.elapsed/chapter.duration);finished=!state?.active;
      }else if(chapter.kind==='film'){
        const state=this.hooks.filmState();if(state?.error)throw new Error(state.error);
        this.chapterProgress=clamp(Number.isFinite(state?.clock)?state.clock/39700:state?.progress||0);
        finished=state?.completed===true||state?.clock>=39700||state?.progress>=1;
        if(!finished&&!state?.active)throw new Error('The PA Cinematic stopped before its 39.7 second timeline completed.');
      }else{this.chapterProgress=clamp(this.elapsed/chapter.duration);finished=this.elapsed>=chapter.duration;}
      if((chapter.kind==='hq'||chapter.kind==='film')&&this.elapsed>chapter.duration+45000&&!finished)throw new Error(`Playback stalled at ${chapter.id}`);
      this.notify();if(finished)this.pending=this.enter(this.index+1);
    }catch(error){const ctx=this.context(this.controller,this.version,chapter.id);this.pending=this.fail(error,ctx);}
  }
  dispose(){
    if(this.disposed)return;this.halt();this.hooks.pauseMotion(false);this.disposed=true;this.active=false;this.paused=false;this.original=null;this.status='disposed';this.phase='idle';this.notify();this.hooks.onChange=()=>{};this.hooks.onError=()=>{};
  }
}
