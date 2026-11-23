// Presentation quality only. Never mutates the equipment catalog or PA shaders.
export const QUALITY_PROFILES=Object.freeze({
  ultra:{pixelRatio:2,shadow:4096,ao:true,samples:4,environment:'hdr',vegetation:'ultra'},
  high:{pixelRatio:1.5,shadow:2048,ao:true,samples:2,environment:'hdr',vegetation:'high'},
  medium:{pixelRatio:1,shadow:1024,ao:false,samples:0,environment:'hdr',vegetation:'medium'},
  low:{pixelRatio:.75,shadow:512,ao:false,samples:0,environment:'fallback',vegetation:'low'}
});
const order=['low','medium','high','ultra'];
export class QualityGovernor{
  constructor({apply,onChange=()=>{},now=()=>performance.now()}){Object.assign(this,{apply,onChange,now});this.mode='auto';this.level='high';this.frames=[];this.bad=0;this.good=0;this.lastChange=now();this.lastSample=now();this.applyLevel('high');}
  set(mode){if(mode!=='auto'&&!QUALITY_PROFILES[mode])throw Error('Unknown quality profile');this.mode=mode;this.frames=[];this.bad=this.good=0;this.lastChange=this.now();if(mode!=='auto')this.applyLevel(mode);else this.onChange(this.snapshot());}
  applyLevel(level){this.level=level;this.apply(QUALITY_PROFILES[level],level);this.onChange(this.snapshot());}
  update(ms,{visible=true,busy=false}={}){
    if(this.mode!=='auto'||!visible||busy||!Number.isFinite(ms)||ms<1)return;
    this.frames.push(Math.min(250,ms));if(this.frames.length>240)this.frames.shift();const now=this.now();
    if(now-this.lastSample<4000||this.frames.length<90)return;this.lastSample=now;
    const sorted=[...this.frames].sort((a,b)=>a-b),p95=sorted[Math.floor(sorted.length*.95)];this.p95=p95;
    this.bad=p95>24?this.bad+1:0;this.good=p95<17.7?this.good+1:0;
    const index=order.indexOf(this.level);if(now-this.lastChange>=16000&&(this.bad>=2&&index>0||this.good>=5&&index<3)){
      this.applyLevel(order[index+(this.bad>=2?-1:1)]);this.lastChange=now;this.bad=this.good=0;this.frames=[];
    }
  }
  snapshot(){return{mode:this.mode,level:this.level,p95:this.p95??null,profile:{...QUALITY_PROFILES[this.level]}};}
}
