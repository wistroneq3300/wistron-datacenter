import * as THREE from 'three';
import {createExploreEnvelope,resolveSafePosition,moveInEnvelope} from './explore-envelope.js';

const OWNER='free-explore',KEYS=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight']);
function editing(target,document){return !!(target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')||document?.querySelector?.('dialog[open], [aria-modal="true"]'));}

// One CameraDirector lease and the application's existing frame loop. Desktop
// offers pointer lock + drag fallback; touch keeps OrbitControls gestures and
// applies the same conservative world envelope to their proposed camera pose.
export class FreeExplore {
  constructor({camera,controls,director,canvas,getEnvelope,onChange=()=>{}}){
    Object.assign(this,{camera,controls,director,canvas,getEnvelope,onChange});
    this.document=canvas.ownerDocument||globalThis.document;this.window=this.document?.defaultView||globalThis.window;
    this.active=false;this.paused=false;this.disposed=false;this.speed=4;this.pointerLocked=false;this.lockAllowed=false;this.inputMode='mouse';this.status='idle';this.keys=new Set();this.lease=-1;this.drag=null;this.lockRequest=0;
    this.euler=new THREE.Euler(0,0,0,'YXZ');this.previous=camera.position.clone();this.lookDistance=1;this.listeners=[];
    this.listen(this.document,'keydown',event=>this.keyDown(event));this.listen(this.document,'keyup',event=>this.keys.delete(event.code));
    this.listen(canvas,'pointerdown',event=>this.pointerDown(event),true);this.listen(this.document,'pointermove',event=>this.pointerMove(event));this.listen(this.document,'pointerup',()=>{this.drag=null;});
    this.listen(this.document,'pointerlockchange',()=>this.lockChanged());this.listen(this.document,'pointerlockerror',()=>this.lockFailed());
    this.listen(this.window,'blur',()=>{this.keys.clear();if(this.active)this.pause();});
    this.listen(this.document,'visibilitychange',()=>{if(this.document.hidden&&this.active)this.pause();});
    this.listen(this.document,'focusin',event=>{if(editing(event.target,this.document))this.keys.clear();});
  }
  listen(target,name,callback,options){target?.addEventListener?.(name,callback,options);this.listeners.push(()=>target?.removeEventListener?.(name,callback,options));}
  ownsCamera(){return this.director.owner===OWNER&&this.director.sequence===this.lease;}
  notify(){this.onChange(this.snapshot());}
  envelope(){return createExploreEnvelope(this.getEnvelope());}
  enter(){
    if(this.disposed)return false;if(this.active)return this.resume();
    let envelope,position;try{envelope=this.envelope();position=resolveSafePosition(this.camera.position,envelope);}catch(error){this.status=error.message;this.notify();return false;}
    if(!position){this.status='No safe exploration position';this.notify();return false;}
    this.lease=this.director.claim(OWNER);this.active=true;this.paused=false;this.inputMode='mouse';this.keys.clear();this.lookDistance=Math.max(.5,this.camera.position.distanceTo(this.controls.target));
    this.camera.position.copy(position);this.previous.copy(position);this.syncLook();this.status='Click the scene to look around; WASD move, Q/E descend/ascend';this.notify();return true;
  }
  syncLook(){const direction=new THREE.Vector3();this.camera.getWorldDirection(direction);this.controls.target.copy(this.camera.position).addScaledVector(direction,this.lookDistance);}
  pause(){if(!this.active||!this.ownsCamera())return false;this.paused=true;this.keys.clear();this.drag=null;this.controls.enabled=false;this.releasePointer();this.status='paused';this.notify();return true;}
  resume(){if(!this.active||!this.ownsCamera())return false;this.paused=false;this.controls.enabled=this.inputMode==='touch';this.status=this.inputMode==='touch'?'Touch orbit within conservative bounds':'Click the scene to look around';this.notify();return true;}
  releasePointer(){this.lockRequest++;this.lockAllowed=false;this.pointerLocked=false;if(this.document?.pointerLockElement===this.canvas)this.document.exitPointerLock?.();}
  exit(){
    if(!this.active)return false;const owned=this.ownsCamera();this.active=false;this.paused=false;this.keys.clear();this.drag=null;this.releasePointer();
    if(owned){
      this.syncLook();
      // A first-person look may exceed the old inspection polar limit. Keep
      // this exact pose valid when OrbitControls takes over; semantic Guided
      // navigation reapplies its authored limits on the next stage change.
      const spherical=new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
      this.controls.minPolarAngle=Math.min(this.controls.minPolarAngle??0,Math.max(0,spherical.phi-1e-6));
      this.controls.maxPolarAngle=Math.max(this.controls.maxPolarAngle??Math.PI,Math.min(Math.PI,spherical.phi+1e-6));
      this.controls.minDistance=Math.min(this.controls.minDistance??0,spherical.radius);
      this.controls.maxDistance=Math.max(this.controls.maxDistance??Infinity,spherical.radius);
      this.director.cancel();this.director.flushOrbit();
    }
    this.status='idle';this.notify();return true;
  }
  reset(){
    if(!this.active||!this.ownsCamera())return false;
    let envelope,position;try{envelope=this.envelope();position=resolveSafePosition(envelope.safePosition,envelope);}catch{return false;}
    if(!position)return false;this.camera.position.copy(position);this.previous.copy(position);this.syncLook();this.keys.clear();this.notify();return true;
  }
  setSpeed(value){const speed=Number(value);if(!Number.isFinite(speed))return false;this.speed=Math.max(.25,Math.min(20,speed));this.notify();return true;}
  keyDown(event){
    if(!this.active||!this.ownsCamera())return;
    if(editing(event.target,this.document)){this.keys.clear();return;}
    if(event.code==='Escape'||event.key==='Escape'){event.preventDefault();this.exit();return;}
    if(!KEYS.has(event.code)||this.paused||event.ctrlKey||event.metaKey||event.altKey)return;
    event.preventDefault();this.keys.add(event.code);
  }
  pointerDown(event){
    if(!this.active||this.paused||!this.ownsCamera()||event.button>0)return;
    if(event.pointerType==='touch'){this.inputMode='touch';this.keys.clear();this.releasePointer();this.controls.enabled=true;this.status='Touch orbit within conservative bounds';this.notify();return;}
    this.controls.enabled=false;this.inputMode='mouse';this.drag={x:event.clientX,y:event.clientY};
    if(this.pointerLocked)return;
    if(!this.canvas.requestPointerLock){this.lockFailed();return;}
    const request=++this.lockRequest;this.lockAllowed=true;this.status='requesting-pointer-lock';this.notify();
    try{const pending=this.canvas.requestPointerLock();pending?.catch?.(()=>{if(this.active&&request===this.lockRequest)this.lockFailed();});}catch{this.lockFailed();}
  }
  lockFailed(){if(!this.active||!this.ownsCamera())return;this.lockAllowed=false;this.pointerLocked=false;this.status='Pointer Lock unavailable; drag to look, WASD to move';this.notify();}
  lockChanged(){
    const locked=this.document?.pointerLockElement===this.canvas;
    if(locked&&(!this.active||this.paused||!this.ownsCamera()||!this.lockAllowed)){this.document.exitPointerLock?.();return;}
    const wasLocked=this.pointerLocked;this.pointerLocked=locked;
    if(locked){this.drag=null;this.status='WASD move · Q/E height · Shift faster · Esc exit';this.notify();}
    else if(wasLocked&&this.active)this.exit();
  }
  pointerMove(event){
    if(!this.active||this.paused||!this.ownsCamera()||this.inputMode==='touch')return;
    let dx=0,dy=0;
    if(this.pointerLocked){dx=event.movementX||0;dy=event.movementY||0;}
    else if(this.drag){dx=event.clientX-this.drag.x;dy=event.clientY-this.drag.y;this.drag={x:event.clientX,y:event.clientY};}
    else return;
    this.euler.setFromQuaternion(this.camera.quaternion);this.euler.y-=dx*.002;this.euler.x=THREE.MathUtils.clamp(this.euler.x-dy*.002,-Math.PI*.48,Math.PI*.48);this.camera.quaternion.setFromEuler(this.euler);this.syncLook();
  }
  update(dt){
    if(!this.active)return;
    if(!this.ownsCamera()){this.exit();return;}
    if(this.paused)return;
    let envelope;try{envelope=this.envelope();}catch{this.pause();return;}
    if(this.inputMode==='touch'){
      const previous=this.previous.clone();this.controls.update();const candidate=moveInEnvelope(previous,this.camera.position.clone().sub(previous),envelope);
      if(!candidate){this.pause();return;}const correction=candidate.clone().sub(this.camera.position);this.camera.position.copy(candidate);this.controls.target.add(correction);this.previous.copy(candidate);return;
    }
    const direction=new THREE.Vector3();this.camera.getWorldDirection(direction);direction.y=0;if(direction.lengthSq()<1e-8)direction.set(0,0,-1);direction.normalize();
    const right=new THREE.Vector3(-direction.z,0,direction.x),motion=new THREE.Vector3();
    if(!editing(this.document?.activeElement,this.document)){
      if(this.keys.has('KeyW'))motion.add(direction);if(this.keys.has('KeyS'))motion.sub(direction);if(this.keys.has('KeyD'))motion.add(right);if(this.keys.has('KeyA'))motion.sub(right);
      if(this.keys.has('KeyE'))motion.y++;if(this.keys.has('KeyQ'))motion.y--;
    }else this.keys.clear();
    if(motion.lengthSq()>0)motion.normalize().multiplyScalar(this.speed*(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?2.5:1)*Math.min(.1,Math.max(0,Number(dt)||0)));
    const position=moveInEnvelope(this.camera.position,motion,envelope);if(!position){this.pause();return;}
    this.camera.position.copy(position);this.previous.copy(position);this.syncLook();
  }
  snapshot(){return {active:this.active,paused:this.paused,pointerLocked:this.pointerLocked,inputMode:this.inputMode,speed:this.speed,status:this.status,owner:this.director.owner,limitation:'Conservative camera envelopes; no full physics simulation'};}
  dispose(){if(this.disposed)return;this.exit();this.disposed=true;for(const remove of this.listeners)remove();this.listeners=[];}
}
