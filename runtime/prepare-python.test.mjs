import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { preparePythonAssets } from './prepare-python.mjs';

const data = Buffer.from('pinned fixture');
const asset = { file: 'fixture.wasm', url: 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/fixture.wasm', bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
const manifest = { schemaVersion: 1, assets: [asset], notices: [] };
async function fixture(fn) {
  const directory = await mkdtemp(join(tmpdir(), 'studylab-vendor-test-'));
  try { await fn(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

test('downloads pinned assets, verifies bytes, then reuses verified offline cache', () => fixture(async destination => {
  let calls = 0;
  const fetchImpl = async (_url, options) => { calls++; assert.equal(options.redirect, 'error'); return new Response(data); };
  assert.equal((await preparePythonAssets({ manifest, destination, fetchImpl })).downloaded, 1);
  assert.deepEqual(await readFile(join(destination, asset.file)), data);
  assert.equal((await preparePythonAssets({ manifest, destination, fetchImpl })).cached, 1);
  assert.equal(calls, 1);
}));

test('fails closed on corrupt cache, wrong digest and oversized download', () => fixture(async destination => {
  await writeFile(join(destination, asset.file), 'bad cache');
  await assert.rejects(preparePythonAssets({ manifest, destination }), /Cached asset failed verification/);
  await rm(join(destination, asset.file));
  for (const body of [Buffer.alloc(data.length), Buffer.alloc(data.length + 1)]) {
    await assert.rejects(preparePythonAssets({ manifest, destination, fetchImpl: async () => new Response(body) }), /verification|size/);
    await assert.rejects(readFile(join(destination, asset.file)), { code: 'ENOENT' });
  }
}));

test('rejects unsupported manifest, unsafe filenames and unapproved origins', () => fixture(async destination => {
  for (const bad of [{ ...manifest, schemaVersion: 2 }, { ...manifest, assets: [{ ...asset, file: '../escape' }] }, { ...manifest, assets: [{ ...asset, url: 'https://attacker.invalid/file' }] }, { ...manifest, assets: [{ ...asset, sha256: 'not-hash' }] }]) {
    await assert.rejects(preparePythonAssets({ manifest: bad, destination }), /manifest/);
  }
}));

test('HTTP failures, empty bodies and incorrect lengths cannot be cached', () => fixture(async destination => {
  for (const response of [new Response('missing', { status: 404 }), new Response(null), new Response(data.subarray(0, 2))]) {
    await assert.rejects(preparePythonAssets({ manifest, destination, fetchImpl: async () => response }), /Download|verification/);
  }
}));
