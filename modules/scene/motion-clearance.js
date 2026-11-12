import * as THREE from 'three';
// Sample the actual projected body meshes, not a second hard-coded inventory.
// This conservative AABB check supplements continuous single-device extraction.
export function cinematicClearance(rig,steps=96){
  let conflict=null;
  try{for(let n=0;n<=steps&&!conflict;n++){
    rig.setCinematic(n/steps);rig.group.updateWorldMatrix(true,true);const boxes=[];
    for(const [id,item] of rig.items){if(!item.group.visible)continue;const box=new THREE.Box3().setFromObject(item.mesh);box.expandByScalar(-.0001);for(const previous of boxes)if(box.intersectsBox(previous.box)){conflict={progress:n/steps,entities:[previous.id,id]};break;}if(conflict)break;boxes.push({id,box});}
  }}finally{rig.setCinematic(null);rig.update(0);}
  return{valid:!conflict,conflict,samples:steps+1,scope:'conservative equipment body AABB samples; not OEM rail/connector certification'};
}
