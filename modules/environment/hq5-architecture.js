import * as THREE from 'three';
import {mergeGeometries} from '../../vendor/BufferGeometryUtils.js';

// Metres are a presentation scale, not a survey. Geometry is authored from the
// cited 2011 overview and 2025 entrance photograph; unseen faces remain Draft.
export class ArchitectureBuilder {
  constructor(owner){this.o=owner;this.parts=new Map();this.stats={windowOpenings:0,curvedPanels:0};}
  add(g,m,parent=this.o.building){const key=m.uuid+parent.uuid;if(!this.parts.has(key))this.parts.set(key,{material:m,parent,geometries:[]});this.parts.get(key).geometries.push(g.index?g.toNonIndexed():g);if(g.index)g.dispose();}
  prism(points,depth,m,position=[0,0,0],rotation=0,holes=[],bevel=.018){
    for(let i=0;i<holes.length;i++)for(let j=i+1;j<holes.length;j++){const [x,y,w,h]=holes[i],[a,b,c,d]=holes[j];if(x<a+c&&x+w>a&&y<b+d&&y+h>b)throw Error('Overlapping HQ facade openings');}
    const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));
    for(const [x,y,w,h] of holes){const path=new THREE.Path();path.moveTo(x,y);path.lineTo(x,y+h);path.lineTo(x+w,y+h);path.lineTo(x+w,y);path.closePath();shape.holes.push(path);}
    const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,steps:1,curveSegments:16});
    g.rotateY(rotation);g.translate(...position);this.add(g,m);return g;
  }
  rect(w,h,d,m,x,y,z,ry=0,bevel=.012){return this.prism([[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]],d,m,[x,y,z],ry,[],bevel);}
  plane(w,h,m,x,y,z,ry=0){const g=new THREE.PlaneGeometry(w,h);g.rotateY(ry);g.translate(x,y,z);this.add(g,m);}
  tube(points,r,m){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));this.add(new THREE.TubeGeometry(curve,Math.max(4,points.length*3),r,8,false),m);}
  // Curved panels have continuous surface normals, UVs and real radial depth.
  arc(cx,cz,r,a0,a1,y,h,m,thickness=.045){
    const shape=new THREE.Shape(),steps=Math.ceil((a1-a0)*30);
    for(let i=0;i<=steps;i++){const a=a0+(a1-a0)*i/steps,x=cx+Math.sin(a)*r,z=cz+Math.cos(a)*r;if(i===0)shape.moveTo(x,-z);else shape.lineTo(x,-z);}
    for(let i=steps;i>=0;i--){const a=a0+(a1-a0)*i/steps;shape.lineTo(cx+Math.sin(a)*(r-thickness),-cz-Math.cos(a)*(r-thickness));}shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,curveSegments:24});g.rotateX(-Math.PI/2);g.translate(0,y,0);this.add(g,m);this.stats.curvedPanels++;
  }
  window(x,y,w,h,z=-4.58,ry=0){
    const o=this.o,at=(dx,dy,dz)=>[x+Math.cos(ry)*dx+Math.sin(ry)*dz,y+dy,z-Math.sin(ry)*dx+Math.cos(ry)*dz];
    this.plane(w,h,o.interior,...at(0,0,-1.3),ry);
    const n=Math.max(2,Math.round(w/1.25));
    for(let j=0;j<n;j++){const dx=-w/2+(j+.5)*w/n;this.rect(w/n-.028,h-.05,.025,o.glass,...at(dx,0,0),ry,0);}
    for(const dx of [-w/2,w/2])this.rect(.06,h+.08,.09,o.frame,...at(dx,0,.035),ry,.004);
    for(const dy of [-h/2,h/2,.35])this.rect(w,.045,.1,o.frame,...at(0,dy,.045),ry,.004);
    for(let j=1;j<n;j++)this.rect(.042,h,.075,o.frame,...at(-w/2+j*w/n,0,.045),ry,.003);
    this.rect(w+.16,.10,.70,o.trim,...at(0,-h/2-.08,-.03),ry,.018);
  }
  build(){
    const o=this.o,front=-4;
    // True window voids cut through one continuous stepped stone wall. No solid
    // building box behind the glazing and no stickers concealing a solid wall.
    const outline=[[-24,0],[6.2,0],[6.2,19.65],[-12,19.65],[-12,16.4],[-18.1,16.4],[-18.1,13.15],[-24,13.15]];
    const bays=[{x:-21,w:4.0,top:13.1},{x:-15.1,w:4.25,top:16.3},{x:-3.05,w:4.2,top:19.55},{x:2.9,w:4.35,top:19.55}],holes=[];
    for(const b of bays){for(let y=8.4;y<b.top-.7;y+=3.25){holes.push([b.x-b.w/2,y-1.05,b.w,2.1]);this.window(b.x,y,b.w,2.1);}
      for(const [y,h] of [[2.05,2.9],[5.05,1.9]]){holes.push([b.x-b.w/2,y-h/2,b.w,h]);this.window(b.x,y,b.w,h);}}
    holes.push([-10.6,.28,4.9,5.52],[-10.6,6.8,4.9,12.6]);
    this.prism(outline,.58,o.stone,[0,0,front-.58],0,holes,.027);this.stats.windowOpenings=holes.length;
    // Return wall: repeat only the broad arrangement visible in the overview.
    const sideHoles=[];
    const sideBays=[[-14.1,2.5],[-18.5,3.3],[-22.9,2.2],[-27.2,3.3],[-31.7,2.6]];
    for(const [z,w] of sideBays)for(let y=8.4;y<19.0;y+=3.25){sideHoles.push([-z-w/2,y-1.05,w,2.1]);this.window(14.45,y,w,2.1,z,Math.PI/2);}
    for(const [z,w] of sideBays)for(const [y,h]of[[2.05,2.9],[5.05,1.9]]){sideHoles.push([-z-w/2,y-h/2,w,h]);this.window(14.45,y,w,h,z,Math.PI/2);}
    this.prism([[12,0],[34.3,0],[34.3,19.65],[12,19.65]],.55,o.stone,[14.45,0,0],Math.PI/2,sideHoles,.025);
    // Hidden faces intentionally plain; no invented rear window schedule/HVAC.
    this.prism(outline,.4,o.stone,[0,0,-40.8],0,[],.025);
    this.rect(9,6.6,.4,o.stone,10.6,3.3,-40.8,0,.025);
    this.rect(36.8,13.1,.4,o.stone,-24,6.55,-22.4,Math.PI/2,.03);
    // Plain Draft closures follow the already modeled roof setbacks. Ends sit
    // inside the front/rear wall thickness, avoiding exposed coplanar end caps;
    // no unverified openings or facade details are inferred on these returns.
    for(const [x,bottom,top]of[[-18.1,13.15,16.4],[-12,16.4,19.65]]){
      this.rect(36.5,top-bottom,.4,o.stone,x,(bottom+top)/2,-22.35,Math.PI/2,.025);
    }
    for(const [x,w,h]of[[-21,6,13.15],[-15.05,5.9,16.4],[-2.9,18.3,19.65]]){
      this.rect(w+.30,.42,37.2,o.stone,x,h-.05,-41.0,0,.04);
      for(const z of [-41.05,-3.91])this.rect(w+.38,.08,.16,o.trim,x,h+.23,z,0,.015);
      for(const dx of [-w/2,w/2])this.rect(.16,.08,37.3,o.trim,x+dx,h+.23,-41.05,0,.015);
      this.rect(w-.2,.045,36.7,o.roof,x,h+.18,-40.75,0,.005);
    }
    this.rect(9.1,.25,22.4,o.stone,10.6,19.52,-34.4,0,.02);
    this.rect(8.6,.04,22.2,o.roof,10.6,19.68,-34.3,0,.005);
    this.rect(.22,.3,22.4,o.stone,14.94,19.76,-34.4,0,.02);
    // Corner curtain wall, inset glazing behind projecting stone slab edges.
    const cornerX=10.55,cornerZ=-8.05;
    for(let y=8.4;y<19.0;y+=3.25){
      this.window(cornerX,y,8.7,2.68,-4.16);this.window(14.86,y,7.8,2.68,cornerZ,Math.PI/2);
      this.rect(9.3,.22,.62,o.stone,10.55,y-1.55,-4.53);this.rect(.62,.22,8.4,o.stone,14.86,y-1.55,-12.15);
      this.rect(8.7,.30,.10,o.frame,10.55,y-1.32,-4.18);this.rect(.10,.30,7.8,o.frame,14.9,y-1.32,-11.95);
    }
    for(const [y,h]of[[2.05,2.9],[5.05,1.9]]){this.window(10.55,y,7.5,h,-4.58);this.window(14.45,y,6.6,h,-8.1,Math.PI/2);}
    this.rect(1.1,6.6,.7,o.stone,6.75,3.3,-4.65);this.rect(1.1,6.6,.7,o.stone,14.45,3.3,-4.65);
    this.rect(9.3,.7,8.5,o.stone,10.55,6.4,-12.1);this.rect(9.5,.55,8.6,o.stone,10.55,19.90,-12.15);
    this.rect(9.62,.10,8.72,o.trim,10.55,20.23,-12.21);
    this.rect(8.75,.02,7.85,o.roof,10.55,20.295,-11.80,0,.005);
    // The entrance vertical bay is convex in the verified 2025 photograph.
    const cx=-8.15,cz=-8.5,r=4.9,a=.51;
    for(let y=8.4;y<19.0;y+=3.25){
      this.arc(cx,cz,r,-a,a,y-1.25,2.5,o.glass,.04);
      for(const dy of [-1.28,.42,1.27])this.arc(cx,cz,r+.045,-a,a,y+dy,.05,o.frame,.06);
      this.arc(cx,cz,r+.18,-a-.015,a+.015,y-1.57,.27,o.stone,.56);
      for(let j=0;j<=5;j++){const angle=-a+j*2*a/5;this.rect(.045,2.5,.09,o.frame,cx+Math.sin(angle)*(r+.05),y,cz+Math.cos(angle)*(r+.05),angle,.003);}
    }
    this.arc(cx,cz,r+.3,-a-.025,a+.025,19.15,.48,o.stone,.72);
        // Far right glazed pavilion and five intermediate stone-window bays are
    // visible in the 2012 overview (not a fabricated symmetric rear facade).
    for(let y=8.4;y<19;y+=3.25){this.window(14.86,y,6.2,2.68,-37.4,Math.PI/2);this.window(11.1,y,7.4,2.68,-40.55,Math.PI);this.rect(.62,.22,6.6,o.stone,14.86,y-1.55,-40.65);this.rect(7.8,.22,.62,o.stone,11.1,y-1.55,-40.95);}
    this.rect(8,.5,6.9,o.stone,11.15,19.9,-40.95);this.rect(8.14,.09,7.04,o.trim,11.15,20.21,-41.02);
    this.rect(7.35,.02,6.25,o.roof,11.15,20.27,-40.62,0,.005);
    for(const [y,h]of[[2.05,2.9],[5.05,1.9]])this.window(14.45,y,5.4,h,-37.4,Math.PI/2);
    this.entrance();o.sign('wistron',[10.55,19.90,-3.46],6.3,.67,'#467c77');
    o.building.userData.facades={front:'2011 overview + 2025 entrance; interpreted Draft',side:'partial historical reference',rear:'unverified plain envelope',roof:'unverified plain membrane',windowSchedule:'unverified',dimensionsMm:'illustrative, not surveyed'};
    this.flush();o.architectureStats=this.stats;
  }
  entrance(){
    const o=this.o,x=-8.15;
    this.rect(6.1,.38,.94,o.stone,x,5.85,-4.80);
    for(const dx of [-2.7,2.7]){this.rect(.65,5.5,.95,o.stone,x+dx,2.75,-4.9);this.rect(.22,1.55,.11,o.frame,x+dx,2.9,-3.89);this.rect(.13,1.40,.045,o.lamp,x+dx,2.9,-3.77);for(let k=0;k<8;k++)this.rect(.18,.025,.035,o.frame,x+dx,2.25+k*.18,-3.70);}
    this.window(x,2.2,4.65,3.9,-5.05);this.window(x,4.9,4.65,1.25,-5.05);
    for(const dx of [-.65,.65])this.tube([[x+dx,1.1,-4.90],[x+dx,2.0,-4.90]],.018,o.metal);
    o.sign('158',[x+2.7,1.82,-3.73],.36,.16,'#4c4b43');
    // Fan canopy: shaped extruded sector + rounded radial ribs, not a rectangle.
    const roof=new THREE.Shape();roof.moveTo(-2.5,-4.55);roof.lineTo(2.5,-4.55);roof.lineTo(3.35,-.3);roof.quadraticCurveTo(0,1.05,-3.35,-.3);roof.closePath();
    const g=new THREE.ExtrudeGeometry(roof,{depth:.09,bevelEnabled:true,bevelSize:.02,bevelThickness:.02,bevelSegments:2});g.rotateX(Math.PI/2);g.translate(x,5.19,0);this.add(g,o.canopyGlass);
    for(let j=0;j<=8;j++){const dx=-3.35+j*6.7/8,z=.37-.67*Math.pow(dx/3.35,2);this.tube([[x+dx*.73,4.99,-4.5],[x+dx*.87,5.05,-2.1],[x+dx,5.12,z]],.09,o.canopyMetal||o.metal);}
    this.tube(Array.from({length:25},(_,j)=>{const dx=-3.35+j*6.7/24;return[x+dx,5.15,.37-.67*(dx/3.35)**2];}),.105,o.canopyMetal||o.metal);
    this.rect(4.8,.1,2.4,o.frame,x,5.02,-4.5);
    for(const dx of [-1.65,0,1.65]){const lamp=new THREE.Mesh(o.own(new THREE.CircleGeometry(.065,16)),o.lamp);lamp.rotation.x=Math.PI/2;lamp.position.set(x+dx,4.96,-3.4);o.building.add(lamp);}
    // Forecourt brand stone: rough bevelled granite, observed in entrance photo.
    this.prism([[-2.3,0],[2.3,0],[2.15,1.1],[1.35,1.16],[.45,1.13],[-.25,1.2],[-1.4,1.14],[-2.15,1.18]],.65,o.roughStone,[x-3.3,.14,1.15],0,[],.075);
    o.sign('wistron',[x-3.3,.87,1.89],3.0,.38,'#676d69');o.sign('緯 創 資 通',[x-3.3,.39,1.89],2.35,.25,'#656c69');
  }
  flush(){for(const {geometries,material,parent}of this.parts.values()){const g=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!g)throw Error('HQ geometry merge failed');this.o.own(g);const mesh=new THREE.Mesh(g,material);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);}this.parts.clear();}
}
