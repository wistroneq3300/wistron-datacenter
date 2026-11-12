const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const root=path.resolve(__dirname,'../..');
const output=path.resolve(process.env.V2_EVIDENCE_DIR||path.join(root,'docs/phase1-2/evidence'));
fs.mkdirSync(output,{recursive:true});
async function browserRun(suite,run){
  const port=Number(process.env.V2_TEST_PORT||4392),origin=`http://127.0.0.1:${port}`;
  const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),TEST_MODE:'1',HOST:'127.0.0.1'},stdio:'ignore',windowsHide:true});
  const report={suite,date:new Date().toISOString(),tests:[],errors:[],requests:[]};let browser;
  try{
    let ready=false;for(let i=0;i<80;i++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}if(!ready)throw Error('Test server unavailable');
    browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||undefined,headless:true});
    const page=await browser.newPage({viewport:{width:3440,height:1440},deviceScaleFactor:1});page.setDefaultTimeout(30000);
    report.browser=browser.version();report.channel=process.env.BROWSER_CHANNEL||'bundled Chromium';report.viewport={width:3440,height:1440,dpr:1};report.runtime=process.version;report.platform=process.platform;
    page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/404/.test(m.text()))report.errors.push(m.text());});
    page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))report.requests.push({url:r.url(),status:r.status()});});
    const check=async(name,fn)=>{try{const evidence=await fn();report.tests.push({name,status:'PASS',evidence});console.log('PASS',name);}catch(e){report.tests.push({name,status:'FAIL',error:e.stack});console.log('FAIL',name,e.message);}};
    await run({page,browser,check,report,origin,output,root});
  }catch(e){report.tests.push({name:'suite execution',status:'FAIL',error:e.stack});}
  finally{await browser?.close();server.kill();report.summary={PASS:report.tests.filter(t=>t.status==='PASS').length,FAIL:report.tests.filter(t=>t.status==='FAIL').length,SKIP:report.tests.filter(t=>t.status==='SKIP').length};fs.writeFileSync(path.join(output,suite+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary));if(report.summary.FAIL)process.exitCode=1;}
}
module.exports={browserRun,root,output};
