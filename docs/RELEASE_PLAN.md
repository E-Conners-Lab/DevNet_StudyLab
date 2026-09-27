# Final local edition — implementation plan

Decision (2026-09-27): user selected a self-contained, local-only release and
browser execution where feasible, with optional bring-your-own-key AI retained.
No accounts, database, Docker, cloud account or paid API is required to study.
The existing Next/React interface and canonical content are retained; Next builds
static files and is not the installed application's server.

## Scope and phase gates

1. Prove browser Python isolation using a separately served runner origin with
   restrictive CSP, worker cancellation and no access to study state. Gate: Python
   runs; host files, study-origin access and external networking do not. If this
   cannot be established, ship downloads/instructions with an explicit limitation.
2. Replace server/database data paths with bundled content and one versioned
   browser progress store. Preserve guides, flashcards, exam grading/history, lab
   drafts/solutions and settings; provide validated export/import and visible
   storage failures. Gate: complete learning loops survive reload and backup restore.
3. Serve built assets through a small Node standard-library-only loopback runtime.
   A separate runner port serves only sandbox assets. Optional Anthropic tutoring
   uses a server-held environment key, short local httpOnly session, session-bound
   CSRF token, strict Origin/Host/Content-Type/method/body limits, global and session
   quotas, fixed vendor URL, bounded output, timeout and redacted errors. Gate:
   malicious requests fail without vendor calls; absent AI cannot block study.
4. Produce and test an extracted release archive containing prebuilt study files,
   vendored pinned Python assets, launcher, licenses, content version and checksums.
   Gate: no npm install/build/database is needed by a learner, no network request
   is made during core study, and all claimed features are exercised from the archive.
5. Test, scan, review and document the final snapshot, with an explicit end of
   maintenance, no monitored support promise, fork instructions and current/historical
   curriculum labeling. Meet 80% coverage for first-party shipped source with test
   files and unchanged third-party generated UI/runtime assets excluded explicitly.
   Prepare GitHub controls/release changes for the actual release commit. Publication
   and archival must follow passing release gates; never archive before verification.

## Architecture and contracts

Browser study origin (127.0.0.1:4318) → bundled static content and versioned local
study state. Browser sandbox origin (127.0.0.1:4319) → disposable Python worker.
Study origin → local /api/v1/session and optional /api/v1/tutor → fixed Anthropic
endpoint. The local process never executes learner Python or shell commands.

Local progress is client-trusted, self-study information, not protected assessment
results. Answers ship with the content. No PII or credentials belong in backups.
Schema v1 carries contentVersion, objective IDs, flashcard SM-2 state, bounded exam
history, lab drafts/completion and preferences. Consumers validate the entire
import before replacing current state; unknown versions/IDs, corrupt or oversized
payloads are rejected. A previous flashcard-only store is migrated explicitly.
Content files remain the source of truth; imports reference IDs instead of
redefining curriculum. Storage write errors must be visible and must not masquerade
as durable saves. Export is available even if browser storage is unavailable.

Assumed load: one local learner, six domains, 199 cards, two 40-question exams and
seven labs; verify actual counts at build. At most 100 retained exam attempts,
128 KiB per lab draft and 2 MiB backup input. Progress validation is linear in this
bounded data. One Python worker at a time, bounded output and watchdog timeout;
worker/tab resource limits are browser limits, not a claim of OS-grade containment.
The app contains no secrets; optional AI credentials exist only in the local
process environment. Browser-origin separation and CSP, not Python name filtering,
provide the browser runner boundary.

Identity table (no infrastructure automation):

| Identity | Needs | Must not have |
|---|---|---|
| Local learner session | Optional tutor calls, study assets | Vendor key, server filesystem operations |
| Python worker | Bundled runtime/assets, virtual memory filesystem | Study origin/storage, external network, host files/processes |
| Local launcher | Read verified release files, fixed vendor HTTPS when opted in | Shell execution, arbitrary path/URL access, privileged ports |
| CI | Source read; scoped artifact/security upload in explicit jobs | Repository admin, secrets while executing untrusted PR code |

## Plan/design self-review

| Rules | Resolution |
|---|---|
| PLAN-01,15; SYS-15 | PASS: sandbox prototype first, clean-archive full study loop and observable failure tests before release |
| PLAN-02,03 | PASS: no public hosting, new accounts/DB, arbitrary OS execution, or required remote services; existing UI/content reused |
| PLAN-04,05; SYS-11 | PASS: canonical IDs; integer counts/days, UTC timestamps; content not duplicated in imported state |
| PLAN-06; SYS-12 | PASS: explicit v1 progress schema/version rejection, versioned optional HTTP API and served version header |
| PLAN-07 | PASS: validate before import replacement, persist before saved indication, sanitize before rendering, package before clean-extract verification, publish before archive |
| PLAN-08,09,11; SYS-04,06,07 | PASS: boundaries above; self-grading honestly client-trusted; no credential fields in browser/backup; threat tests at local HTTP and sandbox boundaries |
| PLAN-10; SYS-02,08,09,10 | PASS: bounded one-user state and one worker; linear processing; actual startup/archive/runtime sizes measured before claims |
| PLAN-12,13,14 | PASS: Pyodide 314.0.7 registry/docs checked 2026-09-27, MPL-2.0; vet locked asset hashes/advisories and preserve upstream license/source notices before distribution. Existing framework tree audited/pinned; Node-only runtime adds no server dependencies |
| SYS-01,03 | PASS: static local learning edition, two loopback origins and optional tightly bounded tutor proxy |
| SYS-05 | N/A: no public TLS deployment/workload certificates. Vendor HTTPS uses platform certificate verification |
| SYS-13,14 | PASS: validated atomic store replacement; errors preserve recoverable in-memory state; no network/AI/sandbox failure blocks study; no destructive data migration |

Threat cases: hostile site targeting loopback APIs; DNS rebinding via Host; cross-site
mutations/spend; malformed or huge imports/messages; sandbox attempts to read study
storage/fetch parent origin/exfiltrate/spawn children; endless code/output; unavailable
AI or storage; incompatible future schema; unsafe archive paths and missing assets.
