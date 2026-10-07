import assert from 'node:assert/strict';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { _electron as electron, expect } from '@playwright/test';

const executable = process.env.CPC_PACKAGED_EXECUTABLE;
if (!executable) throw new Error('CPC_PACKAGED_EXECUTABLE requis.');
const path = resolve(executable);
const temporary = await mkdtemp(join(tmpdir(), 'cpceleste-packaged-'));
const profile = join(temporary, 'profile');
await mkdir(profile, { recursive: true });
const env = { ...process.env, ELECTRON_ENABLE_LOGGING: '1' };
if (process.platform === 'win32') env.APPDATA = profile;
else env.XDG_CONFIG_HOME = profile;

const desktop = await electron.launch({
  executablePath: path,
  args: process.platform === 'linux' ? ['--no-sandbox'] : [],
  timeout: 30000,
  env,
});
const stderr = [];
desktop.process().stderr?.on('data', chunk => { if (stderr.length < 50) stderr.push(String(chunk)); });

try {
  const page = await desktop.firstWindow({ timeout: 30000 });
  const errors = [], consoleLines = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (consoleLines.length < 50) consoleLines.push(message.text()); });
  try {
    await page.getByRole('heading', { name: 'CPCéleste', exact: true }).waitFor({ timeout: 20000 });
    await expect(page).toHaveTitle('CPCéleste — Atelier Amstrad CPC');
    assert.equal(page.url(), 'cpceleste://app/index.html');
    await expect.poll(() => page.locator('.brand-mark').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    await page.locator('.monaco-editor .view-line').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(500);
    assert.deepEqual(errors, []);
    console.log('Packaged CPCéleste booted with renderer, brand assets and Monaco.');
  } catch (error) {
    console.error(JSON.stringify({
      url: page.url(),
      title: await page.title().catch(() => ''),
      body: (await page.locator('body').innerText().catch(() => '')).slice(0, 3000),
      pageErrors: errors,
      console: consoleLines,
      stderr: stderr.join('').slice(-6000),
    }, null, 2));
    throw error;
  }
} finally {
  await desktop.close();
}
