import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { startStudio } from './modules/studio.js';

const $ = id => document.getElementById(id);
const clamp = (v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix = (a,b,t)=>a+(b-a)*t;
const ease = (a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = $('viewport');
const stage = $('scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x152630);
scene.fog = new THREE.Fog(0x152630,38,105);
const camera = new THREE.PerspectiveCamera(43,1,.05,260);
const renderer = new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;
renderer.outputColorSpace=THREE.SRGBColorSpace;
const pmrem = new THREE.PMREMGenerator(renderer);
const env = new RoomEnvironment(renderer);
scene.environment=pmrem.fromScene(env,.04).texture;env.dispose();pmrem.dispose();
const controls = new OrbitControls(camera,canvas);
controls.enableDamping=true;controls.dampingFactor=.075;
controls.maxPolarAngle=Math.PI*.485;controls.minDistance=2;controls.maxDistance=155;
controls.enablePan=true;controls.panSpeed=.55;controls.rotateSpeed=.6;controls.zoomSpeed=.75;

let visualSeed=123456;
function visualRandom(){visualSeed=(Math.imul(1664525,visualSeed)+1013904223)>>>0;return visualSeed/4294967296;}
const C = {
  steel:0x2c3e47,edge:0x4b6470,body:0x1b2b34,server:0x18252c,black:0x09141b,
  metal:0x82969e,floor:0x52646e,floorEdge:0x314a58,wall:0x607d89,white:0xc7d3d4,
  cyan:0x45d2c1,blue:0x238ae5,lime:0x9ccc78,water:0x1cbaf0,hot:0xe27058,
  copper:0xa27b49,gold:0xdeb97d,glass:0x5ca8c2,plant:0x426e66,road:0x1d2d39
};
function mat(color,roughness=.62,metalness=.15,opts={}){return new THREE.MeshStandardMaterial({color,roughness,metalness,...opts});}
const M={
  steel:mat(C.steel,.38,.72),edge:mat(C.edge,.35,.78),body:mat(C.body,.48,.5),server:mat(C.server,.52,.65),black:mat(C.black,.76,.12),
  metal:mat(C.metal,.31,.83),floor:mat(C.floor,.78,.14),floorEdge:mat(C.floorEdge,.7,.3),wall:mat(C.wall,.72,.2),white:mat(C.white,.48,.22),
  cyan:mat(C.cyan,.33,.25,{emissive:C.cyan,emissiveIntensity:.65}),blue:mat(C.blue,.33,.35,{emissive:C.blue,emissiveIntensity:.28}),
  lime:mat(C.lime,.5,.1,{emissive:C.lime,emissiveIntensity:.45}),water:mat(C.water,.31,.52,{emissive:C.water,emissiveIntensity:.24}),hot:mat(C.hot,.39,.4,{emissive:C.hot,emissiveIntensity:.12}),
  copper:mat(C.copper,.3,.74),gold:mat(C.gold,.33,.7),plant:mat(C.plant,.95,0),road:mat(C.road,1,0),
  glass:mat(C.glass,.13,.15,{transparent:true,opacity:.135,side:THREE.DoubleSide,depthWrite:false}),
  glow:mat(C.cyan,.35,.15,{emissive:C.cyan,emissiveIntensity:1.25}),
  glassDark:mat(0x273e4b,.17,.42,{transparent:true,opacity:.58}),
};
const geometryCache = new Map();
function boxGeometry(w,h,d){const key=`${w}|${h}|${d}`;if(!geometryCache.has(key))geometryCache.set(key,new THREE.BoxGeometry(w,h,d));return geometryCache.get(key);}
function box(parent,w,h,d,x,y,z,material=M.steel,options={}){const o=new THREE.Mesh(boxGeometry(w,h,d),material);o.position.set(x,y,z);o.castShadow=options.shadow!==false;o.receiveShadow=true;parent.add(o);return o;}
function instanceStaticGroup(root){
  root.updateWorldMatrix(true,true);
  const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert();
  const boxes=[];
  root.traverse(o=>{
    if(o.isMesh&&!o.isInstancedMesh&&!o.material.transparent&&!o.material.map&&o.geometry.type==='BoxGeometry'&&!o.userData.dynamic){
      boxes.push({source:o,parent:o.parent,matrix:new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld)});
    }
  });
  const groups=new Map();
  for(const item of boxes){
    const m=item.source.material,key=m.uuid;
    if(!groups.has(key))groups.set(key,{material:m,matrices:[],sources:[],cast:item.source.castShadow});
    groups.get(key).matrices.push(item.matrix);groups.get(key).sources.push(item.source);groups.get(key).cast ||= item.source.castShadow;
  }
  const unit=new THREE.BoxGeometry(1,1,1);
  for(const group of groups.values()){
    if(group.matrices.length<3)continue;
    const mesh=new THREE.InstancedMesh(unit,group.material,group.matrices.length);
    group.matrices.forEach((m,i)=>{const {width,height,depth}=group.sources[i].geometry.parameters;mesh.setMatrixAt(i,m.multiply(new THREE.Matrix4().makeScale(width,height,depth)));});
    mesh.castShadow=group.cast;mesh.receiveShadow=true;root.add(mesh);
    group.sources.forEach(source=>source.removeFromParent());
  }
}
function rackX(position){return (position-3.5)*1.52;}

function instanced(parent,w,h,d,positions,material,options={}){
  if(!positions.length)return null;
  const mesh=new THREE.InstancedMesh(boxGeometry(w,h,d),material,positions.length);
  const o=new THREE.Object3D();
  positions.forEach((v,i)=>{o.position.set(v[0],v[1],v[2]);if(v[3])o.rotation.set(v[3][0]||0,v[3][1]||0,v[3][2]||0);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);});
  mesh.castShadow=options.shadow!==false;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function cylinder(parent,r,h,x,y,z,material,rot=null,segments=16){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),material);m.position.set(x,y,z);if(rot)m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function pipe(parent,points,r,material){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'catmullrom',.06);const m=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(16,points.length*10),r,8,false),material);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function outline(mesh,color=0x55cdbd,opacity=.45){const e=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color,transparent:true,opacity}));e.position.copy(mesh.position);e.rotation.copy(mesh.rotation);e.scale.copy(mesh.scale);mesh.parent.add(e);return e;}
const textureCache=new Map();
function canvasTexture(key,draw,w=512,h=512){if(textureCache.has(key))return textureCache.get(key);const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;textureCache.set(key,t);return t;}
function groundTexture(){return canvasTexture('ground',(g,w,h)=>{g.fillStyle='#526671';g.fillRect(0,0,w,h);for(let i=0;i<11000;i++){g.fillStyle=visualRandom()>.5?'rgba(205,222,228,.065)':'rgba(10,25,34,.07)';const s=visualRandom()*2+.5;g.fillRect(visualRandom()*w,visualRandom()*h,s,s);}g.strokeStyle='#1a3340';g.lineWidth=3;g.strokeRect(1,1,w-2,h-2);g.strokeStyle='#75909c';g.lineWidth=1;g.strokeRect(5,5,w-10,h-10);for(const [x,y] of [[12,12],[w-12,12],[12,h-12],[w-12,h-12]]){g.fillStyle='#203d49';g.fillRect(x-2,y-2,4,4);}for(let i=0;i<20;i++){g.strokeStyle=`rgba(25,45,58,${visualRandom()*.08})`;g.beginPath();g.moveTo(visualRandom()*w,visualRandom()*h);g.lineTo(visualRandom()*w,visualRandom()*h);g.stroke();}},256,256);}
const floorMat=mat(0x9aaab0,.8,.15,{map:groundTexture()});
function textPlane(parent,text,x,y,z,w,h,opt={}){
  const key=`text:${text}:${opt.color||'#d5e5e9'}:${opt.bg||'none'}:${opt.weight||'600'}`;
  const tex=canvasTexture(key,(g,cw,ch)=>{if(opt.bg){g.fillStyle=opt.bg;g.fillRect(0,0,cw,ch);}g.fillStyle=opt.color||'#d5e5e9';g.font=`${opt.weight||'600'} ${Math.round(ch*(opt.size||.45))}px ${opt.font||'Arial'}`;g.textBaseline='middle';g.textAlign=opt.align||'center';g.fillText(text,opt.align==='left'?8:cw/2,ch/2,cw-14);},1024,128);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));m.position.set(x,y,z);if(opt.rot)m.rotation.set(...opt.rot);parent.add(m);return m;
}
function wordmark(parent,x,y,z,w=3.3,h=.58,materialOpts={}){const t=canvasTexture('wordmark',(g,cw,ch)=>{g.clearRect(0,0,cw,ch);g.font='700 133px Arial';const grad=g.createLinearGradient(0,0,cw,0);grad.addColorStop(0,'#3787d0');grad.addColorStop(.55,'#439ec7');grad.addColorStop(1,'#73b78c');g.fillStyle=grad;g.textAlign='center';g.textBaseline='middle';g.fillText('wistron',cw/2,ch*.54);},1024,256);const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,toneMapped:false,...materialOpts}));m.position.set(x,y,z);parent.add(m);return m;}

scene.add(new THREE.HemisphereLight(0xb0cad4,0x14232b,1.1));
const sun=new THREE.DirectionalLight(0xe4edf0,2.15);sun.position.set(20,35,19);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-32;sun.shadow.camera.right=32;sun.shadow.camera.top=30;sun.shadow.camera.bottom=-35;sun.shadow.camera.near=1;sun.shadow.camera.far=100;sun.shadow.bias=-.00025;sun.shadow.normalBias=.045;scene.add(sun);
const fillLight=new THREE.DirectionalLight(0x74bbd7,1.1);fillLight.position.set(-27,16,-10);scene.add(fillLight);

const building = new THREE.Group();building.name='Wistron Neihu HQ';scene.add(building);
const city = new THREE.Group();city.name='Urban context';scene.add(city);
const campus = new THREE.Group();campus.name='Data center campus';scene.add(campus);
const shell = new THREE.Group();shell.name='Architectural envelope';scene.add(shell);
shell.name='Data hall envelope';
const cityFar = new THREE.Group();scene.add(cityFar);
cityFar.visible=false;
const campusRim = new THREE.Group();scene.add(campusRim);
const core = new THREE.Group();core.name='Configured rack row';scene.add(core);
const environmentRacks = new THREE.Group();environmentRacks.name='Context racks';scene.add(environmentRacks);
const coolingFlow = new THREE.Group(),powerFlow=new THREE.Group(),networkFlow=new THREE.Group();scene.add(coolingFlow,powerFlow,networkFlow);
const flowDots=[];
function buildCity(){
  box(city,90,.4,110,0,-.6,-15,M.road,{shadow:false});
  box(city,43,.25,6,0,-.37,-27,mat(0x47585d,.92,.02));
  box(cityFar,10,.3,102,44,-.35,-13,mat(0x60706e,.92,.02));
  const lane=[];for(let x=-78;x<80;x+=8)lane.push([x,-.34,-40]);instanced(cityFar,3,.025,.13,lane,mat(0xc9ccbb,.8,.05),{shadow:false});
  const sidewalks=[];for(let x=-72;x<72;x+=6){sidewalks.push([x,-.15,-26]);sidewalks.push([x,-.15,-54]);}instanced(cityFar,5.7,.23,2.8,sidewalks,mat(0x8a999d,.9,.1));
  const park=box(city,12,.4,26,-22,-.2,-12,mat(0x37574f,.98,0));
  const treePos=[[-18,-.1,-21],[-21,-.1,-14],[-21,-.1,-3],[-19,-.1,5],[20,-.1,-21],[23,-.1,-20],[23,-.1,11],[-18,-.1,12]];
  for(const [x,y,z] of treePos){
    cylinder(city,.13,4,x,y+2,z,mat(0x34483e,.9,.02),null,8);
    for(let i=0;i<3;i++){const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.8+visualRandom()*.55,1),mat([0x3f6a60,0x547c6b,0x426b66][i],.96,0));crown.position.set(x+(i-1)*.85,4+i*.6,z+(i%2)*.8);crown.scale.y=.8;crown.castShadow=true;city.add(crown);}
  }
  const distantMat=mat(0x324856,.8,.22);
  const windowMat=mat(0x618998,.42,.35,{emissive:0x305c72,emissiveIntensity:.15});
  for(let i=0;i<7;i++){
    const x=-52+(i%5)*27,z=-63-Math.floor(i/5)*25,h=9+(i*7)%21,w=12+(i%3)*3;
    box(cityFar,w,h,16,x,h/2-.3,z,distantMat);
    const windows=[];for(let yy=3;yy<h-1;yy+=3.1)for(let xx=-w/2+1;xx<w/2-1;xx+=1.8)windows.push([x+xx,yy,z+8.04]);instanced(cityFar,1.15,1.7,.025,windows,windowMat,{shadow:false});
  }
  box(cityFar,39,.09,.16,0,-.27,-28,mat(0x758889,.65,.1));
  textPlane(cityFar,'XINGSHAN ROAD',19,-.16,-27.3,7,.65,{color:'#9abad0',rot:[-Math.PI/2,0,0],size:.38,weight:'500'});
  for(let i=0;i<3;i++){const car=box(cityFar,1.8,.8,3.8,-14+i*15,.15,-43+i*4,mat(i===1?0x768690:0x324b5a,.34,.52));box(car.parent,1.4,.45,1.7,car.position.x,.77,car.position.z,mat(0x294450,.2,.35));cylinder(cityFar,.31,.17,car.position.x-.83,-.03,car.position.z-1.12,M.black,[0,0,Math.PI/2]);cylinder(cityFar,.31,.17,car.position.x+.83,-.03,car.position.z-1.12,M.black,[0,0,Math.PI/2]);}
}
let upperShell,buildingBase;
function buildHQ(){
  building.name='Wistron HQ / conceptual architecture';
  buildingBase=building;
  box(building,31,1.0,24,0,.5,-13,M.wall);
  upperShell=new THREE.Group();building.add(upperShell);upperShell.name="HQ shell";
  const glassM=[mat(0x294957,.19,.55),mat(0x315760,.22,.48),mat(0x3e676f,.2,.48),mat(0x345460,.23,.55)];
  const frames=[],mullions=[];
  const h=21.8;
  box(upperShell,28,h,17,0,12,-14,glassM[0]);
  for(let i=0;i<15;i++){
    const x=-13+i*1.86;
    for(let j=0;j<12;j++){
      const y=3.6+j*1.55;
      box(upperShell,1.77,1.46,.04,x,y,-5.47,glassM[(i+j*3)%4],{shadow:false});
    }
    frames.push([x-.91,12,-5.36]);
  }
  for(let j=0;j<=12;j++)mullions.push([0,2.78+j*1.55,-5.36]);
  instanced(upperShell,.063,20.3,.075,frames,M.metal);
  instanced(upperShell,28,.045,.08,mullions,M.edge);
  const sidePanels=[];for(let z=-21.5;z<-5.5;z+=1.55)for(let y=3.4;y<22;y+=1.55)sidePanels.push([14.03,y,z]);
  instanced(upperShell,.045,1.46,1.44,sidePanels,glassM[2],{shadow:false});
  const sideFrames=[];for(let z=-22;z<-5;z+=1.55)sideFrames.push([14.07,12,z]);instanced(upperShell,.075,20.2,.055,sideFrames,M.metal);
  box(upperShell,28.6,.55,18,0,23,-14,M.white);box(upperShell,28.5,.16,18,0,23.33,-14,M.edge);
  box(upperShell,8,2,7,5,24.1,-15,M.wall);box(upperShell,6,.7,5,5,25.5,-15,M.metal);
  box(upperShell,3,1.8,4,-7,24,-15,M.steel);box(upperShell,2.3,.12,3.3,-7,24.97,-15,M.metal);
  for(let i=0;i<4;i++){cylinder(upperShell,.55,1.1,-2+i*2.1,24,-20,M.metal);cylinder(upperShell,.66,.09,-2+i*2.1,24.57,-20,M.edge);}
  box(building,11,.32,4,0,3.4,-2.4,M.white);box(building,11.2,.075,4.2,0,3.62,-2.4,M.edge);
  box(building,7.2,2.2,.18,0,1.5,-5.27,M.glassDark);
  for(const x of [-2.9,0,2.9])box(building,.06,2.7,.18,x,1.5,-5.05,M.metal);
  box(building,13,.18,5,0,.14,-2,M.floorEdge);
  box(building,12,.18,4,0,-.04,-1,M.metal);
  wordmark(upperShell,-5.3,20.5,-5.26,6.0,1.38);
  textPlane(upperShell,'NEIHU / TAIPEI',7.4,20.5,-5.25,4.1,.46,{color:'#bed0d8',size:.34,weight:'400'});
  box(building,1.1,1.7,.04,-13.3,1.8,-4.99,M.cyan);
  const entranceLight=new THREE.PointLight(0x77daca,15,12,2);entranceLight.position.set(0,3,-2.3);building.add(entranceLight);
  for(let i=0;i<3;i++)box(building,8,.12,.12,0,3.1-i*.45,-4,M.cyan);
  const target = new THREE.Mesh(new THREE.RingGeometry(2.5,2.57,64),new THREE.MeshBasicMaterial({color:0x5ccfbd,transparent:true,opacity:.22,side:THREE.DoubleSide}));target.rotation.x=-Math.PI/2;target.position.set(0,.24,-.8);building.add(target);
  textPlane(city,'WISTRON',-21,.31,-8,4.6,1,{color:'#77aebe',rot:[-Math.PI/2,0,-Math.PI/2],size:.35});
}
const rackFrame={width:1.28,height:2.75,depth:1.25};
function buildSimpleRacks(){
  const body=[],frame=[],tops=[],trays=[],vents=[],handles=[],lights=[];
  const positions=[];
  for(let row=0;row<6;row++){
    const z=4-row*4.35;
    for(let i=0;i<10;i++){
      const x=(i-3.5)*1.74;
      if(row===0)continue;
      if(row===1&&Math.abs(x)<6.55)continue;
      positions.push([x,1.39,z]);
    }
  }
  for(const [x,y,z] of positions){
    body.push([x,1.4,z]);
    for(const dx of [-.62,.62])frame.push([x+dx,1.45,z+.63]);
    frame.push([x,2.79,z+.63]);frame.push([x,.04,z+.63]);tops.push([x,2.79,z]);
    for(let j=0;j<25;j++){
      const yy=.16+j*.098;
      trays.push([x,yy,z+.645]);
      for(const x1 of [-.29,0,.29])vents.push([x+x1,yy,z+.658]);
      if(j%4===0)lights.push([x+.47,yy,z+.67]);
    }
    handles.push([x+.53,1.48,z+.694]);
  }
  instanced(environmentRacks,1.27,2.7,1.2,body,M.body);
  instanced(environmentRacks,.047,2.71,.05,frame,M.edge);
  instanced(environmentRacks,1.3,.075,1.24,tops,M.steel);
  instanced(environmentRacks,1.12,.076,.045,trays,M.black);
  instanced(environmentRacks,.22,.023,.012,vents,M.edge,{shadow:false});
  instanced(environmentRacks,.023,.16,.025,handles,M.metal,{shadow:false});
  instanced(environmentRacks,.027,.023,.014,lights,M.cyan,{shadow:false});
  environmentRacks.userData.count=positions.length;
}
function buildHall(){
  box(campus,19,.24,33,0,-.02,-6,floorMat);
  const grid=[];
  for(let x=-9.6;x<=9.6;x+=1.2)grid.push([x,.115,-5,0]);
  for(let z=-22;z<=11;z+=1.2)grid.push([0,.115,z,1]);
  for(const [x,y,z,type] of grid){box(campus,type?19:.018,.012,type?.018:33,x,y,z,M.floorEdge,{shadow:false});}
  box(campus,19.3,.17,33.4,0,-.2,-6,M.edge);
  const aisleMat=mat(0x467a92,.61,.35);
  box(campus,2.5,.016,12,0,.115,0,aisleMat,{shadow:false});
  for(const x of [-1.35,1.35]){
    box(campus,.026,.026,10.5,x+.0,.132,6,M.gold,{shadow:false});
    box(campus,.014,.016,10.5,x+(x<0?-.025:.025),.132,6,M.glow,{shadow:false});
  }
  const edgeFloors=[-7.44,7.44];for(const x of edgeFloors){box(campus,.045,.012,31,x,.132,-5,M.metal,{shadow:false});}
  textPlane(campus,'COLD AISLE  /  A01',-3.4,.145,8.8,2.5,.34,{color:'#c0e6e9',rot:[-Math.PI/2,0,0],size:.38,weight:'500'});
  textPlane(campus,'FACILITY ACCESS',0,.145,-18.8,2.7,.34,{color:'#a4c0c7',rot:[-Math.PI/2,0,0],size:.33,weight:'500'});
  const glassMat=M.glass;
  for(let z=4.2;z<=10.5;z+=1.6){
    box(shell,.034,3.1,2.70,-1.65,1.7,z,glassMat,{shadow:false});
    box(shell,.034,3.1,2.70,1.65,1.7,z,glassMat,{shadow:false});
    for(const x of [-1.65,1.65])box(shell,.05,3.18,.05,x,1.7,z-.8,M.edge);
    box(shell,3.32,.05,1.58,0,3.26,z,glassMat,{shadow:false});
    for(const x of [-.8,.8])box(shell,.027,.028,1.58,x,3.265,z,M.metal,{shadow:false});
  }
  for(const x of [-1.65,1.65])box(shell,.055,.055,8,x,3.28,7,M.edge);
  box(shell,19,3.6,.16,0,1.9,-22.4,M.wall);
  for(let x=-9;x<9;x+=2.2){box(shell,2.11,2.6,.08,x,1.5,-22.27,M.body);box(shell,.035,2.62,.09,x-.98,1.5,-22.2,M.edge);}
  const windowMat=mat(0x1a4552,.22,.48,{emissive:0x296a70,emissiveIntensity:.5});
  box(shell,8.6,1.25,.11,-4.3,2.4,-22.1,M.black);
  for(let y=0;y<2;y++)for(let i=0;i<12;i++){
    const s=box(shell,.6,.46,.04,-8.2+i*.66,2.12+y*.55,-22.01,windowMat,{shadow:false});
    for(let j=0;j<3;j++)box(shell,.37,.013,.01,s.position.x,s.position.y-.14+j*.11,-21.98,j===0?M.cyan:M.edge,{shadow:false});
  }
  textPlane(shell,'DATA CENTER / HALL 01',5.9,2.7,-22.16,5.6,.51,{color:'#c5e0e8',weight:'500'});
  wordmark(shell,-9.8,3.32,-22.1,2.4,.49);
  for(const x of [-5.3,-7.5]){box(campus,1.7,2.2,1.3,x,1.2,-9,M.white);box(campus,1.45,.36,.9,x,2.43,-9,M.edge);for(let j=0;j<16;j++)box(campus,1.3,.027,.018,x,.32+j*.108,-8.331,M.edge,{shadow:false});box(campus,.72,.34,.023,x,1.93,-8.32,M.black);textPlane(campus,'CDU / LIQUID',x,1.93,-8.302,.63,.13,{color:'#72cbd5',size:.30});}
  for(const x of [7.1,8.8]){box(campus,1.35,2.75,1.18,x,1.46,-10,M.wall);for(let j=0;j<6;j++)box(campus,.93,.27,.02,x,.4+j*.37,-9.391,M.body);box(campus,.8,.35,.025,x,2.56,-9.385,M.black);textPlane(campus,'PDU',x,2.56,-9.363,.4,.14,{color:'#d7c791',size:.45});}
  for(const x of [3.5,4.8]){box(campus,2.2,.16,.9,x,1,-18,M.white);box(campus,2.15,.12,.75,x,.88,-18,M.steel);box(campus,.5,.9,.45,x,.45,-18,M.edge);box(campus,1,.68,.07,x,1.6,-18.1,M.black);box(campus,.91,.59,.015,x,1.6,-18.055,M.glassDark);textPlane(campus,'OPERATIONS',x,1.63,-18.044,.8,.1,{color:'#78b8c7',size:.28});}
  for(const x of [-5.98,.98]){
    box(campus,.055,.055,28,x,3.9,-6.4,M.edge);
    for(const offset of [-.25,.25])box(campus,.037,.065,28,x+offset,3.87,-6.4,M.copper);
    for(let z=-20;z<9;z+=.72)box(campus,.65,.036,.035,x,3.86,z,M.copper);
    for(let z=-19;z<10;z+=4.5){box(campus,.02,1.2,.02,x-.25,4.55,z,M.metal);box(campus,.02,1.2,.02,x+.25,4.55,z,M.metal);box(campus,.65,.03,.03,x,5.13,z,M.metal);}
  }
  for(const x of [-4.5,4.5])for(let row=0;row<6;row++){
    const z=4-row*4.35;
    pipe(campus,[[x,3.13,z+1.6],[x,3.13,z-1.65]],.055,M.copper);
    for(const dx of [-.12,.12])box(campus,.027,.085,4,x+dx,3.23,z,M.metal);
    for(let zz=z-1.8;zz<z+1.8;zz+=.35)box(campus,.29,.03,.033,x,3.22,zz,M.metal);
    box(campus,.09,.026,3.4,x,3.185,z,M.black,{shadow:false});
  }
  for(let z=7;z>-22;z-=5.5){
    for(const x of [-3.5,3.5]){box(shell,2.35,.045,.16,x,3.58,z,M.white);box(shell,2.15,.015,.075,x,3.549,z,mat(0xe1f5fc,.5,.12,{emissive:0xd4f0f9,emissiveIntensity:1.6}),{shadow:false});}
  }
  for(const x of [-.18,.18])pipe(campus,[[x,3.4,11],[x,3.4,-18],[x+3.6,3.4,-19],[x+3.6,1,-19]],.065,x<0?M.water:M.hot);
  coolingFlow.visible=false;powerFlow.visible=false;networkFlow.visible=false;
  for(const x of [-9.1,9.1]){
    cylinder(shell,.075,5.1,x,2.58,-21.5,M.metal);
    for(let y=0;y<5;y++)box(shell,.8,.025,.8,x,1+y,-21.5,M.edge);
    cylinder(shell,.27,1.1,x,5.43,-21.5,M.white);
    for(let j=0;j<4;j++){const blade=box(shell,.05,.02,.4,x,6.01,-21.5,M.edge);blade.rotation.y=j*Math.PI/2;}
  }
  buildSimpleRacks();
}

buildCity();buildHQ();buildHall();[city,cityFar,campus,environmentRacks].forEach(instanceStaticGroup);
startStudio({scene,camera,renderer,controls,reducedMotion,groups:{building,upperShell,city,cityFar,campus,shell,environmentRacks,core}}).catch(error=>{console.error(error);$('loading').querySelector('p').textContent='工作台載入失敗：'+error.message;$('loading').querySelector('small').textContent='請重新整理重試；既有配置會保留。';});
