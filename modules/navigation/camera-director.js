import * as THREE from 'three';

// Exactly one owner writes a camera each frame: transition, timeline or orbit.
// New transitions start at the current pose, so reversing never snaps to a key.
export class CameraDirector {
  constructor(camera,controls,{reducedMotion=false}={}){this.camera=camera;this.controls=controls;this.reducedMotion=reducedMotion;this.owner='orbit';this.transition=null;this.sequence=0;}
  flushOrbit(){const damping=this.controls.enableDamping,position=this.camera.position.clone(),target=this.controls.target.clone();this.controls.enableDamping=false;this.controls.update();this.controls.enableDamping=damping;this.camera.position.copy(position);this.controls.target.copy(target);this.camera.lookAt(target);}
  cancel(){this.sequence++;if(this.transition){this.transition.resolve(false);this.transition=null;}this.owner='orbit';this.controls.enabled=true;}
  move(position,target,{duration=850,fov=32,waypoint}={}){
    this.cancel();this.flushOrbit();this.owner='transition';this.controls.enabled=false;
    const from=this.camera.position.clone(),to=new THREE.Vector3(...position),look=this.controls.target.clone(),end=new THREE.Vector3(...target);
    const curve=waypoint?new THREE.QuadraticBezierCurve3(from,new THREE.Vector3(...waypoint),to):null;
    return new Promise(resolve=>{this.transition={from,to,look,end,curve,fov0:this.camera.fov,fov,started:performance.now(),duration:this.reducedMotion?0:duration,resolve};});
  }
  timeline(){this.cancel();this.flushOrbit();this.owner='timeline';this.controls.enabled=false;}
  update(now){
    const t=this.transition;if(t){const p=t.duration?Math.min(1,(now-t.started)/t.duration):1,s=p*p*(3-2*p);
      if(t.curve)t.curve.getPoint(s,this.camera.position);else this.camera.position.lerpVectors(t.from,t.to,s);
      this.controls.target.lerpVectors(t.look,t.end,s);this.camera.fov=t.fov0+(t.fov-t.fov0)*s;this.camera.updateProjectionMatrix();this.camera.lookAt(this.controls.target);
      if(p===1){this.transition=null;this.owner='orbit';this.controls.enabled=true;this.controls.update();t.resolve(true);}
    }else if(this.owner==='orbit')this.controls.update();
    if(this.owner!=='timeline')this.constrain?.();
  }
}
