/** Real browser/local gateway integration; provider calls are mocked, never paid. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createStudyServers } from './server.mjs';

const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { chromium } = require('playwright');
test('configured BYOK tutor works through real browser session and CSRF with no exposed key', async () => {
  const calls = [];
  const env = { TUTOR_ANTHROPIC_KEY: 'synthetic-browser-test-key', TUTOR_MODEL: 'synthetic-test-model' };
  const app = await createStudyServers({
    webRoot: new URL('../release/devnet-studylab-1.0.0/web/', import.meta.url),
    runnerRoot: new URL('../release/devnet-studylab-1.0.0/runner/', import.meta.url),
    port: 0, runnerPort: 0, env, logger() {},
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return Response.json({ content: [{ type: 'text', text: 'A REST API exposes resources through HTTP methods. This is a simulated provider reply.' }] });
    },
  });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
    const page = await browser.newPage();
    const sent = [], errors = [];
    page.on('request', request => sent.push(request.postData() || ''));
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(app.origin + '/dashboard/tutor/');
    await page.getByRole('textbox', { name: 'Message to AI tutor' }).fill('Explain REST.');
    await page.getByRole('button', { name: 'Send message' }).click();
    await page.getByText(/This is a simulated provider reply/).waitFor();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
    assert.equal(calls[0].options.headers['x-api-key'], env.TUTOR_ANTHROPIC_KEY);
    assert.ok(!JSON.stringify(sent).includes(env.TUTOR_ANTHROPIC_KEY));
    assert.ok(!(await page.content()).includes(env.TUTOR_ANTHROPIC_KEY));
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    assert.ok(!stored.includes(env.TUTOR_ANTHROPIC_KEY));
    assert.ok(!stored.includes('simulated provider reply'));
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await app.close(); }
});
