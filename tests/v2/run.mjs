import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync,execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),output=path.resolve(process.env.V2_EVIDENCE_DIR||path.join(root,'docs/phase1-2/evidence'));fs.mkdirSync(output,{recursive:true});
const summary={date:new Date().toISOString(),runtime:process.version,platform:process.platform,baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),suites:[],totals:{PASS:0,FAIL:0,SKIP:0}};
const summaryOnly=process.argv.includes('--summary');
if(!process.argv.includes('--browser')){
  const r=summaryOnly?{status:0,stdout:fs.readFileSync(path.join(output,'domain-and-journey.tap'),'utf8'),stderr:''}:spawnSync(process.execPath,['--test','--test-reporter=tap','tests/v2/domain.test.mjs','tests/v2/journey.test.mjs'],{cwd:root,encoding:'utf8',windowsHide:true});const outputText=r.stdout+r.stderr;if(!summaryOnly)process.stdout.write(outputText);fs.writeFileSync(path.join(output,'domain-and-journey.tap'),outputText);const counts={PASS:+(outputText.match(/^# pass (\d+)/m)?.[1]||0),FAIL:+(outputText.match(/^# fail (\d+)/m)?.[1]||0),SKIP:+(outputText.match(/^# skipped (\d+)/m)?.[1]||0)};if(r.status!==0&&!counts.FAIL)counts.FAIL=1;summary.suites.push({suite:'domain-and-journey',summary:counts});
}
for(const [file,suite] of [['adapter-browser.cjs','phase1a-adapter'],['config-browser.cjs','phase1b-configuration'],['navigation-browser.cjs','phase2-navigation'],['quality-browser.cjs','integrated-quality'],['recovery-browser.cjs','recovery-and-contracts'],['cinematic-browser.cjs','cinematic-playback'],['delivery-browser.cjs','delivery-artifacts']]){
  const r=summaryOnly?{status:0,stdout:'',stderr:''}:spawnSync(process.execPath,['tests/v2/'+file],{cwd:root,env:{...process.env,V2_EVIDENCE_DIR:output},encoding:'utf8',windowsHide:true});process.stdout.write(r.stdout+r.stderr);const p=path.join(output,suite+'.json');let counts={PASS:0,FAIL:1,SKIP:0};if(fs.existsSync(p)){const report=JSON.parse(fs.readFileSync(p,'utf8'));counts=report.summary;}if(r.status!==0&&!counts.FAIL)counts.FAIL=1;summary.suites.push({suite,summary:counts});
}
for(const suite of summary.suites)for(const key of ['PASS','FAIL','SKIP'])summary.totals[key]+=suite.summary[key];
const files=[];function walk(relative){const absolute=path.join(root,relative);if(fs.statSync(absolute).isDirectory()){for(const name of fs.readdirSync(absolute).sort())walk(path.posix.join(relative,name));}else{const bytes=fs.readFileSync(absolute);const data=/\.(js|mjs|cjs|css|html|json)$/.test(relative)?Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n')):bytes;files.push({path:relative,sha256:crypto.createHash('sha256').update(data).digest('hex'),bytes:bytes.length});}}
for(const file of ['app.js','index.html','styles.css','v2.css','server.mjs','modules','data','tests/v2','vendor/pa-cycle','assets/pa','assets/cooling-assembly.glb'])walk(file);
summary.sourceDigest=crypto.createHash('sha256').update(JSON.stringify(files.map(f=>[f.path,f.sha256]))).digest('hex');summary.hashNote='Text line endings normalized to LF; binary assets exact. baseCommit is the pre-delivery parent, not a claim that uncommitted files were already committed.';
fs.writeFileSync(path.join(output,'tested-source-manifest.json'),JSON.stringify(files,null,2));fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(summary,null,2));console.log('TOTAL',JSON.stringify(summary.totals));if(summary.totals.FAIL)process.exitCode=1;
