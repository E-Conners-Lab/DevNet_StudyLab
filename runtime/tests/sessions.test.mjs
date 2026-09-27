import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessions } from '../sessions.mjs';
import { redactPrompt } from '../tutor.mjs';

test('parallel requests cannot reuse a stale session quota snapshot', () => {
  let time = 1000;
  const sessions = createSessions(() => time);
  const res = { setHeader() {} };
  const session = sessions.open({ headers: {} }, res);
  for (let i = 0; i < 5; i++) sessions.charge(session, res);
  assert.throws(() => sessions.charge(session, res), /limit/);
  time += 60001;
  sessions.charge(session, res);
  time += 3600000;
  assert.throws(() => sessions.charge(session, res), /expired/);
});
test('redacts bearer headers, cookie headers, JSON values and quoted assignments', () => {
  for (const input of ['Authorization: Bearer fixture.jwt.signature', '{"password":"fixture-secret"}', 'password="two word fixture"', 'Cookie: session=fixture-token', 'api_key = \'fixture words\'']) {
    assert.ok(!redactPrompt(input).includes('fixture'), redactPrompt(input));
  }
});
