process.env.V2_EVIDENCE_DIR||='docs/phase5b/evidence';
process.env.V2_TEST_PORT||='4406';
const assert=require('node:assert/strict'),path=require('node:path');
const {browserRun}=require('../v2/harness.cjs');
const distance=(a,b)=>Math.hypot(...a.map((value,index)=>value-b[index]));
const pose=()=>({position:studio.camera.position.toArray(),target:studio.controls.target.toArray(),fov:studio.camera.fov,depth:studio.state.depth,rackId:studio.state.rackId,equipmentId:studio.state.equipmentId,mode:studio.state.mode});
const freeze=()=>({position:studio.camera.position.toArray(),target:studio.controls.target.toArray(),fov:studio.camera.fov,showcase:studio.showcase.snapshot(),hq:studio.hqJourney.snapshot(),film:{active:studio.film.active,clock:studio.film.clock,progress:studio.film.progress,playing:studio.film.playing},owner:studio.director.owner});

browserRun('phase5b-experience',async({page,check,report,origin,output})=>{
  page.setDefaultTimeout(45000);
  await page.goto(origin);await page.waitForFunction(()=>window.studio?.showcase&&studio.freeExplore&&studio.quality);await page.evaluate(()=>studio.environment.hq.loading);
  const ready=()=>page.waitForFunction(()=>!studio.state.pending&&studio.director.owner==='orbit'&&!studio.hqJourney.active);
  const playing=id=>page.waitForFunction(id=>{const state=studio.showcase.snapshot();return state.chapterId===id&&state.phase==='playing'&&!state.paused;},id);
  const stop=async()=>{await page.evaluate(()=>studio.showcase.stop());await ready();};
  const start=async()=>{await page.locator('#playDemo').click();await playing('hq-front');};
  const reach=async(id)=>{
    for(let iteration=0;iteration<20;iteration++){
      const state=await page.evaluate(()=>studio.showcase.snapshot());if(state.chapterId===id){await playing(id);return;}
      assert.equal(state.active,true,`Showcase ended before ${id}: ${state.error||state.status}`);
      await page.locator('#showcaseSkip').click();
      await page.waitForFunction(previous=>{const state=studio.showcase.snapshot();return state.chapterId!==previous&&state.phase==='playing'||!state.active;},state.chapterId);
    }
    throw Error(`Showcase did not reach ${id}`);
  };
  report.gpu=await page.evaluate(()=>{const gl=studio.renderer.getContext(),info=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:gl.getParameter(info?info.UNMASKED_RENDERER_WEBGL:gl.RENDERER),vendor:gl.getParameter(info?info.UNMASKED_VENDOR_WEBGL:gl.VENDOR),version:gl.getParameter(gl.VERSION),pixelRatio:studio.renderer.getPixelRatio()};});

  await check('Showcase UI starts, pauses the actual camera, resumes, skips and restores the previous Hall view',async()=>{
    await page.evaluate(()=>studio.go(2));await ready();const before=await page.evaluate(pose);
    await start();await page.locator('#showcasePause').click();await page.waitForFunction(()=>studio.showcase.paused);
    const paused=await page.evaluate(freeze);await page.waitForTimeout(400);const after=await page.evaluate(freeze);
    assert.deepEqual(after.position,paused.position);assert.deepEqual(after.target,paused.target);assert.equal(after.fov,paused.fov);assert.equal(after.showcase.elapsedMs,paused.showcase.elapsedMs);
    await page.locator('#showcasePause').click();await page.waitForFunction(elapsed=>studio.showcase.elapsed>elapsed,paused.showcase.elapsedMs);
    await page.locator('#showcaseSkip').click();await playing('hq-low');assert.equal(await page.evaluate(()=>studio.showcase.snapshot().skipped.at(-1).reason),'Skipped by viewer.');
    await page.screenshot({path:path.join(output,'showcase-hud-3440x1440.png')});await page.locator('#showcaseStop').click();await page.waitForFunction(()=>studio.showcase.snapshot().status==='stopped');await ready();
    const restored=await page.evaluate(pose);assert.equal(restored.depth,before.depth);assert.equal(restored.mode,before.mode);assert.ok(distance(restored.position,before.position)<.0001);assert.ok(distance(restored.target,before.target)<.0001);assert.equal(restored.fov,before.fov);
    return{before,paused,restored};
  });

  await check('Showcase pause freezes the running HQ orbit and release leaves no timeline owner',async()=>{
    await start();await reach('hq-orbit');await page.waitForFunction(()=>studio.hqJourney.phase==='playing'&&studio.hqJourney.progress>0);
    await page.locator('#showcasePause').click();const frozen=await page.evaluate(freeze);await page.waitForTimeout(450);const later=await page.evaluate(freeze);
    assert.deepEqual(later.position,frozen.position);assert.deepEqual(later.target,frozen.target);assert.equal(later.hq.progress,frozen.hq.progress);assert.equal(later.showcase.elapsedMs,frozen.showcase.elapsedMs);
    await page.locator('#showcasePause').click();await page.waitForFunction(previous=>studio.hqJourney.progress>previous,frozen.hq.progress);await stop();
    const released=await page.evaluate(()=>({showcase:studio.showcase.active,hq:studio.hqJourney.active,film:studio.film.active,owner:studio.director.owner,enabled:studio.controls.enabled}));
    assert.deepEqual(released,{showcase:false,hq:false,film:false,owner:'orbit',enabled:true});return{frozen,released};
  });

  await check('Showcase pause freezes actual PA time and camera, preserving the 39.7 second timeline',async()=>{
    await start();await reach('pa-cinematic');await page.waitForFunction(()=>studio.film.active&&studio.film.clock>100);
    await page.locator('#showcasePause').click();const frozen=await page.evaluate(freeze);await page.waitForTimeout(450);const later=await page.evaluate(freeze);
    assert.deepEqual(later.position,frozen.position);assert.deepEqual(later.target,frozen.target);assert.equal(later.film.clock,frozen.film.clock);assert.equal(later.film.progress,frozen.film.progress);
    await page.locator('#showcasePause').click();await page.waitForFunction(clock=>studio.film.clock>clock,frozen.film.clock);
    const duration=await page.evaluate(()=>window.PAL10Timeline.timeAt(1,'coolingV2'));assert.equal(duration,39700);
    await page.screenshot({path:path.join(output,'showcase-pa-actual-3440x1440.png')});await stop();return{frozen,duration,recording:'Actual PA renderer and clock; this test intentionally stops before completion. Full Showcase video/test covers completion.'};
  });

  for(const target of ['pa-cinematic','system-focus'])await check(`Pause during actual delayed GLB loading prevents ${target} from acquiring camera or starting film until Resume`,async()=>{
    await start();await reach('rack-arrival');
    // Intercept the actual immutable asset bytes; no fake model, camera state,
    // or animation clock is substituted. Skipping a loading PA chapter also
    // exercises the shared library promise and the obsolete PA continuation.
    assert.equal(await page.evaluate(()=>studio.library.refs),0);
    const pattern='**/bare-compute-boards.glb',requests=[];let release;
    const gate=new Promise(resolve=>{release=resolve;}),handler=async route=>{requests.push(route.request().url());await gate;await route.continue();};
    await page.route(pattern,handler);
    try{
      const requested=page.waitForRequest(pattern);await page.locator('#showcaseSkip').click();await requested;
      await page.waitForFunction(()=>studio.state.pending&&studio.showcase.snapshot().chapterId==='pa-cinematic');
      if(target==='system-focus'){
        await page.locator('#showcaseSkip').click();
        await page.waitForFunction(()=>studio.state.pending&&studio.showcase.snapshot().chapterId==='system-focus');
      }
      await page.locator('#showcasePause').click();await page.waitForFunction(()=>studio.showcase.paused);
      const frozen=await page.evaluate(freeze);assert.equal(frozen.film.active,false);assert.equal(frozen.showcase.phase,'loading');
      release();await page.waitForFunction(()=>!!studio.library.asset&&studio.library.refs===1&&!studio.state.pending);await page.waitForTimeout(400);
      const loadedPaused=await page.evaluate(freeze);assert.equal(loadedPaused.showcase.paused,true);assert.equal(loadedPaused.showcase.phase,'loading');
      assert.deepEqual(loadedPaused.position,frozen.position);assert.deepEqual(loadedPaused.target,frozen.target);assert.equal(loadedPaused.fov,frozen.fov);
      assert.equal(loadedPaused.owner,frozen.owner);assert.equal(loadedPaused.film.active,false);assert.equal(loadedPaused.film.clock,frozen.film.clock);assert.equal(loadedPaused.film.progress,frozen.film.progress);
      await page.locator('#showcasePause').click();await playing(target);
      if(target==='pa-cinematic')await page.waitForFunction(()=>studio.film.active&&studio.film.clock>0);
      else{assert.equal(await page.evaluate(()=>studio.state.depth),5);assert.equal(await page.evaluate(()=>studio.film.active),false);}
      const resumed=await page.evaluate(freeze);assert.equal(requests.length,1);
      return{target,delayedAsset:requests[0],actualAssetLoadedWhilePaused:true,sharedPromiseWhenSkipping:target==='system-focus',frozen,loadedPaused,resumed};
    }finally{release();await page.unroute(pattern,handler);await stop();}
  });

  await check('Stopping an in-flight Showcase introduction prevents its late completion from taking camera ownership',async()=>{
    await page.evaluate(()=>studio.go(2));await ready();const original=await page.evaluate(pose);
    await page.evaluate(()=>{window.pendingShowcaseStart=studio.showcase.play();});await page.waitForTimeout(50);await stop();
    const cancelled=await page.evaluate(()=>window.pendingShowcaseStart);assert.equal(cancelled,false);const restored=await page.evaluate(pose);await page.waitForTimeout(1100);
    const stable=await page.evaluate(freeze);assert.equal(stable.showcase.active,false);assert.equal(stable.hq.active,false);assert.equal(stable.film.active,false);assert.equal(stable.owner,'orbit');assert.ok(distance(stable.position,restored.position)<.0001);assert.ok(distance(restored.position,original.position)<.0001);return{cancelled,restored,stable};
  });

  await check('Pausing during a real pending CameraDirector introduction freezes wall-clock interpolation',async()=>{
    await page.evaluate(()=>studio.go(2));await ready();await page.locator('#playDemo').click();await page.waitForFunction(()=>studio.showcase.active&&studio.director.owner==='transition');
    await page.locator('#showcasePause').click();const frozen=await page.evaluate(freeze);await page.waitForTimeout(1100);const held=await page.evaluate(freeze);
    assert.equal(held.showcase.paused,true);assert.deepEqual(held.position,frozen.position);assert.deepEqual(held.target,frozen.target);assert.equal(held.fov,frozen.fov);assert.equal(held.showcase.phase,'loading');
    await page.locator('#showcasePause').click();await playing('hq-front');assert.equal(await page.evaluate(()=>studio.showcase.snapshot().error),null);await stop();return{frozen,held};
  });

  await check('Replay starts a fresh run and external Guided navigation cancels it without restoring an old view',async()=>{
    await start();const firstRun=await page.evaluate(()=>studio.showcase.runId);await reach('hq-low');await page.locator('#showcaseReplay').click();await playing('hq-front');
    assert.ok(await page.evaluate(()=>studio.showcase.runId)>firstRun);await page.evaluate(()=>studio.go(3));await ready();
    const result=await page.evaluate(()=>({depth:studio.state.depth,showcase:studio.showcase.snapshot(),owner:studio.director.owner}));assert.equal(result.depth,3);assert.equal(result.showcase.active,false);assert.equal(result.owner,'orbit');await page.waitForTimeout(1100);assert.equal(await page.evaluate(()=>studio.state.depth),3);return result;
  });

  await check('Free Explore real WASD moves safely, Pause freezes movement, Reset is safe and Escape releases controls',async()=>{
    await page.evaluate(()=>studio.go(0));await ready();await page.locator('#exploreToggle').click();await page.waitForFunction(()=>studio.freeExplore.active);await page.evaluate(()=>document.activeElement?.blur());
    const before=await page.evaluate(()=>studio.camera.position.toArray());await page.keyboard.down('w');await page.waitForTimeout(350);await page.keyboard.up('w');const moved=await page.evaluate(()=>studio.camera.position.toArray());assert.ok(distance(before,moved)>.1);
    await page.locator('#explorePause').click();assert.equal(await page.evaluate(()=>studio.freeExplore.paused),true);const frozen=await page.evaluate(()=>studio.camera.position.toArray());await page.keyboard.down('w');await page.waitForTimeout(350);await page.keyboard.up('w');assert.deepEqual(await page.evaluate(()=>studio.camera.position.toArray()),frozen);
    await page.locator('#explorePause').click();await page.locator('#exploreReset').click();
    const safety=await page.evaluate(()=>{const envelope=studio.freeExplore.envelope(),point=studio.camera.position;return{inside:envelope.bounds.containsPoint(point),blocked:envelope.obstacles.some(box=>box.containsPoint(point)),pose:point.toArray(),snapshot:studio.freeExplore.snapshot(),orbitEnabled:studio.controls.enabled};});assert.equal(safety.inside,true);assert.equal(safety.blocked,false);assert.equal(safety.snapshot.owner,'free-explore');assert.equal(safety.orbitEnabled,false);
    await page.screenshot({path:path.join(output,'free-explore-controls-3440x1440.png')});await page.keyboard.press('Escape');await page.waitForFunction(()=>!studio.freeExplore.active);
    assert.equal(await page.evaluate(()=>studio.director.owner),'orbit');assert.equal(await page.evaluate(()=>document.pointerLockElement),null);return{before,moved,frozen,safety};
  });

  await check('WASD typed in the actual equipment editor does not move the camera or mutate saved configuration',async()=>{
    await page.evaluate(()=>studio.go(4));await ready();await page.locator('#exploreToggle').click();await page.waitForFunction(()=>studio.freeExplore.active);
    const configuration=await page.evaluate(()=>JSON.stringify(studio.store.document));await page.evaluate(()=>studio.editor.open(studio.store.document.equipment.find(item=>item.rackId===studio.state.rackId)?.id));await page.locator('#eqName').fill('');await page.locator('#eqName').focus();
    const before=await page.evaluate(()=>studio.camera.position.toArray());await page.keyboard.type('wasd WASD');await page.waitForTimeout(300);const after=await page.evaluate(()=>studio.camera.position.toArray());
    assert.equal(await page.locator('#eqName').inputValue(),'wasd WASD');assert.deepEqual(after,before);assert.equal(await page.evaluate(()=>JSON.stringify(studio.store.document)),configuration);
    await page.evaluate(()=>studio.editor.close());await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('Escape');await page.waitForFunction(()=>!studio.freeExplore.active);return{before,after,configurationUnchanged:true,input:'wasd WASD'};
  });

  await check('Showcase and Free Explore cannot simultaneously own the camera in either switching direction',async()=>{
    await page.evaluate(()=>studio.go(0));await ready();await page.locator('#exploreToggle').click();await page.waitForFunction(()=>studio.freeExplore.active);await start();
    const showcaseOwns=await page.evaluate(()=>({free:studio.freeExplore.active,showcase:studio.showcase.active,pointer:!!document.pointerLockElement,owner:studio.director.owner}));assert.equal(showcaseOwns.free,false);assert.equal(showcaseOwns.showcase,true);assert.equal(showcaseOwns.pointer,false);assert.notEqual(showcaseOwns.owner,'free-explore');
    await page.locator('#exploreToggle').click();await page.waitForFunction(()=>studio.freeExplore.active&&!studio.showcase.active);await page.waitForTimeout(1100);
    const exploreOwns=await page.evaluate(()=>({free:studio.freeExplore.active,showcase:studio.showcase.active,hq:studio.hqJourney.active,film:studio.film.active,owner:studio.director.owner}));assert.deepEqual(exploreOwns,{free:true,showcase:false,hq:false,film:false,owner:'free-explore'});
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!studio.freeExplore.active);return{showcaseOwns,exploreOwns};
  });

  await check('Quality UI applies all four real profiles and Auto retains measured state without configuration changes',async()=>{
    await page.evaluate(()=>studio.go(0));await ready();const original=await page.evaluate(()=>JSON.stringify(studio.store.document)),samples=[];
    for(const mode of ['low','medium','high','ultra','high','low','high']){
      await page.locator('#qualitySelect').selectOption(mode);await page.waitForFunction(mode=>studio.quality.snapshot().mode===mode,mode);await page.waitForTimeout(200);
      const sample=await page.evaluate(()=>({quality:studio.quality.snapshot(),pixelRatio:studio.renderer.getPixelRatio(),memory:{...studio.renderer.info.memory},shadow:studio.environment.hq.lighting.sun.shadow.mapSize.toArray(),gl:studio.renderer.getContext().getError()}));
      assert.equal(sample.quality.level,mode);assert.equal(sample.shadow[0],sample.quality.profile.shadow);assert.equal(sample.shadow[1],sample.quality.profile.shadow);assert.ok(sample.pixelRatio<=sample.quality.profile.pixelRatio);assert.ok(sample.pixelRatio>0);assert.equal(sample.gl,0);samples.push(sample);
    }
    await page.locator('#qualitySelect').selectOption('auto');const auto=await page.evaluate(()=>studio.quality.snapshot());assert.equal(auto.mode,'auto');assert.equal(await page.evaluate(()=>JSON.stringify(studio.store.document)),original);report.qualitySwitches=samples;return{samples,auto,limitation:'Auto hysteresis is unit-tested; adaptive performance evidence is reported separately. These short transitions do not claim a physical low-end GPU result.'};
  });

  await check('Experience tests produce no browser exceptions, WebGL error or failed local asset response',async()=>{
    assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);assert.equal(await page.evaluate(()=>studio.renderer.getContext().getError()),0);
    return{errors:report.errors,failedAssets:report.requests};
  });
  await page.evaluate(()=>studio.dispose());
});
