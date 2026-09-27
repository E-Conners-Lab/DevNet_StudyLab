# DevNet StudyLab -- Environment Variables

> **File location:** `apps/web/.env.local`

All environment variables used by the Next.js web application.

---

## Required Variables

### `DATABASE_URL`

PostgreSQL connection string for the application database.

| Property | Value |
|----------|-------|
| Required | Yes (for full functionality) |
| Default | None |
| Format | `postgresql://USER:PASSWORD@HOST:PORT/DATABASE` |

**Development default:**

```
DATABASE_URL=postgresql://studylab:studylab_dev_2024@localhost:5432/studylab
```

When unset, the app runs in file-only mode: content loads from JSON files and progress is not persisted to the database.

---

### `AUTH_SECRET`

Encryption key for Auth.js JWT sessions. Used to sign and verify session tokens.

| Property | Value |
|----------|-------|
| Required | Yes |
| Default | None (throws error if unset) |
| Format | Base64 string, 32+ bytes |

**Generate a secure value:**

```bash
openssl rand -base64 32
```

The application will throw an error on startup if `AUTH_SECRET` is not set. This ensures a secure secret is always explicitly configured.

---

## Optional Variables

### `TUTOR_ANTHROPIC_KEY`

API key for Claude (Anthropic) powering the AI Tutor feature. This variable is intentionally named `TUTOR_ANTHROPIC_KEY` rather than `ANTHROPIC_API_KEY` to avoid conflicts with the Claude Code CLI, which reserves `ANTHROPIC_API_KEY` for its own use.

| Property | Value |
|----------|-------|
| Required | No |
| Default | None |
| Format | `sk-ant-api03-...` |

When unset, the AI Tutor page loads and sending a message returns a chat message
explaining how to configure the key. All other features work without it.

(A `401` from `/api/chat` means something different: not signed in. See
`ALLOW_AUTH_BYPASS` below.)

**Get a key:** [console.anthropic.com](https://console.anthropic.com/)

---

### `SKIP_AUTH`

Bypasses authentication proxy. Used for E2E testing and development without a database.

| Property | Value |
|----------|-------|
| Required | No |
| Default | Not set (authentication enabled) |
| Values | `"true"` to skip auth |

When set to `"true"`:
- The proxy does not redirect unauthenticated users to `/login`
- `getCurrentUserId()` returns `null` (progress is not saved to DB)
- The app behaves as if no user is logged in
- The session gates on `/api/chat`, `/api/labs/{slug}/run` and
  `/api/labs/{slug}/solution` allow anonymous callers through

> **Exposure note.** With auth bypassed there is no per-user identity, so the
> rate limits for those routes all key on one shared local caller. That keeps the
> limits meaningful for a single-user lab, but an instance reachable from a
> network hands every caller the same quota - roughly 14,400 tutor requests a day
> against your Anthropic key, plus lab code execution. Only bypass auth on a
> machine you control. In production the bypass must be asserted explicitly with
> `ALLOW_AUTH_BYPASS` (below).

Set automatically by Playwright in `playwright.config.ts`:

```typescript
webServer: {
  env: {
    SKIP_AUTH: "true",
  },
},
```

---

### `ALLOW_AUTH_BYPASS`

Confirms that an open, unauthenticated deployment is intentional. Only consulted
when `NODE_ENV=production`.

| Property | Value |
|----------|-------|
| Required | Only in production, and only when auth would be bypassed |
| Default | Not set |
| Values | `"true"` to confirm an intentionally open production deployment |

Authentication is bypassed when `SKIP_AUTH=true` or `DATABASE_URL` is unset. In
development that is the normal single-user local mode. In production, inferring
"authentication off" from a *missing* variable fails open - an unmounted secret,
a typo, or a platform that supplies a differently-named database URL would all
quietly serve the app with no authentication.

So in production the bypass has to be asserted. If auth would be bypassed and
this variable is not `"true"`, the gated routes fail closed (a generic error, no
data served) and the server log carries the actionable message:

```
Authentication would be bypassed in production. Set DATABASE_URL to enable
authentication, or set ALLOW_AUTH_BYPASS=true to confirm an intentionally open
deployment.
```

Fixing it means one of:
- set `DATABASE_URL` so authentication actually works (what you usually want), or
- set `ALLOW_AUTH_BYPASS=true` if the deployment is deliberately open - read the
  exposure note under `SKIP_AUTH` first.

Development and Playwright runs are unaffected: both run with
`NODE_ENV=development`.

---

### `LAB_ENGINE_URL`

URL of the Docker-based lab engine service. Used to proxy code execution requests to the FastAPI lab engine instead of running Python locally.

| Property | Value |
|----------|-------|
| Required | No (recommended - see below) |
| Default | None |
| Format | Full endpoint URL, **not** just the host: `http://localhost:8100/api/v1/sandbox/run` |

This must be the complete endpoint URL. The route POSTs to this value directly,
so a bare `http://localhost:8100` returns **404** and every lab silently falls
back to local execution.

```bash
# Correct - matches the lab-engine's sandbox route
LAB_ENGINE_URL=http://localhost:8100/api/v1/sandbox/run
```

When unset, labs that support local execution (Python, API, NETCONF) will run code via a local `python3` subprocess. Labs requiring Docker (Bash, Docker, Ansible) will display a message that the lab engine is required - so set this once the Docker stack is running, or those labs stay unavailable.

---

### `POSTGRES_PASSWORD`

PostgreSQL password used by Docker Compose. This is a Docker-level variable, not a Next.js variable.

| Property | Value |
|----------|-------|
| Required | No |
| Default | `studylab_dev_2024` |
| Used by | `docker/docker-compose.yml` |

If changed, update `DATABASE_URL` to match.

---

## Example `.env.local`

```env
# ── Database ────────────────────────────────────────────
DATABASE_URL=postgresql://studylab:studylab_dev_2024@localhost:5432/studylab

# ── Auth.js ─────────────────────────────────────────────
AUTH_SECRET=your-generated-base64-secret-here

# ── AI Tutor (optional) ────────────────────────────────
# TUTOR_ANTHROPIC_KEY=sk-ant-api03-...

# ── Testing (do not set in production) ─────────────────
# SKIP_AUTH=true
```

---

## Variable Summary

| Variable | Required | Default | Used By |
|----------|----------|---------|---------|
| `DATABASE_URL` | For DB features | None | `lib/db/index.ts`, `proxy.ts`, `lib/auth-helpers.ts` |
| `AUTH_SECRET` | Yes | None | `lib/auth.ts` (Auth.js) |
| `TUTOR_ANTHROPIC_KEY` | For AI Tutor | None | `api/chat/route.ts` |
| `SKIP_AUTH` | For testing | Not set | `proxy.ts`, `lib/auth-helpers.ts` |
| `ALLOW_AUTH_BYPASS` | In production, if auth would be bypassed | Not set | `lib/auth-helpers.ts` |
| `LAB_ENGINE_URL` | No | None | `api/labs/[slug]/run/route.ts` |
| `POSTGRES_PASSWORD` | For Docker | `studylab_dev_2024` | `docker/docker-compose.yml` |
