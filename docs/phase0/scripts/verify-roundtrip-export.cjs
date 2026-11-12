const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.PHASE0_PLAYWRIGHT_MODULE || '@playwright/test');
const root = path.resolve(__dirname, '../../..');
const output = path.resolve(process.env.PHASE0_EVIDENCE_DIR || path.join(root, 'docs/phase0/evidence'));
fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: '4389' }, stdio: 'ignore', windowsHide: true });
const result = { date: new Date().toISOString(), scope: 'Unchanged baseline; synthetic sparse fixture; actual UI download and re-upload', errors: [] };
let browser;
async function main() {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch('http://127.0.0.1:4389')).ok) break; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.on('pageerror', e => result.errors.push(e.message));
  await page.goto('http://127.0.0.1:4389', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__WISTRON_STUDIO__ && !document.getElementById('loading'));
  const fixture = { version: 1, racks: [{ id: 'R09', name: 'Phase 0 synthetic fixture', purpose: 'Review only', position: 9 }] };
  await page.locator('#configBtn').click();
  await page.locator('#importConfig').setInputFiles({ name: 'sparse.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.locator('#addRackBtn').click();
  await page.locator('#configBtn').click();
  const downloadPending = page.waitForEvent('download');
  await page.locator('#exportConfig').click();
  const download = await downloadPending;
  const saved = path.join(output, 'exported-sparse-fixture.json');
  await download.saveAs(saved);
  result.downloadName = download.suggestedFilename();
  result.exportedDocument = JSON.parse(fs.readFileSync(saved, 'utf8'));
  await page.locator('#importConfig').setInputFiles(saved);
  result.reimportMessage = await page.locator('#toast').textContent();
  assert.ok(result.exportedDocument.racks.some(r => r.position === 10));
  assert.match(result.reimportMessage, /匯入失敗/);
  assert.deepEqual(result.errors, []);
  result.bugReproduced = true;
}
main().catch(e => { result.failure = e.stack; process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  server.kill();
  fs.writeFileSync(path.join(output, 'export-roundtrip.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
});
