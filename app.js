import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

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
function groundTexture(){return canvasTexture('ground',(g,w,h)=>{g.fillStyle='#526671';g.fillRect(0,0,w,h);for(let i=0;i<11000;i++){g.fillStyle=Math.random()>.5?'rgba(205,222,228,.065)':'rgba(10,25,34,.07)';const s=Math.random()*2+.5;g.fillRect(Math.random()*w,Math.random()*h,s,s);}g.strokeStyle='#1a3340';g.lineWidth=3;g.strokeRect(1,1,w-2,h-2);g.strokeStyle='#75909c';g.lineWidth=1;g.strokeRect(5,5,w-10,h-10);for(const [x,y] of [[12,12],[w-12,12],[12,h-12],[w-12,h-12]]){g.fillStyle='#203d49';g.fillRect(x-2,y-2,4,4);}for(let i=0;i<20;i++){g.strokeStyle=`rgba(25,45,58,${Math.random()*.08})`;g.beginPath();g.moveTo(Math.random()*w,Math.random()*h);g.lineTo(Math.random()*w,Math.random()*h);g.stroke();}},256,256);}
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
let rowMode=false,exploded=false,explodeProgress=0,roofProgress=0,selectedRack=null,flowMode='off',tour=false,tourTarget=0,currentView='hq',cameraAnimation=null,userInteracted=false;
const rackModels=new Map(),rackLabels=new Map(),selectableMeshes=[];
const RACK_X=i=>(i-3.5)*1.52;
const RACK_Z=7;
const DEFAULT_RACKS=()=>Array.from({length:8},(_,i)=>({id:`R${String(i+1).padStart(2,'0')}`,name:i===0?'COMPUTE SYSTEM A':i===1?'COMPUTE SYSTEM B':i===2?'NETWORK FABRIC':i===3?'LIQUID COOLED':`CONFIGURED NODE ${i+1}`,purpose:['General compute','General compute','High-speed fabric','Direct liquid cooling','Compute expansion','Storage nodes','Compute cluster','Validation systems'][i],position:i,configured:true}));
let racks;
try{const p=JSON.parse(localStorage.getItem('wistron-studio-config-v1'));racks=Array.isArray(p?.racks)&&p.racks.length?p.racks:DEFAULT_RACKS();}catch{racks=DEFAULT_RACKS();}
function saveRacks(){try{localStorage.setItem('wistron-studio-config-v1',JSON.stringify({version:1,updated:new Date().toISOString(),racks}));}catch{toast('瀏覽器儲存空間無法使用，仍可匯出 JSON。');}renderRackSummary();}

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
    for(let i=0;i<3;i++){const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.8+Math.random()*.55,1),mat([0x3f6a60,0x547c6b,0x426b66][i],.96,0));crown.position.set(x+(i-1)*.85,4+i*.6,z+(i%2)*.8);crown.scale.y=.8;crown.castShadow=true;city.add(crown);}
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
  const upperShell=new THREE.Group();building.add(upperShell);upperShell.name="HQ shell";
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
function makeRackModel(rack,index){
  const group=new THREE.Group();group.position.set(RACK_X(rack.position),.13,RACK_Z);group.userData.rackId=rack.id;
  const body=box(group,1.28,2.76,1.2,0,1.39,0,M.body);
  box(group,1.31,.09,1.24,0,2.81,0,M.edge);box(group,1.32,.08,1.26,0,.055,0,M.black);
  for(const x of [-.65,.65]){
    box(group,.055,2.8,1.27,x,1.43,0,M.steel);
    box(group,.026,2.6,.026,x*.85,1.42,.638,M.metal);
    for(let y=.19;y<2.6;y+=.10)box(group,.034,.019,.018,x*.86,y,.659,M.black,{shadow:false});
  }
  box(group,1.1,2.52,.03,0,1.47,-.63,M.black);
  const deviceGroup=new THREE.Group();deviceGroup.name='rack-devices';group.add(deviceGroup);
  const frontSlats=[],silverEdges=[],serverLights=[],fanSockets=[];
  for(let i=0;i<26;i++){
    const y=.22+i*.09;
    const material=i>21?M.server:(i<5?M.steel:M.server);
    frontSlats.push([0,y,.633]);
    for(const x of [-.42,-.18,.10,.34])for(let dy=0;dy<2;dy++)fanSockets.push([x,y-.018+dy*.035,.669]);
    silverEdges.push([-.56,y,.654],[.56,y,.654]);
    serverLights.push([.48,y+.013,.671]);
    if(i%3===0)silverEdges.push([0,y+.029,.66]);
  }
  instanced(deviceGroup,1.14,.075,.075,frontSlats,M.server);
  instanced(deviceGroup,.18,.022,.016,fanSockets,M.black,{shadow:false});
  instanced(deviceGroup,.063,.023,.02,silverEdges,M.metal,{shadow:false});
  instanced(deviceGroup,.023,.017,.014,serverLights,M.cyan,{shadow:false});
  for(let i=0;i<5;i++){box(group,.2,.03,.023,-.39,.21+i*.096,.677,M.metal,{shadow:false});box(group,.12,.026,.027,-.12,.21+i*.096,.68,M.black);}
  for(const x of [-.595,.595])box(group,.035,.36,.047,x,1.43,.694,M.metal);
  box(group,1.28,.04,1.24,0,2.6,0,M.edge);
  textPlane(group,rack.id,-.37,2.71,.658,.4,.10,{color:'#d9e7ec',size:.37,weight:'600'});
  textPlane(group,'WISTRON',.05,2.71,.66,.34,.074,{color:'#65b4c3',size:.31,weight:'600'});
  const led=box(group,.04,.022,.01,.48,2.715,.665,M.glow,{shadow:false});
  const rails=box(group,1.19,.032,.032,0,2.54,.67,M.metal);
  const door=new THREE.Group();door.position.set(-.66,0,.73);group.add(door);
  const doorSteel=M.edge;
  box(door,.039,2.69,.045,0,1.42,0,doorSteel);box(door,.039,2.69,.045,1.30,1.42,0,doorSteel);box(door,1.3,.039,.045,.65,2.76,0,doorSteel);box(door,1.3,.039,.045,.65,.085,0,doorSteel);
  box(door,1.21,2.57,.008,.65,1.43,.002,M.glass,{shadow:false});
  for(let y=.22;y<2.62;y+=.1)box(door,1.17,.008,.012,.65,y,.01,M.edge,{shadow:false});
  box(door,.026,.21,.045,1.16,1.44,.053,M.metal);
  box(door,.025,.04,.067,1.16,1.44,.086,M.black);
  door.userData.isDoor=true;
  const coolingPipes=new THREE.Group();group.add(coolingPipes);
  for(const side of [-1,1]){
    if(rack.position%2===0&&side<0)continue;
    pipe(coolingPipes,[[side*.78,2.75,-.53],[side*.78,.35,-.53],[side*.68,.24,-.56]],.035,side<0?M.water:M.hot);
    for(let i=0;i<6;i++){pipe(coolingPipes,[[side*.78,.52+i*.33,-.53],[side*.56,.52+i*.33,-.66]],.012,side<0?M.water:M.hot);}
    cylinder(coolingPipes,.067,.15,side*.74,.3,-.56,M.metal);
  }
  const cables=[];for(let i=0;i<3;i++)pipe(group,[[-.46+(i%3)*.3,1.1+i*.12,-.69],[-.47+(i%3)*.29,1.13+i*.12,-.78],[-.37+(i%3)*.29,1.04+i*.12,-.82]],.009,mat(i%2?0x489aaf:0x989768,.65,.2));
  group.traverse(o=>{if(o.isMesh){o.userData.rackId=rack.id;o.userData.rackIndex=index;selectableMeshes.push(o);}});
  core.add(group);
  rackModels.set(rack.id,{group,door,deviceGroup,led,isOpen:false});
  const button=document.createElement('button');button.className='world-label';button.innerHTML=`<i></i>${escapeHtml(rack.id)}<small>48U</small>`;button.title=`聚焦機櫃 ${rack.id}`;button.addEventListener('click',()=>selectRack(rack.id,true));$('labels').appendChild(button);rackLabels.set(rack.id,button);
  return group;
}
function escapeHtml(s){const div=document.createElement('div');div.textContent=s;return div.innerHTML;}
function clearRack(rack){const model=rackModels.get(rack.id);if(model){selectableMeshes.splice(0,selectableMeshes.length,...selectableMeshes.filter(x=>x.userData.rackId!==rack.id));core.remove(model.group);model.group.traverse(o=>{if(o.geometry&&!geometryCache.has(...[''])){} });rackModels.delete(rack.id);}rackLabels.get(rack.id)?.remove();rackLabels.delete(rack.id);}
function rebuildRow(){selectableMeshes.length=0;for(const {group} of rackModels.values())core.remove(group);rackModels.clear();rackLabels.clear();$('labels').replaceChildren();racks.forEach(makeRackModel);renderRackSummary();}

camera.position.set(25,20,32);controls.target.set(0,4,-11);controls.update();
const presets={
 hq:()=>({p:new THREE.Vector3(34,23,38),t:new THREE.Vector3(2,10,-13),f:43}),
 cutaway:()=>({p:new THREE.Vector3(21,16,28),t:new THREE.Vector3(0,2.1,-8),f:44}),
 hall:()=>({p:new THREE.Vector3(18.7,15.5,24),t:new THREE.Vector3(0,1.3,-5.5),f:42}),
 row:()=>({p:new THREE.Vector3(5.9,3.7,18.6),t:new THREE.Vector3(.25,1.2,6.9),f:39}),
 aisle:()=>({p:new THREE.Vector3(.3,2.15,13.7),t:new THREE.Vector3(0,1.5,-7),f:61}),
};
function viewName(view){return {hq:'總部外觀',cutaway:'建築剖面',hall:'機房總覽',row:'機櫃排',aisle:'冷通道'}[view]||'機房';}
function animateCamera(p,t,f=43,duration=1.75){
  controls.enabled=false;
  cameraAnimation={start:performance.now(),duration:reducedMotion?.03:duration,fromP:camera.position.clone(),toP:p.clone(),fromT:controls.target.clone(),toT:t.clone(),fromF:camera.fov,toF:f};
}
function setSceneVisibility(view){
  const siteOnly=view==='hq';
  campus.visible=!siteOnly;shell.visible=!siteOnly;core.visible=!siteOnly;environmentRacks.visible=!siteOnly;
  city.visible=true;cityFar.visible=siteOnly;building.visible=true;
  rowMode=view==='row'||view==='aisle';
  if(view!=='row'&&view!=='aisle'){closeInspector();for(const model of rackModels.values())model.isOpen=false;}
  if(view!=='row'&&exploded){exploded=false;$('explodeBtn').classList.remove('active');}
  setFlow(flowMode,true);
}
function setView(view,instant=false){
  currentView=view;
  const target=presets[view]();setSceneVisibility(view);
  if(instant||reducedMotion){camera.position.copy(target.p);controls.target.copy(target.t);camera.fov=target.f;camera.updateProjectionMatrix();controls.update();cameraAnimation=null;controls.enabled=true;}
  else animateCamera(target.p,target.t,target.f,view==='hq'&&currentView==='hq'?2.2:1.6);
  document.querySelectorAll('[data-view]').forEach(b=>{const active=b.dataset.view===view;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false');});
  const isHQ=view==='hq';
  $('sceneMeta').style.opacity=isHQ?'1':'0';$('sceneMeta').style.visibility=isHQ?'visible':'hidden';
  $('detailHeader').hidden=isHQ;
  $('detailIndex').textContent={cutaway:'02',hall:'03',row:'04',aisle:'05'}[view]||'01';
  $('detailEnglish').textContent={cutaway:'WITHIN THE BUILDING',hall:'THE DATA HALL',row:'A COMPLETE RACK ROW',aisle:'THE COLD AISLE'}[view]||'SPATIAL CONFIGURATION';
  $('detailTitle').textContent={cutaway:'由建築，深入基礎設施。',hall:'每一個連接，都有它的位置。',row:'一整排系統，等你的定義。',aisle:'走進設備之間。'}[view];
  $('scaleLabel').textContent={hq:'BUILDING SCALE',cutaway:'FACILITY SECTION',hall:'DATA HALL / 01',row:'ROW A / 08 RACKS',aisle:'COLD AISLE / A01'}[view];
  $('footerMessage').textContent={hq:'內湖總部概念模型 · 空間視覺原型',cutaway:'建築剖面 · 概念空間，非實景測繪',hall:'DATA HALL 01 · 空間配置模型',row:'ROW A · 可配置機櫃排',aisle:'COLD AISLE · 自由漫遊視角'}[view];
  $('legend').style.opacity=view==='hq'?'0':'1';
  $('sceneHint').style.opacity=view==='hq'?'1':'.68';
  if(view==='hq'){$('startTour').innerHTML='進入資料中心 <svg><use href="#i-arrow"/></svg>';}
}
function startJourney(){tour=true;tourTarget=0;setView('hq');$('tourControls').hidden=false;updateJourney();toast('滾輪向下，從總部走進資料中心。');}
function updateJourney(){const order=['hq','cutaway','hall','row'];const names=['總部外觀','建築剖面','機房總覽','機櫃排'];$('journeyRange').value=String(tourTarget);$('journeyStep').textContent=`0${tourTarget+1} / 04`;$('journeyName').textContent=names[tourTarget];$('tourPrev').disabled=tourTarget===0;$('tourNext').disabled=tourTarget===3;if(order[tourTarget]!==currentView)setView(order[tourTarget]);}
function advanceJourney(dir){if(!tour){if(dir>0){if(currentView==='hq')setView('cutaway');else if(currentView==='cutaway')setView('hall');else if(currentView==='hall')setView('row');else zoomCamera(.84);}else zoomCamera(1.18);return;}tourTarget=clamp(tourTarget+dir,0,3);updateJourney();}
function exitJourney(){tour=false;$('tourControls').hidden=true;controls.enabled=true;toast('已切換為自由探索，滾輪可縮放。');}
function selectRack(id,focus=true){
  const rack=racks.find(r=>r.id===id);if(!rack)return;
  if(currentView==='hq'||currentView==='cutaway')setView('row');
  if(selectedRack&&rackLabels.has(selectedRack))rackLabels.get(selectedRack).classList.remove('selected');
  selectedRack=id;rackLabels.get(id).classList.add('selected');$('rackInspector').hidden=false;
  $('rackName').textContent=id;$('renameRack').value=id;$('rackPurpose').value=rack.purpose||'';$('rackPurpose').placeholder=rack.name||'自訂設備用途';
  $('rackKicker').textContent='ROW A / CONFIGURED RACK';
  $('rackState').textContent=`${rack.name||'已配置'} · 可自由編輯`;
  $('openRack').classList.toggle('active',rackModels.get(id)?.isOpen||false);
  $('detailEnglish').textContent='CONFIGURED INFRASTRUCTURE';$('detailTitle').textContent=`ROW A  /  ${id}`;
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='row'));
  if(focus){
    const x=RACK_X(rack.position),offset=x<0?-2.9:2.9;
    animateCamera(new THREE.Vector3(x+offset,3.7,RACK_Z+7.6),new THREE.Vector3(x,1.4,RACK_Z),38,1.3);
  }
}
function closeInspector(){selectedRack=null;$('rackInspector').hidden=true;for(const l of rackLabels.values())l.classList.remove('selected');for(const m of rackModels.values())m.isOpen=false;$('openRack').classList.remove('active');}
function addRack(duplicate=false){
  if(racks.length>=10){toast('這一排目前容納 10 櫃；可用 JSON 增加空間配置。');return;}
  const base=duplicate&&selectedRack?racks.find(r=>r.id===selectedRack):null;
  const next=racks.reduce((m,r)=>Math.max(m,r.position),-1)+1;
  let n=1;while(racks.some(r=>r.id===`R${String(n).padStart(2,'0')}`))n++;
  const rack={id:`R${String(n).padStart(2,'0')}`,name:base?`${base.name} / COPY`:'NEW CONFIGURATION',purpose:base?.purpose||'Custom system',position:next,configured:true};
  racks.push(rack);makeRackModel(rack,racks.length-1);saveRacks();setView('row');toast(`已新增 ${rack.id}，只存在此瀏覽器的本機配置。`);setTimeout(()=>selectRack(rack.id),900);
}
function toggleRackDoor(){if(!selectedRack)return;const m=rackModels.get(selectedRack);m.isOpen=!m.isOpen;$('openRack').classList.toggle('active',m.isOpen);$('openRack').innerHTML=`<svg><use href="#i-rack"/></svg>${m.isOpen?'關閉前門':'開門檢視'}`;}
function isolateSelected(){if(!selectedRack)return;const id=selectedRack;const current=rackModels.get(id).group;const active=!core.userData.isolated;
  core.userData.isolated=active;
  for(const [rid,model] of rackModels)model.group.visible=!active||rid===id;
  environmentRacks.visible=!active;shell.visible=!active;
  if(active){const r=racks.find(r=>r.id===id);animateCamera(new THREE.Vector3(RACK_X(r.position)+3.4,3.7,RACK_Z+7.8),new THREE.Vector3(RACK_X(r.position),1.45,RACK_Z),38,1.3);toast('已隔離機櫃。按「機房」可恢復完整空間。');}else{setView('hall');}
}
function setFlow(mode,force=false){
  if(!force&&flowMode===mode)mode='off';flowMode=mode;
  coolingFlow.visible=mode==='cooling';powerFlow.visible=mode==='power';networkFlow.visible=mode==='network';
  document.querySelectorAll('[data-flow]').forEach(b=>b.classList.toggle('active',b.dataset.flow===mode));
  if(!force){shell.visible=mode==='off'&&currentView!=='hq'&&!core.userData.isolated;environmentRacks.visible=mode==='off'&&currentView!=='hq'&&!core.userData.isolated;$('networkBtn').classList.toggle('active',mode!=='off');}
  if(mode!=='off'&&currentView==='hq')setView('cutaway');
}
function makeFlows(){
  const flows=[[coolingFlow,M.water],[coolingFlow,M.hot],[powerFlow,M.gold],[networkFlow,M.cyan]];
  for(let f=0;f<flows.length;f++){
    const [parent,material]=flows[f];const y=f===0?3.5:f===1?3.33:f===2?3.95:3.76;const x=f===0?-4.9:f===1?-4.6:f===2?7.4:4.8;
    const points=[[x,y,-17],[x,y,5.8],[x,y,6.8]];
    pipe(parent,points,.027,material);
    for(const rack of racks){
      const xx=RACK_X(rack.position);
      const pts=[[x,y,RACK_Z],[xx,y,RACK_Z],[xx,2.6,RACK_Z-.4]];
      pipe(parent,pts,.018,material);
      for(let j=0;j<4;j++){
        const dot=new THREE.Mesh(new THREE.SphereGeometry(.038,6,6),new THREE.MeshBasicMaterial({color:material.color,toneMapped:false}));parent.add(dot);flowDots.push({mesh:dot,curve:new THREE.CatmullRomCurve3(pts.map(v=>new THREE.Vector3(...v))),phase:j/4,speed:.105+f*.006});
      }
    }
  }
}

let pointerStart=null;
canvas.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY};canvas.classList.add('dragging');userInteracted=true;if(tour)exitJourney();cameraAnimation=null;controls.enabled=true;});
canvas.addEventListener('pointerup',e=>{canvas.classList.remove('dragging');if(!pointerStart||Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>6)return;pointerStart=null;const rect=canvas.getBoundingClientRect();const raycaster=new THREE.Raycaster();raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hits=raycaster.intersectObjects(selectableMeshes.filter(m=>m.parent&&isVisible(m)),false);if(hits.length)selectRack(hits[0].object.userData.rackId,true);});
canvas.addEventListener('pointerleave',()=>{canvas.classList.remove('dragging');pointerStart=null;});
function isVisible(o){while(o){if(!o.visible)return false;o=o.parent;}return true;}
$('startTour').addEventListener('click',startJourney);$('hallDirect').addEventListener('click',()=>{exitJourney();setView('row');});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{if(tour)exitJourney();setView(b.dataset.view);}));
$('tourPrev').addEventListener('click',()=>advanceJourney(-1));$('tourNext').addEventListener('click',()=>advanceJourney(1));$('exitTour').addEventListener('click',exitJourney);
$('journeyRange').addEventListener('input',e=>{tourTarget=Number(e.target.value);updateJourney();});
let lastWheel=0;stage.addEventListener('wheel',e=>{if(!tour||$('deviceModal').hidden===false||document.querySelector('dialog[open]'))return;e.preventDefault();e.stopPropagation();const now=performance.now();if(Math.abs(e.deltaY)<8||now-lastWheel<650)return;lastWheel=now;advanceJourney(e.deltaY>0?1:-1);},{passive:false,capture:true});
function zoomCamera(f){const delta=camera.position.clone().sub(controls.target);delta.multiplyScalar(f);delta.clampLength(2,155);camera.position.copy(controls.target).add(delta);}
$('closeInspector').addEventListener('click',()=>{closeInspector();if(currentView==='row')setView('hall');});
$('renameRack').addEventListener('change',()=>{if(!selectedRack)return;const value=$('renameRack').value.trim().replace(/[^a-zA-Z0-9_-]/g,'').slice(0,24);if(!value){toast('請輸入英數字機櫃名稱。');return;}if(racks.some(r=>r.id===value&&r.id!==selectedRack)){toast('這個機櫃名稱已存在。');$('renameRack').value=selectedRack;return;}const rack=racks.find(r=>r.id===selectedRack);const old=selectedRack;const model=rackModels.get(old);const label=rackLabels.get(old);model.group.userData.rackId=value;model.group.traverse(o=>{o.userData.rackId=value;});selectableMeshes.forEach(o=>{if(o.userData.rackId===old)o.userData.rackId=value;});rack.id=value;rackModels.delete(old);rackModels.set(value,model);rackLabels.delete(old);rackLabels.set(value,label);label.innerHTML=`<i></i>${escapeHtml(value)}<small>48U</small>`;label.removeEventListener('click',selectRack);label.onclick=()=>selectRack(value);saveRacks();selectRack(value,false);toast(`已重新命名為 ${value}。`);});
$('rackPurpose').addEventListener('change',()=>{if(!selectedRack)return;const r=racks.find(r=>r.id===selectedRack);r.purpose=$('rackPurpose').value.slice(0,60);saveRacks();$('rackState').textContent=`${r.name} · 已儲存本機配置`;toast('用途已儲存。');});
$('openRack').addEventListener('click',toggleRackDoor);$('duplicateRack').addEventListener('click',()=>addRack(true));$('addRackBtn').addEventListener('click',()=>addRack(false));
$('isolateRack').addEventListener('click',isolateSelected);$('rackFront').addEventListener('click',()=>selectRack(selectedRack,true));$('rackRear').addEventListener('click',()=>{if(!selectedRack)return;const r=racks.find(r=>r.id===selectedRack),x=RACK_X(r.position);animateCamera(new THREE.Vector3(x-2.8,3.4,RACK_Z-7.4),new THREE.Vector3(x,1.4,RACK_Z),43,1.5);});
$('explodeBtn').addEventListener('click',()=>{if(currentView==='hq'||currentView==='cutaway'){toast('請先進入機櫃排再拆層。');setView('row');return;}exploded=!exploded;$('explodeBtn').classList.toggle('active',exploded);$('explodeBtn').setAttribute('aria-pressed',String(exploded));toast(exploded?'展開網路托盤、運算設備與電源層。':'設備已回到裝配位置。');});
$('networkBtn').addEventListener('click',()=>{$('flowPanel').hidden=!$('flowPanel').hidden;$('networkBtn').setAttribute('aria-expanded',String(!$('flowPanel').hidden));});$('closeFlow').addEventListener('click',()=>{$('flowPanel').hidden=true;$('networkBtn').setAttribute('aria-expanded','false');});document.querySelectorAll('[data-flow]').forEach(b=>b.addEventListener('click',()=>setFlow(b.dataset.flow)));
$('resetBtn').addEventListener('click',()=>{exitJourney();core.userData.isolated=false;closeInspector();setView('hall');setFlow('off',true);});
$('helpBtn').addEventListener('click',()=>$('helpDialog').showModal());$('configBtn').addEventListener('click',()=>{renderRackSummary();$('configDialog').showModal();});document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
function renderRackSummary(){$('rackSummary').innerHTML=racks.map(r=>`<span>${escapeHtml(r.id)}</span>`).join('');$('configSummary').textContent=`目前整排 ${racks.length} 個機櫃，均可選取、命名、編輯用途或複製。變更只儲存在本機。`;}
$('exportConfig').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({version:1,racks},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='wistron-data-center-config.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已匯出機櫃配置，不包含任何現場資料。');});
$('importConfig').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.racks)||!data.racks.length||data.racks.length>10)throw Error('配置須包含 1–10 台機櫃');const ids=new Set(),positions=new Set();for(const r of data.racks){if(typeof r.id!=='string'||!/^[a-zA-Z0-9_-]{1,24}$/.test(r.id)||ids.has(r.id)||!Number.isInteger(r.position)||r.position<0||r.position>9||positions.has(r.position)||typeof r.purpose!=='string')throw Error('ID 重複、位置重複或欄位格式錯誤');ids.add(r.id);positions.add(r.position);r.name=String(r.name||'CONFIGURED').slice(0,60);r.purpose=r.purpose.slice(0,60);}racks=data.racks.map(r=>({id:r.id,name:r.name,purpose:r.purpose,position:r.position,configured:true}));closeInspector();rebuildRow();makeFlows();saveRacks();setView('row');$('configDialog').close();toast('已安全匯入本機機櫃配置。');}catch(err){toast(`匯入失敗：${err.message}`);}e.target.value='';});
$('resetConfig').addEventListener('click',()=>{if(!confirm('恢復原始八櫃示範配置？本機修改將被覆蓋，請先匯出備份。'))return;racks=DEFAULT_RACKS();closeInspector();rebuildRow();makeFlows();saveRacks();setView('row');$('configDialog').close();toast('已恢復八櫃示範配置。');});
$('fullscreenBtn').addEventListener('click',async()=>{try{if(!document.fullscreenElement)await stage.requestFullscreen();else await document.exitFullscreen();}catch{toast('瀏覽器不支援此處全螢幕。');}});
$('qualityBtn').addEventListener('click',()=>{const high=renderer.getPixelRatio()<1.4;renderer.setPixelRatio(high?Math.min(devicePixelRatio,2):1);renderer.shadowMap.enabled=high;$('qualityLabel').textContent=high?'HIGH QUALITY':'PERFORMANCE';toast(high?'高品質模式':'效能模式');resize();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('deviceModal').hidden)device.close();else if($('flowPanel').hidden===false)$('closeFlow').click();else if(selectedRack)closeInspector();else if(tour)exitJourney();}if(e.key==='Home'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){$('resetBtn').click();}});

const device={scene:null,camera:null,renderer:null,controls:null,asset:null,request:0,open(type='cooling'){
  this.type=type;$('deviceModal').hidden=false;this.request++;
  if(!this.renderer){this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x122029);this.camera=new THREE.PerspectiveCamera(40,1,.001,200);this.renderer=new THREE.WebGLRenderer({antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.5;this.renderer.outputColorSpace=THREE.SRGBColorSpace;const env=new RoomEnvironment(this.renderer);const pg=new THREE.PMREMGenerator(this.renderer);this.scene.environment=pg.fromScene(env,.04).texture;env.dispose();pg.dispose();this.scene.add(new THREE.HemisphereLight(0xd2efff,0x1b2730,2.5));const dl=new THREE.DirectionalLight(0xffffff,4);dl.position.set(4,5,6);this.scene.add(dl);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;$('deviceStage').appendChild(this.renderer.domElement);}
  $('loadCooling').classList.toggle('selected',type==='cooling');$('loadBoard').classList.toggle('selected',type==='board');$('deviceTitle').textContent=type==='cooling'?'Liquid cooling assembly':'L10 compute board';$('devicePlaceholder').classList.remove('done');$('devicePlaceholder').querySelector('span').textContent='正在載入精細 GLB 資產…';
  const rid=this.request;
  new GLTFLoader().load(type==='cooling'?'./assets/cooling-assembly.glb':'./assets/compute-board.glb',gltf=>{if(rid!==this.request)return;this.scene.remove(this.asset);this.asset=gltf.scene;const bounds=new THREE.Box3().setFromObject(this.asset),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());const scale=4/Math.max(size.x,size.y,size.z);this.asset.scale.setScalar(scale);bounds.setFromObject(this.asset);bounds.getCenter(center);this.asset.position.sub(center);this.scene.add(this.asset);const fitted=new THREE.Box3().setFromObject(this.asset).getSize(new THREE.Vector3());this.camera.position.copy(new THREE.Vector3(2.7,1.8,3.5).multiplyScalar(Math.max(fitted.x,fitted.y,fitted.z)/2));this.controls.target.set(0,0,0);this.camera.near=.005;this.camera.far=Math.max(100,fitted.length()*8);this.camera.updateProjectionMatrix();this.controls.update();$('devicePlaceholder').classList.add('done');
  },undefined,err=>{if(rid!==this.request)return;$('devicePlaceholder').querySelector('span').textContent=`GLB 載入失敗：${err.message||'請確認資產位置'}`;});
  this.resize();
},resize(){if(!this.renderer)return;const rect=$('deviceStage').getBoundingClientRect();if(rect.width<1)return;this.renderer.setSize(rect.width,rect.height);this.camera.aspect=rect.width/rect.height;this.camera.updateProjectionMatrix();},close(){this.request++;$('deviceModal').hidden=true;}};
$('deviceView').addEventListener('click',()=>device.open('cooling'));$('closeDevice').addEventListener('click',()=>device.close());$('loadBoard').addEventListener('click',()=>device.open('board'));$('loadCooling').addEventListener('click',()=>device.open('cooling'));
let toastTimer;function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3400);}
function resize(){const w=stage.clientWidth,h=stage.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);device.resize();}
new ResizeObserver(resize).observe(stage);
function updateLabels(){
  const show=currentView==='row'||currentView==='aisle';$('labels').style.display=show?'block':'none';if(!show)return;
  const width=stage.clientWidth,height=stage.clientHeight;const rect=canvas.getBoundingClientRect();
  const v=new THREE.Vector3();
  for(const r of racks){
    const label=rackLabels.get(r.id);const m=rackModels.get(r.id);if(!m)continue;
    v.set(0,2.93,.57);m.group.localToWorld(v);v.project(camera);const x=(v.x*.5+.5)*width,y=(-v.y*.5+.5)*height;
    const visible=v.z<1&&v.z>-1&&x>20&&x<width-20&&y>20&&y<height-110&&isVisible(m.group)&&camera.position.z>RACK_Z-1.0;
    label.style.display=visible?'flex':'none';label.style.left=`${x}px`;label.style.top=`${y}px`;
  }
}
let lastTime=0,frames=0;
function animate(now=0){requestAnimationFrame(animate);const dt=Math.min(.05,(now-lastTime)/1000||.016);lastTime=now;
  if(cameraAnimation){const a=cameraAnimation,t=clamp((now-a.start)/(a.duration*1000)),q=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;camera.position.lerpVectors(a.fromP,a.toP,q);controls.target.lerpVectors(a.fromT,a.toT,q);camera.fov=mix(a.fromF,a.toF,q);camera.updateProjectionMatrix();camera.lookAt(controls.target);if(t>=1){cameraAnimation=null;controls.enabled=true;controls.update();}}
  else if(controls.enabled)controls.update();
  const targetRoof=currentView==='hq'?0:currentView==='cutaway'?.48:1;roofProgress=reducedMotion?targetRoof:mix(roofProgress,targetRoof,.035);
  if(upperShell){upperShell.scale.y=1-roofProgress*.88;upperShell.position.y=roofProgress*.12;upperShell.visible=currentView==='hq'||currentView==='cutaway';}
  building.visible=currentView==='hq'||currentView==='cutaway';
  campus.visible=currentView!=='hq';
  city.visible=true;environmentRacks.visible=(currentView==='hall'||currentView==='row'||currentView==='aisle')&&flowMode==='off'&&!core.userData.isolated;
  shell.visible=(currentView==='hall'||currentView==='row'||currentView==='aisle')&&flowMode==='off'&&!core.userData.isolated;
  if(currentView==='cutaway')building.visible=true;
  const targetExplode=exploded?1:0;explodeProgress=reducedMotion?targetExplode:mix(explodeProgress,targetExplode,.075);
  for(const m of rackModels.values()){m.deviceGroup.position.z=explodeProgress*.88;m.group.rotation.y=mix(m.group.rotation.y,currentView==='hq'?.10:0,.04);}
  for(const m of rackModels.values())m.door.rotation.y=mix(m.door.rotation.y,m.isOpen?-Math.PI*.69:exploded?-Math.PI*.43:0,.085);
  for(const f of flowDots){const t=(now*.0001*f.speed*9+f.phase)%1;f.mesh.position.copy(f.curve.getPoint(t));}
  updateLabels();
  renderer.render(scene,camera);
  if(device.renderer&&!$('deviceModal').hidden){device.controls.update();device.renderer.render(device.scene,device.camera);}
  frames++;
}

try{
  buildCity();buildHQ();buildHall();racks.forEach(makeRackModel);instanceStaticGroup(city);instanceStaticGroup(cityFar);instanceStaticGroup(campus);instanceStaticGroup(shell);for(const [id,model] of rackModels){instanceStaticGroup(model.deviceGroup);instanceStaticGroup(model.door);}instanceStaticGroup(city.children.length?building:building);makeFlows();renderRackSummary();resize();
  setView('hall',true);setTimeout(()=>$('loading').classList.add('done'),700);setTimeout(()=>$('loading').remove(),1600);animate();
  window.__WISTRON_STUDIO__={scene,camera,renderer,controls,get racks(){return racks;},get currentView(){return currentView;},get selectedRack(){return selectedRack;},get flowMode(){return flowMode;},get exploded(){return exploded;},setView,selectRack,get drawCalls(){return renderer.info.render.calls;}};
}catch(err){console.error(err);$('loading').querySelector('p').textContent='3D 初始化錯誤';$('loading').querySelector('small').textContent=err.message;}
