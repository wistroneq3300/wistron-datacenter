import * as THREE from 'three';

// DOM nodes are retained by stable entity ID; projection updates positions only.
export class ExplorationHUD{
  constructor({container,camera,onActivate}){Object.assign(this,{container,camera,onActivate});this.nodes=new Map();this.vector=new THREE.Vector3();this.hidden=false;}
  setHotspots(items){
    const ids=new Set(items.map(item=>item.id));for(const[id,entry]of this.nodes)if(!ids.has(id)){entry.button.remove();this.nodes.delete(id);}
    for(const item of items){let entry=this.nodes.get(item.id);if(!entry){const button=document.createElement('button');button.className='spatial-hotspot';button.dataset.entityId=item.id;button.type='button';button.onclick=()=>this.onActivate(this.nodes.get(item.id).item);this.container.append(button);entry={button};this.nodes.set(item.id,entry);}entry.item=item;entry.button.textContent=item.label;entry.button.setAttribute('aria-label',item.description||item.label);entry.button.title=item.description||item.label;}
  }
  update(){const rect=this.container.getBoundingClientRect(),eye=this.camera.position,placed=[];
    // Existing Rack labels belong to the same spatial composition. New row
    // hotspots may not cover them, even though the legacy layer owns their DOM.
    for(const node of this.container.parentElement?.querySelectorAll('#labels button:not([hidden])')||[]){if(getComputedStyle(node).visibility==='hidden')continue;const r=node.getBoundingClientRect();if(!r.width||!r.height)continue;placed.push({x:r.x-rect.x+r.width/2,y:r.y-rect.y+r.height/2,width:r.width,height:r.height});}
    for(const {button,item}of this.nodes.values()){
    const point=typeof item.position==='function'?item.position():item.position;if(!point){button.hidden=true;continue;}
    this.vector.copy(point);const front=this.vector.clone().sub(eye).dot(this.camera.getWorldDirection(new THREE.Vector3()))>0;this.vector.project(this.camera);
    button.hidden=this.hidden||!front||Math.abs(this.vector.x)>.94||Math.abs(this.vector.y)>.82||this.vector.z>1;
    if(!button.hidden){const width=button.offsetWidth,height=button.offsetHeight,x=Math.max(width/2+10,Math.min(rect.width-width/2-10,(this.vector.x*.5+.5)*rect.width)),baseY=(-this.vector.y*.5+.5)*rect.height,step=height+12;let y=baseY,available=false;
      for(const n of [0,-1,1,-2,2,-3,3,-4,4]){y=Math.max(height/2+140,Math.min(rect.height-height/2-150,baseY+n*step));if(!placed.some(p=>Math.abs(p.x-x)<(p.width+width)/2+8&&Math.abs(p.y-y)<(p.height+height)/2+8)){available=true;break;}}
      if(!available){button.hidden=true;continue;}placed.push({x,y,width,height});button.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;
    }
  }}
  dispose(){for(const entry of this.nodes.values())entry.button.remove();this.nodes.clear();}
}
