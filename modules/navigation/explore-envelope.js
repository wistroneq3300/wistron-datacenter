import * as THREE from 'three';

// Conservative camera clearance, not a physics engine. Boxes represent the
// visible shell / racks supplied by the current stage, in world coordinates.
const EPS=1e-5,AXES=['x','y','z'];
const vector=value=>value?.isVector3?value.clone():new THREE.Vector3(...(value||[0,0,0]));
const box=value=>value?.isBox3?value.clone():new THREE.Box3(vector(value?.min),vector(value?.max));
const finite=v=>AXES.every(axis=>Number.isFinite(v[axis]));

export function createExploreEnvelope(input){
  if(!input?.bounds)throw new Error('Free Explore requires a conservative boundary');
  const radius=Number.isFinite(input.radius)?Math.max(0,input.radius):.22;
  const bounds=box(input.bounds).expandByScalar(-radius);
  if(!finite(bounds.min)||!finite(bounds.max)||AXES.some(axis=>bounds.max[axis]<=bounds.min[axis]))throw new Error('Free Explore boundary has no usable volume');
  const obstacles=(input.obstacles||[]).map(value=>box(value).expandByScalar(radius));
  if(obstacles.some(value=>!finite(value.min)||!finite(value.max)||value.isEmpty()))throw new Error('Invalid Free Explore obstacle');
  return {bounds,obstacles,safePosition:vector(input.safePosition),radius};
}

export function isSafePosition(position,envelope){
  return finite(position)&&envelope.bounds.containsPoint(position)&&!envelope.obstacles.some(obstacle=>obstacle.containsPoint(position));
}

// Select a nearby valid pose when an old stage pose is outside this envelope.
// Candidate projections include every obstacle face: a blocked reset is never
// accepted merely because its coordinates were supplied as "safe".
export function resolveSafePosition(preferred,envelope){
  const clamp=p=>envelope.bounds.clampPoint(p,new THREE.Vector3());
  const origin=clamp(vector(preferred)),queue=[origin,clamp(envelope.safePosition),envelope.bounds.getCenter(new THREE.Vector3())],seen=new Set();
  let best=null,bestDistance=Infinity;
  for(let i=0;i<queue.length&&i<512;i++){
    const p=queue[i],key=p.toArray().map(n=>n.toFixed(5)).join(',');if(seen.has(key))continue;seen.add(key);
    if(isSafePosition(p,envelope)){const distance=p.distanceToSquared(origin);if(distance<bestDistance){best=p;bestDistance=distance;}continue;}
    for(const obstacle of envelope.obstacles)if(obstacle.containsPoint(p))for(const axis of AXES)for(const edge of ['min','max']){
      const candidate=p.clone();candidate[axis]=obstacle[edge][axis]+(edge==='min'?-EPS:EPS);queue.push(clamp(candidate));
    }
  }
  return best;
}

function obstacleHit(origin,delta,obstacle){
  let enter=-Infinity,leave=Infinity,normal=null;
  for(const axis of AXES){
    const d=delta[axis];
    if(Math.abs(d)<1e-12){if(origin[axis]<obstacle.min[axis]||origin[axis]>obstacle.max[axis])return null;continue;}
    let near=(obstacle.min[axis]-origin[axis])/d,far=(obstacle.max[axis]-origin[axis])/d;
    if(near>far)[near,far]=[far,near];
    if(near>enter){enter=near;normal=new THREE.Vector3();normal[axis]=-Math.sign(d);}
    leave=Math.min(leave,far);if(enter>leave)return null;
  }
  if(!normal||enter<-1e-10||enter>1||leave<1e-10||normal.dot(delta)>=0)return null;
  return {time:Math.max(0,enter),normal};
}

function firstHit(origin,delta,envelope){
  let first=null;
  const accept=hit=>{if(hit&&(!first||hit.time<first.time))first=hit;};
  for(const axis of AXES){
    const end=origin[axis]+delta[axis];
    if(delta[axis]<0&&end<envelope.bounds.min[axis]){const normal=new THREE.Vector3();normal[axis]=1;accept({time:(envelope.bounds.min[axis]-origin[axis])/delta[axis],normal});}
    if(delta[axis]>0&&end>envelope.bounds.max[axis]){const normal=new THREE.Vector3();normal[axis]=-1;accept({time:(envelope.bounds.max[axis]-origin[axis])/delta[axis],normal});}
  }
  for(const obstacle of envelope.obstacles)accept(obstacleHit(origin,delta,obstacle));
  return first;
}

export function moveInEnvelope(previous,delta,envelope){
  const start=isSafePosition(previous,envelope)?previous.clone():resolveSafePosition(previous,envelope);
  if(!start||!finite(delta))return start;
  const position=start.clone(),remaining=delta.clone();
  // Continuous segment sweeps prevent tunneling even at sprint speed or after
  // a delayed frame. Sliding removes only motion into a contacted surface.
  for(let iteration=0;iteration<8&&remaining.lengthSq()>1e-14;iteration++){
    const hit=firstHit(position,remaining,envelope);
    if(!hit){position.add(remaining);remaining.set(0,0,0);break;}
    const fraction=Math.max(0,hit.time-EPS/remaining.length());
    position.addScaledVector(remaining,fraction);remaining.multiplyScalar(1-fraction);
    const into=remaining.dot(hit.normal);if(into<0)remaining.addScaledVector(hit.normal,-into);
  }
  return isSafePosition(position,envelope)?position:start;
}
