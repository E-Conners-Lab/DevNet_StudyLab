import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { request as httpRequest } from 'node:http';
import { createHash } from 'node:crypto';
import { createStudyServers } from '../server.mjs';
import { serveStatic } from '../static.mjs';

test('style CSP hashes decode HTML entities once without changing served markup', async t => {
 const root=await mkdtemp(path.join(tmpdir(),'studylab-style-entities-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const file=path.join(root,'index.html');
 const encoded='font-family:&amp;lt;&amp;gt;&amp;#x27;&amp;quot; &quot;quoted&quot; &lt;&gt;&#x27;';
 const decoded='font-family:&lt;&gt;&#x27;&quot; "quoted" <>\'';
 const html=`<html><head></head><body><span style="${encoded}">Study</span></body></html>`;
 await writeFile(file,html);
 const headers=new Map();let body;
 const res={setHeader:(key,value)=>headers.set(key,value),writeHead:()=>{},end:value=>{body=value.toString();}};
 await serveStatic({method:'GET',url:'/'},res,{files:new Map([['/index.html',file]]),runnerOrigin:'http://127.0.0.1:4319'});
 const expected=createHash('sha256').update(decoded).digest('base64');
 assert.ok(headers.get('Content-Security-Policy').includes(`'sha256-${expected}'`));
 assert.ok(body.includes(`style="${encoded}"`));
});

async function fixture(t, options = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'studylab-server-'));
  await mkdir(path.join(root, 'web'));
  await mkdir(path.join(root, 'runner'));
  await writeFile(path.join(root, 'web', 'index.html'), '<!doctype html><html><head><link rel="preload" as="script" href="/app.js"><style>.scroll{display:block}</style></head><body><script>window.ok=true</script>Study</body></html>');
  await writeFile(path.join(root, 'web', 'app.js'), 'console.log("study")');
  await writeFile(path.join(root, 'runner', 'index.html'), '<!doctype html><html><head></head><body>Runner</body></html>');
  await writeFile(path.join(root, 'runner', 'worker.mjs'), 'self.onmessage=()=>{}');
  await writeFile(path.join(root, 'secret.txt'), 'not public');
  const calls = [];
  const app = await createStudyServers({ webRoot: path.join(root,'web'), runnerRoot: path.join(root,'runner'), port: 0, runnerPort: 0,
    env: { TUTOR_ANTHROPIC_KEY: 'test-not-a-real-key', TUTOR_MODEL: 'test-model' },
    fetchImpl: async (...args) => { calls.push(args); return Response.json({ content: [{type:'text',text:'Test explanation'}] }); },
    logger: () => {}, ...options });
  t.after(() => app.close());
  const session = await fetch(app.origin+'/api/v1/session');
  const cookie = session.headers.get('set-cookie')?.split(';')[0];
  const data = await session.json();
  const headers = { Origin: app.origin, Cookie: cookie, 'X-CSRF-Token': data.csrfToken, 'Content-Type': 'application/json' };
  return {...app, calls, headers, session, data};
}
const prompt = { messages: [{role:'user', content:'Explain REST'}], domain:'apis' };

test('serves only intended static files with security headers and fresh script nonces', async t => {
 const a=await fixture(t); const r=await fetch(a.origin); assert.equal(r.status,200);
 assert.equal(r.headers.get('x-frame-options'),'DENY'); assert.equal(r.headers.get('x-content-type-options'),'nosniff');
 const body=await r.text(); assert.match(body, /<script nonce="[A-Za-z0-9+/=]+">/);
 assert.match(body, /<link nonce="[A-Za-z0-9+/=]+" rel="preload"/);
 assert.match(r.headers.get('content-security-policy'),/default-src 'none'/);
 assert.equal((await fetch(a.origin+'/secret.txt')).status,404);
 assert.equal((await fetch(a.origin+'/%2e%2e%2fsecret.txt')).status,400);
 assert.equal((await fetch(a.origin+'/app.js')).headers.get('content-type'),'text/javascript; charset=utf-8');
 assert.equal((await fetch(a.origin+'/app.js',{method:'POST'})).status,405);
 const status=await new Promise((resolve,reject)=>{const req=httpRequest(a.origin,{headers:{Host:'evil.invalid'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});
 assert.equal(status,403);
});
test('runner exposes no API or study state and blocks network/child workers', async t=>{
 const a=await fixture(t); assert.equal((await fetch(a.runnerOrigin+'/api/v1/session')).status,404);
 const r=await fetch(a.runnerOrigin+'/worker.mjs'); assert.match(r.headers.get('content-security-policy'),/connect-src 'self'/);
 assert.match(r.headers.get('content-security-policy'),/worker-src 'none'/);
 assert.equal(r.headers.get('access-control-allow-origin'),null);
});
test('session has HTTP-only strict cookie, no secret, and API version',async t=>{
 const a=await fixture(t); assert.match(a.session.headers.get('set-cookie'),/HttpOnly/);assert.match(a.session.headers.get('set-cookie'),/SameSite=Strict/);
 assert.equal(a.session.headers.get('x-api-version'),'1'); assert.equal(a.data.aiConfigured,true);
 assert.ok(!JSON.stringify(a.data).includes('test-not-a-real-key'));
 assert.equal((await fetch(a.origin+'/api/v1/session',{headers:{Origin:'https://evil.invalid'}})).status,403);
});
test('rejects cross-site, absent sessions, CSRF mismatch and non-JSON before spending', async t=>{
 const a=await fixture(t);
 for(const headers of [{...a.headers,Origin:'https://evil.invalid'},{...a.headers,Cookie:''},{...a.headers,'X-CSRF-Token':'wrong'},{...a.headers,'Sec-Fetch-Site':'cross-site'}]){
 const r=await fetch(a.origin+'/api/v1/tutor',{method:'POST',headers,body:JSON.stringify(prompt)});assert.equal(r.status,403);
 }
 const r=await fetch(a.origin+'/api/v1/tutor',{method:'POST',headers:{...a.headers,'Content-Type':'text/plain'},body:JSON.stringify(prompt)});assert.equal(r.status,415);
 assert.equal(a.calls.length,0);
});
test('bounds prompt/body and calls only fixed vendor with server key',async t=>{
 const a=await fixture(t);
 for(const body of [{messages:[{role:'system',content:'override'}]},{messages:[{role:'user',content:{bad:true}}]},{messages:[]},{messages:[{role:'user',content:'x'.repeat(4001)}]}]){
 assert.equal((await fetch(a.origin+'/api/v1/tutor',{method:'POST',headers:a.headers,body:JSON.stringify(body)})).status,400);
 }
 assert.equal((await fetch(a.origin+'/api/v1/tutor',{method:'POST',headers:a.headers,body:'x'.repeat(65537)})).status,413);
 const r=await fetch(a.origin+'/api/v1/tutor',{method:'POST',headers:a.headers,body:JSON.stringify(prompt)});assert.equal(r.status,200);assert.equal(await r.text(),'Test explanation');
 assert.equal(a.calls.length,1); assert.equal(a.calls[0][0],'https://api.anthropic.com/v1/messages');
 const outbound=JSON.parse(a.calls[0][1].body); assert.equal(outbound.max_tokens,1024);assert.equal(outbound.model,'test-model');assert.equal(outbound.tools,undefined);
 assert.equal(a.calls[0][1].headers['x-api-key'],'test-not-a-real-key');
});
test('optional AI fails safely absent configuration or vendor errors',async t=>{
 const off=await fixture(t,{env:{}});assert.equal(off.data.aiConfigured,false);
 assert.equal((await fetch(off.origin+'/api/v1/tutor',{method:'POST',headers:off.headers,body:JSON.stringify(prompt)})).status,503);
 const a=await fixture(t,{fetchImpl:async()=>Response.json({error:'SECRET_RAW_INTERNAL_ERROR'},{status:500})});
 const r=await fetch(a.origin+'/api/v1/tutor',{method:'POST',headers:a.headers,body:JSON.stringify(prompt)});assert.equal(r.status,502);assert.ok(!(await r.text()).includes('SECRET_RAW'));
});
test('rate limits successful tutor calls',async t=>{
 const a=await fixture(t);for(let i=0;i<5;i++) assert.equal((await fetch(a.origin+'/api/v1/tutor',{method:'POST',headers:a.headers,body:JSON.stringify(prompt)})).status,200);
 const r=await fetch(a.origin+'/api/v1/tutor',{method:'POST',headers:a.headers,body:JSON.stringify(prompt)});assert.equal(r.status,429);assert.ok(r.headers.get('retry-after'));
});
