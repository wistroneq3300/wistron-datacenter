import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.join(root,'docs/phase5a/evidence');
fs.mkdirSync(out,{recursive:true});const summaryOnly=process.argv.includes('--summary');
const run=(args,env={})=>{const r=spawnSync(process.execPath,args,{cwd:root,env:{...process.env,...env},encoding:'utf8',windowsHide:true});process.stdout.write((r.stdout||'')+(r.stderr||''));return r;};
if(!summaryOnly){
  const r=run(['--test','--test-reporter=tap','tests/v5/architecture.test.mjs','tests/v5/vegetation.test.mjs','tests/v5/hq-journey.test.mjs']);fs.writeFileSync(path.join(out,'phase5a-unit.tap'),(r.stdout||'')+(r.stderr||''));
  run(['tests/v5/hq-browser.cjs']);run(['tests/v5/movie.cjs']);
  run(['tests/v3/run.mjs'],{V3_EVIDENCE_DIR:path.join(out,'regression')});
}
const totals={PASS:0,FAIL:0,SKIP:0,PENDING:0},suites=[];
try{const tap=fs.readFileSync(path.join(out,'phase5a-unit.tap'),'utf8');const summary={PASS:+(tap.match(/^# pass (\d+)/m)?.[1]||0),FAIL:+(tap.match(/^# fail (\d+)/m)?.[1]||0),SKIP:+(tap.match(/^# skipped (\d+)/m)?.[1]||0),PENDING:+(tap.match(/^# todo (\d+)/m)?.[1]||0)};if(!tap.includes('# tests'))summary.FAIL++;suites.push({suite:'phase5a-unit',summary});}catch(e){suites.push({suite:'phase5a-unit',summary:{FAIL:1},error:e.message});}
for(const name of ['phase5a-hq','phase5a-movie'])try{const r=JSON.parse(fs.readFileSync(path.join(out,name+'.json')));suites.push({suite:name,date:r.date,summary:r.summary});}catch(e){suites.push({suite:name,summary:{FAIL:1},error:e.message});}
try{const r=JSON.parse(fs.readFileSync(path.join(out,'regression/summary.json')));suites.push({suite:'P1-P4 regression',date:r.date,summary:r.totals});}catch(e){suites.push({suite:'P1-P4 regression',summary:{FAIL:1},error:e.message});}
for(const s of suites)for(const k of Object.keys(totals))totals[k]+=s.summary[k]||0;
const files=[];const walk=relative=>{const file=path.join(root,relative);if(fs.statSync(file).isDirectory())for(const name of fs.readdirSync(file).sort())walk(path.posix.join(relative,name));else{const raw=fs.readFileSync(file),data=/\.(js|mjs|cjs|css|html|json)$/.test(relative)?Buffer.from(raw.toString('utf8').replace(/\r\n/g,'\n')):raw;files.push({path:relative,bytes:raw.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});}};
for(const file of ['app.js','index.html','styles.css','v2.css','v3.css','v5.css','server.mjs','modules','tests/v5','assets/environment','vendor/hq5'])walk(file);
fs.writeFileSync(path.join(out,'tested-source-manifest.json'),JSON.stringify(files,null,2));
const result={date:new Date().toISOString(),baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),runtime:process.version,platform:process.platform,suites,totals,sourceDigest:crypto.createHash('sha256').update(JSON.stringify(files.map(f=>[f.path,f.sha256]))).digest('hex'),note:'Executed final suite results only. First failed attempt retained separately, not reclassified as PASS. Summary mode aggregates stored evidence; it executes no tests. LF-normalized source hashes; exact binary hashes. GPU byte allocation is unavailable, not zero.'};
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(result,null,2));console.log('PHASE5A TOTAL',JSON.stringify(totals));if(totals.FAIL)process.exitCode=1;
