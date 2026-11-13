import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../../vendor/three.module.js';
const source=fs.readFileSync(new URL('../../modules/environment/hq5-journey.js',import.meta.url),'utf8').replace("from 'three'",`from '${new URL('../../vendor/three.module.js',import.meta.url).href}'`);
const {HQJourney,HQ_VIEWS}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(options={}){
  const camera=new THREE.PerspectiveCamera(),controls={target:new THREE.Vector3(),enabled:true},state={depth:0},fades=[];
  const director={owner:'orbit',sequence:0,cancel(){this.sequence++;this.owner='orbit';controls.enabled=true;this.resolve?.(false);this.resolve=null;},timeline(){this.cancel();this.owner='timeline';controls.enabled=false;},move(position,target,{fov}){this.cancel();camera.position.fromArray(position);controls.target.fromArray(target);camera.fov=fov;return Promise.resolve(true);}};
  const hq={pose:name=>({position:name==='front'?[-8,9,42]:[48,30,52],target:[-3,12,-12],fov:name==='front'?38:43}),journeyEntry:{approach:[-8.15,1.8,.5],door:[-8.15,1.8,-4.5],target:[-8.15,1.8,-7]}};
  const journey=new HQJourney({hq,camera,controls,director,getDepth:()=>state.depth,enterHQ:async()=>{state.depth=0;return true;},enterInterior:async()=>{state.depth=1;return true;},onFade:value=>fades.push(value),...options});
  return{journey,camera,controls,director,state,fades};
}
test('HQ presets preserve the authored pose and reject unknown controls',async()=>{
  const {journey,camera,director}=setup();for(const name of HQ_VIEWS){assert.equal(await journey.view(name),true);assert.equal(journey.snapshot().view,name);assert.equal(journey.active,false);assert.equal(director.owner,'orbit');}
  await journey.view('front');assert.equal(camera.fov,38);await assert.rejects(journey.view('invalid'),/Unknown/);
});
test('HQ orbit performs one finite exterior revolution and releases camera ownership',async()=>{
  const {journey,camera,director,controls}=setup();assert.equal(await journey.play('orbit'),true);const first=camera.position.clone(),center=controls.target.clone();
  for(let i=0;i<600;i++){journey.update(.05);assert.ok(camera.position.toArray().every(Number.isFinite));assert.ok(Math.hypot(camera.position.x-center.x,camera.position.z-center.z)>=48-.001);}
  assert.ok(camera.position.distanceTo(first)<.001);assert.equal(journey.active,false);assert.equal(director.owner,'orbit');assert.equal(controls.enabled,true);
});
test('Pause freezes HQ motion and cancel keeps the current camera pose',async()=>{
  const {journey,camera}=setup();await journey.play('orbit');journey.update(4);const pose=camera.position.clone();assert.equal(journey.pause(),true);journey.update(10);assert.deepEqual(camera.position.toArray(),pose.toArray());journey.cancel();journey.update(10);assert.deepEqual(camera.position.toArray(),pose.toArray());
});
test('A later CameraDirector owner cannot be cancelled or overwritten by HQ update',async()=>{
  const {journey,camera,director}=setup();await journey.play('orbit');await director.move([99,88,77],[0,0,0],{fov:44});director.owner='transition';const sequence=director.sequence;journey.update(1);assert.equal(journey.active,false);assert.equal(director.owner,'transition');assert.equal(director.sequence,sequence);assert.deepEqual(camera.position.toArray(),[99,88,77]);
});
test('Cancelling an unfinished HQ camera introduction prevents late timeline activation',async()=>{
  const {journey,director}=setup();director.move=function(){this.cancel();this.owner='transition';return new Promise(resolve=>this.resolve=resolve);};const playing=journey.play('orbit');await tick();journey.cancel();assert.equal(await playing,false);assert.equal(journey.active,false);assert.equal(director.owner,'orbit');
});
test('Fly-in covers the doorway before entering Interior and reveals only after handoff',async()=>{
  const {journey,state,fades}=setup();await journey.play('fly-in');journey.update(9.57);assert.ok(journey.fade>.999999);assert.equal(state.depth,0);journey.update(1.43);assert.equal(journey.phase,'handoff');assert.equal(journey.fade,1);await tick();assert.equal(state.depth,1);assert.equal(journey.phase,'reveal');journey.update(.5);assert.equal(journey.active,false);assert.equal(journey.fade,0);assert.ok(fades.every(value=>value>=0&&value<=1));
});
test('Cancellation during an awaited Interior handoff cannot reapply a late fade',async()=>{
  let resolve;const {journey}=setup({enterInterior:()=>new Promise(done=>resolve=done)});await journey.play('fly-in');journey.update(11);assert.equal(journey.phase,'handoff');journey.cancel();resolve(true);await tick();assert.equal(journey.phase,'idle');assert.equal(journey.fade,0);
});
test('Cancellation while returning to HQ prevents a late preset or cinematic from starting',async()=>{
  for(const mode of ['preset','orbit']){
    let complete;const {journey,state,director,camera}=setup();state.depth=2;
    journey.enterHQ=()=>{director.owner='transition';director.sequence++;return new Promise(resolve=>complete=resolve);};
    const pending=mode==='preset'?journey.view('entrance'):journey.play('orbit');await tick();journey.cancel();state.depth=0;complete(true);
    assert.equal(await pending,false);assert.equal(journey.active,false);assert.equal(director.owner,'orbit');assert.deepEqual(camera.position.toArray(),[0,0,0]);
  }
});
test('A stale HQ return cannot overwrite a newer camera preset',async()=>{
  let complete;const {journey,state,camera}=setup();state.depth=2;journey.enterHQ=()=>new Promise(resolve=>complete=resolve);
  const previous=journey.play('fly-in');await tick();state.depth=0;assert.equal(await journey.view('front'),true);const chosen=camera.position.toArray();complete(true);
  assert.equal(await previous,false);assert.equal(journey.snapshot().view,'front');assert.deepEqual(camera.position.toArray(),chosen);assert.equal(journey.active,false);
});
test('Disposal during an asynchronous HQ return never starts a new camera transition',async()=>{
  let complete;const {journey,state,director}=setup();state.depth=1;journey.enterHQ=()=>new Promise(resolve=>complete=resolve);
  const pending=journey.view('side');await tick();journey.dispose();const sequence=director.sequence;state.depth=0;complete(true);assert.equal(await pending,false);assert.equal(director.sequence,sequence);assert.equal(journey.active,false);
});
test('Reduced Motion uses static presets and semantic entry without camera playback',async()=>{
  const {journey,state}=setup({reducedMotion:true});assert.equal(await journey.play('orbit'),true);assert.equal(journey.active,false);assert.equal(await journey.play('fly-in'),true);assert.equal(state.depth,1);assert.equal(journey.active,false);
});
