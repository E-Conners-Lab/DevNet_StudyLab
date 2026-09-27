import { mkdir, readFile, readdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { inventory } from '../runtime/static.mjs';
import { makeManifest, verifyRelease } from '../runtime/integrity.mjs';
import { supportedNode } from '../runtime/launch.mjs';
import { preparePythonAssets } from '../runtime/prepare-python.mjs';
import { createZip } from './zip-release.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const name = 'devnet-studylab-1.0.0';
const destination = path.join(root, 'release', name);
async function copy(source, target) {
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
}
async function copyTree(source, target) {
  for (const [url, file] of await inventory(source)) await copy(file, path.join(target, url.slice(1)));
}
function npm(args, capture = false) {
  const cli = process.env.npm_execpath;
  if (!cli) throw new Error('Run this build using npm run release:build.');
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.status !== 0) throw new Error(`Build command failed: npm ${args.join(' ')}`);
  return result.stdout;
}
async function licenses() {
  const lock = JSON.parse(await readFile(path.join(root, 'apps/web/package-lock.json'), 'utf8'));
  const index = ['# JavaScript dependency notices', '', 'Versions and license identifiers are also listed in sbom.cdx.json.'];
  for (const [location, entry] of Object.entries(lock.packages)) {
    if (!location || entry.dev) continue;
    const packageRoot = path.join(root, 'apps/web', location);
    let packageFiles;
    try { packageFiles = await readdir(packageRoot); }
    catch (error) { if (entry.optional && error.code === 'ENOENT') continue; throw error; }
    const notices = packageFiles.filter(file => /^(LICENSE|LICENCE|COPYING|NOTICE)(\.|$|-)/i.test(file));
    const id = location.replaceAll('/', '__');
    index.push(`\n- ${location} ${entry.version} — ${entry.license || 'See package notice'}`);
    for (const notice of notices) {
      // Package notices are files, not executable build hooks.
      try { await copy(path.join(packageRoot, notice), path.join(destination, 'licenses/javascript', id, notice)); }
      catch (error) { if (error.code !== 'EISDIR') throw error; }
    }
  }
  await writeFile(path.join(destination, 'licenses/JAVASCRIPT.md'), index.join('\n') + '\n');
}
async function build() {
  if (!supportedNode(process.versions.node)) throw new Error('Build with Node.js 24.21.0 or newer within 24.x.');
  const manifest = JSON.parse(await readFile(path.join(root, 'runtime/pyodide-manifest.json'), 'utf8'));
  await preparePythonAssets({ manifest });
  if (!process.argv.includes('--skip-web-build')) npm(['run', 'build', '--prefix', 'apps/web']);
  await rm(destination, { recursive: true, force: true });
  await copyTree(path.join(root, 'apps/web/out'), path.join(destination, 'web'));
  for (const file of ['index.html', 'frame.mjs', 'controller.mjs', 'worker.mjs']) await copy(path.join(root, 'runtime/sandbox', file), path.join(destination, 'runner', file));
  for (const entry of [...manifest.assets, ...manifest.notices]) await copy(path.join(root, 'runtime/vendor/pyodide', entry.file), path.join(destination, 'runner/assets', entry.file));
  for (const file of ['http.mjs', 'server.mjs', 'sessions.mjs', 'static.mjs', 'tutor.mjs', 'integrity.mjs', 'launch.mjs', 'start.mjs']) await copy(path.join(root, 'runtime', file), path.join(destination, 'runtime', file));
  for (const file of ['README.md', 'SETUP.md', 'SECURITY.md', 'LICENSE', '.env.example']) await copy(path.join(root, file), path.join(destination, file));
  await copy(path.join(root, 'runtime/pyodide-manifest.json'), path.join(destination, 'licenses/pyodide-manifest.json'));
  await copy(path.join(root, 'runtime/sandbox/README.md'), path.join(destination, 'licenses/PYTHON.md'));
  for (const file of ['API_REFERENCE.md', 'ARCHITECTURE.md', 'ENVIRONMENT_VARIABLES.md', 'ROUTES.md', 'DATABASE_SCHEMA.md', 'CONTENT_STRATEGY.md', 'RELEASE_REVIEW.md', 'RELEASE_PLAN.md', 'AI_EVALUATION.md']) {
    await copy(path.join(root, 'docs', file), path.join(destination, 'docs', file));
  }
  await licenses();
  await writeFile(path.join(destination, 'sbom.cdx.json'), npm(['sbom', '--package-lock-only', '--omit=dev', '--sbom-format=cyclonedx', '--prefix', 'apps/web'], true));
  await writeFile(path.join(destination, 'package.json'), JSON.stringify({ name: 'devnet-studylab-local', version: '1.0.0', private: true, license: 'ISC', scripts: { start: 'node runtime/start.mjs' }, engines: { node: '>=24.21.0 <25' } }, null, 2) + '\n');
  await writeFile(path.join(destination, 'release-manifest.json'), JSON.stringify(await makeManifest(destination), null, 2) + '\n');
  await verifyRelease(destination);
  const files = [];
  for (const [url, filename] of await inventory(destination)) files.push({ path: name + url, data: await readFile(filename) });
  const zip = createZip(files.sort((a, b) => a.path.localeCompare(b.path)));
  const output = path.join(root, 'release-artifacts');
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, name + '.zip'), zip);
  await writeFile(path.join(output, 'SHA256SUMS.txt'), `${createHash('sha256').update(zip).digest('hex')}  ${name}.zip\n`);
  console.info(`Verified ${files.length} files. Release archive: release-artifacts/${name}.zip (${zip.length} bytes)`);
}
try { await build(); }
catch (error) { console.error(`Release build failed: ${error.message}`); process.exitCode = 1; }
