import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../../vendor/three.module.js';

const three=new URL('../../vendor/three.module.js',import.meta.url).href;
const data=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const source=file=>fs.readFileSync(new URL('../../modules/navigation/'+file,import.meta.url),'utf8').replaceAll("from 'three'",`from '${three}'`);
const envelopeURL=data(source('explore-envelope.js'));
const {createExploreEnvelope,isSafePosition,resolveSafePosition,moveInEnvelope}=await import(envelopeURL);
const {FreeExplore}=await import(data(source('free-explore.js').replace("'./explore-envelope.js'",`'${envelopeURL}'`)));
const {CameraDirector}=await import(data(source('camera-director.js')));
const vector=(x,y,z)=>new THREE.Vector3(x,y,z),box=(min,max)=>new THREE.Box3(vector(...min),vector(...max));
const raw=()=>({bounds:box([-10,0,-10],[10,10,10]),obstacles:[box([-1,0,-1],[1,6,1])],safePosition:[0,2,5],radius:.25});
const envelope=()=>createExploreEnvelope(raw());

class Surface{
  constructor(){this.listeners=new Map();}
  addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}
  removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
  emit(name,fields={}){const event={preventDefault(){this.prevented=true;},target:this,...fields};for(const fn of this.listeners.get(name)||[])fn(event);return event;}
  count(){return [...this.listeners.values()].reduce((sum,list)=>sum+list.size,0);}
}
function setup(){
  const document=new Surface(),window=new Surface(),canvas=new Surface();document.defaultView=window;canvas.ownerDocument=document;document.querySelector=()=>document.modal?{}:null;document.exitPointerLock=()=>{document.pointerLockElement=null;document.emit('pointerlockchange');};
  const camera=new THREE.PerspectiveCamera(45,1,.1,100);camera.position.set(0,2,5);camera.lookAt(0,2,0);
  const controls={target:vector(0,2,0),enabled:true,enableDamping:true,updates:0,update(){this.updates++;}},director=new CameraDirector(camera,controls),events=[];
  const controller=new FreeExplore({camera,controls,director,canvas,getEnvelope:raw,onChange:state=>events.push(state)});
  return {controller,camera,controls,director,canvas,document,window,events};
}
const editable={closest:()=>({})};

test('expanded rack sweep cannot tunnel through a thin obstacle at a large displacement',()=>{
  const e=createExploreEnvelope({bounds:box([-100,0,-100],[100,20,100]),obstacles:[box([-.01,0,-10],[.01,10,10])],safePosition:[-5,2,0],radius:.3});
  const position=moveInEnvelope(vector(-50,2,0),vector(100,0,0),e);
  assert.ok(position.x<-.31&&position.x>-.32);assert.ok(isSafePosition(position,e));
});
test('diagonal contact slides along a wall without entering its expanded clearance',()=>{
  const e=envelope(),position=moveInEnvelope(vector(-5,2,0),vector(10,0,4),e);
  assert.ok(position.x>4.9);assert.ok(position.z>3.9); // This path passes the end of the obstacle.
  const slide=moveInEnvelope(vector(-5,2,0),vector(10,0,1),e);
  assert.ok(slide.x<-1.25);assert.ok(slide.z>.99);assert.ok(isSafePosition(slide,e));
});
test('floor, ceiling and world boundary continuously clamp and slide',()=>{
  const e=envelope();for(const delta of [vector(80,-50,0),vector(-80,50,0),vector(0,0,80)]){
    const p=moveInEnvelope(vector(0,2,5),delta,e);assert.ok(isSafePosition(p,e));assert.ok(p.y>=.25&&p.y<=9.75);assert.ok(p.x>=-9.75&&p.x<=9.75);assert.ok(p.z<=9.75);
  }
});
test('unsafe and outside spawn / reset positions are validated, including fully blocked rooms',()=>{
  const e=envelope();for(const p of [vector(0,2,0),vector(100,-30,100)])assert.ok(isSafePosition(resolveSafePosition(p,e),e));
  const blocked=createExploreEnvelope({bounds:box([-1,-1,-1],[1,1,1]),obstacles:[box([-3,-3,-3],[3,3,3])],safePosition:[0,0,0],radius:.1});
  assert.equal(resolveSafePosition(vector(0,0,0),blocked),null);assert.equal(moveInEnvelope(vector(0,0,0),vector(1,0,0),blocked),null);
  assert.throws(()=>createExploreEnvelope({bounds:box([0,0,0],[.1,.1,.1])}),/usable volume/);
});
test('envelope creation leaves input boxes unchanged and invalid movement never corrupts a safe pose',()=>{
  const input=raw(),old=input.obstacles[0].min.clone(),e=createExploreEnvelope(input);assert.deepEqual(input.obstacles[0].min.toArray(),old.toArray());
  const start=vector(0,2,5);assert.deepEqual(moveInEnvelope(start,vector(NaN,0,0),e).toArray(),start.toArray());
});
test('entry cancels a pending camera move and owns exactly one disabled OrbitControls lease',async()=>{
  const {controller,director,controls}=setup();const pending=director.move([3,2,5],[0,2,0]);assert.equal(controller.enter(),true);assert.equal(await pending,false);assert.equal(director.owner,'free-explore');assert.equal(controls.enabled,false);controller.dispose();
});
test('CameraDirector pause freezes transitions and resume compensates elapsed wall time',async()=>{
  const {director,camera,controls}=setup();const pending=director.move([8,2,5],[0,2,0],{duration:1000}),start=director.transition.started;director.update(start+200);const pausedPosition=camera.position.clone();
  assert.equal(director.pause(start+200),true);assert.equal(director.pause(start+250),false);director.update(start+9000);assert.deepEqual(camera.position.toArray(),pausedPosition.toArray());assert.equal(controls.enabled,false);
  assert.equal(director.resume(start+5200),true);assert.ok(Math.abs(director.transition.started-(start+5000))<1e-9);director.update(start+5200);assert.ok(camera.position.distanceTo(pausedPosition)<1e-9);director.update(start+6001);assert.equal(await pending,true);assert.equal(director.owner,'orbit');
});
test('claim and cancel clear a paused camera owner rather than preserving a stale paused state',()=>{
  const {director,controls}=setup();director.pause();director.claim('showcase');assert.equal(director.paused,false);assert.equal(controls.enabled,false);director.pause();director.cancel();assert.equal(director.paused,false);assert.equal(controls.enabled,true);
});
test('WASD movement, sprint, speed clamp, pause and resume operate through the world envelope',()=>{
  const {controller,document,camera}=setup();controller.enter();controller.setSpeed(4);const initial=camera.position.z;
  document.emit('keydown',{code:'KeyW'});controller.update(.1);assert.ok(Math.abs(camera.position.z-(initial-.4))<1e-6);
  document.emit('keydown',{code:'ShiftLeft'});controller.update(.1);assert.ok(Math.abs(camera.position.z-(initial-1.4))<1e-6);
  controller.pause();const position=camera.position.clone();controller.update(1);assert.deepEqual(camera.position.toArray(),position.toArray());
  controller.resume();controller.update(.1);assert.deepEqual(camera.position.toArray(),position.toArray());
  controller.setSpeed(100);assert.equal(controller.speed,20);assert.equal(controller.setSpeed('bad'),false);controller.setSpeed(0);assert.equal(controller.speed,.25);controller.dispose();
});
test('input fields, contenteditable, modifiers and open dialogs do not intercept or continue WASD',()=>{
  const {controller,document,camera}=setup();controller.enter();const start=camera.position.clone();
  for(const fields of [{target:editable},{ctrlKey:true},{altKey:true},{metaKey:true}])assert.equal(document.emit('keydown',{code:'KeyW',...fields}).prevented,undefined);
  document.modal=true;assert.equal(document.emit('keydown',{code:'KeyW'}).prevented,undefined);document.modal=false;
  document.emit('keydown',{code:'KeyW'});document.activeElement=editable;controller.update(.1);assert.deepEqual(camera.position.toArray(),start.toArray());
  document.activeElement=null;controller.update(.1);assert.deepEqual(camera.position.toArray(),start.toArray());
  document.emit('keydown',{code:'Escape',target:editable});assert.equal(controller.active,true);controller.dispose();
});
test('exit and Escape release their lease at the current pose without returning to the entry view',()=>{
  const {controller,document,camera,director,controls}=setup();controller.enter();document.emit('keydown',{code:'KeyD'});controller.update(.1);const current=camera.position.clone();
  assert.equal(document.emit('keydown',{code:'Escape'}).prevented,true);assert.equal(controller.active,false);assert.equal(director.owner,'orbit');assert.equal(controls.enabled,true);assert.deepEqual(camera.position.toArray(),current.toArray());controller.dispose();
});
test('returning from first-person upward look keeps the current pose inside OrbitControls limits',()=>{
  const {controller,camera,controls}=setup();controls.maxPolarAngle=Math.PI*.485;controller.enter();camera.lookAt(camera.position.clone().add(vector(0,3,-1)));const current=camera.position.clone(),orientation=camera.quaternion.clone();controller.exit();
  const angle=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target)).phi;
  assert.ok(controls.maxPolarAngle>=angle);assert.deepEqual(camera.position.toArray(),current.toArray());assert.ok(1-Math.abs(camera.quaternion.dot(orientation))<1e-10);controller.dispose();
});
test('a superseding camera owner cannot be cancelled by stale free input or an update',()=>{
  const {controller,director,camera,document}=setup();controller.enter();director.claim('showcase');const sequence=director.sequence,position=camera.position.clone();document.emit('keydown',{code:'KeyW'});controller.update(.1);
  assert.equal(director.owner,'showcase');assert.equal(director.sequence,sequence);assert.deepEqual(camera.position.toArray(),position.toArray());assert.equal(controller.active,false);controller.dispose();
});
test('Pointer Lock is requested only by explicit canvas activation and unavailable lock permits drag look',()=>{
  const {controller,canvas,document,camera}=setup();let requests=0;canvas.requestPointerLock=()=>{requests++;throw Error('denied');};controller.enter();assert.equal(requests,0);const direction=camera.quaternion.clone();
  canvas.emit('pointerdown',{button:0,pointerType:'mouse',clientX:20,clientY:20});assert.equal(requests,1);assert.match(controller.status,/unavailable/);
  document.emit('pointermove',{clientX:40,clientY:24});assert.notDeepEqual(camera.quaternion.toArray(),direction.toArray());document.emit('pointerup');controller.dispose();
});
test('Pointer Lock loss exits, while explicit pause and late lock acquisition cannot steal a lease',()=>{
  const {controller,canvas,document,director}=setup();canvas.requestPointerLock=()=>{document.pointerLockElement=canvas;document.emit('pointerlockchange');};controller.enter();canvas.emit('pointerdown',{button:0});assert.equal(controller.pointerLocked,true);
  document.exitPointerLock();assert.equal(controller.active,false);assert.equal(director.owner,'orbit');
  controller.enter();canvas.emit('pointerdown',{button:0});controller.pause();assert.equal(controller.active,true);assert.equal(controller.paused,true);assert.equal(document.pointerLockElement,null);
  controller.exit();controller.enter();document.pointerLockElement=canvas;document.emit('pointerlockchange');assert.equal(document.pointerLockElement,null);assert.equal(controller.active,true);controller.dispose();
});
test('touch OrbitControls fallback is constrained by the same swept envelope',()=>{
  const {controller,canvas,controls,camera}=setup();controller.enter();canvas.emit('pointerdown',{pointerType:'touch',button:0});assert.equal(controller.inputMode,'touch');assert.equal(controls.enabled,true);
  controls.update=()=>camera.position.set(0,2,-5);controller.update(.1);assert.ok(camera.position.z>1.25);assert.ok(isSafePosition(camera.position,envelope()));controller.dispose();
});
test('reset validates safePosition and preserves view orientation; blur clears movement and pauses',()=>{
  const {controller,camera,window}=setup();controller.enter();controller.getEnvelope=()=>({...raw(),safePosition:[0,2,0]});const orientation=camera.quaternion.clone();assert.equal(controller.reset(),true);assert.ok(isSafePosition(camera.position,envelope()));assert.deepEqual(camera.quaternion.toArray(),orientation.toArray());window.emit('blur');assert.equal(controller.paused,true);controller.dispose();
});
test('disposing repeatedly removes every input listener and disallows reentry',()=>{
  const {controller,document,window,canvas}=setup();controller.enter();assert.ok(document.count()>0);controller.dispose();controller.dispose();assert.equal(document.count()+window.count()+canvas.count(),0);assert.equal(controller.enter(),false);
});
