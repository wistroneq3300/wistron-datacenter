process.env.V2_EVIDENCE_DIR||='docs/phase5a/evidence';process.env.V2_TEST_PORT||='4398';
const assert=require('node:assert/strict'),path=require('node:path');
const {browserRun}=require('../v2/harness.cjs');

browserRun('phase5a-hq',async({page,browser,check,report,origin,output})=>{
  const settle=()=>page.waitForFunction(()=>studio.director.owner==='orbit'&&!studio.hqJourney.active&&!studio.state.pending);
  await page.goto(origin);await page.waitForFunction(()=>window.studio);await page.evaluate(()=>studio.environment.hq.loading);
  report.gpu=await page.evaluate(()=>{const gl=studio.renderer.getContext(),d=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:gl.getParameter(d?d.UNMASKED_RENDERER_WEBGL:gl.RENDERER),vendor:gl.getParameter(d?d.UNMASKED_VENDOR_WEBGL:gl.VENDOR),webgl:gl.getParameter(gl.VERSION),drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],pixelRatio:studio.renderer.getPixelRatio()};});

  await check('HQ actual assets, shader compilation and Draft labels load without browser errors',async()=>{
    await page.waitForTimeout(250);const data=await page.evaluate(()=>({evidence:studio.environment.hq.root.userData.evidence,plants:studio.environment.hq.vegetation,environmentModes:[...studio.environment.hq.lighting.targets.keys()],geometry:studio.renderer.info.memory.geometries,textures:studio.renderer.info.memory.textures,gl:studio.renderer.getContext().getError()}));
    assert.equal(data.evidence.status,'draft');assert.equal(data.plants.assetErrors.length,0);assert.equal(data.plants.loadedTextures,7);assert.deepEqual(data.environmentModes.sort(),['day','dusk','night']);assert.equal(data.gl,0);assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);return data;
  });

  await check('Five actual camera controls reach their authored pose and render 3440×1440 captures',async()=>{
    const views=[];for(const name of ['quarter','front','side','aerial','entrance']){
      await page.locator('#hqCamera').selectOption(name);await settle();
      const pose=await page.evaluate(name=>{const expected=studio.environment.hq.pose(name);return{view:studio.hqJourney.snapshot().view,expected,position:studio.camera.position.toArray(),target:studio.controls.target.toArray(),fov:studio.camera.fov,depth:studio.state.depth,heroHidden:document.querySelector('#sceneMeta').hidden};},name);
      assert.equal(pose.view,name);assert.equal(pose.depth,0);for(let i=0;i<3;i++){assert.ok(Math.abs(pose.position[i]-pose.expected.position[i])<.001);assert.ok(Math.abs(pose.target[i]-pose.expected.target[i])<.001);}assert.equal(pose.fov,pose.expected.fov??43);if(name==='entrance')assert.equal(pose.heroHidden,true);
      await page.screenshot({path:path.join(output,`hq5-day-${name}-3440x1440.png`)});views.push(pose);
    }return views;
  });

  await check('Four post-upgrade captures repeat the exact pre-upgrade camera poses',async()=>{
    const cameras={front:{position:[-3,17,62],target:[-3,13,-12],fov:43},side:{position:[65,19,-9],target:[-3,13,-12],fov:43},quarter:{position:[48,29,53],target:[-3,13,-12],fov:43},entrance:{position:[15,4.5,13],target:[4.7,2.1,-3.8],fov:43}};
    for(const [name,pose] of Object.entries(cameras)){await page.evaluate(pose=>{studio.hqJourney.cancel();document.querySelector('#sceneMeta').hidden=false;return studio.director.move(pose.position,pose.target,{fov:pose.fov});},pose);await page.screenshot({path:path.join(output,`hq5-after-matched-${name}-3440x1440.png`)});}
    const result={baselineCommit:'160c0d6cf7684633d87d0280a4d73df4401525f6',viewport:[3440,1440],dpr:1,cameras,note:'Camera/viewport are held constant; architecture, materials and lighting intentionally changed. The historical entrance camera targeted the incorrect corner, so its matched comparison is not a validation of the new entrance.'};require('node:fs').writeFileSync(path.join(output,'hq5-matched-cameras.json'),JSON.stringify(result,null,2));return result;
  });

  await check('120 native frames are measured at every HQ view; reported budgets are not visual acceptance',async()=>{
    const results=[];for(const name of ['front','side','quarter','aerial','entrance']){
      await page.evaluate(name=>studio.showHQView(name),name);await page.waitForTimeout(150);
      const sample=await page.evaluate(async()=>{let previous=await new Promise(requestAnimationFrame);const intervals=[],frames=[];for(let i=0;i<120;i++){const now=await new Promise(requestAnimationFrame);intervals.push(now-previous);previous=now;frames.push({...studio.renderer.info.render});}const sorted=[...intervals].sort((a,b)=>a-b),values=key=>frames.map(f=>f[key]);return{frames:intervals.length,intervalsMs:intervals,meanFps:120000/intervals.reduce((a,b)=>a+b,0),medianMs:sorted[60],p95Ms:sorted[114],maxMs:sorted.at(-1),drawCalls:{min:Math.min(...values('calls')),max:Math.max(...values('calls'))},triangles:{min:Math.min(...values('triangles')),max:Math.max(...values('triangles'))},memory:{...studio.renderer.info.memory},plants:studio.environment.hq.vegetation,gl:studio.renderer.getContext().getError()};});
      assert.equal(sample.frames,120);assert.ok(Number.isFinite(sample.p95Ms)&&sample.p95Ms>0);assert.ok(sample.drawCalls.min>4,'Must count the HQ scene, not only the last fullscreen pass');assert.equal(sample.gl,0);results.push({name,...sample,within30FpsFrameBudget:sample.p95Ms<=33.4});
    }report.performance=results;report.performanceInterpretation='Observed native requestAnimationFrame timing. P95 ≤33.4ms is a reported 30fps frame budget, not a claimed physical-device guarantee; failing budgets remain visible in each result.';return results;
  });

  await check('Day, dusk and night controls retain exclusive selection and distinct actual lighting',async()=>{
    await page.evaluate(()=>studio.showHQView('quarter'));const modes=[];for(const mode of ['day','dusk','night']){
      await page.locator(`#hqControls button[data-hq-light="${mode}"]`).click();try{await page.waitForFunction(mode=>studio.environment.hq.mode===mode&&document.querySelector(`#hqControls button[data-hq-light="${mode}"]`).getAttribute('aria-pressed')==='true',mode);}catch(error){report.lightFailure=await page.evaluate(()=>({mode:studio.environment.hq.mode,buttons:[...document.querySelectorAll('[data-hq-light]')].map(b=>({tag:b.tagName,id:b.id,value:b.dataset.hqLight,pressed:b.getAttribute('aria-pressed')})),toast:document.querySelector('#toast').textContent}));throw error;}
      await page.waitForTimeout(400); // Capture the settled CSS selection and rendered light profile.
      const result=await page.evaluate(()=>({mode:studio.environment.hq.mode,pressed:[...document.querySelectorAll('#hqControls button[data-hq-light][aria-pressed="true"]')].map(b=>b.dataset.hqLight),sun:studio.environment.hq.lighting.sun.intensity,ambient:studio.environment.hq.lighting.hemi.intensity,fog:studio.scene.fog.color.getHex(),environment:studio.scene.environment.uuid,environmentIntensity:studio.scene.environmentIntensity,restoredExposure:studio.renderer.toneMappingExposure}));assert.deepEqual(result.pressed,[mode]);modes.push(result);await page.screenshot({path:path.join(output,`hq5-${mode}-quarter-3440x1440.png`)});
    }assert.equal(new Set(modes.map(m=>m.fog)).size,3);assert.equal(new Set(modes.map(m=>m.environment)).size,3);assert.ok(modes[2].sun<modes[0].sun);return modes;
  });

  await check('Real HQ orbit supports pause, resume, stop and returns camera ownership without snapping',async()=>{
    await page.locator('#hqOrbit').click();await page.waitForFunction(()=>studio.hqJourney.phase==='playing');await page.waitForTimeout(400);await page.locator('#hqPause').click();
    const frozen=await page.evaluate(()=>({position:studio.camera.position.toArray(),progress:studio.hqJourney.progress}));await page.waitForTimeout(300);assert.deepEqual(await page.evaluate(()=>studio.camera.position.toArray()),frozen.position);assert.equal(await page.evaluate(()=>studio.hqJourney.progress),frozen.progress);
    await page.locator('#hqPause').click();await page.waitForFunction(value=>studio.hqJourney.progress>value,frozen.progress);const stopped=await page.evaluate(()=>{const before=studio.camera.position.clone();document.querySelector('#hqStop').click();return{distance:before.distanceTo(studio.camera.position),owner:studio.director.owner,active:studio.hqJourney.active};});assert.equal(stopped.distance,0);assert.equal(stopped.owner,'orbit');assert.equal(stopped.active,false);return{frozen,stopped};
  });

  await check('Pointer, wheel, semantic go, free mode and Escape each cancel the HQ timeline',async()=>{
    const records=[];for(const action of ['pointer','wheel','go','free','escape']){
      await page.evaluate(()=>studio.go(0));await page.evaluate(()=>studio.playHQ('orbit'));await page.waitForFunction(()=>studio.hqJourney.phase==='playing');
      if(action==='pointer')await page.mouse.click(2400,550);
      if(action==='wheel'){await page.mouse.move(2400,550);await page.mouse.wheel(0,160);await page.waitForFunction(()=>studio.state.depth===1&&studio.director.owner==='orbit');}
      if(action==='go')await page.evaluate(()=>studio.go(2));
      if(action==='free')await page.locator('#exitTour').click();
      if(action==='escape')await page.keyboard.press('Escape');
      const result=await page.evaluate(()=>({active:studio.hqJourney.active,owner:studio.director.owner,depth:studio.state.depth,mode:studio.state.mode,fade:studio.hqJourney.fade}));assert.equal(result.active,false);assert.equal(result.owner,'orbit');assert.equal(result.fade,0);records.push({action,...result});if(action==='free')await page.locator('#exitTour').click();
    }return records;
  });

  await check('A cancelled return from Hall cannot restart an obsolete HQ cinematic',async()=>{
    await page.evaluate(()=>studio.go(2));await page.evaluate(()=>{window.pendingHQ=studio.playHQ('orbit');});await page.waitForTimeout(50);await page.evaluate(()=>studio.showHQView('entrance'));
    const result=await page.evaluate(async()=>({cancelled:await window.pendingHQ,view:studio.hqJourney.snapshot().view,active:studio.hqJourney.active,owner:studio.director.owner,depth:studio.state.depth}));assert.equal(result.cancelled,false);assert.equal(result.view,'entrance');assert.equal(result.active,false);assert.equal(result.owner,'orbit');assert.equal(result.depth,0);return result;
  });

  await check('Fly-in runs in real time, fully covers the doorway and enters Interior before revealing',async()=>{
    await page.evaluate(()=>studio.go(0));await page.evaluate(()=>studio.playHQ('fly-in'));
    const result=await page.evaluate(async()=>{const started=performance.now(),samples=[];let previous=studio.camera.position.clone();while(studio.hqJourney.active){await new Promise(requestAnimationFrame);samples.push({phase:studio.hqJourney.phase,progress:studio.hqJourney.progress,fade:studio.hqJourney.fade,depth:studio.state.depth,step:studio.camera.position.distanceTo(previous),finite:studio.camera.position.toArray().every(Number.isFinite)});previous.copy(studio.camera.position);if(performance.now()-started>65000)throw Error('HQ fly-in exceeded the real-time timeout');}const interior=samples.find(s=>s.depth===1);return{wallMs:performance.now()-started,frames:samples.length,coveredOutside:samples.some(s=>s.depth===0&&s.fade>=.999),firstInterior:interior,maximumCameraStepM:Math.max(...samples.map(s=>s.step)),finite:samples.every(s=>s.finite),depth:studio.state.depth,owner:studio.director.owner,fade:studio.hqJourney.fade,phases:[...new Set(samples.map(s=>s.phase))]};});assert.ok(result.wallMs>=11000);assert.ok(result.frames>30);assert.equal(result.coveredOutside,true);assert.ok(result.firstInterior.fade>=.999);assert.equal(result.depth,1);assert.equal(result.owner,'orbit');assert.equal(result.fade,0);assert.equal(result.finite,true);await page.screenshot({path:path.join(output,'hq5-fly-in-interior-3440x1440.png')});return result;
  });

  await check('HQ light changes preserve Hall and PA Rack palettes and stable resources over repeated returns',async()=>{
    const samples=[];for(let cycle=0;cycle<4;cycle++){
      await page.evaluate(()=>studio.go(0));await page.evaluate(()=>studio.environment.hq.setLighting('night'));const hqFog=await page.evaluate(()=>studio.scene.fog.color.getHex());
      await page.evaluate(()=>studio.go(2));const hall=await page.evaluate(()=>({background:studio.scene.background.getHex(),fog:studio.scene.fog.color.getHex(),environment:studio.scene.environment.uuid,intensity:studio.scene.environmentIntensity,exposure:studio.renderer.toneMappingExposure,hqVisible:studio.environment.hq.root.visible}));
      await page.evaluate(()=>studio.go(4,{rackId:'rack-1'}));const rack=await page.evaluate(()=>({background:studio.scene.background.getHex(),fog:studio.scene.fog,environment:studio.scene.environment.uuid,intensity:studio.scene.environmentIntensity,exposure:studio.renderer.toneMappingExposure,theme:[...studio.studio.materials].map(m=>m.uniforms.uLightTheme.value),paEnvironment:studio.studio.environment.uuid}));
      if(cycle===0)await page.screenshot({path:path.join(output,'hq5-rack-palette-regression-3440x1440.png')});
      await page.evaluate(()=>studio.go(0));const returned=await page.evaluate(()=>({mode:studio.environment.hq.mode,fog:studio.scene.fog.color.getHex(),memory:{...studio.renderer.info.memory},refs:studio.library.refs,lod:studio.projection.stats().detailed}));assert.equal(returned.mode,'night');assert.equal(returned.fog,hqFog);assert.equal(returned.refs,0);assert.equal(returned.lod,0);assert.equal(hall.hqVisible,false);assert.equal(hall.intensity,1);assert.equal(rack.intensity,1);assert.equal(rack.fog,null);assert.ok(rack.theme.every(v=>v===0));samples.push({hall,rack,returned});
    }for(const sample of samples.slice(1)){assert.deepEqual(sample.hall,samples[0].hall);assert.deepEqual(sample.rack,samples[0].rack);assert.deepEqual(sample.returned.memory,samples[0].returned.memory);}return samples;
  });
  await page.evaluate(()=>studio.dispose());await page.close();

  await check('Mobile DPR 2 controls, one-finger orbit cancellation and pinch zoom operate under synthesized touch',async()=>{
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});try{
      const mobile=await context.newPage(),errors=[];mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(origin);await mobile.waitForFunction(()=>window.studio);await mobile.evaluate(()=>studio.environment.hq.loading);
      await mobile.waitForTimeout(400);await mobile.screenshot({path:path.join(output,'hq5-mobile-default-390x844-dpr2.png')});
      await mobile.locator('#hqControls button[data-hq-light="dusk"]').tap();assert.equal(await mobile.evaluate(()=>studio.environment.hq.mode),'dusk');await mobile.locator('#hqCamera').selectOption('entrance');await mobile.waitForFunction(()=>!studio.hqJourney.active&&studio.director.owner==='orbit');
      const buttons=await mobile.locator('#hqControls button:visible').evaluateAll(nodes=>nodes.map(n=>({id:n.id||n.dataset.hqLight,x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})));assert.ok(buttons.every(b=>b.x>=0&&b.x+b.width<=390&&b.height>=44));
      const layout=await mobile.evaluate(()=>{const scene=document.querySelector('#scene').getBoundingClientRect(),controls=document.querySelector('#hqControls').getBoundingClientRect(),crumbs=document.querySelector('#breadcrumbs').getBoundingClientRect();return{heroDisplay:getComputedStyle(document.querySelector('#sceneMeta')).display,sceneHeight:scene.height,clearBandHeight:controls.top-Math.max(scene.top,crumbs.bottom),clearBandRatio:(controls.top-Math.max(scene.top,crumbs.bottom))/scene.height};});report.mobileLayout=layout;assert.equal(layout.heroDisplay,'none');assert.ok(layout.clearBandRatio>=.45,'HQ mobile must retain at least 45% scene height between breadcrumb and controls');
      await mobile.locator('#hqOrbit').tap();await mobile.waitForFunction(()=>studio.hqJourney.phase==='playing');const cdp=await context.newCDPSession(mobile);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:220,y:300}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:265,y:325}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await mobile.evaluate(()=>studio.hqJourney.active),false);
      const gesture=await mobile.evaluate(()=>{for(let y=120;y<innerHeight-120;y+=10)if([85,120,220,255].every(x=>document.elementFromPoint(x,y)===studio.renderer.domElement))return{y,start:[{x:120,y,id:1},{x:220,y,id:2}],end:[{x:85,y,id:1},{x:255,y,id:2}],hit:'viewport'};throw Error('No unobstructed two-finger canvas area');});
      const before=await mobile.evaluate(()=>studio.camera.position.distanceTo(studio.controls.target));await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:gesture.start});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:gesture.end});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mobile.waitForTimeout(250);const result=await mobile.evaluate(()=>({distance:studio.camera.position.distanceTo(studio.controls.target),depth:studio.state.depth,dpr:devicePixelRatio,pixelRatio:studio.renderer.getPixelRatio(),overflow:document.documentElement.scrollWidth>innerWidth,canvas:[studio.renderer.domElement.width,studio.renderer.domElement.height]}));report.mobile={...result,buttons,before,gesture};assert.notEqual(result.distance,before);assert.equal(result.depth,0);assert.equal(result.dpr,2);assert.equal(result.overflow,false);await mobile.screenshot({path:path.join(output,'hq5-mobile-touch-390x844-dpr2.png')});assert.deepEqual(errors,[]);return{...report.mobile,events:'Playwright tap/select and Chrome CDP synthesized touch; no physical mobile device'};
    }finally{await context.close();}
  });

  await check('HQ GPU create / render / dispose cycles release owned resources and late loaders cannot reattach',async()=>{
    const lifecycle=await browser.newPage({viewport:{width:960,height:540}});const errors=[],requests=[];report.lifecycleConsole=errors;report.lifecycleRequests=requests;lifecycle.on('pageerror',e=>errors.push({message:e.message,type:'pageerror'}));lifecycle.on('console',m=>{if(m.type()==='error')errors.push({message:m.text(),location:m.location(),type:'console'});});lifecycle.on('response',response=>{if(response.status()>=400)requests.push({url:response.url(),status:response.status()});});lifecycle.on('requestfailed',request=>requests.push({url:request.url(),failure:request.failure()?.errorText}));try{
      await lifecycle.goto(origin+'/tests/v5/hq-lifecycle.html');
      const result=await lifecycle.evaluate(async()=>{
        const THREE=await import('/vendor/three.module.js'),{HQEnvironment}=await import('/modules/environment/hq-scene.js');const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true});renderer.setSize(960,540);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.outputColorSpace=THREE.SRGBColorSpace;
        const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,960/540,.05,400),cycles=[];const renderEmpty=()=>{scene.environment=null;scene.background=new THREE.Color(0x111111);renderer.render(scene,camera);};
        for(let cycle=0;cycle<4;cycle++){
          const hq=new HQEnvironment(scene,renderer);await hq.loading;const pose=hq.pose();camera.position.fromArray(pose.position);camera.lookAt(new THREE.Vector3(...pose.target));hq.update(camera);for(const mode of ['day','dusk','night']){await hq.setLighting(mode);hq.update(camera);hq.lighting.render(scene,camera);await new Promise(requestAnimationFrame);}
          const resources=new Set([...hq.geometry,...hq.materials,...hq.textures,...hq.plants.geometries,...hq.plants.materials,...hq.plants.textures]),disposed=new Set();resources.forEach(r=>r.addEventListener('dispose',()=>disposed.add(r)));const before={...renderer.info.memory};hq.dispose();hq.dispose();renderEmpty();await new Promise(requestAnimationFrame);cycles.push({before,after:{...renderer.info.memory},expectedOwned:resources.size,disposedOwned:disposed.size,rootAttached:!!hq.root.parent,plants:hq.vegetation,pipeline:hq.lighting.pipeline,environmentTargets:hq.lighting.targets.size,gl:renderer.getContext().getError()});
        }
        const late=new HQEnvironment(scene,renderer);late.dispose();await late.loading;renderEmpty();await new Promise(requestAnimationFrame);const lateResult={memory:{...renderer.info.memory},rootAttached:!!late.root.parent,geometry:late.geometry.size,materials:late.materials.size,textures:late.textures.size,plants:late.vegetation,targets:late.lighting.targets.size,gl:renderer.getContext().getError()};renderer.dispose();return{cycles,late:lateResult};
      });
      report.lifecycle=result;for(const cycle of result.cycles){assert.equal(cycle.disposedOwned,cycle.expectedOwned);assert.equal(cycle.rootAttached,false);assert.equal(cycle.environmentTargets,0);assert.equal(cycle.pipeline,null);assert.equal(cycle.plants.disposed,true);assert.equal(cycle.gl,0);assert.deepEqual(cycle.after,result.cycles[0].after);}assert.equal(result.late.rootAttached,false);assert.equal(result.late.geometry,0);assert.equal(result.late.materials,0);assert.equal(result.late.textures,0);assert.equal(result.late.targets,0);assert.equal(result.late.gl,0);assert.deepEqual(result.late.memory,result.cycles[0].after);assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);return result;
    }finally{await lifecycle.close();}
  });
  await check('No desktop browser console, shader or asset errors',()=>{assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);});
  report.tests.push({name:'Latest survey geometry, original user photograph matching and physical mobile GPU performance',status:'SKIP',reason:'User primary photo, measured dimensions and physical mobile device are unavailable. Public reference evidence, actual desktop GPU captures and synthesized touch are recorded separately.'});
});
