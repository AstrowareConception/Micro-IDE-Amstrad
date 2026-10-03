// Browser transport proof with our original synthetic ROM. No BASIC boot claim.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const server = spawn(process.execPath, ['scripts/serve-harness.mjs', '6130'], { stdio: ['ignore', 'pipe', 'inherit'] });
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.once('data', resolve); server.once('error', reject);
    server.once('exit', code => reject(new Error('Server exited ' + code)));
  });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto('http://127.0.0.1:6130');
  assert.equal(response.status(), 200);
  assert.match(response.headers()['content-security-policy'], /frame-ancestors 'none'/);
  await page.waitForFunction(() => document.getElementById('status').textContent.includes('Module prêt'));
  await page.locator('#start').click();
  await page.waitForFunction(() => document.getElementById('status').textContent.includes('16384 octets'));
  const rom = Buffer.alloc(16384); rom[0] = 0xc3;
  for (const id of ['os', 'basic', 'amsdos']) await page.locator('#' + id).setInputFiles({ name: id + '.rom', mimeType: 'application/octet-stream', buffer: rom });
  await page.locator('#disk').setInputFiles({ name: 'hello.dsk', mimeType: 'application/octet-stream', buffer: await readFile('out/hello.dsk') });
  await page.locator('#start').click();
  await page.waitForFunction(() => {
    try { return JSON.parse(document.getElementById('observations').textContent).emulatedSeconds > .1; } catch { return false; }
  });
  assert.equal(await page.locator('#type').isDisabled(), true);
  await page.locator('#pause').click();
  await page.waitForFunction(() => JSON.parse(document.getElementById('observations').textContent).paused === true);
  const ticks = JSON.parse(await page.locator('#observations').textContent()).emulatedSeconds;
  await page.waitForTimeout(600);
  assert.equal(JSON.parse(await page.locator('#observations').textContent()).emulatedSeconds, ticks);
  const downloadPromise = page.waitForEvent('download'); await page.locator('#export').click();
  const download = await downloadPromise;
  assert.deepEqual(await readFile(await download.path()), await readFile('out/hello.dsk'));
  await page.locator('#reset').click(); assert.equal(await page.locator('#type').isDisabled(), true);
  const forbidden = await page.request.get('/package.json'); assert.equal(forbidden.status(), 404);
  await page.screenshot({ path: 'out/j0-harness.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'passed', runtime: 'chromium-wasm', firmware: 'synthetic JP 0',
    pauseVerified: true, diskExportVerified: true, cpcBootTested: false }));
} finally { if (browser) await browser.close(); server.kill(); }
