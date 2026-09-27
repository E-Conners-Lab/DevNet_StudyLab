# Architecture — final local edition

CCNA Automation Study Prep is a static browser learning application plus a small loopback launcher. Next.js/React are build tools and UI infrastructure; **Next.js is not the installed application's server**. The release requires Node 24.21.0 or later in 24.x, with no installed npm dependencies at runtime.

```text
Browser: 127.0.0.1:4318
  ├── bundled guides/cards/exams/labs
  ├── local validated progress → browser storage / JSON backup
  ├── Python iframe: 127.0.0.1:4319 → disposable Wasm worker
  └── optional chat → /api/v1/session + /api/v1/tutor
                                      └── fixed Anthropic HTTPS endpoint
```

## Content and study state

`content/` is the canonical curriculum. `apps/web/src/lib/local/catalog.ts` statically imports it into the browser build. Content is available offline, including worked solutions and answer keys. The product does not claim protected grading or certification integrity.

`schema.ts` defines versioned, bounded progress. `store.ts` owns browser persistence, explicit legacy flashcard migration, import/export/reset, and subscriber notifications. Failed writes retain recoverable in-memory changes and surface an error. `use-study.ts` connects the store to React. `client.ts` adapts the former API-shaped UI calls into local functions; it rejects arbitrary network destinations. Exam scoring, SM-2 scheduling, and dashboard aggregation use the same catalog/state.

Progress belongs to one browser profile and origin, not an account. There is no cross-tab synchronization, cloud synchronization, database, or authenticated learner identity. Writes detect a changed stored snapshot and fail closed with an export/reload message instead of silently replacing another tab’s saved progress. Reset/import are explicit replacement operations. Do not promise that old PostgreSQL records migrate; only the legacy browser flashcard store is handled.

## Browser Python

The launcher binds a second listener on `127.0.0.1:4319` for runner assets. The study page embeds that distinct origin and exchanges versioned, validated messages. Each run starts a fresh worker and virtual filesystem. Stop/watchdog termination destroys the worker. Output and source are bounded.

The worker uses locally bundled Pyodide and selected packages; it does not fetch a CDN or accept arbitrary package installation. HTTP CSP headers on both frame and worker constrain networking and worker creation. The runner has no generic proxy, filesystem API, or host command execution endpoint. Its Python/JavaScript bridge exists; origin separation and CSP provide the boundary rather than Python import filtering.

This does not impose OS-grade memory isolation. Browser resource exhaustion remains possible. External device/API exercises and host CLI operations are outside the in-browser runtime. See `licenses/PYTHON.md` in the extracted download (`runtime/sandbox/README.md` in source) for the runner boundary and pinned asset notices.

## Optional tutor

The launcher alone receives `TUTOR_ANTHROPIC_KEY`; the browser receives no provider key. `TUTOR_MODEL` is configured locally so a user can select an available model without rebuilding. Selecting a future model does not certify its behavior or guarantee compatibility.

The gateway accepts only a fixed Messages API call after exact Host/Origin, method, content type, body, session/CSRF, and rate checks. It bounds context/output, sets a timeout, returns generic correlated errors, and logs metadata rather than prompts or credentials. It has no model tools and no connection to Python execution. Prompt redaction is best-effort and does not authorize sending sensitive material.

Tutor conversation history exists only in browser memory. Reloading clears it, and it is absent from progress backups. Submitted messages and context reach Anthropic under that provider's policies. Network/provider/model failures do not block other study tools.

## Packaging and operation

A prebuilt release contains the static web output, runner assets, Node launcher/runtime, pinned Python assets and notices, license, setup documentation, and integrity metadata. A source archive additionally needs the documented npm/build workflow. The launcher serves only inventoried release files and rejects unsupported paths/methods; it does not serve the entire extraction directory.

`npm run release:build` prepares the distributable package. Verify the extracted artifact on its own: clean startup, complete learning loops, persistence/restore, Python restrictions, unavailable tutor, and absence of external requests during core study. Record actual results in the release review rather than inferring readiness from architecture.

## Maintenance boundary

This snapshot has no promised updates or support. It removes the former account/database/Docker service stack from the learner's runtime, reducing required moving parts. It cannot remove vulnerabilities discovered later in browsers, Node, Python, bundled libraries, or content. Public hosting, new network/device capabilities, additional packages, or model/tool changes require a fork's own design, security review, and validation.
