import { HttpError, equalSecret, token } from './http.mjs';

const COOKIE = 'studylab_session';
const TTL = 60 * 60 * 1000;
const MAX_SESSIONS = 32;
export function createSessions(now = Date.now) {
  const sessions = new Map();
  let globalCalls = [];
  function prune() {
    for (const [key, session] of sessions) if (session.expires <= now()) sessions.delete(key);
  }
  function lookup(req) {
    prune();
    const id = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
    return id ? sessions.get(id) : undefined;
  }
  return {
    open(req, res) {
      let session = lookup(req);
      if (!session) {
        if (sessions.size >= MAX_SESSIONS) throw new HttpError(429, 'Too many local sessions. Restart StudyLab or wait an hour.');
        session = { id: token(), csrf: token(), expires: now()+TTL, calls: [] };
        sessions.set(session.id, session);
      }
      // HTTP loopback only. No cookie holds a provider key, identity or study data.
      res.setHeader('Set-Cookie', `${COOKIE}=${session.id}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=3600`);
      return session;
    },
    authorize(req) {
      const session = lookup(req);
      if (!session || !equalSecret(req.headers['x-csrf-token'], session.csrf)) {
        throw new HttpError(403, 'Your local session expired. Reload the page and try again.');
      }
      return session;
    },
    charge(session, res) {
      const current = sessions.get(session.id);
      if (!current || current.expires <= now()) throw new HttpError(403, 'Your local session expired. Reload the page and try again.');
      const active = current.calls.filter(t => now()-t < 60000);
      const shared = globalCalls.filter(t => now()-t < 60000);
      if (active.length >= 5 || shared.length >= 10) {
        res.setHeader('Retry-After', '60');
        throw new HttpError(429, 'Tutor limit reached. Wait one minute before trying again.');
      }
      sessions.set(session.id, { ...current, calls: [...active, now()] });
      globalCalls = [...shared, now()];
    },
  };
}
