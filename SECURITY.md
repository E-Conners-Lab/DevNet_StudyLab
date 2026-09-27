# Security and maintenance policy

## Support status

This is a final, **unmaintained educational snapshot**. No ongoing security fixes, dependency updates, model evaluations, curriculum corrections, or support responses are promised. No version has a promised maintenance period. Passing release checks means only that the recorded checks passed for that exact snapshot; it does not guarantee future safety.

Use an updated browser and a patched supported Node 24.x runtime on a trusted personal computer. Anyone distributing a fork or exposing a service assumes responsibility for its security review, dependency maintenance, and user support.

## Intended boundary

- One learner, loopback-only listeners at `127.0.0.1:4318` and `127.0.0.1:4319`. Do not expose these through a reverse proxy, tunnel, port forwarding, or a shared network.
- The released runtime serves bundled static assets and an optional, narrowly scoped Anthropic tutor gateway. No database, learner accounts, server-side Python/shell execution, device access, arbitrary URL proxy, or uploaded-file hosting is provided.
- Python runs in a disposable worker on a separate browser origin. Restrictive CSP and validated cross-origin messages limit capabilities. Browser resource exhaustion is still possible; this is not an OS sandbox for hostile programs.
- Progress is client-trusted self-study data. Answer keys ship in the download. Scores and completion marks are not proof of identity, certification, or tamper-resistant assessment results.
- Browser progress and downloaded backups are not encrypted. Drafts may contain whatever you type. Do not store real credentials, personal/confidential data, or production configurations in them.

## Optional AI

The launcher reads `TUTOR_ANTHROPIC_KEY` and `TUTOR_MODEL` from its environment or a local `.env`. It never sends the provider key to browser JavaScript. Submitted tutor messages and conversation context leave your machine for Anthropic; provider terms, retention practices, availability, and charges apply. Built-in redaction is a best-effort safeguard, not a guarantee that sensitive text will be recognized. Do not submit sensitive information.

The gateway checks the exact Host/Origin, request method/content type/body limits, a short local session, and a session-bound CSRF token. Requests and outputs are bounded, with local quotas and timeouts. These controls do not provide account-level spending limits, defend against hostile software already running on your computer, or make public hosting appropriate. The tutor has no tools and cannot execute lab code or change devices. Model output remains untrusted and can be incorrect. See [the deterministic gate and chosen-model evaluation procedure](docs/AI_EVALUATION.md); no live model behavior is certified by this release.

The local HTTP session cookie is HttpOnly and explicitly SameSite=Strict. This loopback-only edition does not claim HTTPS/Secure-cookie transport protections or the authentication controls required for a public service. Never reuse this session model for internet deployment without a new design and review.

## Reporting and forks

There is **no monitored vulnerability-response commitment**. Do not publish secrets, personal data, or sensitive exploit details in issues. If GitHub private vulnerability reporting is available, it may be used, but availability does not imply anyone will read or address a report. An archived repository cannot accept normal contributions; publish improvements in a clearly identified fork.

If you discover a problem in your copy, stop using the affected feature and remove any configured key. If a provider key was exposed, revoke it in the provider account. Inspect the release review and upstream advisories before deciding whether to keep using or redistribute this snapshot.

See [docs/RELEASE_REVIEW.md](docs/RELEASE_REVIEW.md) for actual release evidence and unresolved gates, and [docs/RELEASE_PLAN.md](docs/RELEASE_PLAN.md) for the accepted local-edition design.
