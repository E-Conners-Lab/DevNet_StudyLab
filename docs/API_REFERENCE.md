# Local contracts — final edition

The downloaded app has two real HTTP API endpoints, both on the study origin. Content/progress routes named `/api/...` in UI code are **in-browser adapter calls**, not server endpoints. No external-client compatibility is promised for those internal calls.

## HTTP API version 1

Base origin: `http://127.0.0.1:4318`. API responses include `X-API-Version: 1`. Incorrect methods return `405` with `Allow`; errors are JSON containing `error`, `correlationId`, and `apiVersion`. Error responses do not contain upstream error bodies or stack traces.

### GET /api/v1/session

Creates or reuses a local session and sets the HttpOnly, SameSite=Strict session cookie, scoped to `/api` with a one-hour expiry. The JSON response contains:

```json
{
  "csrfToken": "opaque-session-bound-value",
  "aiConfigured": false,
  "model": null,
  "promptVersion": "local-study-v1",
  "apiVersion": "1"
}
```

The response never contains the Anthropic key. Exact Host and browser-origin checks apply. The anti-CSRF value is used by the browser for the next tutor request; it is not a provider credential.

### POST /api/v1/tutor

Requires the session cookie, the exact study `Origin`, `X-CSRF-Token`, and `Content-Type: application/json`. The body is:

```json
{
  "messages": [{ "role": "user", "content": "Explain idempotent REST methods." }],
  "domain": "apis"
}
```

`domain` is optional/null or one of the six bundled domain slugs. Messages may only have `user` or `assistant` roles. Limits:

- 64 KiB HTTP body, 1–20 messages, 1–4,000 characters per message, 16,000 characters total.
- The final message must be from the user. Unknown fields are rejected.
- Five requests per session per minute and ten globally per minute; local sessions are bounded.
- A 30-second provider timeout and a 1,024-token provider generation cap.
- Provider response size is bounded; only text content is returned.

A successful response is `text/plain; charset=utf-8`. It is delivered after the bounded provider request, not as token-by-token provider streaming. The UI can consume it through its existing text-reader interface. A missing key/model returns `503`; invalid session/origin returns `403`; rate limiting returns `429` with `Retry-After`. Local limits are not a financial spending cap.

The only outbound destination is the fixed Anthropic Messages API. Neither an arbitrary provider URL nor tool execution is accepted. Model choice comes from the launcher environment, not the request body.

## In-browser study adapter

`apps/web/src/lib/local/client.ts` exports `localFetch`, which returns standard `Response` objects while reading bundled content and the local progress store. It rejects arbitrary URLs and has no fallback network request. Only `/api/chat` delegates to the versioned session/tutor gateway above.

| Internal path | Method | Purpose |
|---|---|---|
| `/api/flashcards` | GET | Cards, count, and per-domain counts; optional `domain` |
| `/api/flashcards/progress` | GET / POST | Load SM-2 progress or rate a known card with integer `quality` 0–5 |
| `/api/study/{slug}` | GET | Bundled study guide |
| `/api/study/progress` | GET / POST | Completed objective codes; write `{objectiveCode, completed}` |
| `/api/exams` | GET | Exam summaries; optional `domain` |
| `/api/exams/{examId}` | GET | Questions for an exam or `domain-quiz` |
| `/api/exams/{examId}/grade` | POST | Grade `{answers, timeTaken?}` and record an attempt |
| `/api/exams/attempts` | GET | Up to 100 recent local attempts |
| `/api/labs` | GET | Lab catalog; optional `domain` and `type` |
| `/api/labs/{slug}` | GET | Instructions, hints, starter code, and metadata |
| `/api/labs/{slug}/solution` | GET | Worked solution and expected output |
| `/api/labs/attempts` | GET | Draft/start/completion status |
| `/api/dashboard/stats` | GET | Statistics derived from the same local progress |
| `/api/tutor/conversations` | GET / POST | In-memory conversation summaries/create |
| `/api/tutor/conversations/{id}` | GET / PATCH / DELETE | In-memory messages, title update, deletion |
| `/api/tutor/conversations/{id}/messages` | POST | In-memory user/assistant message |
| `/api/chat` | POST | Fixed local tutor gateway delegation |

There is no HTTP lab-run endpoint. Browser execution uses the separate runner message protocol documented in `licenses/PYTHON.md` in the extracted download (`runtime/sandbox/README.md` in source).

## Progress backup contract

The storage key is `devnet-study-progress-v1`. Exported JSON has `schemaVersion: 1` and `contentVersion: "2026-09-27"`, followed by `objectives`, `flashcards`, `examAttempts`, `labs`, and `preferences`. Canonical content stays in bundled files; backups contain IDs and learner progress, not replacement curriculum. See `apps/web/src/lib/local/schema.ts` for exact validation.

Imports are capped at 2 MiB and validated before replacing existing state. Unsupported versions, unknown IDs, forbidden record keys, duplicates, malformed dates, out-of-range values, and oversized drafts are rejected. Each draft is capped at 128 KiB, and only the newest 100 exam attempts are retained. Tutor messages and credentials are excluded.

A failed storage write leaves recoverable changes in memory, produces a visible error, and must not be represented as a durable save. Export remains available. Multiple tabs are not synchronized. Writes compare the stored snapshot with the last value observed by that tab; a detected conflict preserves stored data and recoverable memory, then requires export/reload before further writes or import/reset. Use a single editing tab. Scores and completion are client-trusted learning aids, not authoritative credentials.
