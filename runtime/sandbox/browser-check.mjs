/** Real Chromium boundary checks against the production HTTP runtime. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createStudyServers } from '../server.mjs';

const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { chromium } = require('playwright');
const CLIENT = `const frame=document.querySelector('iframe');const origin='http://127.0.0.1:4319';const pending=new Map();window.ready=false;
addEventListener('message',e=>{if(e.origin!==origin||e.source!==frame.contentWindow||e.data?.v!==1)return;const d=e.data;if(d.type==='ready'){ready=true;return;}const p=pending.get(d.id);if(!p)return;p.events.push(d);if(d.status==='running'&&p.cancelAfter!=null)setTimeout(()=>frame.contentWindow.postMessage({v:1,type:'cancel',id:d.id},origin),p.cancelAfter);if(d.type==='status'&&!['loading','running'].includes(d.status)){pending.delete(d.id);p.resolve(p.events);}});
window.run=(code,cancelAfter=null)=>new Promise(resolve=>{const id=crypto.randomUUID();pending.set(id,{resolve,events:[],cancelAfter});frame.contentWindow.postMessage({v:1,type:'run',id,code},origin);});
localStorage.setItem('study-private-marker','private-marker');`;

test('offline Python, origin/network/worker isolation, timeout, cancellation and fresh recovery', { timeout: 90_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'studylab-browser-boundary-'));
  let servers, browser;
  try {
    const webRoot = join(root, 'web'), runnerRoot = join(root, 'runner');
    await mkdir(webRoot); await mkdir(runnerRoot);
    await writeFile(join(webRoot, 'index.html'), '<!doctype html><html><head><script src="/client.js" defer></script></head><body><iframe sandbox="allow-scripts allow-same-origin" src="http://127.0.0.1:4319/"></iframe></body></html>');
    await writeFile(join(webRoot, 'client.js'), CLIENT);
    await writeFile(join(webRoot, 'private.json'), '{"private":"not for Python"}');
    for (const file of ['index.html', 'frame.mjs', 'controller.mjs', 'worker.mjs']) await cp(new URL(file, import.meta.url), join(runnerRoot, file));
    await cp(new URL('../vendor/pyodide/', import.meta.url), join(runnerRoot, 'assets'), { recursive: true });
    // A successful nested Worker would request this file; it must never be fetched.
    await writeFile(join(runnerRoot, 'nested.mjs'), 'postMessage("nested worker escaped")');
    servers = await createStudyServers({ webRoot, runnerRoot, env: {}, logger() {} });
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const forbiddenRequests = [];
    context.on('request', request => {
      const url = request.url();
      if (url.endsWith('/private.json') || url.endsWith('/nested.mjs') || !url.startsWith('http://127.0.0.1:431')) forbiddenRequests.push(url);
    });
    // Fail the test on attempted outbound requests; also prevent external traffic
    // if a future CSP regression makes such requests possible.
    await context.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:431') ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(servers.origin); await page.waitForFunction(() => window.ready);
    const run = (code, cancelAfter = null) => page.evaluate(({ code, cancelAfter }) => window.run(code, cancelAfter), { code, cancelAfter });
    const text = events => events.filter(e => e.type === 'output').map(e => e.text).join('');
    const final = events => events.at(-1).status;

    const sample = await run("import json, yaml\nfrom jinja2 import Template\nprint(Template('Hello {{ name }}').render(**yaml.safe_load('name: learner')))\nprint(json.dumps({'sum': sum(range(10))}))");
    assert.equal(final(sample), 'done'); assert.match(text(sample), /Hello learner/); assert.match(text(sample), /\"sum\": 45/);
    const boundary = await run("import js, asyncio\nprint('DOM',hasattr(js,'document'))\nprint('STORAGE',hasattr(js,'localStorage'))\nfor url in ['http://127.0.0.1:4318/private.json','https://example.com/']:\n try:\n  await js.fetch(url)\n  print('UNEXPECTED FETCH')\n except Exception:\n  print('BLOCKED FETCH')\ntry:\n w=js.Worker.new('/nested.mjs')\n await asyncio.sleep(0.2)\nexcept Exception:\n print('BLOCKED NESTED')\ntry:\n open('/etc/passwd').read()\n print('UNEXPECTED HOST FILE')\nexcept OSError:\n print('NO HOST FILE')");
    assert.equal(final(boundary), 'done'); assert.match(text(boundary), /DOM False/); assert.match(text(boundary), /STORAGE False/);
    assert.equal((text(boundary).match(/BLOCKED FETCH/g) ?? []).length, 2);
    assert.match(text(boundary), /NO HOST FILE/); assert.doesNotMatch(text(boundary), /UNEXPECTED/);
    assert.deepEqual(forbiddenRequests, []);
    assert.equal(final(await run('while True: pass', 100)), 'cancelled');
    assert.equal(final(await run('while True: pass')), 'timeout');
    assert.equal(final(await run("print('x' * 70000)")), 'output-limit');
    assert.equal(final(await run('raise ValueError("learner error")')), 'error');
    assert.match(text(await run("print('fresh worker recovered')")), /fresh worker recovered/);
    const labFiles = ['python-data-parsing', 'ansible-network', 'docker-basics', 'git-basics', 'netconf-basics'];
    for (const slug of labFiles) {
      const lab = JSON.parse(await readFile(new URL(`../../content/labs/${slug}.json`, import.meta.url), 'utf8'));
      assert.equal(typeof lab.solutionCode, 'string', `${slug}: solution is present`);
      const result = await run(lab.solutionCode);
      assert.equal(final(result), 'done', `${slug}: ${result.at(-1).message ?? ''}`);
      assert.ok(text(result).length > 0, `${slug}: solution produced learner output`);
    }
    assert.deepEqual(forbiddenRequests, []);
  } finally {
    await browser?.close(); await servers?.close(); await rm(root, { recursive: true, force: true });
  }
});
