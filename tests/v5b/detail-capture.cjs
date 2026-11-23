process.env.V2_EVIDENCE_DIR||='docs/phase5b/evidence';process.env.V2_TEST_PORT||='4409';
const assert=require('node:assert/strict'),path=require('node:path');
const {browserRun}=require('../v2/harness.cjs');
browserRun('phase5b-detail-capture',async({page,check,report,origin,output})=>{
  await page.goto(origin);await page.waitForFunction(()=>window.studio?.experience);await page.evaluate(()=>studio.environment.hq.loading);
  await page.evaluate(()=>{studio.quality.set('high');studio.store.reset();});
  await page.evaluate(()=>studio.go(3,{rackId:'rack-1'}));
  for(const [depth,name] of [[4,'detailed-rack'],[5,'system'],[6,'board'],[7,'component']])await check(`Fresh ${name} actual 3440×1440 capture with current Guided HUD`,async()=>{
    assert.equal(await page.evaluate(depth=>studio.go(depth,{rackId:'rack-1'}),depth),true);await page.waitForTimeout(450);
    const frame=await page.evaluate(()=>({depth:studio.state.depth,selection:{rackId:studio.state.rackId,equipmentId:studio.state.equipmentId,boardKey:studio.state.boardKey,componentKey:studio.state.componentKey},camera:{position:studio.camera.position.toArray(),target:studio.controls.target.toArray(),fov:studio.camera.fov},quality:studio.quality.snapshot(),hotspots:[...document.querySelectorAll('.spatial-hotspot')].filter(item=>!item.hidden).map(item=>({id:item.dataset.entityId,text:item.textContent,rect:item.getBoundingClientRect().toJSON()})),glError:studio.renderer.getContext().getError()}));
    assert.equal(frame.depth,depth);assert.equal(frame.glError,0);await page.screenshot({path:path.join(output,`${name}-3440x1440.png`)});return frame;
  });
  await check('Fresh detail captures have no browser or asset errors',()=>{assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);});
  await page.evaluate(()=>studio.dispose());
});
