# Local edition release review

Review date: 2026-09-27. This report supersedes the earlier full-stack audit. The supported release is a static, local study app with a small Node launcher, separate-origin browser Python, and optional bring-your-own-key Anthropic tutoring. It is an unmaintained educational snapshot, not a public web service.

## Release decision

Local package verification passed. This document records the local preparation evidence. Publication is conditional on GitHub CI, CodeQL, governance and artifact verification for the release commit; the published GitHub release notes record the final remote results. No security guarantee or ongoing maintenance commitment is implied.

## Changes made

- Removed accounts, database dependencies, Next server API routes, and the host Python execution service. Learner Python never reaches a host subprocess.
- Preserved guides, 199 flashcards, two 40-question exams, domain quizzes, seven labs, drafts and worked solutions. All 61 canonical objectives are used. Empty progress starts empty rather than displaying sample achievements.
- Added one validated, versioned browser progress store, backup/restore, visible storage errors, and detection of stale writes from another tab. Old database records are not silently migrated.
- Bundled Pyodide and the required Python packages with pinned hashes, sizes, upstream notices and source references. Five lab solutions execute in the browser. The shell/network exercises remain explicitly download-only.
- Retained optional AI with a local server-held key and user-selected model. The gateway enforces exact Host/Origin, session-bound CSRF, allowed methods, request/output limits, quotas, timeout, fixed HTTPS vendor destination and generic errors. The model has no tools.
- Added a prebuilt ZIP, file integrity manifest, archive checksum, JavaScript SBOM and third-party notices. The learner needs Node 24.21.0 or later within 24.x; no npm install, database or Docker is required.
- Replaced CI with pinned, least-privilege build/test/audit/secret-scan checks and a CodeQL workflow. Workflows are source changes until run on GitHub.

## Findings fixed during review

The former server-side arbitrary-code execution paths and publicly bound service stack were removed from the supported source. The new implementation's independent review found four additional defects: concurrent requests could reuse a stale tutor quota counter; prompt redaction missed common credential formats; two browser tabs could overwrite progress silently; a long tutor answer could exceed the next request’s history-message limit. Regression tests reproduced these, and all were fixed. Review also removed an ignored generated documentation manifest from packaging because it contained an absolute development path and obsolete endpoints.

Production browser checks caught missing preload nonces and dynamically recreated component styles. CSP permits trusted scripts with fresh nonces and exact built-style hashes, rather than broad script evaluation or arbitrary inline script execution. The native editor and all four packaged browser journeys pass with no CSP violations.

## Recorded verification

| Check | Result / scope |
|---|---|
| Clean source install | Node 24.21.0; reduced lockfiles install successfully |
| Dependency advisories | Root and complete web lock trees reported zero npm advisories at review time; repeat against the final commit |
| UI unit/integration suite | 97 tests passed; 89.25% statements, 81.11% branches, 87.87% functions, 91.29% lines at latest measured run |
| Content validation | 23 tests passed |
| Runtime, packaging and deterministic AI suite | 65 tests passed; latest measured runtime coverage 97.94% lines, 91.99% branches, 89.19% functions |
| Browser Python boundary | Real Chromium checks passed for Python/YAML/Jinja, blocked parent/external network, no host filesystem/DOM/storage, blocked child workers, timeout, cancellation, output cap and recovery |
| Bundled lab solutions | Five supported solution files executed successfully in the browser |
| Packaged UI | Four main user journeys passed with strict CSP checks; no outside-origin requests during the core study/backup flow |
| Secret scans | Gitleaks 8.30.0: no findings across all 35 Git commits or current publishable source at review time |
| ZIP integrity | Standard unzip integrity test passed; launcher rejects missing, changed, unexpected public files and unsupported manifests |
| Clean extracted download | ZIP extracted outside the source checkout; standalone Node launcher, dashboard and browser Python execution passed with no node_modules and no browser errors |
| Optional AI | 32 deterministic, versioned gate tests passed using simulated provider responses; one paid live browser-to-Anthropic smoke test passed with claude-haiku-4-5-20251001; comprehensive model-quality acceptance remains unverified |
| Configured tutor in browser | Passed through the real local session/CSRF gateway with a simulated provider; key absent from DOM, browser requests and local storage |

Coverage includes application TS/TSX and local data logic, excluding test files, generated type declarations and unchanged UI-library wrappers. Node coverage includes runtime modules and the asset downloader; the CLI entry is exercised by packaged browser tests. The iframe/worker modules are exercised in real-browser boundary tests, not included in Node line-coverage percentages. Do not interpret these percentages as every distributed dependency or every browser execution path being covered.

Local verification used macOS ARM64, Node 24.21.0 and Chromium/Chrome. Windows, Linux, Firefox and Safari were not exercised in this session. The committed Ubuntu CI workflow is prepared but has not run remotely. Reproduce with `npm run test:coverage --prefix apps/web`, `npm run test:content --prefix apps/web`, `npm run test:runtime`, `npm run release:build`, `npm run test:e2e --prefix apps/web`, `npm run test:sandbox` and `npm run test:tutor-browser` after installing the Playwright browser as described in SETUP.md.

## Security-control applicability

| Controls | Disposition |
|---|---|
| SEC-01 | Provider credentials stay server-side; ephemeral authorization cookie is HttpOnly. Browser progress is intentionally non-secret, client-trusted study data. CSRF material is not a provider credential. |
| SEC-02,03,27 | Tutor access is checked against the local session and origin. Static curriculum is public within the loopback app. N/A: multi-user ownership, account permissions and protected assessment results. |
| SEC-04,16,17 | N/A: no login, privilege transition, passwords, JWTs or refresh tokens. Local sessions expire after one hour. |
| SEC-05,07,23,26,36 | Strict input contracts, size bounds, constant-time CSRF comparison, method allowlists, exact Origin/Fetch Metadata checks and `/api/v1` responses. Progress imports reject unsupported schema/content versions. No separate reverse proxy is deployed. |
| SEC-06 | Tutor quotas and a bounded local session count; N/A: login/reset/OTP endpoints. |
| SEC-08 | Vendor transport uses HTTPS. N/A: public TLS/HSTS; listeners are fixed to 127.0.0.1. The local cookie intentionally lacks Secure. This is the user-selected local-only boundary, not a public-hosting design. |
| SEC-09,10,24,25 | CSP, frame restrictions, nosniff, no-store and no-referrer headers. Runner framing is allowed only by the study origin; main pages deny framing. |
| SEC-11,18,28 | HTTP failures are generic and correlated; tutor logs contain metadata only. N/A: account/admin/delete audit trails, since none exist. Local logs are not an immutable multi-user audit system. |
| SEC-12,13,14,15 | No distributed key; separate explicitly named optional tutor configuration. Users own provider key scope, rotation and spend limits. Removing/changing local configuration and restarting replaces the active key. No deployment credentials are supplied. |
| SEC-20,21,22 | N/A: hosted private files and general uploads. Local JSON backup import is size/schema/content validated before replacement; no uploaded media or metadata is served. |
| SEC-29,30 | Exact versions, committed lockfiles, dependency audits in CI; bundled Python bytes verified against a pinned manifest. No ongoing update service is promised. |
| SEC-31 | N/A: no container/Kubernetes release. JavaScript SBOM and Python manifest/notices are included. Local checksums detect accidental corruption; they are not a publisher signature or hosted build attestation. |
| SEC-32 | Loopback, unprivileged ports, no shell execution; CI read-only by default, CodeQL grants security upload only for its job. |
| SEC-34 | **Pending remote gate:** required review, signed commits, no force-push/admin bypass on release branches. Current main is unprotected. |
| SEC-35 | **Pending remote gate:** verify/enable push protection and a required CodeQL high/critical findings gate, and run CI for the final release commit. Workflow files alone do not enforce branch rules. |
| SEC-19 (legacy) | No directory listing; static files are inventoried and paths/methods constrained. |
| AI-1,2,3,4 | Untrusted message roles/boundaries, no model tools, best-effort redaction, versioned deterministic evaluation gate and redacted transport metadata. See AI_EVALUATION.md for the explicit live-model evidence gap and chosen-model procedure. No default model is distributed. |

## Public GitHub release gates

1. Review and commit the final source through a reviewed pull request and GitHub-signed squash merge. No personal signing credentials are created.
2. Run CI and CodeQL on that exact commit. Resolve high/critical findings and require the relevant checks.
3. Configure protected main/release branches with required human review, signed commits, blocked force pushes and no admin bypass. Verify secret scanning and push protection. The read-only remote check reported private visibility and unprotected main; unavailable security settings were not treated as enabled.
4. Publish the verified prebuilt ZIP and its SHA256SUMS alongside a tag pointing to the reviewed commit. Retain source, license notices and SBOM. GitHub's automatic source ZIP is not the ready-to-run asset.
5. Confirm the no-maintenance notice is visible. If the owner chooses to archive the repository, do so only after the release and downloads are verified. Archiving is not yet performed or assumed.

The release workflow publishes only after the remote gates above pass. The pre-existing deletion of `slides.html` was preserved without restoring or altering it.
