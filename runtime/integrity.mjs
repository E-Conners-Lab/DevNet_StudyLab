import product from '../package.json' with { type: 'json' };
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { inventory } from './static.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export async function makeManifest(root) {
  const paths = await inventory(root);
  const files = [];
  for (const [url, filename] of [...paths].sort(([a], [b]) => a.localeCompare(b))) {
    if (url === '/release-manifest.json' || url === '/.env') continue;
    const bytes = await readFile(filename);
    files.push({ path: url.slice(1), bytes: bytes.byteLength, sha256: hash(bytes) });
  }
  return { schemaVersion: 1, version: product.version, node: '>=24.21.0 <25', files };
}
export async function verifyRelease(root) {
  const manifest = JSON.parse(await readFile(path.join(root, 'release-manifest.json'), 'utf8'));
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > 10000) throw new Error('Unsupported release manifest.');
  const paths = await inventory(root);
  const seen = new Set();
  for (const entry of manifest.files) {
    if (!entry || typeof entry.path !== 'string' || entry.path.startsWith('/') || /[\\\u0000-\u001f]/.test(entry.path) || entry.path.split('/').some(part => !part || part === '.' || part === '..') || seen.has(entry.path) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Invalid release manifest entry.');
    seen.add(entry.path);
    const file = paths.get('/' + entry.path);
    if (!file) throw new Error('Release verification failed: missing file.');
    const bytes = await readFile(file);
    if (bytes.byteLength !== entry.bytes || hash(bytes) !== entry.sha256) throw new Error('Release verification failed: changed file. Download and extract a fresh copy.');
  }
  for (const url of paths.keys()) {
    if ((url.startsWith('/web/') || url.startsWith('/runner/')) && !seen.has(url.slice(1))) throw new Error('Release verification failed: unexpected public file.');
  }
  return manifest;
}
