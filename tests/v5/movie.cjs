process.env.V2_EVIDENCE_DIR||='docs/phase5a/evidence';process.env.V2_TEST_PORT||='4398';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const {browserRun}=require('../v2/harness.cjs');

browserRun('phase5a-movie',async({page,check,report,origin,output,root})=>{
  const filename='hq5-cinematic-3440x1440.webm',file=path.join(output,filename);let recorded=false;
  await page.goto(origin);await page.waitForFunction(()=>window.studio);await page.evaluate(()=>studio.environment.hq.loading);await page.evaluate(()=>studio.showHQView('quarter'));
  await check('Native 3440×1440 video records five views, three light modes, a complete orbit and real entrance handoff',async()=>{
    fs.writeFileSync(file,Buffer.alloc(0));await page.exposeFunction('writeHQMovieChunk',encoded=>fs.appendFileSync(file,Buffer.from(encoded,'base64')));
    const capture=await page.evaluate(()=>{
      if(!globalThis.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)throw Error('MediaRecorder/canvas.captureStream unavailable');
      const source=studio.renderer.domElement,canvas=document.createElement('canvas');canvas.width=3440;canvas.height=1440;const ctx=canvas.getContext('2d',{alpha:false}),stream=canvas.captureStream(30);
      const mime=['video/webm;codecs=vp8','video/webm;codecs=vp9','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));if(!mime)throw Error('No supported native WebM encoder');
      const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:5000000}),capture={recorder,stream,frames:0,started:performance.now(),stage:'HQ / day',pending:Promise.resolve(),error:null};window.hqMovie=capture;
      recorder.ondataavailable=event=>{if(!event.data.size)return;capture.pending=capture.pending.then(async()=>{const bytes=new Uint8Array(await event.data.arrayBuffer());let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));await window.writeHQMovieChunk(btoa(text));});};
      recorder.onerror=event=>{capture.error=event.error?.message||'MediaRecorder error';};
      const draw=()=>{ctx.fillStyle='#081014';ctx.fillRect(0,0,3440,1440);const scale=Math.min(3440/source.width,1440/source.height),width=source.width*scale,height=source.height*scale,x=(3440-width)/2,y=(1440-height)/2;ctx.drawImage(source,x,y,width,height);if(studio.hqJourney.fade>0){ctx.globalAlpha=studio.hqJourney.fade;ctx.fillStyle='#071015';ctx.fillRect(x,y,width,height);ctx.globalAlpha=1;}ctx.fillStyle='#d5e6de';ctx.font='22px sans-serif';ctx.fillText('Wistron HQ · Draft architecture / illustrative environment',30,30);ctx.textAlign='right';ctx.fillText(capture.stage,3410,30);ctx.textAlign='left';capture.frames++;capture.raf=requestAnimationFrame(draw);};
      draw();recorder.start(1000);return{mime,width:3440,height:1440,sourceCanvas:[source.width,source.height],requestedFps:30,bitrate:5000000,composition:'Actual rendered canvas at native width; letterboxed to 3440×1440 with Draft caption. The real HQJourney.fade value reproduces the browser DOM doorway fade. No generated 3D frames or synthetic frame interpolation.'};
    });
    const segments=[];const segment=async(name,action)=>{const before=await page.evaluate(name=>{hqMovie.stage=name;return performance.now()-hqMovie.started;},name);await action();const after=await page.evaluate(()=>performance.now()-hqMovie.started);segments.push({name,startMs:before,endMs:after});};
    let stop;
    try{
      for(const view of ['quarter','front','side','aerial','entrance'])await segment(`HQ · day · ${view}`,async()=>{await page.evaluate(view=>studio.showHQView(view),view);await page.waitForTimeout(1100);});
      for(const mode of ['dusk','night'])await segment(`HQ · ${mode}`,async()=>{await page.evaluate(async mode=>{await studio.environment.hq.setLighting(mode);await studio.showHQView('quarter');},mode);await page.waitForTimeout(1500);});
      await segment('HQ · day · full 360° orbit',async()=>{await page.evaluate(async()=>{await studio.environment.hq.setLighting('day');await studio.playHQ('orbit');});await page.waitForFunction(()=>!studio.hqJourney.active,undefined,{timeout:70000});});
      await segment('HQ entrance → conceptual Interior',async()=>{await page.evaluate(()=>studio.playHQ('fly-in'));await page.waitForFunction(()=>!studio.hqJourney.active&&studio.state.depth===1,undefined,{timeout:70000});await page.waitForTimeout(2500);});
    }finally{
      stop=await page.evaluate(async()=>{const capture=hqMovie;await new Promise((resolve,reject)=>{capture.recorder.addEventListener('stop',resolve,{once:true});capture.recorder.addEventListener('error',e=>reject(e.error),{once:true});capture.recorder.stop();});cancelAnimationFrame(capture.raf);capture.stream.getTracks().forEach(track=>track.stop());await capture.pending;return{wallMs:performance.now()-capture.started,renderedCaptureFrames:capture.frames,error:capture.error,depth:studio.state.depth,active:studio.hqJourney.active};});
    }
    assert.equal(stop.error,null);assert.equal(stop.depth,1);assert.equal(stop.active,false);assert.ok(stop.wallMs>=50000);assert.ok(stop.renderedCaptureFrames>100);assert.ok(fs.statSync(file).size>100000);recorded=true;
    report.video={path:filename,...capture,...stop,bytes:fs.statSync(file).size,segments};return report.video;
  });
  if(recorded)await check('Recorded video supports byte-range playback and decodes two different nonblank real frames',async()=>{
    const url=origin+'/'+path.relative(root,output).split(path.sep).join('/')+'/'+filename,response=await fetch(url,{headers:{Range:'bytes=0-63'}});assert.equal(response.status,206);assert.equal((await response.arrayBuffer()).byteLength,64);
    const decoded=await page.evaluate(async ({url,endTime})=>{
      const video=document.createElement('video');video.src=url;video.muted=true;video.preload='auto';document.body.append(video);await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=()=>reject(Error('Recorded WebM metadata decode failed'));});
      const seek=time=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Recorded WebM seek timed out')),15000);video.addEventListener('seeked',()=>{clearTimeout(timer);resolve();},{once:true});video.currentTime=time;});
      const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;const ctx=canvas.getContext('2d'),frames=[];
      for(const time of [3,24,endTime]){await seek(time);ctx.drawImage(video,0,0,160,90);const bytes=ctx.getImageData(0,0,160,90).data;let sum=0,hash=2166136261;for(let i=0;i<bytes.length;i+=4){sum+=(bytes[i]+bytes[i+1]+bytes[i+2])/3;hash=Math.imul(hash^bytes[i],16777619)>>>0;}frames.push({time:video.currentTime,luminance:sum/(160*90),hash});}
      const result={width:video.videoWidth,height:video.videoHeight,duration:Number.isFinite(video.duration)?video.duration:null,frames};video.remove();return result;
    },{url,endTime:report.video.wallMs/1000-.6});assert.equal(decoded.width,3440);assert.equal(decoded.height,1440);assert.ok(decoded.frames.every(f=>f.luminance>3));assert.ok(decoded.frames.at(-1).luminance>25,'The final recorded Interior must be visibly revealed, not just the covering fade');assert.notEqual(decoded.frames[0].hash,decoded.frames[1].hash);report.video.decode=decoded;return decoded;
  });
  await check('Movie capture has no browser, shader or asset errors',()=>{assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);});
});
