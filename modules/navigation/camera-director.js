import * as THREE from 'three';

// Exactly one owner writes a camera each frame: transition, timeline or orbit.
// New transitions start at the current pose, so reversing never snaps to a key.
export class CameraDirector {
  constructor(camera,controls,{reducedMotion=false}={}){this.camera=camera;this.controls=controls;this.reducedMotion=reducedMotion;this.owner='orbit';this.transition=null;this.sequence=0;this.paused=false;this.pausedAt=0;}
  flushOrbit(){const damping=this.controls.enableDamping,position=this.camera.position.clone(),target=this.controls.target.clone();this.controls.enableDamping=false;this.controls.update();this.controls.enableDamping=damping;this.camera.position.copy(position);this.controls.target.copy(target);this.camera.lookAt(target);}
  cancel(){this.sequence++;if(this.transition){this.transition.resolve(false);this.transition=null;}this.paused=false;this.pausedAt=0;this.owner='orbit';this.controls.enabled=true;}
  move(position,target,{duration=850,fov=32,waypoint,onProgress}={}){
    this.cancel();this.flushOrbit();this.owner='transition';this.controls.enabled=false;
    const from=this.camera.position.clone(),to=new THREE.Vector3(...position),look=this.controls.target.clone(),end=new THREE.Vector3(...target);
    const curve=waypoint?new THREE.QuadraticBezierCurve3(from,new THREE.Vector3(...waypoint),to):null;
    return new Promise(resolve=>{this.transition={from,to,look,end,curve,fov0:this.camera.fov,fov,started:performance.now(),duration:this.reducedMotion?0:duration,resolve,onProgress};});
  }
  timeline(){this.cancel();this.flushOrbit();this.owner='timeline';this.controls.enabled=false;}
  // Controllers use the sequence as a lease. A superseded controller must not
  // cancel a later camera owner when an asynchronous input finishes.
  claim(owner){if(!owner||owner==='orbit'||owner==='transition')throw new Error('A named camera controller is required');this.cancel();this.flushOrbit();this.owner=owner;this.controls.enabled=false;return this.sequence;}
  pause(now=performance.now()){if(this.paused)return false;this.paused=true;this.pausedAt=now;this.controls.enabled=false;return true;}
  resume(now=performance.now()){if(!this.paused)return false;if(this.transition)this.transition.started+=Math.max(0,now-this.pausedAt);this.paused=false;this.pausedAt=0;this.controls.enabled=this.owner==='orbit';return true;}
  update(now){
    if(this.paused)return;
    const t=this.transition;if(t){const p=t.duration?Math.min(1,(now-t.started)/t.duration):1,s=p*p*(3-2*p);
      if(t.curve)t.curve.getPoint(s,this.camera.position);else this.camera.position.lerpVectors(t.from,t.to,s);
      this.controls.target.lerpVectors(t.look,t.end,s);this.camera.fov=t.fov0+(t.fov-t.fov0)*s;this.camera.updateProjectionMatrix();this.camera.lookAt(this.controls.target);t.onProgress?.(s);
      if(p===1){this.transition=null;this.owner='orbit';this.controls.enabled=true;this.controls.update();t.resolve(true);}
    }else if(this.owner==='orbit')this.controls.update();
    if(this.owner!=='timeline')this.constrain?.();
  }
}
