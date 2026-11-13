const assert=require('node:assert/strict'),path=require('node:path');
process.env.V2_EVIDENCE_DIR||=path.resolve(__dirname,'../../docs/phase3-4/evidence');process.env.V2_TEST_PORT||='4396';
const {browserRun}=require('../v2/harness.cjs');
browserRun('phase3-hall-preview',async({page,check,report,origin,output})=>{
  await page.goto(origin+'/tests/v3/hall-preview.html');await page.waitForFunction(()=>window.hallPreview?.ready);report.scope='Standalone HallEnvironment and actual configuration-derived RackProjection LOD; main navigation and PA inspection quality are separate regression suites.';
  report.gpu=await page.evaluate(()=>{const gl=hallPreview.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),canvas:[gl.canvas.width,gl.canvas.height]};});
  for(const count of [1,4,32])await check(`${count} configured racks render with bounded Hall and LOD batches`,async()=>{
    const state=await page.evaluate(count=>hallPreview.layout(count),count);await page.waitForTimeout(200);assert.equal(state.projection.racks,count);assert.equal(state.projection.visibleRacks,count);assert.equal(state.projection.detailed,0);assert.equal(state.hall.geometries,1);assert.ok(state.hall.drawBatches<=50);
    await page.screenshot({path:path.join(output,`hall-${count}-rack-3440x1440.png`)});
    const render=await page.evaluate(()=>{hallPreview.render();const r=hallPreview.renderer,gl=r.getContext(),pixel=new Uint8Array(4);gl.readPixels(gl.canvas.width/2|0,gl.canvas.height/2|0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return{render:{...r.info.render},memory:{...r.info.memory},glError:gl.getError(),centerPixel:[...pixel]};});assert.equal(render.glError,0);assert.ok(render.render.triangles>1000);assert.ok(render.centerPixel.slice(0,3).some(v=>v>15));
    const frames=await page.evaluate(async()=>{const intervals=[];let last;await new Promise(resolve=>{function sample(now){if(last!==undefined)intervals.push(now-last);last=now;if(intervals.length<120)requestAnimationFrame(sample);else resolve();}requestAnimationFrame(sample);});intervals.sort((a,b)=>a-b);return{samples:intervals.length,p95Ms:intervals[Math.ceil(intervals.length*.95)-1],medianMs:intervals[intervals.length/2|0],fpsFromMedian:1000/intervals[intervals.length/2|0],measurement:'requestAnimationFrame intervals, not GPU elapsed timer'};});return{...state,...render,frames};
  });
  await check('Hall side and entrance camera images render without overlap errors',async()=>{for(const [name,side] of [['left',-1],['right',1]]){await page.evaluate(side=>hallPreview.view(side),side);await page.waitForTimeout(100);await page.screenshot({path:path.join(output,`hall-32-${name}-3440x1440.png`)});}assert.equal(await page.evaluate(()=>hallPreview.renderer.getContext().getError()),0);return{angles:2};});
  await check('Repeated 1/32/4 layout release returns GPU bookkeeping to the same baseline',async()=>{
    const cycles=await page.evaluate(()=>{const baseline=hallPreview.release(),counts=[];for(let i=0;i<6;i++){hallPreview.layout([1,32,4][i%3]);counts.push(hallPreview.release());}hallPreview.layout(32);return{baseline,counts};});for(const count of cycles.counts)assert.deepEqual(count,cycles.baseline);return cycles;
  });
  await check('Hall instance hit metadata resolves real row and rack IDs',async()=>{
    const result=await page.evaluate(()=>{const projection=hallPreview.projection,ids=new Set(hallPreview.document.racks.map(r=>r.id));let slots=0,unknown=[];projection.lod.group.traverse(mesh=>{if(mesh.userData.rackIds)mesh.userData.rackIds.forEach((id,index)=>{const hit=projection.resolveHit({object:mesh,instanceId:index});slots++;if(!ids.has(hit?.rackId))unknown.push(id);});});let rows=0;hallPreview.hall.root.traverse(mesh=>{if(mesh.userData.kind==='row')rows++;});return{slots,unknown,rows};});assert.ok(result.slots>32);assert.deepEqual(result.unknown,[]);assert.ok(result.rows>=4);return result;
  });
  await check('No console, shader, WebGL or asset errors',()=>{assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);return{errors:0};});
});
