const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const {spawn}=require('node:child_process');
const {chromium}=require(process.env.PHASE0_PLAYWRIGHT_MODULE || '@playwright/test');
const root=path.resolve(__dirname,'../../..'),out=path.resolve(process.env.PHASE0_EVIDENCE_DIR || path.join(root,'docs/phase0/evidence'));fs.mkdirSync(out,{recursive:true});
const result={date:new Date().toISOString(),scope:'Phase 0: unchanged baseline, no V2 implementation',viewport:{width:3440,height:1440},errors:[],httpFailures:[],checks:{},screenshots:[]};
const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:'4388'},stdio:'ignore',windowsHide:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));let browser;
async function main(){
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:4388')).ok)break;}catch{}await pause(100);}
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});result.browser=browser.version();
 const page=await browser.newPage({viewport:result.viewport,reducedMotion:'reduce',deviceScaleFactor:1});page.setDefaultTimeout(30000);
 page.on('pageerror',e=>result.errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))result.httpFailures.push({url:r.url(),status:r.status()});});
 await page.goto('http://127.0.0.1:4388',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__WISTRON_STUDIO__&&!document.getElementById('loading'));
 result.gpu=await page.evaluate(()=>{const s=window.__WISTRON_STUDIO__,g=s.renderer.getContext(),x=g.getExtension('WEBGL_debug_renderer_info');return {renderer:x?g.getParameter(x.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),canvas:[g.canvas.width,g.canvas.height]};});
 const capture=async name=>{await pause(700);const file=`baseline-3440x1440-${name}.png`;await page.screenshot({path:path.join(out,file)});result.screenshots.push(file);console.log('captured',name);};
 for(const view of ['hq','hall','row']){await page.locator(`[data-view="${view}"]`).click();await capture(view);}
 await page.evaluate(()=>window.__WISTRON_STUDIO__.selectRack('R01',true));await page.locator('#isolateRack').click();await page.locator('#openRack').click();await pause(1200);await capture('rack-front-open');
 await page.locator('#rackRear').click();await capture('rack-rear');
 result.checks.memoryBefore=await page.evaluate(()=>({...window.__WISTRON_STUDIO__.renderer.info.memory,drawCalls:window.__WISTRON_STUDIO__.drawCalls}));
 await page.locator('[data-view="hall"]').click();
 result.checks.isolationAfterHall=await page.evaluate(()=>{const g=window.__WISTRON_STUDIO__.scene.children.find(g=>g.name==='Configured rack row');return {isolated:g.userData.isolated,visibleRacks:g.children.filter(c=>c.visible).length,total:g.children.length};});
 await page.locator('#resetBtn').click();await page.locator('[data-view="hq"]').click();await page.locator('#startTour').click();
 for(let i=0;i<3;i++)await page.locator('#tourNext').click();
 result.checks.journeyEnd=await page.evaluate(()=>({stage:document.getElementById('journeyStep').textContent,nextDisabled:document.getElementById('tourNext').disabled,view:window.__WISTRON_STUDIO__.currentView}));
 await page.locator('#viewport').click({position:{x:300,y:300}});
 result.checks.tourAfterCanvasClick=await page.locator('#tourControls').evaluate(e=>({hidden:e.hidden}));
 const sparse={version:1,racks:[{id:'R09',name:'Review fixture',purpose:'Review only',position:9}]};
 await page.locator('#configBtn').click();await page.locator('#importConfig').setInputFiles({name:'phase0-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(sparse))});await page.locator('#addRackBtn').click();
 result.checks.addAfterSparseImport=await page.evaluate(()=>window.__WISTRON_STUDIO__.racks.map(r=>({id:r.id,position:r.position})));
 const exported=await page.evaluate(()=>({version:1,racks:window.__WISTRON_STUDIO__.racks}));
 await page.locator('#configBtn').click();await page.locator('#importConfig').setInputFiles({name:'phase0-roundtrip.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});result.checks.reimportOwnConfig=await page.locator('#toast').textContent();await page.locator('[data-close="configDialog"]').click();
 await page.evaluate(()=>localStorage.removeItem('wistron-studio-config-v1'));await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__WISTRON_STUDIO__&&!document.getElementById('loading'));
 result.checks.memoryCycles=[];
 for(let i=0;i<4;i++){await page.locator('#configBtn').click();await page.locator('#importConfig').setInputFiles({name:'phase0-memory.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(sparse))});await pause(350);result.checks.memoryCycles.push(await page.evaluate(()=>({...window.__WISTRON_STUDIO__.renderer.info.memory,drawCalls:window.__WISTRON_STUDIO__.drawCalls})));}
 result.finished=true;
}
main().catch(e=>{result.failure=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.kill();fs.writeFileSync(path.join(out,'baseline-runtime.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));});
