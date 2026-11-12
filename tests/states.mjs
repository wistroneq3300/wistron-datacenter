import { chromium } from '/mnt/openhands/u2/workspace/project/101ab20529eb407d95e7afaa5b7702c3/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,executablePath:'/mnt/openhands/u2/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome',args:['--no-sandbox','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'});
page.on('pageerror',e=>console.log('PAGEERROR',e.message));
await page.goto('http://localhost:4300',{waitUntil:'networkidle'});await page.waitForTimeout(2300);
for(const view of ['hq','cutaway','row']){
 await page.evaluate(v=>window.__WISTRON_STUDIO__.setView(v,true),view);await page.waitForTimeout(2200);await page.screenshot({path:`previews/v1-${view}.png`});console.log(view,await page.evaluate(()=>({draw:window.__WISTRON_STUDIO__.drawCalls,buttons:[...document.querySelectorAll('.world-label')].map(x=>({id:x.textContent,visible:getComputedStyle(x).display,rect:x.getBoundingClientRect().toJSON()}))})));
}
await page.evaluate(()=>window.__WISTRON_STUDIO__.selectRack('R01',true));await page.waitForTimeout(2000);await page.locator('#deviceView').click();await page.waitForFunction(()=>document.getElementById('devicePlaceholder').classList.contains('done')||document.getElementById('devicePlaceholder').textContent.includes('失敗'),{timeout:60000});await page.waitForTimeout(2500);console.log('GLB',await page.locator('#devicePlaceholder').textContent());await page.screenshot({path:'previews/v1-device.png'});await browser.close();
