// Review actual decoded movie frames without starting the 3D application.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const root=path.resolve(__dirname,'../..'),output=path.join(root,'docs/phase5a/evidence'),origin='http://127.0.0.1:4399';
(async()=>{
  const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:'4399',HOST:'127.0.0.1',TEST_MODE:'1'},stdio:'ignore',windowsHide:true});let browser;
  try{
    for(let i=0;i<80;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
    browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||undefined,headless:true});const page=await browser.newPage();
    await page.goto(origin+'/tests/v5/hq-lifecycle.html');
    await page.evaluate(async()=>{const video=document.createElement('video');video.src='/docs/phase5a/evidence/hq5-cinematic-3440x1440.webm';video.muted=true;video.preload='auto';window.reviewVideo=video;document.body.append(video);await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=()=>reject(Error('Movie metadata failed'));});});
    const frames=[],movie=JSON.parse(fs.readFileSync(path.join(output,'phase5a-movie.json'))),endTime=movie.video.wallMs/1000-.6;
    for(const second of [3,9,15,24,36,46,58,60,endTime]){
      const frame=await page.evaluate(async second=>{const video=window.reviewVideo;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Video seek timeout')),30000);video.addEventListener('seeked',()=>{clearTimeout(timer);resolve();},{once:true});video.currentTime=second;});const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);return{second:video.currentTime,width:canvas.width,height:canvas.height,data:canvas.toDataURL('image/png').split(',')[1]};},second);
      const filename=second===endTime?'hq5-film-frame-final.png':`hq5-film-frame-${String(second).padStart(2,'0')}s.png`;fs.writeFileSync(path.join(output,filename),Buffer.from(frame.data,'base64'));frames.push({second:frame.second,width:frame.width,height:frame.height,path:filename});
    }
    fs.writeFileSync(path.join(output,'movie-frame-review.json'),JSON.stringify({date:new Date().toISOString(),source:'hq5-cinematic-3440x1440.webm',browser:browser.version(),method:'Native browser video decode; direct drawImage to original 3440×1440 canvas; no image editing or generated frames. Frame extraction alone is not a visual PASS.',frames},null,2));console.log('Extracted '+frames.length+' actual movie frames for visual review.');
  }finally{await browser?.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
