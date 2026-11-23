process.env.V2_EVIDENCE_DIR ||= 'docs/phase5b/evidence';
process.env.V2_TEST_PORT ||= '4410';
const assert=require('node:assert/strict');
const path=require('node:path');
const {browserRun}=require('../v2/harness.cjs');

browserRun('phase5b-interior',async({page,check,report,origin,output})=>{
  await page.goto(origin);
  await page.waitForFunction(()=>window.studio && Number(getComputedStyle(document.getElementById('loading')).opacity)<.01);
  const ready=()=>page.waitForFunction(()=>studio.director.owner==='orbit'&&!studio.hqJourney.active);
  const stage=()=>page.evaluate(()=>({depth:studio.state.depth,lobby:studio.environment.interior.root.visible,hall:studio.environment.hall.root.visible,hq:studio.environment.hq.root.visible,core:studio.projection.parent.visible,camera:studio.camera.position.toArray()}));
  await check('HQ primary action opens the modeled visitor lobby before the separate Hall',async()=>{
    await page.locator('#startTour').click();await ready();
    const lobby=await stage();
    assert.equal(lobby.depth,1);assert.equal(lobby.lobby,true);assert.equal(lobby.hall,false);assert.equal(lobby.core,false);assert.equal(lobby.hq,false);
    assert.match(await page.locator('#detailTitle').textContent(),/Draft/);
    await page.screenshot({path:path.join(output,'interior-lobby-3440x1440.png')});
    await page.getByRole('button',{name:'Data Center Hall · 進入',exact:true}).click();await ready();
    const hall=await stage();assert.equal(hall.depth,2);assert.equal(hall.hall,true);assert.equal(hall.lobby,false);assert.equal(hall.core,true);
    await page.locator('#breadcrumbs [data-depth="1"]').click();await ready();assert.equal((await stage()).lobby,true);
    return {lobby,hall};
  });
  await check('Free Explore stays in the lobby and Escape restores Guided at the same depth',async()=>{
    await page.locator('#exploreToggle').click();assert.equal(await page.evaluate(()=>studio.freeExplore.active),true);
    await page.keyboard.down('KeyW');await page.waitForTimeout(300);await page.keyboard.up('KeyW');
    assert.equal(await page.evaluate(()=>studio.environment.interior.bounds.containsPoint(studio.camera.position)),true);
    await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>studio.state.depth),1);assert.equal(await page.evaluate(()=>studio.director.owner),'orbit');
  });
  await check('Lobby allocation plateaus across repeated Hall and HQ returns',async()=>{
    const cycles=[];
    for(let i=0;i<3;i++){
      await page.evaluate(async()=>{await studio.go(2);await studio.go(0);await studio.go(1);});
      cycles.push(await page.evaluate(()=>({memory:{...studio.renderer.info.memory},gl:studio.renderer.getContext().getError()})));
    }
    for(const cycle of cycles){assert.deepEqual(cycle,cycles[0]);assert.equal(cycle.gl,0);}
    return cycles;
  });
  await check('Rendered lobby produces no browser or asset errors',()=>{assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);});
  await page.evaluate(()=>studio.dispose());
});
