import * as THREE from 'three';

// Evidence is historical and incomplete. Dimensions, window schedule, entrance,
// rear and roof are explicitly Draft, never a surveyed Wistron BIM model.
export const HQ_EVIDENCE=Object.freeze({status:'draft',reference:'Wistron 2011 Sustainability Report, PDF page 36',referenceUrl:'https://esg.wistron.com/en/report-download/esg/yExk1GE7Q2Nz/2011SustainabilityReportEN.pdf#page=36',observed:['pale stone window reveals','blue-green glazed corner','stepped wing silhouette','projecting cornice'],pending:['user reference photo','current window schedule','survey dimensions','entrance/canopy','rear','roof','landscape positions']});
const random=seed=>()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
const vec=a=>new THREE.Vector3(...a);

export class HQEnvironment {
  constructor(scene,renderer){
    this.scene=scene;this.renderer=renderer;this.root=new THREE.Group();this.root.name='Neihu HQ · historical reference / DRAFT';this.root.userData.evidence=HQ_EVIDENCE;
    this.building=new THREE.Group();this.city=new THREE.Group();this.root.add(this.building,this.city);scene.add(this.root);
    this.geometry=new Set();this.materials=new Set();this.textures=new Set();this.batches=new Map();this.treeLods=[];this.disposed=false;
    this.box=this.own(new THREE.BoxGeometry(1,1,1));this.rnd=random(1582011);
    this.stone=this.material(0xd4d3cd,.86,0);this.reveal=this.material(0x92938f,.9,0);this.glass=this.material(0x15464b,.19,.55);this.glass2=this.material(0x275b60,.24,.44);this.frame=this.material(0x253f42,.34,.73);this.dark=this.material(0x152a2b,.6,.15);this.metal=this.material(0x626b68,.35,.72);this.paving=this.material(0xb8bab7,.94,0);this.road=this.material(0x363c3b,.96,.02);this.soil=this.material(0x40392c,1,0);
    this.stone.map=this.noiseTexture('#f4f4f1',.045);this.stone.map.repeat.set(4,4);this.road.map=this.noiseTexture('#414544',.24);this.road.map.repeat.set(16,16);
    this.buildArchitecture();this.buildSite();this.flush();this.buildVegetation();this.makeDaylight();
    this.loading=this.loadPBR().catch(()=>false);
  }
  own(g){this.geometry.add(g);return g;}
  material(color,roughness,metalness,extra={}){const m=new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});this.materials.add(m);return m;}
  texture(canvas){const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());this.textures.add(t);return t;}
  noiseTexture(base,amount){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle=base;g.fillRect(0,0,256,256);const pixels=g.getImageData(0,0,256,256);for(let i=0;i<pixels.data.length;i+=4){const n=(this.rnd()-.5)*255*amount;for(let k=0;k<3;k++)pixels.data[i+k]+=n;}g.putImageData(pixels,0,0);const t=this.texture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;}
  block(parent,material,size,position,rotation=0){const key=parent.uuid+material.uuid;let b=this.batches.get(key);if(!b){b={parent,material,matrices:[]};this.batches.set(key,b);}const matrix=new THREE.Matrix4().compose(vec(position),new THREE.Quaternion().setFromAxisAngle(vec([0,1,0]),rotation),vec(size));b.matrices.push(matrix);}
  flush(){for(const b of this.batches.values()){const mesh=new THREE.InstancedMesh(this.box,b.material,b.matrices.length);b.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=true;mesh.receiveShadow=true;b.parent.add(mesh);}this.batches.clear();}
  buildArchitecture(){
    const p=this.building,B=(m,s,v,r)=>this.block(p,m,s,v,r);
    // Photo-derived arrangement; this schedule is a labelled draft interpretation.
    // No fabricated rooftop HVAC or hidden rear windows are asserted.
    const wings=[{x:-17.5,w:8,h:22.4},{x:-9.5,w:8,h:25.6},{x:-1.5,w:8,h:28.8}];
    for(const wing of wings){
      B(this.stone,[wing.w,wing.h,18],[wing.x,wing.h/2,-14]);
      const top=wing.h-1.4;B(this.stone,[wing.w+.4,.55,18.5],[wing.x,wing.h+.15,-14]);
      for(let y=5.6;y<top;y+=3.25)for(const dx of [-2.25,.25,2.5]){
        B(this.reveal,[1.75,2.06,.19],[wing.x+dx,y,-4.94]);B(this.dark,[1.5,1.82,.12],[wing.x+dx,y,-4.82]);B(this.glass,[1.36,1.68,.035],[wing.x+dx,y,-4.74]);B(this.stone,[1.94,.13,.35],[wing.x+dx,y-1.02,-4.68]);
        B(this.frame,[.035,1.7,.055],[wing.x+dx,y,-4.70]);
      }
      // Actual panel joints are scale cues, not a claim about surveyed stone sizes.
      for(let y=3.7;y<wing.h;y+=1.62)B(this.reveal,[wing.w,.012,.009],[wing.x,y,-4.985]);
    }
    // Tall glazed corner plus a perpendicular stone wing, visible in official photo.
    B(this.stone,[12,29,19],[8.5,14.5,-14]);
    B(this.dark,[8.2,23.5,8.4],[10.3,17,-8.2]);
    for(let floor=0;floor<7;floor++){
      const y=6.8+floor*3.24,glass=floor%3===1?this.glass2:this.glass;
      B(glass,[8.22,2.61,.09],[10.3,y,-3.95]);B(glass,[.09,2.61,7.8],[14.56,y,-7.85]);
      B(this.frame,[8.44,.28,.32],[10.3,y-1.45,-3.88]);B(this.frame,[.32,.28,8.04],[14.54,y-1.45,-7.86]);
      B(this.stone,[8.65,.13,.44],[10.3,y-1.28,-3.86]);B(this.stone,[.44,.13,8.2],[14.55,y-1.28,-7.85]);
      for(let j=0;j<=9;j++)B(this.frame,[.044,2.64,.09],[6.2+j*.91,y,-3.87]);
      for(let j=0;j<9;j++)B(this.frame,[.09,2.64,.044],[14.55,y,-4.4-j*.87]);
    }
    B(this.stone,[9.5,.65,9.4],[10.3,29.55,-7.8]);B(this.reveal,[9.1,.18,9],[10.3,29.15,-7.8]);
    // Recessed windows on the side wing, explicitly unverified schedule.
    for(let y=5.6;y<27;y+=3.25)for(let z=-14;z>-22;z-=2.5){B(this.reveal,[.18,2,1.8],[14.54,y,z]);B(this.glass,[.045,1.75,1.55],[14.65,y,z]);B(this.frame,[.06,1.77,.04],[14.69,y,z]);}
    for(let y=5.6;y<26;y+=3.25)for(const x of [3.9]){B(this.reveal,[1.55,2,.18],[x,y,-4.94]);B(this.glass,[1.35,1.72,.055],[x,y,-4.82]);}
    // A second narrow glazed bay in the left wing is visible in the reference.
    for(let y=5.6;y<23;y+=3.25){B(this.glass2,[2.1,2.9,.2],[-11.3,y,-4.75]);B(this.frame,[2.2,.2,.3],[-11.3,y-1.5,-4.7]);}
    B(this.reveal,[39.5,.75,20.2],[-3.5,.38,-14]);
    B(this.dark,[35,3.2,.12],[-3.8,2.2,-4.36]);
    for(let x=-21;x<15;x+=3.8){B(this.stone,[.7,4.3,1],[x,2.15,-4.6]);B(this.stone,[.75,.3,1.1],[x,.3,-4.6]);}
    B(this.stone,[39,.55,1.2],[-3.3,4.2,-4.55]);
    // Entrance and canopy are placeholders because no close reference is supplied.
    B(this.frame,[6.6,.2,3.2],[4.9,3.45,-2.8]);B(this.glass2,[6.3,.06,3],[4.9,3.58,-2.8]);
    for(const x of [2,7.8])B(this.metal,[.12,3.4,.12],[x,1.7,-1.45]);
    for(const x of [3.2,4.8,6.4]){B(this.glass2,[1.5,2.85,.1],[x,1.8,-4.32]);B(this.metal,[.035,2.85,.18],[x-.76,1.8,-4.22]);B(this.metal,[.03,.5,.05],[x+.5,1.6,-4.18]);}
    B(this.paving,[8.4,.14,4.5],[4.8,.18,-2.8]);
    this.sign('wistron',[10.3,29.52,-3.02],6.4,.68,'#468d83');
    this.sign('158',[10.2,2.8,-4.72],1.3,.54,'#d9ddcf');
    this.building.userData.facades={front:'historical-photo-derived-draft',side:'partial-reference-draft',rear:'unverified-plain-envelope',roof:'unverified-no-equipment',windowSchedule:'unverified',dimensionsMm:'illustrative-not-surveyed'};
  }
  sign(text,position,width,height,color){const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');ctx.clearRect(0,0,1024,128);ctx.fillStyle=color;ctx.font='600 100px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,67);const map=this.texture(c),material=new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,toneMapped:false});this.materials.add(material);const mesh=new THREE.Mesh(this.own(new THREE.PlaneGeometry(width,height)),material);mesh.position.fromArray(position);this.building.add(mesh);}
  buildSite(){const B=(m,s,v)=>this.block(this.city,m,s,v);B(this.road,[140,.3,140],[0,-.55,-8]);B(this.paving,[48,.22,31],[-3.5,-.19,-13]);
    const curb=this.material(0xa1a69e,.91,.02),stripe=this.material(0xd7d6b9,.85,.01);for(let x=-27;x<21;x+=.6)B(curb,[.58,.25,.35],[x,-.14,2.65]);for(let z=-28;z<3;z+=.6)B(curb,[.35,.25,.58],[20.7,-.14,z]);
    for(let x=-65;x<65;x+=7)B(stripe,[3.6,.008,.12],[x,-.39,12]);for(let z=-55;z<45;z+=7)B(stripe,[.12,.008,3.6],[31,-.39,z]);
    for(let z=5;z<11;z+=1.1)B(stripe,[5,.01,.5],[-21,-.38,z]);
    for(const x of [-21,-14,-7,0,12]){B(curb,[2.3,.3,1.8],[x,-.02,1]);B(this.soil,[2.1,.03,1.6],[x,.15,1]);}
    for(const z of [-8,-17,-25]){B(curb,[2,.3,2],[18,-.02,z]);B(this.soil,[1.8,.03,1.8],[18,.15,z]);}
    for(const [x,z] of [[-25,3],[20,4],[21,-23]]){B(this.metal,[.12,6,.12],[x,2.8,z]);B(this.metal,[1.3,.12,.12],[x+.6,5.72,z]);B(this.stone,[.85,.07,.32],[x+1,5.68,z]);}
    // Paving joints are instances and sit above the slab, without coplanar overlap.
    const joint=this.material(0x92998f,.95,.01);for(let x=-26;x<20;x+=1.2)B(joint,[.015,.008,5.2],[x,-.071,.1]);for(let z=-2.5;z<2.7;z+=.9)B(joint,[46,.008,.014],[-3,-.07,z]);
  }
  buildVegetation(){
    const leafCanvas=document.createElement('canvas');leafCanvas.width=128;leafCanvas.height=256;const c=leafCanvas.getContext('2d');const grad=c.createLinearGradient(0,0,128,256);grad.addColorStop(0,'#8b9f42');grad.addColorStop(.45,'#436c2b');grad.addColorStop(1,'#294a24');c.fillStyle=grad;c.beginPath();c.moveTo(64,3);c.bezierCurveTo(123,60,126,163,64,253);c.bezierCurveTo(5,165,4,71,64,3);c.fill();c.strokeStyle='#b4bb6170';c.lineWidth=2;c.beginPath();c.moveTo(64,5);c.lineTo(64,253);for(let y=40;y<220;y+=24){c.moveTo(64,y+22);c.lineTo(24,y);c.moveTo(64,y+22);c.lineTo(103,y);}c.stroke();
    const leafMap=this.texture(leafCanvas),leafMat=this.material(0xffffff,.83,.0,{map:leafMap,alphaTest:.45,side:THREE.DoubleSide});
    const leaf=this.own(new THREE.PlaneGeometry(.19,.38,2,4));const pos=leaf.attributes.position;for(let i=0;i<pos.count;i++)pos.setZ(i,.035*Math.sin(pos.getY(i)*Math.PI/.38)+.025*Math.abs(pos.getX(i))/.095);leaf.computeVertexNormals();
    const bark=this.material(0x51483a,.97,0);bark.map=this.noiseTexture('#6a5b45',.3);bark.map.repeat.set(2,8);
    const branch=this.own(new THREE.CylinderGeometry(.58,1,1,10,3));
    const roots=[[-21,.18,1],[-14,.18,1],[-7,.18,1],[0,.18,1],[12,.18,1],[18,.18,-8],[18,.18,-17],[18,.18,-25],[-26,.18,-17],[-26,.18,-26]];
    const branchMatrices=[],leaves=[],dummy=new THREE.Object3D(),up=vec([0,1,0]);
    const segment=(from,to,radius)=>{const a=vec(from),b=vec(to),d=b.clone().sub(a);dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(up,d.clone().normalize());dummy.scale.set(radius,d.length(),radius);dummy.updateMatrix();branchMatrices.push(dummy.matrix.clone());};
    for(const [tx,ty,tz] of roots){
      const height=5+this.rnd()*1.4;segment([tx,ty,tz],[tx+.15,ty+height*.72,tz],.19);
      for(let b=0;b<14;b++){const angle=b*2.399+this.rnd()*.6,spread=1.2+this.rnd()*1.05,y=ty+height*(.45+.035*b),end=[tx+Math.cos(angle)*spread,y+.8+this.rnd()*.4,tz+Math.sin(angle)*spread];segment([tx+.09,ty+height*.45,tz],end,.075*(1-b/22));
        for(let twig=0;twig<5;twig++){const a=angle+(twig-2)*.47,tip=[end[0]+Math.cos(a)*.68,end[1]+this.rnd()*.65,end[2]+Math.sin(a)*.68];segment(end,tip,.018);
          for(let n=0;n<31;n++){const t=this.rnd(),r=.42*Math.sqrt(this.rnd()),phi=this.rnd()*Math.PI*2;dummy.position.set(THREE.MathUtils.lerp(end[0],tip[0],t)+Math.cos(phi)*r,THREE.MathUtils.lerp(end[1],tip[1],t)+(this.rnd()-.5)*.65,THREE.MathUtils.lerp(end[2],tip[2],t)+Math.sin(phi)*r);dummy.rotation.set(this.rnd()*Math.PI,phi,this.rnd()*Math.PI);dummy.scale.setScalar(.75+this.rnd()*.8);dummy.updateMatrix();leaves.push(dummy.matrix.clone());}
        }
      }
    }
    const trunk=new THREE.InstancedMesh(branch,bark,branchMatrices.length);branchMatrices.forEach((m,i)=>trunk.setMatrixAt(i,m));trunk.castShadow=trunk.receiveShadow=true;this.city.add(trunk);
    // Near/far render populations reuse curved leaf geometry, not polygon crowns.
    for(let i=leaves.length-1;i>0;i--){const j=Math.floor(this.rnd()*(i+1));[leaves[i],leaves[j]]=[leaves[j],leaves[i]];}
    const foliage=new THREE.InstancedMesh(leaf,leafMat,leaves.length);leaves.forEach((m,i)=>foliage.setMatrixAt(i,m));foliage.castShadow=true;foliage.receiveShadow=true;this.city.add(foliage);this.treeLods.push({mesh:foliage,count:leaves.length});
    this.vegetation={trees:roots.length,branches:branchMatrices.length,leaves:leaves.length,method:'tapered branches + curved alpha-tested leaf instances',placement:'draft'};
  }
  makeDaylight(){
    const sky=document.createElement('canvas');sky.width=1024;sky.height=512;const c=sky.getContext('2d'),g=c.createLinearGradient(0,0,0,512);g.addColorStop(0,'#83abc5');g.addColorStop(.46,'#dbe6ed');g.addColorStop(.5,'#e7e9e9');g.addColorStop(.58,'#969da3');g.addColorStop(1,'#565e66');c.fillStyle=g;c.fillRect(0,0,1024,512);
    const skyTex=this.texture(sky);skyTex.mapping=THREE.EquirectangularReflectionMapping;this.sky=skyTex;const pmrem=new THREE.PMREMGenerator(this.renderer);this.envTarget=pmrem.fromEquirectangular(skyTex);pmrem.dispose();
    this.lights=new THREE.Group();const sun=new THREE.DirectionalLight(0xffffff,3.1);sun.position.set(-35,60,35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-55,right:55,top:50,bottom:-50,near:1,far:150});sun.shadow.normalBias=.04;sun.shadow.bias=-.00008;this.lights.add(sun,new THREE.HemisphereLight(0xe7eff8,0x777b80,1.15));this.root.add(this.lights);
  }
  async loadPBR(){
    // Optional licensed textures are declared in a checked-in manifest. No network
    // provider URLs or dynamic third-party fetches are accepted by the viewer.
    const response=await fetch('./assets/environment/manifest.json');if(!response.ok)return false;const manifest=await response.json();const loader=new THREE.TextureLoader();
    for(const spec of manifest.materials||[]){const material=spec.id==='asphalt03'?this.road:spec.id==='stone'?this.stone:null;if(!material)continue;for(const [slot,path]of Object.entries(spec.maps)){if(!['map','normalMap','roughnessMap'].includes(slot)||!/^assets\/environment\/[A-Za-z0-9._-]+$/.test(path))continue;const tex=await loader.loadAsync('./'+path);if(this.disposed){tex.dispose();continue;}tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(spec.id==='asphalt03'?32:3,spec.id==='asphalt03'?32:3);tex.colorSpace=slot==='map'?THREE.SRGBColorSpace:THREE.NoColorSpace;this.textures.add(tex);material[slot]=tex;material.needsUpdate=true;}if(spec.id==='stone')material.normalScale.set(.16,.16);if(spec.id==='asphalt03')material.color.set(0xffffff);}return true;
  }
  setDepth(depth){this.root.visible=depth===0;}
  update(camera){for(const lod of this.treeLods){const far=camera.position.distanceTo(vec([0,5,-10]))>95;const count=far?Math.floor(lod.count*.55):lod.count;lod.mesh.count=count;}}
  pose(angle='quarter'){const center=[-3,13,-12];return angle==='front'?{position:[-3,17,62],target:center}:angle==='side'?{position:[65,19,-9],target:center}:angle==='entrance'?{position:[15,4.5,13],target:[4.7,2.1,-3.8]}:{position:[48,29,53],target:center};}
  dispose(){this.disposed=true;this.root.removeFromParent();this.root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.isLight)o.shadow?.dispose();});for(const g of this.geometry)g.dispose();for(const m of this.materials)m.dispose();for(const t of this.textures)t.dispose();this.envTarget.dispose();}
}
