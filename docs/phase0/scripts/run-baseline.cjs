const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root=path.resolve(__dirname,'../../..');
const evidence=path.resolve(process.env.PHASE0_EVIDENCE_DIR || path.join(root,'docs/phase0/evidence'));fs.mkdirSync(evidence,{recursive:true});
const {pathToFileURL}=require('node:url');
const runtime=pathToFileURL(require.resolve(process.env.PHASE0_PLAYWRIGHT_MODULE || '@playwright/test')).href;
let source=fs.readFileSync(path.join(root,'tests/smoke.mjs'),'utf8');
source=source.replace("import { chromium } from '@playwright/test';",`import playwright from '${runtime}';\nconst { chromium } = playwright;`)
 .replace("new URL('..', import.meta.url)","new URL('../../../', import.meta.url)")
 .replace("'previews/configuration.png'",JSON.stringify(path.join(evidence,'baseline-configuration.png')));
const file=path.join(__dirname,'baseline-smoke-adapted.mjs');fs.writeFileSync(file,source);
source=source.replace("headless: true, args:","headless: true, channel: 'chrome', args:");fs.writeFileSync(file,source);
const result=spawnSync(process.execPath,[file],{cwd:root,encoding:'utf8'});
fs.writeFileSync(path.join(evidence,'baseline-smoke.log'),`Source: tests/smoke.mjs, application unchanged.\nHarness adaptations: bundled Playwright import, server cwd, screenshot output path, installed Chrome channel.\n${result.stdout}\n${result.stderr}\nexit=${result.status}\n`);
fs.unlinkSync(file);
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');process.exitCode=result.status||0;
