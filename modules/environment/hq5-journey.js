import * as THREE from 'three';

const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
const vector=a=>new THREE.Vector3(...a);
export const HQ_VIEWS=Object.freeze(['front','side','quarter','aerial','entrance']);

// HQ owns no animation loop, renderer, configuration or equipment state. The
// studio invokes update and the existing CameraDirector grants camera ownership.
export class HQJourney {
  constructor({hq,camera,controls,director,getDepth,enterHQ,enterInterior,onFade=()=>{},onChange=()=>{},onError=()=>{},reducedMotion=false}){
    Object.assign(this,{hq,camera,controls,director,getDepth,enterHQ,enterInterior,onFade,onChange,onError,reducedMotion});
    this.active=false;this.paused=false;this.phase='idle';this.mode=null;this.progress=0;this.elapsed=0;this.token=0;this.disposed=false;this.ownsCamera=false;this.fade=0;this.lastView='quarter';
  }
  snapshot(){return{active:this.active,paused:this.paused,phase:this.phase,mode:this.mode,progress:this.progress,view:this.lastView,fade:this.fade};}
  notify(){this.onChange(this.snapshot());}
  setFade(value){this.fade=clamp(value);this.onFade(this.fade);}
  cancel(){this.token++;if(this.ownsCamera&&this.director.sequence===this.ownedSequence)this.director.cancel();this.ownsCamera=false;this.active=false;this.paused=false;this.phase='idle';this.mode=null;this.progress=0;this.setFade(0);this.notify();}
  async ready(token){
    if(this.disposed||token!==this.token)return false;
    if(this.getDepth()!==0){
      const opening=this.enterHQ();this.ownsCamera=true;this.ownedSequence=this.director.sequence;
      const completed=await opening;
      if(token!==this.token||this.disposed)return false;
      this.ownsCamera=false;if(!completed)return false;
    }
    return !this.disposed&&token===this.token&&this.getDepth()===0;
  }
  async view(name){
    if(!HQ_VIEWS.includes(name))throw new Error('Unknown HQ camera preset');
    this.cancel();const token=this.token;if(!await this.ready(token))return false;const pose=this.hq.pose(name);
    this.active=true;this.mode='preset';this.phase='transition';this.lastView=name;this.ownsCamera=true;this.notify();
    const moving=this.director.move(pose.position,pose.target,{fov:pose.fov??43,duration:1100});this.ownedSequence=this.director.sequence;const completed=await moving;
    if(token!==this.token||this.disposed)return false;
    this.ownsCamera=false;this.active=false;this.mode=null;this.phase='idle';this.notify();return completed;
  }
  async play(mode='orbit'){
    if(!['orbit','fly-in'].includes(mode))throw new Error('Unknown HQ cinematic');
    this.cancel();const token=this.token;if(!await this.ready(token))return false;
    if(this.reducedMotion){
      if(mode==='orbit')return this.view('quarter');
      return this.enterInterior();
    }
    this.mode=mode;this.active=true;this.phase='intro';this.lastView=mode==='orbit'?'quarter':'front';this.ownsCamera=true;this.notify();
    // Fly-in starts at a high exterior camera, so even a manually moved camera
    // first returns to an authored exterior pose under director ownership.
    const pose={...this.hq.pose(mode==='orbit'?'quarter':'front')};
    if(mode==='orbit'){const offset=vector(pose.position).sub(vector(pose.target)),radius=Math.hypot(offset.x,offset.z);if(radius<48){const a=Math.atan2(offset.x,offset.z);pose.position=[pose.target[0]+Math.sin(a)*48,pose.position[1],pose.target[2]+Math.cos(a)*48];}}
    const moving=this.director.move(pose.position,pose.target,{fov:pose.fov??43,duration:1100});this.ownedSequence=this.director.sequence;const completed=await moving;
    if(!completed||token!==this.token||this.disposed||this.getDepth()!==0){if(token===this.token)this.cancel();return false;}
    this.director.timeline();this.ownedSequence=this.director.sequence;this.phase='playing';this.elapsed=0;this.progress=0;
    this.start={position:this.camera.position.clone(),target:this.controls.target.clone(),fov:this.camera.fov};
    if(mode==='orbit'){
      const offset=this.start.position.clone().sub(this.start.target);this.radius=Math.max(48,Math.hypot(offset.x,offset.z));this.angle=Math.atan2(offset.x,offset.z);this.duration=30000;
    }else{
      const entry=this.hq.journeyEntry||{approach:[-8.15,1.8,.5],door:[-8.15,1.8,-4.5],target:[-8.15,1.8,-7]};
      this.entry={approach:vector(entry.approach),door:vector(entry.door),target:vector(entry.target)};this.duration=11000;
      this.control=this.start.position.clone().lerp(this.entry.approach,.65);this.control.y=Math.max(5.5,this.control.y*.7);
    }
    this.notify();return true;
  }
  pause(){if(!this.active||this.phase!=='playing')return false;this.paused=!this.paused;this.notify();return this.paused;}
  resume(){if(!this.active||!this.paused)return false;this.paused=false;this.notify();return true;}
  async handoff(){
    const token=this.token;this.phase='handoff';this.ownsCamera=false;this.setFade(1);this.director.cancel();this.notify();
    try{const completed=await this.enterInterior();if(token!==this.token||this.disposed)return;if(!completed){this.cancel();return;}this.phase='reveal';this.elapsed=0;this.notify();}
    catch(error){if(token===this.token){this.cancel();this.onError(error);}}
  }
  update(dt){
    if(!this.active||this.disposed)return;
    if(this.phase==='handoff')return;
    if(this.phase==='reveal'){this.elapsed+=Math.max(0,dt)*1000;this.setFade(1-smooth(this.elapsed/500));if(this.elapsed>=500){this.cancel();}return;}
    if(this.getDepth()!==0){this.cancel();return;}
    if(this.phase!=='playing'||this.paused)return;
    // A user or another semantic transition may have taken the director. Never
    // steal it back during the next animation frame.
    if(this.director.owner!=='timeline'||this.director.sequence!==this.ownedSequence){this.cancel();return;}
    this.elapsed=Math.min(this.duration,this.elapsed+Math.max(0,dt)*1000);const p=this.progress=this.elapsed/this.duration;
    if(this.mode==='orbit'){
      const a=this.angle+Math.PI*2*smooth(p),center=this.start.target;
      this.camera.position.set(center.x+Math.sin(a)*this.radius,this.start.position.y+3*Math.sin(Math.PI*p)**2,center.z+Math.cos(a)*this.radius);this.controls.target.copy(center);
    }else{
      const approach=smooth(Math.min(1,p/.82)),one=1-approach;
      this.camera.position.copy(this.start.position).multiplyScalar(one*one).addScaledVector(this.control,2*one*approach).addScaledVector(this.entry.approach,approach*approach);
      this.controls.target.lerpVectors(this.start.target,this.entry.target,approach);
      this.camera.fov=this.start.fov+(48-this.start.fov)*approach;
      // The final doorway movement is covered before the camera reaches the
      // facade. No unmodelled building corridor is invented for this transition.
      if(p>.82)this.camera.position.lerpVectors(this.entry.approach,this.entry.door,smooth((p-.82)/.18));
      this.setFade(smooth((p-.77)/.10));
    }
    this.camera.updateProjectionMatrix();this.camera.lookAt(this.controls.target);this.notify();
    if(p>=1){if(this.mode==='fly-in')this.handoff().catch(()=>{});else this.cancel();}
  }
  dispose(){this.cancel();this.disposed=true;this.onChange=()=>{};this.onFade=()=>{};}
}
