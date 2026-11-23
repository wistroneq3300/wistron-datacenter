import * as THREE from 'three';
import {RGBELoader} from '../../vendor/hq5/loaders/RGBELoader.js';
import {EffectComposer} from '../../vendor/hq5/postprocessing/EffectComposer.js';
import {RenderPass} from '../../vendor/hq5/postprocessing/RenderPass.js';
import {SSAOPass} from '../../vendor/hq5/postprocessing/SSAOPass.js';
import {OutputPass} from '../../vendor/hq5/postprocessing/OutputPass.js';

const PRESETS=Object.freeze({
  day:{hdr:'urban_street_04_1k.hdr',sun:[-34,52,28],sunColor:0xfff9f5,power:2.65,sky:0x8bb8d8,horizon:0xd6e0e7,ambient:.72,environment:.65,exposure:1.0},
  dusk:{hdr:'modern_evening_street_1k.hdr',sun:[-48,13,9],sunColor:0xffba78,power:2.6,sky:0x687d9c,horizon:0xe5b9a1,ambient:.35,environment:.65,exposure:1.05},
  night:{hdr:'pond_bridge_night_1k.hdr',sun:[-22,38,-8],sunColor:0xa9c4e2,power:.17,sky:0x122539,horizon:0x2a3d50,ambient:.11,environment:.15,exposure:1.1}
});

export class HQLighting {
  constructor(hq){
    this.hq=hq;this.renderer=hq.renderer;this.scene=hq.scene;this.mode='day';this.active=true;this.disposed=false;this.targets=new Map();this.sources=new Set();this.pipeline=null;this.loadGeneration=0;this.quality={ao:true,samples:4,shadow:4096,environment:'hdr'};
    this.group=new THREE.Group();hq.root.add(this.group);
    this.sun=new THREE.DirectionalLight(0xffffff,3);this.sun.castShadow=true;this.sun.shadow.mapSize.set(4096,4096);Object.assign(this.sun.shadow.camera,{left:-38,right:38,top:32,bottom:-32,near:1,far:150});this.sun.shadow.normalBias=.012;this.sun.shadow.bias=-.000025;this.sun.shadow.radius=2;this.sun.target.position.set(-4,10,-12);this.group.add(this.sun,this.sun.target);
    this.hemi=new THREE.HemisphereLight(0xd9e9f4,0x727876,.6);this.group.add(this.hemi);
    this.entry=new THREE.PointLight(0xffd3a0,0,12,2);this.entry.position.set(-8.15,4.5,-2.2);this.group.add(this.entry);
    this.wash=new THREE.SpotLight(0x99cae0,0,60,Math.PI*.3,.8,2);this.wash.position.set(8,1,6);this.wash.target.position.set(10,20,-5);this.group.add(this.wash,this.wash.target);
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const c=canvas.getContext('2d'),g=c.createLinearGradient(0,0,0,256);g.addColorStop(0,'#8bb8db');g.addColorStop(.5,'#d8e3e5');g.addColorStop(1,'#6b7776');c.fillStyle=g;c.fillRect(0,0,512,256);const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.mapping=THREE.EquirectangularReflectionMapping;
    const pmrem=new THREE.PMREMGenerator(this.renderer);this.fallback=pmrem.fromEquirectangular(t);pmrem.dispose();t.dispose();this.envTarget=this.fallback;
    this.sky=new THREE.Color(PRESETS.day.horizon);this.makeSky();
    this.ready=this.load();
  }
  makeSky(){
    const uniforms={top:{value:new THREE.Color()},horizon:{value:new THREE.Color()},sunColor:{value:new THREE.Color()},sunDirection:{value:new THREE.Vector3()},cloudStrength:{value:.3}};
    this.skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms,vertexShader:'varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`varying vec3 vDirection;uniform vec3 top,horizon,sunColor,sunDirection;uniform float cloudStrength;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+13.5;a*=.5;}return v;}
      void main(){vec3 d=normalize(vDirection);float h=max(d.y,0.);vec3 color=mix(horizon,top,pow(h,.48));float sun=max(dot(d,normalize(sunDirection)),0.);color+=sunColor*(pow(sun,180.)*.18+pow(sun,14.)*.08);vec2 p=d.xz/(h+.17)*2.;float cloud=smoothstep(.48,.77,fbm(p))*smoothstep(.02,.25,h);color=mix(color,horizon*1.17,cloud*cloudStrength);gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
    this.skyGeometry=new THREE.SphereGeometry(180,32,16);this.dome=new THREE.Mesh(this.skyGeometry,this.skyMaterial);this.dome.frustumCulled=false;this.dome.renderOrder=-100;this.group.add(this.dome);
  }
  async load(){
    const generation=++this.loadGeneration;
    await Promise.all(Object.entries(PRESETS).map(async([mode,p])=>{const texture=await new RGBELoader().loadAsync('./assets/environment/hq5-lighting/'+p.hdr);if(this.disposed||generation!==this.loadGeneration){texture.dispose();return;}texture.mapping=THREE.EquirectangularReflectionMapping;const pmrem=new THREE.PMREMGenerator(this.renderer);const target=pmrem.fromEquirectangular(texture);pmrem.dispose();texture.dispose();if(this.disposed||generation!==this.loadGeneration){target.dispose();return;}this.targets.get(mode)?.dispose();this.targets.set(mode,target);if(mode===this.mode)this.set(mode);}));return true;
  }
  setQuality(profile){
    const previous=this.quality;this.quality={...profile};
    if(previous.ao!==profile.ao||previous.samples!==profile.samples)this.disposePipeline();
    if(previous.shadow!==profile.shadow){this.sun.shadow.dispose();this.sun.shadow.map=null;this.sun.shadow.mapPass=null;this.sun.shadow.mapSize.set(profile.shadow,profile.shadow);this.sun.shadow.needsUpdate=true;}
    if(profile.environment==='fallback'){this.loadGeneration++;for(const target of this.targets.values())target.dispose();this.targets.clear();this.envTarget=this.fallback;this.activate(this.active);}
    else if(previous.environment==='fallback'){this.ready=this.load();this.ready.catch(error=>{this.lastError=error.message;});}
  }
  disposePipeline(){if(!this.pipeline)return;const {composer,ao,output,render}=this.pipeline;ao.dispose();ao.noiseTexture.dispose();ao.ssaoMaterial.dispose();output.dispose();render.dispose();composer.dispose();this.pipeline=null;}
  set(mode){
    this.blend=null;
    const p=PRESETS[mode];if(!p)throw Error('Invalid HQ light preset');this.mode=mode;this.envTarget=this.targets.get(mode)||this.fallback;this.sky.set(p.horizon);this.sun.position.fromArray(p.sun);this.sun.color.set(p.sunColor);this.sun.intensity=p.power;this.hemi.intensity=p.ambient;
    this.skyMaterial.uniforms.top.value.set(p.sky);this.skyMaterial.uniforms.horizon.value.set(p.horizon);this.skyMaterial.uniforms.sunColor.value.set(p.sunColor);this.skyMaterial.uniforms.sunDirection.value.copy(this.sun.position).normalize();this.skyMaterial.uniforms.cloudStrength.value=mode==='night'?.12:.65;
    this.entry.intensity=mode==='day'?0:mode==='dusk'?65:110;this.wash.intensity=mode==='night'?280:0;
    this.hq.lamp.emissiveIntensity=mode==='day'?.15:mode==='dusk'?1.6:3;
    this.hq.roofWordmark.emissiveIntensity=mode==='night'?.26:mode==='dusk'?.07:0;
    this.hq.glass.emissive.set(mode==='night'?0x0b242c:0x000000);this.hq.glass.emissiveIntensity=mode==='night'?.35:0;
    for(const light of this.hq.streetLamps)light.intensity=mode==='day'?0:mode==='dusk'?32:65;
    this.activate(this.active);
  }
  transitionTo(mode,seconds=2.4){
    const capture=()=>({sun:this.sun.intensity,hemi:this.hemi.intensity,entry:this.entry.intensity,wash:this.wash.intensity,color:this.sun.color.clone(),sky:this.sky.clone(),top:this.skyMaterial.uniforms.top.value.clone(),horizon:this.skyMaterial.uniforms.horizon.value.clone(),direction:this.sun.position.clone(),environment:this.scene.environmentIntensity});
    const from=capture();this.set(mode);const to=capture();this.blend={from,to,elapsed:0,seconds};this.mixLighting(0);
  }
  mixLighting(t){const {from:a,to:b}=this.blend;this.sun.intensity=THREE.MathUtils.lerp(a.sun,b.sun,t);this.hemi.intensity=THREE.MathUtils.lerp(a.hemi,b.hemi,t);this.entry.intensity=THREE.MathUtils.lerp(a.entry,b.entry,t);this.wash.intensity=THREE.MathUtils.lerp(a.wash,b.wash,t);this.sun.color.copy(a.color).lerp(b.color,t);this.sun.position.copy(a.direction).lerp(b.direction,t);this.sky.copy(a.sky).lerp(b.sky,t);this.skyMaterial.uniforms.top.value.copy(a.top).lerp(b.top,t);this.skyMaterial.uniforms.horizon.value.copy(a.horizon).lerp(b.horizon,t);this.skyMaterial.uniforms.sunDirection.value.copy(this.sun.position).normalize();this.scene.environmentIntensity=THREE.MathUtils.lerp(a.environment,b.environment,t);this.scene.fog?.color.copy(this.sky);}
  activate(active){this.active=active;if(active){const p=PRESETS[this.mode];this.scene.environment=this.envTarget.texture;this.scene.environmentIntensity=p.environment;this.scene.background=this.sky;this.scene.fog=new THREE.Fog(p.horizon,100,200);}else{this.scene.environmentIntensity=1;}}
  update(camera,dt=0){this.dome.position.copy(camera.position);if(this.active){this.scene.environment=this.envTarget.texture;this.scene.environmentIntensity=PRESETS[this.mode].environment;if(this.blend){this.blend.elapsed+=dt;const t=Math.min(1,this.blend.elapsed/this.blend.seconds);this.mixLighting(t*t*(3-2*t));if(t===1)this.blend=null;}}}
  render(scene,camera){
    if(!this.quality.ao){const exposure=this.renderer.toneMappingExposure;this.renderer.toneMappingExposure=PRESETS[this.mode].exposure;try{this.renderer.render(scene,camera);}finally{this.renderer.toneMappingExposure=exposure;}return;}
    if(!this.pipeline){
      const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:this.quality.samples});const composer=new EffectComposer(this.renderer,target);composer.setPixelRatio(1);const render=new RenderPass(scene,camera),ao=new SSAOPass(scene,camera,1,1,16),output=new OutputPass();ao.kernelRadius=.42;ao.minDistance=.00015;ao.maxDistance=.018;
      // Architecture AO runs at half resolution. Alpha leaf silhouettes retain
      // their real shadow maps; opaque normal override must not fill leaf cards.
      const resize=ao.setSize.bind(ao);ao.setSize=(w,h)=>resize(Math.max(1,w>>1),Math.max(1,h>>1));
      const override=ao.renderOverride.bind(ao);ao.renderOverride=(...args)=>{const visible=this.hq.plants.root.visible,sky=this.dome.visible;this.hq.plants.root.visible=false;this.dome.visible=false;try{return override(...args);}finally{this.hq.plants.root.visible=visible;this.dome.visible=sky;}};
      // Output is terminal: keep the same MSAA read buffer each frame instead
      // of allocating a second full-size MSAA attachment through ping-pong.
      output.needsSwap=false;composer.renderTarget1.samples=0;composer.addPass(render);composer.addPass(ao);composer.addPass(output);this.pipeline={composer,render,ao,output,size:new THREE.Vector2()};
    }
    const p=this.pipeline,s=this.renderer.getDrawingBufferSize(new THREE.Vector2());if(!s.equals(p.size)){p.composer.setSize(s.x,s.y);p.size.copy(s);}p.render.camera=camera;p.ao.camera=camera;
    p.ao.ssaoMaterial.uniforms.cameraNear.value=camera.near;p.ao.ssaoMaterial.uniforms.cameraFar.value=camera.far;p.ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);p.ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
    const exposure=this.renderer.toneMappingExposure,auto=this.renderer.info.autoReset;this.renderer.toneMappingExposure=PRESETS[this.mode].exposure;this.renderer.info.autoReset=false;this.renderer.info.reset();
    try{p.composer.render();}finally{this.renderer.toneMappingExposure=exposure;this.renderer.info.autoReset=auto;}
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.loadGeneration++;this.group.removeFromParent();this.sun.shadow.dispose();this.skyGeometry.dispose();this.skyMaterial.dispose();this.fallback.dispose();for(const t of this.targets.values())t.dispose();this.targets.clear();this.disposePipeline();}
}
