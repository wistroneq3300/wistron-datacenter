import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {normalizeFacility,validateFacility,buildLayout,rackEnvelopeMm} from '../../modules/domain/facility.js';
import {resolveJourney,NavigationUnavailable} from '../../modules/navigation/journey.js';
const base=JSON.parse(fs.readFileSync(new URL('../../data/demo-config.json',import.meta.url),'utf8'));

test('legacy facility is a nonmutating Draft projection and preserves hall references',()=>{
  const before=JSON.stringify(base),facility=normalizeFacility(base);assert.equal(JSON.stringify(base),before);assert.equal(facility.halls[0].id,'hall-1');assert.equal(facility.halls[0].status,'draft');assert.equal(validateFacility(base).valid,true);assert.equal(validateFacility({...base,facility}).valid,true);
});
test('Selecting a valid empty Hall keeps its identity and blocks entry to a nonexistent Row',()=>{
  const doc=structuredClone(base);doc.facility=normalizeFacility(doc);
  const hall=structuredClone(doc.facility.halls[0]);hall.id='hall-empty';hall.name='Empty planned Hall';hall.boundsMm.min[0]+=40000;hall.boundsMm.max[0]+=40000;doc.facility.halls.push(hall);
  assert.equal(validateFacility(doc).valid,true);
  const initial=resolveJourney(doc,{},4,{rackId:'rack-1'}),selected=resolveJourney(doc,initial,2,{hallId:hall.id});
  assert.equal(selected.hallId,hall.id);assert.equal(selected.rowId,undefined);assert.equal(selected.rackId,null);assert.equal(selected.equipmentId,null);assert.equal(selected.path.at(-1).entityId,hall.id);
  assert.throws(()=>resolveJourney(doc,selected,3),error=>error instanceof NavigationUnavailable&&error.depth===2);
  assert.equal(resolveJourney(doc,selected,1).hallId,hall.id);
  assert.equal(resolveJourney(doc,selected,3,{hallId:doc.rows[0].hallId}).rowId,doc.rows[0].id);
});
test('Rack envelope includes exact original PA frame and infrastructure across capacities',()=>{
  const context={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../../vendor/pa-cycle/rack-equipment-scene.js',import.meta.url),'utf8'),context);
  const source=context.window.PARackScene.buildEditorialParts([]);
  for(const capacity of [24,48,60]){
    const profile={...base.rackProfiles[0],capacity},rack={positionMm:[200,130,7000]},b=rackEnvelopeMm(rack,profile),unit=profile.pitchMm/.3,sy=(capacity*.3+1.18)/(48*.3+1.18),origin=rack.positionMm.map((v,i)=>v+(i===1?(capacity*.3/2+.59)*unit:0));
    for(const key of ['frame','infrastructure'])for(let i=0;i<source[key].data.length;i+=11)for(let axis=0;axis<3;axis++){
      const world=origin[axis]+source[key].data[i+axis]*unit*[.688,sy,.802][axis];assert.ok(world>=b.min[axis]-.001&&world<=b.max[axis]+.001);
    }
  }
});
test('1, 4 and 32 Rack layouts retain identity and only create empty additional racks',()=>{
  for(const [total,rows] of [[1,1],[4,2],[32,4]]){
    const next=buildLayout(base,{totalRacks:total,rows});assert.equal(next.racks.length,total);assert.equal(next.rows.length,rows);assert.equal(next.racks[0].id,'rack-1');assert.equal(next.equipment.length,37);assert.deepEqual(next.equipment,base.equipment);assert.equal(new Set(next.racks.map(r=>r.id)).size,total);assert.equal(validateFacility(next).valid,true);assert.equal(next.facility.halls[0].status,'draft');assert.ok(next.racks.slice(8).every(r=>r.inventoryState==='empty'));
    assert.deepEqual(buildLayout(base,{totalRacks:total,rows}),next);
  }
});
test('Draft layout clamps neither collision nor bad spacing and keeps the source unchanged',()=>{
  const old=JSON.stringify(base);assert.throws(()=>buildLayout(base,{rows:4,totalRacks:3}),/Rack 數/);assert.throws(()=>buildLayout(base,{pitchMm:100}),/外框/);assert.throws(()=>buildLayout(base,{aisleMm:NaN}));assert.throws(()=>buildLayout(base,{totalRacks:129}));assert.equal(JSON.stringify(base),old);
});
test('Hall reference, bounds and ceiling validation prevents dangling or malformed hierarchy',()=>{
  const next=buildLayout(base,{totalRacks:4,rows:2});next.rows[0].hallId='missing';assert.ok(validateFacility(next).errors.some(e=>e.code==='hall-reference'));
  const bound=buildLayout(base,{totalRacks:1});bound.facility.halls[0].boundsMm.max[0]=0;assert.ok(validateFacility(bound).errors.some(e=>e.code==='rack-hall-boundary'));
  const height=buildLayout(base,{totalRacks:1});height.facility.halls[0].ceilingHeightMm=NaN;assert.ok(validateFacility(height).errors.some(e=>e.code==='hall-bounds'));
});
test('Rack-to-Rack and infrastructure collisions validate physical envelopes, not row slots',()=>{
  const next=buildLayout(base,{totalRacks:4,rows:2});next.racks[1].positionMm=[...next.racks[0].positionMm];assert.ok(validateFacility(next).errors.some(e=>e.code==='rack-collision'));
  const infra=buildLayout(base,{totalRacks:1});infra.facility.halls[0].infrastructure[0].positionMm=[...infra.racks[0].positionMm];assert.ok(validateFacility(infra).errors.some(e=>e.code==='rack-infrastructure-collision'));
});
test('Facility refuses unsupported secrets, false verification and duplicated IDs',()=>{
  for(const mutation of [d=>d.facility.token='secret',d=>d.facility.halls[0].status='verified',d=>d.facility.halls[0].id=d.racks[0].id,d=>d.facility.halls[0].infrastructure[0].id=d.racks[0].id]){const d=buildLayout(base,{totalRacks:1});mutation(d);assert.equal(validateFacility(d).valid,false);}
});
test('Nondefault positions and tall profiles expand a derived Hall instead of clipping',()=>{
  const doc=structuredClone(base);doc.racks[0].positionMm=[21000,130,-15000];doc.rackProfiles[0].capacity=60;const facility=normalizeFacility(doc),hall=facility.halls[0];assert.ok(hall.boundsMm.max[0]>21000);assert.ok(hall.boundsMm.min[2]<-15000);assert.equal(validateFacility({...doc,facility}).valid,true);
});
test('Hall scene batches 32 racks without inventing inventory and releases owned resources',async()=>{
  const THREE=await import('../../vendor/three.module.js');
  const source=fs.readFileSync(new URL('../../modules/environment/hall-scene.js',import.meta.url),'utf8').replace("from 'three'",`from '${new URL('../../vendor/three.module.js',import.meta.url).href}'`).replace("from '../domain/facility.js'",`from '${new URL('../../modules/domain/facility.js',import.meta.url).href}'`);
  const {HallEnvironment}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`),scene=new THREE.Scene(),hall=new HallEnvironment(scene),doc=buildLayout(base,{totalRacks:32,rows:4});
  assert.equal(hall.sync(doc),true);assert.equal(hall.sync(doc),false);assert.equal(hall.stats.halls,1);assert.equal(hall.stats.rows,4);assert.ok(hall.stats.drawBatches<60);assert.equal(hall.stats.geometries,1);assert.ok(hall.bounds('row-a').max.z>7);assert.equal(hall.root.visible,false);
  let fakeRack=false;hall.root.traverse(o=>{if(o.userData.kind==='rack'||o.userData.rackId)fakeRack=true;});assert.equal(fakeRack,false);
  hall.setDepth(2);assert.equal(hall.root.visible,true);assert.equal(hall.resources.ceiling.visible,false);hall.setDepth(4);assert.equal(hall.root.visible,false);
  const owned=hall.resources,counts={geometry:0,material:0,texture:0,instance:0};for(const g of owned.geometries)g.addEventListener('dispose',()=>counts.geometry++);for(const m of owned.materials)m.addEventListener('dispose',()=>counts.material++);for(const t of owned.textures)t.addEventListener('dispose',()=>counts.texture++);owned.group.traverse(o=>{if(o.isInstancedMesh)o.addEventListener('dispose',()=>counts.instance++);});
  const expected={geometry:owned.geometries.size,material:owned.materials.size,texture:owned.textures.size,instance:owned.batches};
  const invalid=structuredClone(doc);invalid.racks[1].positionMm=[...invalid.racks[0].positionMm];assert.throws(()=>hall.sync(invalid),/碰撞/);assert.equal(hall.resources,owned);assert.equal(counts.geometry,0);
  hall.sync(buildLayout(base,{totalRacks:1}));assert.deepEqual(counts,expected);assert.equal(owned.group.parent,null);hall.dispose();hall.dispose();assert.equal(scene.children.length,0);assert.equal(hall.stats.geometries,0);assert.throws(()=>hall.sync(doc),/disposed/);
});
