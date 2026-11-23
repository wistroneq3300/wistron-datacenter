import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ShowcaseController,SHOWCASE_CHAPTERS} from '../../modules/navigation/showcase.js';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
function setup(overrides={}){
  const calls=[],original={depth:3,camera:{position:[1,2,3],target:[4,5,6],fov:40},selection:{rackId:'rack-stable'}};
  const runtime={paused:false,cameraOwner:'orbit',hq:{active:false,progress:0},film:{active:false,clock:0,progress:0},depth:3,restored:null};
  const hooks={
    capture:()=>structuredClone(original),getSelection:()=>({rackId:'rack-stable',equipmentId:'system-stable',boardKey:'Board1',componentKey:'Board1/CPU',hasInternalAsset:true}),
    restore:async(value,ctx)=>{if(!ctx.isCurrent())return false;calls.push(['restore']);runtime.depth=value.depth;runtime.restored=structuredClone(value);runtime.cameraOwner='orbit';return true;},
    go:async(depth,selection,ctx)=>{if(!ctx.isCurrent())return false;calls.push(['go',depth,selection]);runtime.depth=depth;return true;},
    viewHQ:async(view,ctx)=>{if(!ctx.isCurrent())return false;calls.push(['view',view]);return true;},
    setLighting:async(mode,ctx)=>{if(!ctx.isCurrent())return false;calls.push(['light',mode]);return true;},
    startHQ:async(mode,ctx)=>{if(!ctx.isCurrent())return false;calls.push(['hq',mode]);runtime.hq={active:true,progress:0};runtime.cameraOwner='timeline';return true;},
    hqState:()=>runtime.hq,
    stopHQ:()=>{runtime.hq.active=false;},
    beginFilm:async(selection,ctx)=>{if(!ctx.isCurrent())return false;calls.push(['film',selection]);runtime.film={active:true,clock:0,progress:0};runtime.cameraOwner='timeline';return true;},
    filmState:()=>runtime.film,stopFilm:()=>{runtime.film.active=false;},pauseMotion:value=>{runtime.paused=value;},cancelMotion:()=>{runtime.cameraOwner='orbit';},
    onChange:snapshot=>{runtime.snapshot=snapshot;},onError:error=>calls.push(['error',error.message]),...overrides,
  };
  const showcase=new ShowcaseController(hooks);
  return{showcase,runtime,calls,original,hooks};
}
async function reach(showcase,id){
  for(let count=0;showcase.snapshot().chapterId!==id;count++){
    assert.ok(count<SHOWCASE_CHAPTERS.length,`Could not reach ${id}`);await showcase.skip();
  }
}

test('The Showcase has a finite semantic route and preserves the original PA timeline duration',()=>{
  assert.equal(new Set(SHOWCASE_CHAPTERS.map(c=>c.id)).size,SHOWCASE_CHAPTERS.length);
  assert.equal(SHOWCASE_CHAPTERS.find(c=>c.kind==='film').duration,39700);
  assert.deepEqual(SHOWCASE_CHAPTERS.filter(c=>c.kind==='go').map(c=>c.depth),[1,2,3,4,5,6,7,4,2]);
  const source=fs.readFileSync(new URL('../../modules/navigation/showcase.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/requestAnimationFrame\s*\(|setInterval\s*\(|setTimeout\s*\(/);
});

test('Play captures a return point once and passes stable selected identity through every equipment stage',async()=>{
  let captures=0;const {showcase,calls}=setup({capture:()=>{captures++;return{depth:3};}});
  assert.equal(await showcase.play(),true);assert.equal(await showcase.play(),true);assert.equal(captures,1);
  await reach(showcase,'component-focus');
  for(const [,depth,selection] of calls.filter(c=>c[0]==='go'&&c[1]>=4)){
    assert.equal(selection.rackId,'rack-stable');assert.equal(selection.equipmentId,'system-stable');assert.equal(selection.componentKey,'Board1/CPU');assert.ok(depth<=7);
  }
  assert.equal(calls.filter(c=>c[0]==='film').length,1);showcase.dispose();
});

test('Timed chapters advance through the existing RAF update and pause without consuming elapsed time',async()=>{
  const {showcase,runtime}=setup();await showcase.play();showcase.update(1);const before=showcase.snapshot();
  assert.equal(showcase.pause(),true);showcase.update(80);assert.equal(runtime.paused,true);assert.equal(showcase.snapshot().elapsedMs,before.elapsedMs);assert.equal(showcase.snapshot().progress,before.progress);
  assert.equal(showcase.pause(),false);assert.equal(showcase.resume(),true);assert.equal(runtime.paused,false);
  showcase.update(2.2);await showcase.pending;assert.equal(showcase.snapshot().chapterId,'hq-low');showcase.dispose();
});

test('Pause while loading gates all later effects until resume',async()=>{
  const gate=deferred(),events=[];const {showcase}=setup({go:async()=>gate.promise,viewHQ:async(view)=>{events.push(view);return true;},setLighting:async mode=>{events.push(mode);return true;}});
  const playing=showcase.play();await tick();assert.equal(showcase.pause(),true);gate.resolve(true);await tick();
  assert.deepEqual(events,[]);assert.equal(showcase.snapshot().status,'paused');assert.equal(showcase.snapshot().phase,'loading');
  showcase.resume();assert.equal(await playing,true);assert.deepEqual(events,['day','front']);showcase.dispose();
});

test('Stop cancels an outstanding load before restoring and no stale completion starts a view',async()=>{
  const gate=deferred();let context;const {showcase,calls,original,runtime}=setup({go:async(depth,selection,ctx)=>{context=ctx;return gate.promise;}});
  const playing=showcase.play();await tick();assert.equal(context.signal.aborted,false);
  assert.equal(await showcase.stop(),true);assert.equal(context.signal.aborted,true);gate.resolve(true);assert.equal(await playing,false);
  assert.equal(calls.some(c=>c[0]==='view'),false);assert.deepEqual(runtime.restored,original);assert.equal(showcase.snapshot().status,'stopped');assert.equal(runtime.cameraOwner,'orbit');
});

test('Stop releases a pause gate even if the original loader resolves after cancellation',async()=>{
  const gate=deferred();const {showcase}=setup({viewHQ:async()=>gate.promise});const playing=showcase.play();await tick();showcase.pause();gate.resolve(true);await tick();
  await showcase.stop();assert.equal(await playing,false);assert.equal(showcase.waiters.size,0);assert.equal(showcase.active,false);
});

test('Skip invalidates an old loading chapter and preserves the paused state of the new chapter',async()=>{
  const gate=deferred();let first=true;const views=[];
  const {showcase}=setup({viewHQ:async(view)=>{views.push(view);if(first){first=false;return gate.promise;}return true;}});
  const playing=showcase.play();await tick();showcase.pause();const skipping=showcase.skip();gate.resolve(true);await tick();
  assert.equal(await playing,false);assert.equal(showcase.snapshot().chapterId,'hq-low');assert.deepEqual(views,['front']);
  showcase.resume();assert.equal(await skipping,true);assert.deepEqual(views,['front','low']);assert.equal(showcase.snapshot().skipped[0].reason,'Skipped by viewer.');showcase.dispose();
});

test('HQ chapters wait for actual HQ playback; PA chapter waits for the actual 39.7 second endpoint',async()=>{
  const {showcase,runtime}=setup();await showcase.play();await reach(showcase,'hq-orbit');showcase.update(30);assert.equal(showcase.snapshot().chapterId,'hq-orbit');
  runtime.hq.progress=1;runtime.hq.active=false;showcase.update(0);await showcase.pending;assert.equal(showcase.snapshot().chapterId,'hq-dusk');
  await reach(showcase,'pa-cinematic');showcase.update(40);assert.equal(showcase.snapshot().chapterId,'pa-cinematic');
  runtime.film.clock=39699;runtime.film.progress=.999;showcase.update(0);assert.equal(showcase.snapshot().chapterId,'pa-cinematic');
  runtime.film.clock=39700;runtime.film.progress=1;showcase.update(0);await showcase.pending;assert.equal(showcase.snapshot().chapterId,'system-focus');showcase.dispose();
});

test('A complete run finishes in Hall, retains its return point, and Stop restores the exact captured state',async()=>{
  const {showcase,runtime,original}=setup();await showcase.play();
  for(let count=0;showcase.active;count++){
    assert.ok(count<30);const chapter=SHOWCASE_CHAPTERS[showcase.index];
    if(chapter.kind==='hq'){runtime.hq.active=false;runtime.hq.progress=1;}
    if(chapter.kind==='film'){runtime.film.clock=39700;runtime.film.progress=1;}
    showcase.update(chapter.duration/1000);await showcase.pending;
  }
  assert.equal(showcase.snapshot().status,'completed');assert.equal(showcase.snapshot().progress,1);assert.equal(showcase.snapshot().skipped.length,0);assert.equal(runtime.depth,2);assert.equal(runtime.restored,null);
  assert.equal(await showcase.stop(),true);assert.deepEqual(runtime.restored,original);assert.equal(showcase.snapshot().canRestore,false);
});

test('Replay restores before starting and cannot be overwritten by a previous cancelled loader',async()=>{
  const gate=deferred(),views=[];let first=true;
  const {showcase,calls}=setup({viewHQ:async(view,ctx)=>{if(first){first=false;await gate.promise;}if(!ctx.isCurrent())return false;views.push([ctx.runId,view]);return true;}});
  const firstPlay=showcase.play();await tick();assert.equal(await showcase.replay(),true);const run=showcase.runId;gate.resolve(true);assert.equal(await firstPlay,false);
  assert.deepEqual(views,[[run,'front']]);assert.ok(calls.some(c=>c[0]==='restore'));assert.equal(showcase.snapshot().status,'playing');showcase.dispose();
});

test('Missing catalog assets are explicitly skipped and never fabricate a Board or Component',async()=>{
  const {showcase,calls}=setup({getSelection:()=>({rackId:'r',equipmentId:'s',hasInternalAsset:false})});await showcase.play();await reach(showcase,'rack-arrival');
  await showcase.skip();assert.equal(showcase.snapshot().chapterId,'system-focus');await showcase.skip();assert.equal(showcase.snapshot().chapterId,'rack-return');
  assert.deepEqual(showcase.snapshot().skipped.filter(c=>c.reason!=='Skipped by viewer.').map(c=>c.chapterId),['pa-cinematic','board-focus','component-focus']);
  assert.equal(calls.some(c=>c[0]==='film'||c[0]==='go'&&c[1]>=6),false);showcase.dispose();
});

test('An explicitly unavailable asset can recover to the next chapter without reporting a successful load',async()=>{
  const {showcase}=setup({beginFilm:async()=>({skipped:true,reason:'Configured geometry has no safe PA camera clearance.'})});await showcase.play();await reach(showcase,'rack-arrival');await showcase.skip();
  assert.equal(showcase.snapshot().chapterId,'system-focus');assert.equal(showcase.snapshot().skipped.at(-1).reason,'Configured geometry has no safe PA camera clearance.');showcase.dispose();
});

test('An actual load error restores the original state and remains a visible error',async()=>{
  const {showcase,runtime,calls,original}=setup({viewHQ:async()=>{throw new Error('HDR decoding failed');}});
  assert.equal(await showcase.play(),false);assert.equal(showcase.snapshot().status,'error');assert.match(showcase.snapshot().error,/hq-front: HDR decoding failed/);assert.deepEqual(runtime.restored,original);assert.equal(runtime.cameraOwner,'orbit');assert.equal(calls.filter(c=>c[0]==='error').length,1);
});

test('A stale error restoration cannot overwrite a newer Stop request',async()=>{
  const gate=deferred();let first=true;
  const {showcase}=setup({viewHQ:async()=>{throw new Error('Failed first scene');},restore:async(value,ctx)=>{if(first){first=false;await gate.promise;}return ctx.isCurrent();}});
  const playing=showcase.play();await tick();assert.equal(showcase.snapshot().status,'restoring');assert.equal(await showcase.stop(),true);gate.resolve(true);await playing;assert.equal(showcase.snapshot().status,'stopped');
});

test('Unexpected PA cancellation is an error, never a successful cinematic or skipped test',async()=>{
  const {showcase,runtime}=setup();await showcase.play();await reach(showcase,'pa-cinematic');runtime.film.active=false;showcase.update(.1);await showcase.pending;
  assert.equal(showcase.snapshot().status,'error');assert.match(showcase.snapshot().error,/stopped before its 39.7 second/);assert.equal(showcase.snapshot().active,false);
});

test('Disposal during asynchronous loading synchronously releases ownership and prevents continuation',async()=>{
  const gate=deferred();let ctx;const {showcase,runtime}=setup({viewHQ:async(view,context)=>{ctx=context;return gate.promise;}});
  const playing=showcase.play();await tick();showcase.dispose();assert.equal(ctx.signal.aborted,true);gate.resolve(true);assert.equal(await playing,false);
  assert.equal(showcase.snapshot().status,'disposed');assert.equal(runtime.cameraOwner,'orbit');assert.equal(await showcase.play(),false);assert.equal(await showcase.stop(),false);
});
