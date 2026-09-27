/** Build-time only. Learners receive these verified files in the release archive. */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const DEFAULT_DESTINATION = fileURLToPath(new URL('./vendor/pyodide/', import.meta.url));
const ALLOWED_PREFIXES = ['https://cdn.jsdelivr.net/pyodide/v314.0.7/full/', 'https://raw.githubusercontent.com/'];
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

function entriesFor(manifest) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.assets) || !Array.isArray(manifest.notices)) throw new Error('Unsupported Python asset manifest.');
  const entries = [...manifest.assets, ...manifest.notices];
  for (const entry of entries) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(entry.file) || entry.file.includes('..') || !Number.isInteger(entry.bytes) || entry.bytes < 1 || entry.bytes > 20_000_000 || !/^[a-f0-9]{64}$/.test(entry.sha256) || typeof entry.url !== 'string' || !ALLOWED_PREFIXES.some(prefix => entry.url.startsWith(prefix))) throw new Error('Invalid Python asset manifest entry.');
  }
  if (new Set(entries.map(entry => entry.file)).size !== entries.length) throw new Error('Duplicate file in Python asset manifest.');
  return entries;
}

async function readVerifiedCache(path, entry) {
  let bytes;
  try { bytes = await readFile(path); } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  if (bytes.length !== entry.bytes || digest(bytes) !== entry.sha256) throw new Error(`Cached asset failed verification: ${entry.file}. Remove this cache file and rebuild.`);
  return true;
}

async function download(entry, fetchImpl) {
  const response = await fetchImpl(entry.url, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
  if (!response.ok || !response.body) throw new Error(`Download failed for ${entry.file}.`);
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > entry.bytes) throw new Error(`Download exceeded pinned size: ${entry.file}.`);
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (length !== entry.bytes || digest(bytes) !== entry.sha256) throw new Error(`Download verification failed: ${entry.file}.`);
  return bytes;
}

export async function preparePythonAssets({ manifest, destination = DEFAULT_DESTINATION, fetchImpl = fetch }) {
  const entries = entriesFor(manifest);
  await mkdir(destination, { recursive: true });
  let cached = 0;
  for (const entry of entries) {
    const output = join(destination, entry.file);
    if (await readVerifiedCache(output, entry)) { cached++; continue; }
    const bytes = await download(entry, fetchImpl);
    const temporary = `${output}.${randomUUID()}.download`;
    try {
      await writeFile(temporary, bytes, { flag: 'wx' });
      await rename(temporary, output);
    } finally { await rm(temporary, { force: true }); }
  }
  return { cached, downloaded: entries.length - cached, bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const manifest = JSON.parse(await readFile(new URL('./pyodide-manifest.json', import.meta.url), 'utf8'));
    console.log('Verified offline Python assets:', await preparePythonAssets({ manifest }));
  } catch (error) {
    console.error(`Python asset preparation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
