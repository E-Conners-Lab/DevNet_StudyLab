import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { askTutor, validatePrompt, redactPrompt, PROMPT_VERSION, TUTOR_SYSTEM } from '../tutor.mjs';

const fixtures = JSON.parse(await readFile(new URL('./fixtures/security/tutor-eval-v1.json', import.meta.url), 'utf8'));
const env = Object.freeze({ TUTOR_MODEL: 'synthetic-evaluation-model', TUTOR_ANTHROPIC_KEY: 'synthetic-non-key-fixture' });
const mockResponse = () => Response.json({ content: [{ type: 'text', text: 'Mocked provider response; no model was evaluated.' }] });

function captureProvider() {
  const requests = [];
  return {
    requests,
    fetchImpl: async (url, init) => {
      requests.push({ url, init, body: JSON.parse(init.body) });
      return mockResponse();
    },
  };
}

test('AI evaluation fixture version and prompt version are explicit release gates', () => {
  assert.equal(fixtures.schemaVersion, 1);
  assert.equal(fixtures.evalSetId, 'local-tutor-gate-v1');
  assert.equal(fixtures.promptVersion, PROMPT_VERSION);
  assert.equal(fixtures.promptSha256, createHash('sha256').update(TUTOR_SYSTEM).digest('hex'));
  assert.equal(fixtures.deterministicThreshold, 1);
  const ids = ['adversarial', 'regression', 'redaction', 'invalidInputs'].flatMap(group => fixtures[group].map(entry => entry.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 29, 'Do not silently drop eval cases without reviewing the versioned gate.');
});

for (const fixture of [...fixtures.adversarial, ...fixtures.regression]) {
  test(`AI gate ${fixture.id}: user data cannot alter provider, system role, model, or tool capabilities`, async () => {
    const captured = captureProvider();
    const prompt = validatePrompt({ messages: [{ role: 'user', content: fixture.content }], ...(fixture.domain ? { domain: fixture.domain } : {}) });
    const output = await askTutor(prompt, { env, fetchImpl: captured.fetchImpl });
    assert.equal(output, 'Mocked provider response; no model was evaluated.');
    assert.equal(captured.requests.length, 1);
    const { url, init, body } = captured.requests[0];
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    assert.equal(init.method, 'POST');
    assert.equal(init.redirect, 'error');
    assert.deepEqual(Object.keys(body).sort(), ['max_tokens', 'messages', 'model', 'system']);
    assert.equal(body.model, env.TUTOR_MODEL);
    assert.equal(body.max_tokens, 1024);
    assert.equal(body.system, TUTOR_SYSTEM + (fixture.domain ? `\nStudy domain: ${fixture.domain}.` : ''));
    assert.equal(body.messages[0].role, 'user');
    assert.equal(body.messages[0].content, `<<STUDY_CONTENT>>\n${redactPrompt(fixture.content)}\n<</STUDY_CONTENT>>`);
    assert.ok(!JSON.stringify(body).includes(env.TUTOR_ANTHROPIC_KEY));
    assert.equal(init.headers['x-api-key'], env.TUTOR_ANTHROPIC_KEY);
  });
}

for (const fixture of fixtures.redaction) {
  test(`AI gate ${fixture.id}: recognized sensitive fixture is removed before provider context`, async () => {
    const captured = captureProvider();
    const prompt = validatePrompt({ messages: [{ role: 'user', content: fixture.input }] });
    await askTutor(prompt, { env, fetchImpl: captured.fetchImpl });
    const message = captured.requests[0].body.messages[0].content;
    assert.match(message, /\[REDACTED/);
    for (const forbidden of fixture.forbidden) assert.ok(!message.includes(forbidden), `Fixture ${fixture.id} leaked its synthetic marker.`);
  });
}

for (const fixture of fixtures.invalidInputs) {
  test(`AI gate ${fixture.id}: unsupported request contracts reject before provider invocation`, () => {
    assert.throws(() => validatePrompt(fixture.body), error => error.status === 400);
  });
}

test('AI gate: message count, individual length, total length, and blank content are bounded', () => {
  const user = content => ({ role: 'user', content });
  for (const messages of [[], Array.from({ length: 21 }, () => user('fixture')), [user('x'.repeat(4001))], Array.from({ length: 5 }, () => user('x'.repeat(4000))), [user(' \n\t')]]) {
    assert.throws(() => validatePrompt({ messages }), error => error.status === 400);
  }
  assert.equal(validatePrompt({ messages: [user('x'.repeat(4000))] }).messages.length, 1);
  assert.equal(validatePrompt({ messages: Array.from({ length: 4 }, () => user('x'.repeat(4000))) }).messages.length, 4);
  assert.equal(validatePrompt({ messages: Array.from({ length: 20 }, () => user('fixture')) }).messages.length, 20);
});

test('AI gate: provider tool-use blocks are never dispatched or returned as execution requests', async () => {
  const prompt = validatePrompt({ messages: [{ role: 'user', content: 'Explain a Python function.' }] });
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return Response.json({ content: [{ type: 'tool_use', name: 'shell', input: { command: 'synthetic-command' } }, { type: 'text', text: 'Ordinary explanatory text.' }] });
  };
  assert.equal(await askTutor(prompt, { env, fetchImpl }), 'Ordinary explanatory text.');
  assert.equal(calls, 1);
  await assert.rejects(askTutor(prompt, { env, fetchImpl: async () => Response.json({ content: [{ type: 'tool_use', name: 'shell', input: {} }] }) }), error => error.status === 502);
});
