import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync,execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),output=path.resolve(process.env.V3_EVIDENCE_DIR||path.join(root,'docs/phase3-4/evidence'));
fs.mkdirSync(output,{recursive:true});
const summaryOnly=process.argv.includes('--summary'),suites=[],totals={PASS:0,FAIL:0,SKIP:0,PENDING:0};
const execute=(file,args=[],env={})=>{const r=spawnSync(process.execPath,[file,...args],{cwd:root,env:{...process.env,...env},encoding:'utf8',windowsHide:true});process.stdout.write((r.stdout||'')+(r.stderr||''));return r;};
if(!summaryOnly){
  execute('tests/v2/run.mjs',[],{V2_EVIDENCE_DIR:path.join(output,'regression')});
  const r=execute('--test',['--test-reporter=tap','tests/v3/facility.test.mjs','tests/v3/adapters.test.mjs','tests/v3/twin-core.test.mjs','tests/v3/security.test.mjs']);fs.writeFileSync(path.join(output,'domain-twin-security.tap'),(r.stdout||'')+(r.stderr||''));
  for(const file of ['hall-preview-browser.cjs','p3-browser.cjs','twin-browser.cjs','journey-browser.cjs','asset-lifecycle-browser.cjs','delivery-browser.cjs'])execute('tests/v3/'+file,[],{V2_EVIDENCE_DIR:output,V2_TEST_PORT:'4396'});
}
for(const [folder,name] of [['regression','domain-and-journey.tap'],['','domain-twin-security.tap']]){
  const file=path.join(output,folder,name);try{const data=fs.readFileSync(file,'utf8'),counts={PASS:+(data.match(/^# pass (\d+)/m)?.[1]||0),FAIL:+(data.match(/^# fail (\d+)/m)?.[1]||0),SKIP:+(data.match(/^# skipped (\d+)/m)?.[1]||0),PENDING:+(data.match(/^# todo (\d+)/m)?.[1]||0)};if(!data.includes('# tests'))counts.FAIL++;suites.push({suite:name,file:path.posix.join(folder,name),summary:counts});}catch(error){suites.push({suite:name,summary:{PASS:0,FAIL:1,SKIP:0,PENDING:0},error:error.message});}
}
for(const [folder,names] of [['regression',['phase1a-adapter','phase1b-configuration','phase2-navigation','integrated-quality','recovery-and-contracts','cinematic-playback','delivery-artifacts']],['',['phase3-hall-preview','phase3-integrated','phase4-integrated','phase34-journey','asset-lifecycle','phase34-delivery']]])for(const name of names){try{const report=JSON.parse(fs.readFileSync(path.join(output,folder,name+'.json'),'utf8')),summary=Object.fromEntries(Object.keys(totals).map(status=>[status,report.tests.filter(t=>t.status===status).length]));suites.push({suite:name,file:path.posix.join(folder,name+'.json'),date:report.date,summary});}catch(error){suites.push({suite:name,summary:{PASS:0,FAIL:1,SKIP:0,PENDING:0},error:error.message});}}
for(const suite of suites)for(const status of Object.keys(totals))totals[status]+=suite.summary[status];
const files=[];function walk(relative){const absolute=path.join(root,relative);if(fs.statSync(absolute).isDirectory()){for(const name of fs.readdirSync(absolute).sort())walk(path.posix.join(relative,name));}else{const bytes=fs.readFileSync(absolute),data=/\.(js|mjs|cjs|css|html|json)$/.test(relative)?Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n')):bytes;files.push({path:relative,sha256:crypto.createHash('sha256').update(data).digest('hex'),bytes:bytes.length});}}
for(const name of ['package.json','package-lock.json','app.js','index.html','styles.css','v2.css','v3.css','server.mjs','modules','data','tests/v2','tests/v3','vendor/pa-cycle','assets/pa','assets/environment','assets/cooling-assembly.glb','docs/phase3-4/VISUAL-COMPARISON.html'])walk(name);
const summary={date:new Date().toISOString(),runtime:process.version,platform:process.platform,baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),suites,totals,sourceDigest:crypto.createHash('sha256').update(JSON.stringify(files.map(f=>[f.path,f.sha256]))).digest('hex'),hashNote:'LF-normalized text and exact binary assets. baseCommit is pre-delivery parent. Summary mode collects retained executed reports; it does not execute tests. PENDING and SKIP are never counted as PASS.'};
fs.writeFileSync(path.join(output,'tested-source-manifest.json'),JSON.stringify(files,null,2));fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(summary,null,2));console.log('TOTAL',JSON.stringify(totals));if(totals.FAIL)process.exitCode=1;
