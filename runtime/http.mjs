import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

export const API_VERSION = '1';
export const BODY_LIMIT = 64 * 1024;
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function equalSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function token() { return randomBytes(32).toString('base64url'); }
export function commonHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), usb=()');
}
export function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'X-API-Version': API_VERSION });
  res.end(JSON.stringify(data));
}
export function fail(res, error, logger = () => {}) {
  const correlationId = randomUUID();
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof HttpError ? error.message : 'The request could not be completed.';
  logger({ event: 'request_error', status, correlationId });
  if (!res.headersSent) json(res, status, { error: message, correlationId, apiVersion: API_VERSION });
  else res.end();
}
export function requireBrowserOrigin(req, origin, required = false) {
  const supplied = req.headers.origin;
  if ((required && !supplied) || (supplied && supplied !== origin) ||
      ['cross-site', 'same-site'].includes(req.headers['sec-fetch-site'])) {
    throw new HttpError(403, 'This request must come from the local study app page.');
  }
}
export function readJson(req) {
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    req.resume(); throw new HttpError(415, 'Content-Type must be application/json.');
  }
  if (Number(req.headers['content-length']) > BODY_LIMIT) { req.resume(); throw new HttpError(413, 'Request is too large.'); }
  return new Promise((resolve, reject) => {
    let chunks = [], size = 0, settled = false;
    const rejectOnce = error => { if (!settled) { settled = true; chunks = []; reject(error); } };
    req.on('data', chunk => {
      size += chunk.length;
      if (size > BODY_LIMIT) return rejectOnce(new HttpError(413, 'Request is too large.'));
      if (!settled) chunks = [...chunks, chunk];
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, 'Request must contain valid JSON.')); }
    });
    req.on('error', () => rejectOnce(new HttpError(400, 'Request could not be read.')));
    req.on('aborted', () => rejectOnce(new HttpError(400, 'Request was interrupted.')));
  });
}
