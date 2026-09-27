import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { makeManifest, verifyRelease } from '../integrity.mjs';
import { supportedNode, launch } from '../launch.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'studylab-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const dir of ['web', 'runner']) {
    await mkdir(path.join(root, dir));
    await writeFile(path.join(root, dir, 'index.html'), '<html><head></head><body>Local study</body></html>');
  }
  const manifest = await makeManifest(root);
  await writeFile(path.join(root, 'release-manifest.json'), JSON.stringify(manifest));
  return root;
}
test('release inventory verifies contents, permits local env, rejects tampered and missing files', async t => {
  const root = await fixture(t);
  await verifyRelease(root);
  await writeFile(path.join(root, '.env'), 'TUTOR_ANTHROPIC_KEY=not-real');
  await verifyRelease(root);
  await writeFile(path.join(root, 'web/index.html'), 'tampered');
  await assert.rejects(verifyRelease(root), /verification/);
  await rm(path.join(root, 'web/index.html'));
  await assert.rejects(verifyRelease(root));
});
test('rejects unsafe or unsupported manifests and symlinks', async t => {
  const root = await fixture(t);
  const original = JSON.parse(await readFile(path.join(root, 'release-manifest.json'), 'utf8'));
  for (const manifest of [{ ...original, schemaVersion: 2 }, { ...original, files: [{ path: '../secret', bytes: 1, sha256: '0'.repeat(64) }] }, { ...original, files: [] }]) {
    await writeFile(path.join(root, 'release-manifest.json'), JSON.stringify(manifest));
    await assert.rejects(verifyRelease(root), /manifest/);
  }
  await symlink(path.join(root, 'runner/index.html'), path.join(root, 'web/link.html'));
  await assert.rejects(makeManifest(root), /symbolic/);
});
test('launcher supports only tested Node24, loads local env, and serves both loopback origins', async t => {
  assert.equal(supportedNode('24.21.0'), true);
  assert.equal(supportedNode('24.22.1'), true);
  for (const version of ['24.20.0', '22.23.3', '25.2.1', 'bad']) assert.equal(supportedNode(version), false);
  const root = await fixture(t);
  const events = [];
  const app = await launch({ root, version: '24.21.0', loadEnv: file => { events.push(file); }, env: {}, port: 0, runnerPort: 0, logger: () => {} });
  t.after(() => app.close());
  assert.equal(events[0], path.join(root, '.env'));
  assert.equal((await fetch(app.origin)).status, 200);
  assert.match(app.runnerOrigin, /^http:\/\/127\.0\.0\.1:/);
  await assert.rejects(launch({ root, version: '25.0.0' }), /Node/);
  await assert.rejects(launch({ root, version: '24.21.0', loadEnv: () => { throw new Error('permission denied'); } }), /configuration/);
});
