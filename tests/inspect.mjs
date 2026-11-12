import { chromium } from '/mnt/openhands/u2/workspace/project/101ab20529eb407d95e7afaa5b7702c3/node_modules/playwright/index.mjs';
const browser=await chromium.launch({headless:true,executablePath:'/mnt/openhands/u2/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome',args:['--no-sandbox','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1920,height:1200}});
page.on('console',m=>console.log('CONSOLE',m.type(),m.text()));page.on('pageerror',e=>console.log('PAGEERROR',e.stack));page.on('requestfailed',r=>console.log('FAILED',r.url(),r.failure()));
await page.goto('http://localhost:4300',{waitUntil:'networkidle'});await page.waitForTimeout(6000);
console.log(await page.evaluate(()=>({studio:!!window.__WISTRON_STUDIO__,loading:document.getElementById('loading')?.textContent,canvas:[document.querySelector('canvas').width,document.querySelector('canvas').height],scene:window.__WISTRON_STUDIO__?.currentView,draw:window.__WISTRON_STUDIO__?.drawCalls,buttons:document.querySelectorAll('button').length})));
await page.screenshot({path:'previews/v1-hall.png'});
await browser.close();
