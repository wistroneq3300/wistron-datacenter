process.env.V2_EVIDENCE_DIR ||= 'docs/phase5b/evidence';
process.env.V2_TEST_PORT ||= '4411';
const assert = require('node:assert/strict');
const path = require('node:path');
const {browserRun} = require('../v2/harness.cjs');

browserRun('phase5b-hq-street',async({page,check,report,origin,output})=>{
  await page.goto(origin);
  await page.waitForFunction(()=>window.studio && Number(getComputedStyle(document.getElementById('loading')).opacity)<.01);
  await page.evaluate(()=>studio.quality.set('ultra'));

  await check('Rendered asphalt follows the frontage, separate access drive and offset road mouths', async()=>{
    const result = await page.evaluate(async()=>{
      const THREE=await import('/vendor/three.module.js');
      const {STREET_PLAN}=await import('/modules/environment/hq5b-site.js');
      const {hq}=studio.environment;
      const meshes=[];
      hq.site.root.traverse(node=>{if(node.isMesh && node.material===hq.road)meshes.push(node);});
      const onAsphalt=(x,z)=>new THREE.Raycaster(new THREE.Vector3(x,1,z),new THREE.Vector3(0,-1,0)).intersectObjects(meshes).length>0;
      const {main,access,lane168,oppositeAlley}=STREET_PLAN;
      const center=(main.near+main.far)/2;
      return {
        frontage:[-65,-8,20,65].every(x=>onAsphalt(x,center)),
        access:onAsphalt(access.x,-10),
        eastLane:onAsphalt(lane168.x,-10),
        greenSeparation:!onAsphalt((access.x+lane168.x)/2,-10),
        noFourWay:!onAsphalt(lane168.x,main.far+7),
        offsetSouthMouth:onAsphalt(oppositeAlley.x,main.far+7),
        noAccessAcrossStreet:!onAsphalt(access.x,main.far+7),
        lobbyStaysDistinct:!studio.environment.interior.root.visible,
        evidence:hq.site.stats().evidence,
      };
    });
    for(const key of ['frontage','access','eastLane','greenSeparation','noFourWay','offsetSouthMouth','noAccessAcrossStreet','lobbyStaysDistinct'])assert.equal(result[key],true,key);
    return result;
  });

  await check('Daylight 45°, entrance, same-camera street and both junctions are captured from WebGL',async()=>{
    const captures=[];
    for(const [name,view,pose] of [
      ['hq-quarter','quarter'],['hq-entrance','entrance'],
      ['street-context',null,{position:[27,2.2,17],target:[-6,3,-5],fov:52}],
      ['street-junctions',null,{position:[1,66,29],target:[-3,0,-1],fov:44}],
    ]){
      if(view)await page.evaluate(view=>studio.showHQView(view),view);
      else await page.evaluate(pose=>studio.director.move(pose.position,pose.target,{fov:pose.fov}),pose);
      await page.waitForTimeout(130);
      const filename=`${name}-3440x1440.png`;
      await page.screenshot({path:path.join(output,filename)});
      const poseRecord=await page.evaluate(()=>({position:studio.camera.position.toArray(),target:studio.controls.target.toArray(),fov:studio.camera.fov,viewport:[innerWidth,innerHeight],gl:studio.renderer.getContext().getError()}));
      assert.equal(poseRecord.gl,0);
      captures.push({filename,...poseRecord});
    }
    return captures;
  });
  await check('No browser, shader or asset errors',()=>{assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);});
  await page.evaluate(()=>studio.dispose());
});
