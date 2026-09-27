# CCNA Automation Study Prep browser application

This folder contains the React/Next.js source for the final local edition. Next.js statically exports the UI; the downloadable app is served by the small Node loopback runtime, not a Next.js server. Accounts, database access, and server-side lab execution have been removed from the supported edition.

Start with the repository [README](../../README.md) and [SETUP](../../SETUP.md). From the repository root, `npm run release:build` builds the complete distributable app, including the separate browser Python runtime. `npm start` is the installed release's launcher command.

Main source areas:

- `src/app/dashboard/`: learning pages and settings.
- `src/lib/local/`: bundled content, versioned progress, grading, and the local data adapter.
- `src/hooks/`: study UI, optional tutor, and browser Python integration.
- `src/components/`: reusable UI.
- `../../runtime/`: loopback server, optional Anthropic gateway, Python assets, and security boundary.

See [architecture](../../docs/ARCHITECTURE.md), [local contracts](../../docs/API_REFERENCE.md), and the [security/maintenance policy](../../SECURITY.md). Historical refactor notes are not current installation instructions.
