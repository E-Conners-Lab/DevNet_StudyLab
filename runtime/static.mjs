import { readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { HttpError } from './http.mjs';

const TYPES = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.wasm':'application/wasm','.zip':'application/zip','.whl':'application/octet-stream' };
export async function inventory(root) {
  const canonical = await realpath(root);
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes:true });
    const nested = await Promise.all(entries.map(async entry => {
      const full = path.join(dir,entry.name);
      if (entry.isSymbolicLink()) throw new Error('Release files must not be symbolic links');
      if (entry.isDirectory()) return walk(full);
      if (!entry.isFile()) return [];
      return [[ '/'+path.relative(canonical,full).split(path.sep).join('/'),full ]];
    }));
    return nested.flat();
  }
  return new Map(await walk(canonical));
}
function decodePath(raw) {
  let decoded;
  try { decoded = decodeURIComponent(raw.split('?')[0]); }
  catch { throw new HttpError(400, 'Invalid path.'); }
  if (!decoded.startsWith('/') || /[\\\u0000-\u001f]/.test(decoded) || decoded.split('/').some(s=>s==='..'||s==='.') || /%2e|%2f|%5c/i.test(decoded)) throw new HttpError(400,'Invalid path.');
  return decoded;
}
export function runnerPolicy({worker=false,studyOrigin}) {
  return `default-src 'none'; script-src 'self'${worker ? " 'wasm-unsafe-eval'" : ''}; connect-src ${worker ? "'self'" : "'none'"}; worker-src ${worker ? "'none'" : "'self'"}; frame-ancestors ${studyOrigin}; base-uri 'none'; form-action 'none'; object-src 'none'`;
}
export async function collectStyleHashes(files) {
  const hashes = [];
  for (const filename of files.values()) {
    if (!filename.endsWith('.html')) continue;
    const source = await readFile(filename, 'utf8');
    for (const match of source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) hashes.push(`'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`);
  }
  return [...new Set(hashes)];
}
function studyHtml(source, runnerOrigin, styles) {
  const nonce = randomBytes(24).toString('base64');
  // Decode ampersands last so nested entity text is decoded only once.
  const attrs = [...source.matchAll(/\sstyle="([^"]*)"/g)].map(match => match[1].replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'));
  const hashes = [...new Set(attrs.map(value=>`'sha256-${createHash('sha256').update(value).digest('base64')}'`))];
  // Hydration/navigation may recreate built-in styles from another static page.
  const csp = `default-src 'none'; script-src 'nonce-${nonce}' 'strict-dynamic'; style-src 'self' 'nonce-${nonce}' ${[...new Set(styles)].join(' ')}; style-src-attr ${hashes.length ? "'unsafe-hashes' " + hashes.join(' ') : "'none'"}; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src ${runnerOrigin}; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`;
  const html = source.replace(/<script(?=[\s>])/g,`<script nonce="${nonce}"`).replace(/<style(?=[\s>])/g,`<style nonce="${nonce}"`)
    .replace(/<link(?=[^>]*\bas="script")/g,`<link nonce="${nonce}"`)
    .replace('</head>',`<meta name="csp-nonce" content="${nonce}"><meta name="studylab-runner-origin" content="${runnerOrigin}"></head>`);
  return { html, csp };
}
export async function serveStatic(req,res,{files,runner=false,studyOrigin,runnerOrigin,styleHashes=[]}) {
  if (!['GET','HEAD'].includes(req.method)) { res.setHeader('Allow','GET, HEAD');throw new HttpError(405,'Method not allowed.'); }
  const pathname = decodePath(req.url);
  if (pathname.startsWith('/api/')) throw new HttpError(404,'Resource not found.');
  const candidates = [pathname,pathname.replace(/\/$/,'')+'/index.html',pathname+'.html'];
  const file = candidates.map(p=>files.get(p)).find(Boolean);
  if (!file) throw new HttpError(404,'Resource not found.');
  const ext = path.extname(file);
  const type = TYPES[ext];
  if (!type) throw new HttpError(404,'Resource not found.');
  let body = await readFile(file);
  if (runner) {
    res.setHeader('Content-Security-Policy',runnerPolicy({worker:pathname.endsWith('/worker.mjs'),studyOrigin}));
  } else {
    res.setHeader('X-Frame-Options','DENY');
    if (ext === '.html') {
      const result = studyHtml(body.toString('utf8'),runnerOrigin,styleHashes);
      res.setHeader('Content-Security-Policy',result.csp);body=Buffer.from(result.html);
    }
  }
  res.writeHead(200,{'Content-Type':type,'Content-Length':body.byteLength});
  res.end(req.method === 'HEAD' ? undefined : body);
}
