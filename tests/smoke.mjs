import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const port = 4387;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore',
});
let browser;
const errors = [];
const failedRequests = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if ((await fetch(origin)).ok) { ready = true; break; }
    } catch {}
    await sleep(100);
  }
  assert.ok(ready, 'Preview server did not start');

  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`));
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__WISTRON_STUDIO__ && !document.getElementById('loading'));
  assert.equal(await page.evaluate(() => window.__WISTRON_STUDIO__.currentView), 'hall');

  for (const view of ['hq', 'cutaway', 'row', 'hall']) {
    await page.locator(`[data-view="${view}"]`).click();
    await page.waitForFunction(expected => window.__WISTRON_STUDIO__.currentView === expected, view);
  }
  console.log('PASS: hall, headquarters, cutaway, and rack-row views');

  await page.evaluate(() => window.__WISTRON_STUDIO__.selectRack('R01', false));
  await page.locator('#renameRack').fill('R01_TEST');
  await page.locator('#renameRack').press('Tab');
  await page.locator('#rackPurpose').fill('Compute validation');
  await page.locator('#rackPurpose').press('Tab');
  assert.equal(await page.evaluate(() => window.__WISTRON_STUDIO__.racks[0].id), 'R01_TEST');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__WISTRON_STUDIO__);
  assert.equal(await page.evaluate(() => window.__WISTRON_STUDIO__.racks[0].purpose), 'Compute validation');
  await page.locator('#addRackBtn').click();
  assert.equal(await page.evaluate(() => window.__WISTRON_STUDIO__.racks.length), 9);
  console.log('PASS: rack selection, editing, persistence, and adding a rack');

  await page.evaluate(() => window.__WISTRON_STUDIO__.selectRack('R01_TEST', false));
  await page.locator('#deviceView').click();
  await page.waitForFunction(() => document.getElementById('devicePlaceholder').classList.contains('done'), { timeout: 60000 });
  await page.locator('#loadBoard').click();
  await page.waitForFunction(() => document.getElementById('devicePlaceholder').classList.contains('done'), { timeout: 60000 });
  await page.locator('#closeDevice').click();
  assert.ok(await page.locator('#deviceModal').evaluate(element => element.hidden));
  console.log('PASS: cooling and compute-board GLB assets');

  await page.locator('#networkBtn').click();
  await page.locator('[data-flow="cooling"]').click();
  assert.equal(await page.evaluate(() => window.__WISTRON_STUDIO__.flowMode), 'cooling');
  await page.locator('#explodeBtn').click();
  assert.equal(await page.evaluate(() => window.__WISTRON_STUDIO__.exploded), true);
  console.log('PASS: conceptual flow overlays and exploded rack row');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#configBtn').click();
  await page.locator('#exportConfig').click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'wistron-data-center-config.json');
  await page.screenshot({ path: 'previews/configuration.png' });
  await page.locator('[data-close="configDialog"]').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#configBtn').click();
  const bounds = await page.locator('#configDialog').boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, 'Configuration dialog fits mobile viewport');
  console.log('PASS: JSON export and mobile configuration dialog');

  assert.deepEqual(errors, [], `Browser errors: ${errors.join('; ')}`);
  assert.deepEqual(failedRequests, [], `Failed requests: ${failedRequests.join('; ')}`);
  console.log('PASS: no uncaught browser errors or failed asset requests');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
