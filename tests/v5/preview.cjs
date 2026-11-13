process.env.V2_EVIDENCE_DIR||='docs/phase5a/evidence';process.env.V2_TEST_PORT||='4398';
const path=require('node:path');const {browserRun}=require('../v2/harness.cjs');
browserRun('hq5-preview',async({page,check,report,origin,output})=>{
 await page.goto(origin);await page.waitForFunction(()=>window.studio);await page.evaluate(()=>studio.environment.hq.loading);await page.waitForTimeout(800);
 await check('HQ initial GPU shader and material loading',async()=>{if(report.errors.length||report.requests.length)throw Error(JSON.stringify({errors:report.errors,requests:report.requests}));return page.evaluate(()=>({memory:studio.renderer.info.memory,draw:studio.renderer.info.render,plants:studio.environment.hq.vegetation}));});
 for(const view of ['quarter','front','entrance','side','aerial']){await page.evaluate(v=>studio.showHQView(v),view);await page.waitForTimeout(150);await page.screenshot({path:path.join(output,`hq5-day-${view}-3440x1440.png`)});}
 for(const mode of ['dusk','night']){await page.evaluate(mode=>{studio.environment.hq.setLighting(mode);return studio.showHQView('quarter');},mode);await page.waitForTimeout(300);await page.screenshot({path:path.join(output,`hq5-${mode}-quarter-3440x1440.png`)});}
 report.finalErrors=report.errors;
});
