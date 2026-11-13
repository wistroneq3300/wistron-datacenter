process.env.V2_EVIDENCE_DIR||='docs/phase3-4/evidence';process.env.V2_TEST_PORT||='4398';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const {browserRun}=require('../v2/harness.cjs');
browserRun('phase34-journey',async({browser,page,check,report,origin,output})=>{
  const context=await browser.newContext({viewport:{width:3440,height:1440},deviceScaleFactor:1,recordVideo:{dir:output,size:{width:1720,height:720}}}),film=await context.newPage(),video=film.video();
  film.on('pageerror',e=>report.errors.push(e.message));
  try{
    await film.goto(origin);await film.waitForFunction(()=>window.studio);
    await check('Actual HQ → eight levels → Hall → Node fault / recovery cinematic recording',async()=>{
      const visited=[];await film.waitForTimeout(1200);
      for(let depth=1;depth<=7;depth++){await film.evaluate(d=>studio.go(d,{rackId:'rack-1',equipmentId:'editorial-compute-01'}),depth);assert.equal(await film.evaluate(()=>studio.state.depth),depth);visited.push(depth);await film.waitForTimeout(700);}
      await film.evaluate(()=>studio.go(2));await film.locator('#twinBtn').click();
      for(const scenario of ['healthy','warningSystem','failNode']){await film.locator(`[data-demo-scenario="${scenario}"]`).click();await film.waitForTimeout(800);}
      await film.locator('.twin-entity[data-entity-id="editorial-compute-01::node-0"]').click();await film.waitForFunction(()=>studio.state.depth===6&&studio.director.owner==='orbit');await film.waitForTimeout(800);
      assert.match(await film.locator('#twinDetail .telemetry-metric').first().textContent(),/84.*DEMO/);
      for(const scenario of ['recoveringNode','recovered','offline','stale']){await film.locator(`[data-demo-scenario="${scenario}"]`).click();await film.waitForTimeout(800);}
      await film.locator('#closeTwin').click();await film.evaluate(()=>studio.go(0));await film.waitForTimeout(1000);
      return{visited:[0,...visited],node:'editorial-compute-01::node-0',syntheticMetrics:true,recording:'actual browser continuous frames; programmatic camera commands plus real UI clicks'};
    });
  }finally{await context.close();const generated=await video.path(),target=path.join(output,'hq-to-node-demo-1720x720.webm');await video.saveAs(target);if(generated!==target&&fs.existsSync(generated))fs.unlinkSync(generated);report.video={path:path.basename(target),viewport:[3440,1440],encoded:[1720,720],mock:true};}
  await page.goto(origin);await page.waitForFunction(()=>window.studio);
  await check('Failed reconnect is visible; canceled Node focus cannot retake camera or selection',async()=>{
    await page.locator('#twinBtn').click();await page.locator('[data-demo-scenario="healthy"]').click();await page.locator('[data-demo-scenario="offline"]').click();await page.locator('#twinReconnect').click();await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('仍無法連線'));assert.match(await page.locator('#toast').textContent(),/仍無法連線/);await page.locator('#demoReset').click();await page.waitForFunction(()=>studio.twin.snapshot().connection.state==='connected');
    const result=await page.evaluate(async()=>{await studio.go(2);const focusing=studio.focusEntity('editorial-compute-01::node-0');const started=performance.now();while(studio.state.depth!==6){await new Promise(requestAnimationFrame);if(performance.now()-started>10000)throw Error('Board transition never started');}const returning=studio.go(2);const focused=await focusing;await returning;return{focused,depth:studio.state.depth,node:studio.state.nodeId,owner:studio.director.owner};});
    assert.equal(result.focused,false);assert.equal(result.depth,2);assert.equal(result.node,null);assert.equal(result.owner,'orbit');return result;
  });
  await check('Repeated HQ / Hall / Node switching releases detail assets and bounds resource growth',async()=>{
    const result=await page.evaluate(async()=>{await studio.go(0);await studio.go(2);const samples=[];for(let i=0;i<6;i++){await studio.focusEntity('editorial-compute-01::node-0');await studio.go(0);await studio.go(2);await new Promise(requestAnimationFrame);samples.push({memory:{...studio.renderer.info.memory},refs:studio.library.refs,pool:studio.projection.pool.size,details:studio.projection.stats().detailed,markers:studio.twinSync.markers.size});}return samples;});
    assert.ok(result.every(s=>s.refs===0&&s.pool===0&&s.details===0));assert.deepEqual(result.slice(1).map(s=>s.memory),Array(5).fill(result[1].memory));return result;
  });
  await check('Monitoring panel works on touch viewport without horizontal overflow',async()=>{
    const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}),p=await mobile.newPage();try{await p.goto(origin);await p.waitForFunction(()=>window.studio);await p.locator('#twinBtn').tap();await p.locator('[data-demo-scenario="healthy"]').tap();await p.locator('[data-demo-scenario="failNode"]').tap();assert.equal(await p.evaluate(()=>studio.twin.stateFor('rack-1').health),'fail');const size=await p.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,panel:document.getElementById('twinPanel').getBoundingClientRect().toJSON()}));assert.ok(size.documentWidth<=size.width+1);assert.ok(size.panel.left>=0&&size.panel.right<=size.width);await p.screenshot({path:path.join(output,'twin-touch-390x844.png')});return size;}finally{await mobile.close();}
  });
  await check('A pending read-only gateway cannot block the independent 3D workbench',async()=>{
    const ctx=await browser.newContext(),p=await ctx.newPage();let release;const held=new Promise(resolve=>release=resolve);try{
      await p.route('**/data/monitoring.json',route=>route.fulfill({json:{mode:'pa-gateway',staleAfterMs:15000,routes:{inventory:'/synthetic-inventory',snapshot:'/synthetic-snapshot'}}}));
      await p.route('**/synthetic-inventory',async route=>{await held;try{await route.fulfill({status:503,body:'Synthetic unavailable relay'});}catch{}});
      await p.goto(origin);await p.waitForFunction(()=>window.studio);assert.equal(await p.evaluate(()=>studio.twin.snapshot().connection.state),'connecting');await p.evaluate(()=>studio.go(4,{rackId:'rack-1'}));assert.equal(await p.evaluate(()=>studio.state.depth),4);assert.equal(await p.locator('.demo-controls').isVisible(),false);return{transport:'synthetic held request',workbenchReady:true,liveConnectionVerified:false};
    }finally{await p.evaluate(()=>studio?.dispose()).catch(()=>{});release();await ctx.close();}
  });
  await check('Continuous journey and monitoring have no console or asset errors',()=>{assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);});
});
