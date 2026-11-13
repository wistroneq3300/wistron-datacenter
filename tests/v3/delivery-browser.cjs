process.env.V2_EVIDENCE_DIR||='docs/phase3-4/evidence';process.env.V2_TEST_PORT||='4396';
const assert=require('node:assert/strict'),path=require('node:path');const {browserRun}=require('../v2/harness.cjs');
browserRun('phase34-delivery',async({page,check,report,origin,output})=>{
  await page.goto(origin+'/docs/phase3-4/VISUAL-COMPARISON.html');
  await check('P3/P4 gallery decodes actual HQ / Hall / PA comparison and monitoring evidence',async()=>{
    for(const image of await page.locator('img').all()){await image.scrollIntoViewIfNeeded();await image.evaluate(img=>img.decode());}
    const images=await page.locator('img').evaluateAll(imgs=>imgs.map(i=>({path:i.getAttribute('src'),width:i.naturalWidth,height:i.naturalHeight})));
    assert.ok(images.length>=20);assert.ok(images.every(i=>i.width>=1000&&i.height>=500));assert.ok(images.filter(i=>i.path.includes('hq-')).every(i=>i.width===3440&&i.height===1440));
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(output,'visual-gallery-3440x1440.png')});return images;
  });
  await check('Both real recordings support byte-range playback and decode nonblank moving frames',async()=>{
    const movies=[];for(const video of await page.locator('video').all()){
      const src=await video.evaluate(v=>v.getAttribute('src')||v.querySelector('source').getAttribute('src')),url=new URL(src,page.url()).href,response=await fetch(url,{headers:{Range:'bytes=0-63'}});assert.equal(response.status,206);assert.equal((await response.arrayBuffer()).byteLength,64);
      await video.scrollIntoViewIfNeeded();const movie=await video.evaluate(async v=>{v.load();if(v.readyState<1)await new Promise(resolve=>v.addEventListener('loadedmetadata',resolve,{once:true}));v.muted=true;await new Promise(resolve=>{v.addEventListener('seeked',resolve,{once:true});v.currentTime=10;});await v.play();await new Promise(r=>setTimeout(r,200));v.pause();const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;const ctx=c.getContext('2d');ctx.drawImage(v,0,0);const p=ctx.getImageData(0,0,c.width,c.height).data;let sum=0;for(let i=0;i<p.length;i+=16)sum+=(p[i]+p[i+1]+p[i+2])/3;return{duration:v.duration,width:v.videoWidth,height:v.videoHeight,decodedTime:v.currentTime,meanLuminance:sum/(p.length/16)};});
      assert.ok(movie.duration>20&&movie.decodedTime>10&&movie.meanLuminance>3);assert.equal(movie.width,1720);assert.equal(movie.height,720);movies.push({src,...movie});
    }assert.equal(movies.length,2);assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);return movies;
  });
});
