process.env.V2_EVIDENCE_DIR||='docs/phase5b/evidence';
process.env.V2_TEST_PORT||='4409';
const assert=require('node:assert/strict'),path=require('node:path');
const {browserRun}=require('../v2/harness.cjs');
const selector=id=>`#hotspots button[data-entity-id=${JSON.stringify(id)}]`;
const pose=()=>({position:studio.camera.position.toArray(),target:studio.controls.target.toArray(),fov:studio.camera.fov});
const ready=page=>page.waitForFunction(()=>window.studio&&!studio.state.pending&&studio.director.owner==='orbit'&&!studio.hqJourney.active&&Number(getComputedStyle(document.getElementById('loading')).opacity)<.01);
const snapshot=()=>({depth:studio.state.depth,hallId:studio.state.hallId,rowId:studio.state.rowId,rackId:studio.state.rackId,equipmentId:studio.state.equipmentId,nodeId:studio.state.nodeId,boardKey:studio.state.boardKey,componentKey:studio.state.componentKey,path:studio.state.path});
const items=page=>page.evaluate(()=>[...studio.experience.hud.nodes.values()].map(({button,item})=>({id:item.id,label:item.label,depth:item.depth,nodeId:item.nodeId,selection:item.selection,visible:!button.hidden&&getComputedStyle(button).visibility!=='hidden'})));
async function activate(page,id,{keyboard=false,touch=false}={}){
  const button=page.locator(selector(id));await button.waitFor({state:'visible'});
  if(keyboard){await button.focus();assert.equal(await page.evaluate(()=>document.activeElement?.dataset.entityId),id);await page.keyboard.press('Enter');}
  else if(touch)await button.tap();else await button.click();
  await ready(page);return page.evaluate(snapshot);
}
const atDepth=async(page,depth)=>{await page.waitForFunction(depth=>studio.state.depth===depth,depth);await ready(page);};

browserRun('phase5b-hotspots',async({page,browser,check,report,origin,output})=>{
  page.setDefaultTimeout(45000);await page.goto(origin);await page.waitForFunction(()=>window.studio?.experience);await ready(page);await page.evaluate(()=>studio.quality.set('high'));
  report.gpu=await page.evaluate(()=>{const gl=studio.renderer.getContext(),info=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:gl.getParameter(info?info.UNMASKED_RENDERER_WEBGL:gl.RENDERER),version:gl.getParameter(gl.VERSION)};});

  await check('Visible stable-ID hotspots support an actual keyboard / click journey from HQ Entrance through Component',async()=>{
    await page.evaluate(()=>studio.go(0));await ready(page);const trace=[];
    const entrance=page.locator(selector('hq-entrance'));await entrance.waitFor({state:'visible'});await entrance.hover();await page.screenshot({path:path.join(output,'hotspot-hover-3440x1440.png')});
    await entrance.focus();await page.screenshot({path:path.join(output,'hotspot-keyboard-focus-3440x1440.png')});
    trace.push(await activate(page,'hq-entrance',{keyboard:true}));assert.equal(trace.at(-1).depth,1);
    for(const depth of [2,3,4,5,6,7]){
      await page.waitForFunction(depth=>[...studio.experience.hud.nodes.values()].some(({item,button})=>item.depth===depth&&!button.hidden),depth);
      let target=(await items(page)).find(item=>item.depth===depth&&item.visible);
      if(depth===5){const systemIds=await page.evaluate(()=>studio.store.document.equipment.filter(e=>studio.store.document.catalog.find(m=>m.id===e.modelId)?.internalAsset).map(e=>e.id));target=(await items(page)).find(item=>item.depth===5&&item.visible&&systemIds.includes(item.id));}
      assert.ok(target,`No visible hotspot for depth ${depth}`);const result=await activate(page,target.id,{keyboard:depth%2===0});assert.equal(result.depth,depth);assert.equal(result.path.at(-1).entityId,target.id);trace.push({...result,activatedHotspot:target.id});
    }
    await page.screenshot({path:path.join(output,'component-hotspot-path-3440x1440.png')});report.hotspotPath=trace;return{trace,activation:'Actual visible buttons; alternating click and focused Enter. No navigation state was injected for the path.'};
  });

  await check('Visible Node hotspot focuses its real Mock identity and supplied Board, and Breadcrumb returns to System',async()=>{
    await page.evaluate(()=>studio.go(5,{rackId:'rack-1'}));await ready(page);
    await page.waitForFunction(()=>[...studio.experience.hud.nodes.values()].some(({button,item})=>item.nodeId&&!button.hidden));
    const node=(await items(page)).find(item=>item.nodeId&&item.visible);assert.ok(node);
    const expected=await page.evaluate(id=>{const entity=studio.twin.entities.get(id);return{id:entity.id,systemId:entity.systemId,boardId:entity.boardId};},node.nodeId);
    const selected=await activate(page,node.id,{keyboard:true});assert.equal(selected.nodeId,expected.id);assert.equal(selected.equipmentId,expected.systemId);assert.equal(selected.depth,expected.boardId?6:5);
    if(expected.boardId)assert.equal(selected.path.at(-1).entityId,expected.boardId);
    await page.screenshot({path:path.join(output,'node-hotspot-focus-3440x1440.png')});
    await page.locator('#breadcrumbs button[data-depth="5"]').click();await atDepth(page,5);assert.equal(await page.evaluate(()=>studio.state.equipmentId),expected.systemId);
    return{expected,selected,returned:await page.evaluate(snapshot),data:'DEMO / MOCK identity; no inferred component failure'};
  });

  await check('Hotspot buttons retain object identity and have no child-list rebuild during actual stationary WebGL frames',async()=>{
    await page.evaluate(()=>studio.go(5,{rackId:'rack-1'}));await ready(page);await page.waitForFunction(()=>studio.experience.hud.nodes.size>=2);
    const before=await page.evaluate(()=>{window.hotspotAudit={nodes:[...document.querySelectorAll('#hotspots button')],mutations:0,frame:studio.renderer.info.render.frame};window.hotspotObserver=new MutationObserver(records=>window.hotspotAudit.mutations+=records.length);window.hotspotObserver.observe(document.getElementById('hotspots'),{childList:true,subtree:true});return{count:hotspotAudit.nodes.length,frame:hotspotAudit.frame};});
    await page.waitForTimeout(550);
    const result=await page.evaluate(()=>{hotspotObserver.disconnect();const current=[...document.querySelectorAll('#hotspots button')];return{sameNodes:current.length===hotspotAudit.nodes.length&&current.every((node,index)=>node===hotspotAudit.nodes[index]),mutations:hotspotAudit.mutations,frames:studio.renderer.info.render.frame-hotspotAudit.frame,count:current.length};});
    assert.equal(result.sameNodes,true);assert.equal(result.mutations,0);assert.ok(result.frames>0);return{before,...result};
  });

  await check('Switching Rows at the same depth through Facility UI refreshes the stable-ID Rack hotspot',async()=>{
    const original=await page.evaluate(()=>studio.store.export());
    try{
      await page.locator('#facilityBtn').click();await page.locator('#facilityPanel').waitFor({state:'visible'});
      await page.locator('#facilityPanel details').filter({has:page.locator('#layoutForm')}).locator('summary').click();
      await page.locator('#layoutRows').fill('2');await page.locator('#layoutCount').fill('4');await page.locator('#layoutForm button').click();await atDepth(page,2);
      const rows=await page.evaluate(()=>studio.store.document.rows.map(row=>({id:row.id,racks:studio.store.document.racks.filter(rack=>rack.rowId===row.id).map(rack=>rack.id)})));
      assert.equal(rows.length,2);const results=[];
      for(const row of rows){
        if(!await page.locator('#facilityPanel').isVisible())await page.locator('#facilityBtn').click();
        await page.locator(`#facilityTree button[data-row-id=${JSON.stringify(row.id)}]`).click();await atDepth(page,3);await page.locator('#closeFacility').click();
        await page.waitForFunction(rowId=>studio.state.rowId===rowId&&[...studio.experience.hud.nodes.values()].some(({item})=>item.depth===4&&studio.store.document.racks.find(r=>r.id===item.id)?.rowId===rowId),row.id);
        const rack=(await items(page)).find(item=>item.depth===4&&item.visible);assert.ok(rack);assert.ok(row.racks.includes(rack.id));results.push({rowId:row.id,rackHotspotId:rack.id,depth:await page.evaluate(()=>studio.state.depth)});
      }
      assert.notEqual(results[0].rackHotspotId,results[1].rackHotspotId);assert.ok((await items(page)).every(item=>item.id!==results[0].rackHotspotId));return results;
    }finally{await page.evaluate(original=>studio.store.import(original),original);if(await page.locator('#facilityPanel').isVisible())await page.locator('#closeFacility').click();await page.evaluate(()=>studio.go(0));await ready(page);}
  });

  async function playing(id){await page.waitForFunction(id=>studio.showcase.snapshot().chapterId===id&&studio.showcase.phase==='playing'&&!studio.showcase.paused,id);}
  async function reach(id){for(let i=0;i<20;i++){const state=await page.evaluate(()=>studio.showcase.snapshot());if(state.chapterId===id){await playing(id);return;}assert.equal(state.active,true,state.error||'Showcase stopped');await page.locator('#showcaseSkip').click();await page.waitForFunction(previous=>studio.showcase.snapshot().chapterId!==previous&&studio.showcase.phase==='playing'||!studio.showcase.active,state.chapterId);}throw Error(`Did not reach ${id}`);}
  async function dragCanvas(){const point=await page.evaluate(()=>{const r=studio.renderer.domElement.getBoundingClientRect();for(const yf of [.35,.45,.55])for(const xf of [.45,.55,.65]){const x=r.x+r.width*xf,y=r.y+r.height*yf;if(document.elementFromPoint(x,y)===studio.renderer.domElement&&document.elementFromPoint(x+130,y+45)===studio.renderer.domElement)return{x,y};}throw Error('No unobstructed actual canvas drag region');});await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+130,point.y+45,{steps:10});await page.mouse.up();await page.waitForTimeout(200);return point;}

  await check('Active Showcase blocks actual canvas dragging while paused, including Skip to a new paused chapter',async()=>{
    await page.locator('#playDemo').click();await playing('hq-front');await page.locator('#showcasePause').click();await page.waitForFunction(()=>studio.showcase.paused);
    const paused=await page.evaluate(pose),firstPoint=await dragCanvas();assert.deepEqual(await page.evaluate(pose),paused);
    await page.locator('#showcaseSkip').click();await page.waitForFunction(()=>studio.showcase.paused&&studio.showcase.snapshot().chapterId==='hq-low');
    const skipped=await page.evaluate(pose),secondPoint=await dragCanvas();assert.deepEqual(await page.evaluate(pose),skipped);
    await page.locator('#showcasePause').click();await playing('hq-low');await page.locator('#showcaseStop').click();await page.waitForFunction(()=>studio.showcase.status==='stopped');await ready(page);
    return{paused,skipped,firstPoint,secondPoint,actualCanvasHitVerified:true};
  });

  await check('Reduced Motion remains idle until explicit Play Demo, then actual HQ orbit and PA film clocks advance',async()=>{
    await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>window.studio?.showcase);await ready(page);
    assert.equal(await page.evaluate(()=>studio.hqJourney.reducedMotion),true);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>studio.showcase.active||studio.film.active||studio.hqJourney.active),false);
    await page.locator('#playDemo').click();await playing('hq-front');await reach('hq-orbit');await page.waitForFunction(()=>studio.hqJourney.phase==='playing'&&studio.hqJourney.progress>0);
    const hqBefore=await page.evaluate(()=>({progress:studio.hqJourney.progress,position:studio.camera.position.toArray()}));await page.waitForTimeout(300);const hqAfter=await page.evaluate(()=>({progress:studio.hqJourney.progress,position:studio.camera.position.toArray()}));assert.ok(hqAfter.progress>hqBefore.progress);assert.notDeepEqual(hqAfter.position,hqBefore.position);
    await reach('pa-cinematic');await page.waitForFunction(()=>studio.film.active&&studio.film.playing&&studio.film.clock>0);const before=await page.evaluate(()=>studio.film.clock);await page.waitForTimeout(400);const after=await page.evaluate(()=>studio.film.clock);assert.ok(after>before);assert.equal(await page.evaluate(()=>window.PAL10Timeline.timeAt(1,'coolingV2')),39700);
    await page.locator('#showcaseStop').click();await page.waitForFunction(()=>studio.showcase.status==='stopped');await ready(page);assert.equal(await page.evaluate(()=>studio.hqJourney.reducedMotion),true);
    return{preference:'reduce',automaticPlayback:false,explicitUserPlay:true,hqBefore,hqAfter,paClockBefore:before,paClockAfter:after,limitation:'This test verifies actual advancing playback; it stops before the full PA timeline endpoint. Full Showcase recording is separate.'};
  });

  await check('Desktop hotspot and input tests have no browser, WebGL or local asset errors',async()=>{assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);assert.equal(await page.evaluate(()=>studio.renderer.getContext().getError()),0);return{errors:report.errors,requests:report.requests};});
  await page.evaluate(()=>studio.dispose());await page.close();

  await check('390×844 touch activates HQ / Hall / Row / Rack hotspots and the mobile inspector opens and closes',async()=>{
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
    try{
      const mobile=await context.newPage(),errors=[],requests=[];mobile.setDefaultTimeout(45000);mobile.on('pageerror',error=>errors.push(error.message));mobile.on('console',message=>{if(message.type()==='error'&&!/404/.test(message.text()))errors.push(message.text());});mobile.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))requests.push({url:response.url(),status:response.status()});});
      await mobile.goto(origin);await mobile.waitForFunction(()=>window.studio?.experience);await ready(mobile);const trace=[];
      await mobile.screenshot({path:path.join(output,'mobile-hq-390x844.png')});
      const qualityHit=await mobile.locator('#qualitySelect').evaluate(select=>{const rect=select.getBoundingClientRect(),hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);return{rect:rect.toJSON(),hitId:hit?.id,directHit:hit===select};});assert.equal(qualityHit.directHit,true);assert.ok(qualityHit.rect.height>=44);
      await mobile.locator('#qualitySelect').tap();await mobile.keyboard.press('Home');await mobile.keyboard.press('ArrowDown');await mobile.keyboard.press('Enter');const qualityValue=await mobile.locator('#qualitySelect').inputValue();await mobile.waitForFunction(mode=>studio.quality.mode===mode,qualityValue);
      trace.push(await activate(mobile,'hq-entrance',{touch:true}));assert.equal(trace.at(-1).depth,1);
      for(const depth of [2,3,4]){await mobile.waitForFunction(depth=>[...studio.experience.hud.nodes.values()].some(({button,item})=>item.depth===depth&&!button.hidden),depth);const item=(await items(mobile)).find(item=>item.depth===depth&&item.visible);assert.ok(item);trace.push(await activate(mobile,item.id,{touch:true}));assert.equal(trace.at(-1).depth,depth);if(depth===2){assert.equal(await mobile.locator('#labels button:visible').count(),0);await mobile.screenshot({path:path.join(output,'mobile-hotspot-hall-390x844.png')});await mobile.screenshot({path:path.join(output,'mobile-hall-390x844.png')});}}
      const toggle=mobile.locator('#inspectorToggle'),panel=mobile.locator('#rackInspector');await toggle.waitFor({state:'visible'});assert.equal(await panel.isVisible(),false);assert.equal(await toggle.getAttribute('aria-expanded'),'false');await toggle.tap();await panel.waitFor({state:'visible'});assert.equal(await toggle.getAttribute('aria-expanded'),'true');await mobile.screenshot({path:path.join(output,'mobile-inspector-open-390x844.png')});
      await toggle.tap();await panel.waitFor({state:'hidden'});assert.equal(await toggle.getAttribute('aria-expanded'),'false');await mobile.screenshot({path:path.join(output,'mobile-hotspot-rack-390x844.png')});await mobile.screenshot({path:path.join(output,'mobile-rack-390x844.png')});
      await mobile.locator('#playDemo').tap();await mobile.waitForFunction(()=>studio.showcase.phase==='playing');await mobile.locator('#showcasePause').tap();await mobile.waitForFunction(()=>studio.showcase.paused);await mobile.screenshot({path:path.join(output,'mobile-controls-390x844.png')});await mobile.locator('#showcaseStop').tap();await mobile.waitForFunction(()=>studio.showcase.status==='stopped');await ready(mobile);assert.equal(await mobile.evaluate(()=>studio.state.depth),4);
      assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);assert.equal(await mobile.evaluate(()=>studio.renderer.getContext().getError()),0);
      return{trace,qualityHit,qualityValue,inspectorOpened:true,inspectorClosed:true,showcasePlayedPausedStopped:true,errors,requests,viewport:{width:390,height:844,dpr:2},limitation:'Actual Chrome touch emulation; no physical mobile-device claim'};
    }finally{await context.close();}
  });
});
