import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSandboxController } from './controller.mjs';

const ID = '11111111-1111-4111-8111-111111111111';
function harness() {
  const messages = [], workers = [], timers = new Map();
  let sequence = 0;
  const controller = createSandboxController({
    postToParent: (message) => messages.push(message),
    createWorker: () => {
      const worker = { terminated: false, commands: [], postMessage(d) { this.commands.push(d); }, terminate() { this.terminated = true; } };
      workers.push(worker);
      return worker;
    },
    setTimer: (fn, ms) => { const key = ++sequence; timers.set(key, { fn, ms }); return key; },
    clearTimer: (key) => timers.delete(key),
  });
  const run = (code = 'print(1)', id = ID) => controller.handleCommand({ v: 1, type: 'run', id, code });
  const emit = (data, index = workers.length - 1) => workers[index].onmessage({ data });
  return { controller, messages, workers, timers, run, emit };
}

test('a fresh worker loads, runs, streams text, then is disposed', () => {
  const h = harness(); h.run();
  assert.equal(h.messages.at(-1).status, 'loading');
  assert.equal([...h.timers.values()][0].ms, 30_000);
  h.emit({ type: 'ready' });
  assert.deepEqual(h.workers[0].commands, [{ type: 'run', code: 'print(1)' }]);
  assert.equal([...h.timers.values()][0].ms, 10_000);
  h.emit({ type: 'output', stream: 'stdout', text: '1' });
  assert.deepEqual(h.messages.at(-1), { v: 1, type: 'output', id: ID, stream: 'stdout', text: '1' });
  h.emit({ type: 'done' });
  assert.equal(h.messages.at(-1).status, 'done');
  assert.equal(h.workers[0].terminated, true);
  assert.equal(h.timers.size, 0);
});

test('rejects unsupported protocol and invalid IDs before making a worker', () => {
  const h = harness();
  for (const command of [null, {}, { v: 2, type: 'run', id: ID, code: 'x' }, { v: 1, type: 'run', id: '../x', code: 'x' }]) h.controller.handleCommand(command);
  assert.equal(h.workers.length, 0);
});

test('rejects missing, nonstring and oversized UTF-8 code', () => {
  const h = harness();
  for (const code of [undefined, 12, '\u20ac'.repeat(50_000)]) h.controller.handleCommand({ v: 1, type: 'run', id: ID, code });
  assert.equal(h.workers.length, 0);
  assert.equal(h.messages.at(-1).status, 'error');
});

test('matching cancel disposes the worker; wrong IDs cannot cancel another run', () => {
  const h = harness(); h.run();
  h.controller.handleCommand({ v: 1, type: 'cancel', id: '22222222-2222-4222-8222-222222222222' });
  assert.equal(h.workers[0].terminated, false);
  h.controller.handleCommand({ v: 1, type: 'cancel', id: ID });
  assert.equal(h.messages.at(-1).status, 'cancelled');
  assert.equal(h.workers[0].terminated, true);
});

test('startup and execution watchdogs terminate stalled code', () => {
  for (const started of [false, true]) {
    const h = harness(); h.run(); if (started) h.emit({ type: 'ready' });
    [...h.timers.values()][0].fn();
    assert.equal(h.messages.at(-1).status, 'timeout');
    assert.equal(h.workers[0].terminated, true);
  }
});

test('worker messages cannot reset execution timeout by forging readiness', () => {
  const h = harness(); h.run(); h.emit({ type: 'ready' });
  const timer = [...h.timers.keys()][0];
  h.emit({ type: 'ready' });
  assert.equal([...h.timers.keys()][0], timer);
  assert.equal(h.workers[0].commands.length, 1);
});

test('replacement ignores stale worker replies and starts isolated state', () => {
  const h = harness(); h.run(); h.emit({ type: 'ready' }); h.run('print(2)');
  assert.equal(h.workers[0].terminated, true);
  const length = h.messages.length;
  h.emit({ type: 'done' }, 0);
  assert.equal(h.messages.length, length);
  h.emit({ type: 'ready' });
  assert.equal(h.workers[1].commands[0].code, 'print(2)');
});

test('output and message flooding are bounded independently', () => {
  for (const flood of ['chunk', 'total', 'messages']) {
    const h = harness(); h.run(); h.emit({ type: 'ready' });
    if (flood === 'chunk') h.emit({ type: 'output', stream: 'stdout', text: 'x'.repeat(4097) });
    if (flood === 'total') for (let n = 0; n < 20; n++) h.emit({ type: 'output', stream: 'stderr', text: 'x'.repeat(4096) });
    if (flood === 'messages') for (let n = 0; n < 513; n++) h.emit({ type: 'unrecognized' });
    assert.equal(h.messages.at(-1).status, 'output-limit');
    assert.equal(h.workers[0].terminated, true);
  }
});

test('invalid output and done before startup are ignored', () => {
  const h = harness(); h.run();
  h.emit({ type: 'done' }); h.emit(null);
  h.emit({ type: 'output', stream: 'stdout', text: 'premature' });
  h.emit({ type: 'ready' });
  h.emit({ type: 'output', stream: 'html', text: '<b>x</b>' });
  h.emit({ type: 'output', stream: 'stdout', text: {} });
  assert.equal(h.messages.length, 2);
});

test('worker startup/crash and Python errors are terminal and bounded', () => {
  const h = harness(); h.run(); h.workers[0].onerror({ preventDefault() {} });
  assert.equal(h.messages.at(-1).status, 'error');
  h.run(); h.emit({ type: 'error', text: 'x'.repeat(5000) });
  assert.equal(h.messages.at(-1).message.length, 1000);
  assert.equal(h.workers[1].terminated, true);
});

test('worker constructor failure is reported safely', () => {
  const messages = [];
  const c = createSandboxController({ postToParent: d => messages.push(d), createWorker() { throw new Error('internal path'); } });
  c.handleCommand({ v: 1, type: 'run', id: ID, code: 'x' });
  assert.equal(messages.at(-1).status, 'error');
  assert.equal(JSON.stringify(messages).includes('internal path'), false);
});
