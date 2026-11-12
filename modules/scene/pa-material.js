import * as THREE from 'three';
import { fragmentShader } from './pa-fragment.js';

// PA shading is evaluated in the same authored studio coordinates as upstream.
// Three owns the context, camera, buffers and lifecycle. No second WebGL canvas.
const vertexShader = `precision highp float;
attribute vec3 position; attribute vec3 normal; attribute vec4 paColor;
attribute vec2 paMaterial; attribute vec2 uv; attribute vec4 tangent;
uniform mat4 modelMatrix, viewMatrix, projectionMatrix, uLightViewProjection;
uniform mat3 uWorldNormal; uniform vec3 uOrigin; uniform float uUnit, uOpacity;
varying vec3 vPosition,vLocal,vNormal; varying vec4 vColor,vShadow,vTangent;
varying vec2 vMaterial,vUV;
void main(){vec4 world=modelMatrix*vec4(position,1.0);
vPosition=(world.xyz-uOrigin)/uUnit;vLocal=position;
vNormal=normalize(uWorldNormal*normal);vColor=vec4(paColor.rgb,paColor.a*uOpacity);
vMaterial=paMaterial;vUV=uv;vTangent=vec4(normalize(mat3(modelMatrix)*tangent.xyz),tangent.w);
vShadow=uLightViewProjection*world;gl_Position=projectionMatrix*viewMatrix*world;}`;

const solid = (r,g,b) => {
  const t=new THREE.DataTexture(new Uint8Array([r,g,b,255]),1,1);
  t.needsUpdate=true;t.colorSpace=THREE.NoColorSpace;return t;
};

export class PAStudio {
  constructor(renderer, scene) {
    this.renderer=renderer;this.scene=scene;this.materials=new Set();this.ready=false;this.errors=[];
    this.white=solid(255,255,255);this.normal=solid(128,128,255);
    this.shadowTarget=new THREE.WebGLRenderTarget(2048,2048,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true});
    this.shadowCamera=new THREE.OrthographicCamera(-2.3,2.3,2.3,-2.3,.1,12);
    this.shadowCamera.layers.set(1);this.lightVP=new THREE.Matrix4();this.focus=null;this.dirty=true;
    this.depthMaterial=new THREE.RawShaderMaterial({
      vertexShader:`precision highp float;attribute vec3 position;uniform mat4 projectionMatrix,viewMatrix,modelMatrix;void main(){gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.0);}`,
      fragmentShader:`precision highp float;void main(){vec4 d=vec4(fract(gl_FragCoord.z*vec3(16777216.,65536.,256.)),gl_FragCoord.z);d.yzw-=d.xyz/256.;gl_FragColor=d;}`,
      side:THREE.DoubleSide,blending:THREE.NoBlending,toneMapped:false
    });
    this.loading=this.load();
  }
  async load() {
    const loader=new THREE.TextureLoader();
    try {
      [this.environment,this.coolingEnvironment]=await Promise.all([
        loader.loadAsync(new URL('../../assets/pa/studio-small-09-radiance.png',import.meta.url).href),
        loader.loadAsync(new URL('../../assets/pa/studio-small-09-cooling-radiance.png',import.meta.url).href)
      ]);
      for(const t of [this.environment,this.coolingEnvironment]){
        t.colorSpace=THREE.NoColorSpace;t.flipY=false;t.generateMipmaps=false;
        t.minFilter=t.magFilter=THREE.LinearFilter;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.needsUpdate=true;
      }
      this.ready=true;this.materials.forEach(m=>{m.uniforms.uEnvironment.value=m.userData.cooling?this.coolingEnvironment:this.environment;m.uniforms.uHasEnvironment.value=1;});
    } catch(e){this.errors.push(e.message);throw e;}
  }
  material({cooling=false,asset=null,l10=false}={}) {
    const uniform = value => ({value});
    const uniforms={uWorldNormal:uniform(new THREE.Matrix3()),uOrigin:uniform(new THREE.Vector3()),uUnit:uniform(1),uOpacity:uniform(1),
      uLightViewProjection:uniform(this.lightVP),uEye:uniform(new THREE.Vector3()),uKeyPosition:uniform(new THREE.Vector3(-10,18,14)),
      uLightTheme:uniform(0),uTime:uniform(0),uScan:uniform(0),uScanY:uniform(0),uRack:uniform(l10?0:1),uQuality:uniform(1),
      uReveal:uniform(1),uDetail:uniform(0),uSectionX:uniform(10000),uL10Finish:uniform(l10?1:0),
      uCoolingFlow:uniform(0),uCoolingTravel:uniform(0),uCoolingFinish:uniform(0),uCoolingRoute:uniform(new THREE.Vector4()),uCoolingPhase:uniform(new THREE.Vector2(1,0)),
      uShadowMap:uniform(this.shadowTarget.texture),uShadowPass:uniform(0),uHasShadow:uniform(0),uShadowTexel:uniform(1/2048),
      uEnvironment:uniform((cooling?this.coolingEnvironment:this.environment)||this.white),uHasEnvironment:uniform(this.ready?1:0),
      uAsset:uniform(asset?1:0),uAssetNormalScale:uniform(asset?.normalScale?.x??1),uAssetRoughness:uniform(asset?.roughness??1),
      uAssetAO:uniform(asset?.aoMapIntensity??1),uAssetAlphaCutoff:uniform(asset?.alphaTest??0),uAssetAlphaMask:uniform(asset?.alphaTest>0?1:0),
      uAssetFilmStrength:uniform(asset?.userData?.l10ThinFilmStrength??0),uAssetFilmThickness:uniform(asset?.userData?.l10ThinFilmThickness??400),
      uAssetBase:uniform(asset?.map||this.white),uAssetMR:uniform(asset?.metalnessMap||this.white),uAssetNormal:uniform(asset?.normalMap||this.normal),uAssetOcclusion:uniform(asset?.aoMap||this.white)
    };
    if(asset){for(const key of ['map','metalnessMap','roughnessMap','normalMap','aoMap'])if(asset[key])asset[key].colorSpace=THREE.NoColorSpace;}
    const m=new THREE.RawShaderMaterial({vertexShader,fragmentShader,uniforms,side:THREE.DoubleSide,toneMapped:false,transparent:!!asset?.transparent,depthWrite:!asset?.transparent});
    m.userData.cooling=cooling;m.name=asset?.name||'PA studio / authored conductor';this.materials.add(m);
    m.addEventListener('dispose',()=>this.materials.delete(m));return m;
  }
  bind(mesh, rig) {
    mesh.onBeforeRender=(_renderer,_scene,camera,_geometry,material)=>{
      if(!material.uniforms?.uEye)return;
      const u=material.uniforms;
      material.uniformsNeedUpdate=true;
      if(mesh.userData.paOpacity!==undefined)u.uOpacity.value=mesh.userData.paOpacity;
      u.uWorldNormal.value.getNormalMatrix(mesh.matrixWorld);
      u.uOrigin.value.copy(rig.group.position);u.uUnit.value=rig.unit;
      u.uEye.value.setFromMatrixPosition(camera.matrixWorld).sub(rig.group.position).divideScalar(rig.unit);
      u.uHasShadow.value=this.focus===rig?1:0;
      if(this.focus===rig)u.uKeyPosition.value.copy(this.shadowCamera.position).sub(rig.group.position).divideScalar(rig.unit);
    };
  }
  setFocus(rig){
    if(this.focus===rig)return;
    this.focus?.group.traverse(o=>o.layers.disable(1));this.focus=rig;
    rig?.group.traverse(o=>o.layers.enable(1));this.dirty=true;
  }
  shadow(force=false) {
    if(!this.focus||(!this.dirty&&!force))return;
    const r=this.renderer,s=this.scene,g=this.focus.group;
    const center=g.position.clone();
    const extent=Math.max(2.3,this.focus.height*.85);
    this.shadowCamera.left=this.shadowCamera.bottom=-extent;this.shadowCamera.right=this.shadowCamera.top=extent;
    this.shadowCamera.position.copy(center).add(new THREE.Vector3(-10,18,14).multiplyScalar(this.focus.unit));
    this.shadowCamera.lookAt(center);this.shadowCamera.updateProjectionMatrix();this.shadowCamera.updateMatrixWorld();
    this.lightVP.multiplyMatrices(this.shadowCamera.projectionMatrix,this.shadowCamera.matrixWorldInverse);
    const target=r.getRenderTarget(),background=s.background,override=s.overrideMaterial,clear=r.getClearColor(new THREE.Color()),alpha=r.getClearAlpha();
    try{s.background=null;s.overrideMaterial=this.depthMaterial;r.setRenderTarget(this.shadowTarget);r.setClearColor(0xffffff,1);r.clear();r.render(s,this.shadowCamera);}
    finally{s.background=background;s.overrideMaterial=override;r.setRenderTarget(target);r.setClearColor(clear,alpha);}
    this.dirty=false;
  }
  dispose(){this.materials.forEach(m=>m.dispose());this.shadowTarget.dispose();this.depthMaterial.dispose();this.environment?.dispose();this.coolingEnvironment?.dispose();this.white.dispose();this.normal.dispose();}
}

export function paGeometry(data,stride=11) {
  const count=data.length/stride,position=new Float32Array(count*3),normal=new Float32Array(count*3),color=new Float32Array(count*4),material=new Float32Array(count*2);
  for(let i=0;i<count;i++){
    const s=i*stride;position.set(data.subarray(s,s+3),i*3);normal.set(data.subarray(s+3,s+6),i*3);
    color.set(data.subarray(s+6,s+9),i*4);color[i*4+3]=stride===12?data[s+9]:data[s+9]===-3?.2:1;
    material[i*2]=stride===12?data[s+10]:data[s+9]===-3?.65:data[s+9];material[i*2+1]=data[s+stride-1];
    if(stride===11&&data[s+9]>.5&&(data[s+6]*.2126+data[s+7]*.7152+data[s+8]*.0722)<.14)for(let k=0;k<3;k++)color[i*4+k]*=1.25;
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(position,3));g.setAttribute('normal',new THREE.BufferAttribute(normal,3));
  g.setAttribute('paColor',new THREE.BufferAttribute(color,4));g.setAttribute('paMaterial',new THREE.BufferAttribute(material,2));
  g.computeBoundingBox();g.computeBoundingSphere();return g;
}
