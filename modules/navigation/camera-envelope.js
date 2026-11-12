import * as THREE from 'three';
// Resolve a camera point against visible inspection envelopes. This is not
// architectural collision detection: deeper stages deliberately use cutaways.
export function keepCameraOutside(camera,target,box,previous){
  if(!box.containsPoint(camera.position))return false;
  const delta=camera.position.clone().sub(previous),distance=delta.length();
  if(distance>.00001&&!box.containsPoint(previous)){
    delta.normalize();const hit=new THREE.Ray(previous,delta).intersectBox(box,new THREE.Vector3());
    if(hit){camera.position.copy(hit).addScaledVector(delta,-.005);camera.lookAt(target);return true;}
  }
  const faces=[['x',box.min.x-.005],['x',box.max.x+.005],['z',box.min.z-.005],['z',box.max.z+.005],['y',box.max.y+.005]];
  faces.sort((a,b)=>Math.abs(camera.position[a[0]]-a[1])-Math.abs(camera.position[b[0]]-b[1]));
  camera.position[faces[0][0]]=faces[0][1];camera.lookAt(target);return true;
}
