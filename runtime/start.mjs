import product from '../package.json' with { type: 'json' };
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { launch } from './launch.mjs';

const parent = fileURLToPath(new URL('../', import.meta.url));
const root = existsSync(path.join(parent, 'release-manifest.json')) ? parent : path.join(parent, 'release', `${product.name}-${product.version}`);
try {
  const app = await launch({ root });
  console.info(`${product.displayName} — local edition\nOpen ${app.origin}\nPython sandbox: ${app.runnerOrigin}\nPress Ctrl+C to stop. Do not expose these ports to a network.`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); });
} catch (error) {
  const message = error.code === 'EADDRINUSE' ? 'Ports 4318 and 4319 must be free. Stop another study app instance and try again.'
    : error.code === 'ENOENT' ? 'Release files are missing. Extract the complete download, or run npm run release:build from source.'
    : error.message;
  console.error(`${product.displayName} could not start: ${message}`);
  process.exitCode = 1;
}
