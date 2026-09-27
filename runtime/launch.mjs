import path from 'node:path';
import { createStudyServers } from './server.mjs';
import { verifyRelease } from './integrity.mjs';

export function supportedNode(version) {
  const [major, minor] = version.split('.').map(Number);
  return major === 24 && minor >= 21;
}
export async function launch({ root, version = process.versions.node, loadEnv = process.loadEnvFile, env = process.env, ...serverOptions }) {
  if (!supportedNode(version)) throw new Error('Install Node.js 24 LTS, version 24.21.0 or newer within 24.x, then try again.');
  await verifyRelease(root);
  try { loadEnv(path.join(root, '.env')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('Cannot read local .env configuration. Check its permissions and syntax.'); }
  return createStudyServers({ webRoot: path.join(root, 'web'), runnerRoot: path.join(root, 'runner'), env, ...serverOptions });
}
