# DevNet StudyLab — final local edition

A downloadable study companion for networking, Python, APIs, and automation. It includes six study guides, 199 spaced-repetition flashcards, two 40-question practice exams, domain quizzes, and seven coding exercises. Your progress stays in your browser, with JSON backup and restore.

**This is an unmaintained educational snapshot.** No future fixes, dependency updates, curriculum updates, or support responses are promised. It is designed for one person on a trusted computer, not public hosting. Forks and adaptations are welcome under the [ISC license](LICENSE).

The content follows the historical Cisco DevNet Associate 200-901 v1.1 curriculum. Cisco now calls the certification **CCNA Automation**; check [Cisco's current course and exam information](https://www.cisco.com/site/us/en/learn/training-certifications/training/courses/ccnaauto.html) before planning an exam. StudyLab is independent material, not an official Cisco product or a guarantee of current exam coverage or passing results.

## Download and run

1. Download the **prebuilt ZIP asset** from [GitHub Releases](https://github.com/E-Conners-Lab/DevNet_StudyLab/releases), then extract it. GitHub's automatically generated **Source code** ZIP is a developer download and needs a build.
2. Install [Node.js](https://nodejs.org/en/download) **24.21.0 or later within the 24.x series**. Use an up-to-date supported browser.
3. Open a terminal in the extracted release folder and run:

   ```sh
   npm start
   ```

4. Open **[http://127.0.0.1:4318](http://127.0.0.1:4318)**. Keep the terminal open; press Ctrl+C to stop.

The prebuilt release needs **no npm install, database, Docker, account, or API key**. The launcher serves bundled files only on your computer. Use the exact address above: `localhost` is intentionally not an alias.

See [SETUP.md](SETUP.md) for source builds, backups, optional AI setup, and troubleshooting. Verification results and remaining release gates belong in [the release review](docs/RELEASE_REVIEW.md); this README is not a certification that every gate has passed.

## What works locally

- Read the six guides and mark the 61 objectives complete.
- Review flashcards using spaced repetition.
- Take full practice exams or domain quizzes and revisit your recent results.
- Edit and save lab drafts, reveal hints and solutions, and download code.
- Run supported Python exercises in a separate browser worker using bundled Pyodide. Python cannot run host shell commands or access your computer's files. Network access and arbitrary package installation are unavailable. Exercises involving external APIs need their documented external environment; Git, Docker, Ansible, and device tasks may be simulations rather than real infrastructure operations.
- Export, import, and reset progress from **Settings**. Browser storage errors are visible; export immediately if changes cannot be saved.

Core study does not require an internet connection after download. Reference links open external websites only when you choose them. Python execution uses browser resource limits and a watchdog; it is not a hardened environment for running hostile third-party programs.

## Optional AI tutor — bring your own key

The tutor is optional and uses **your own Anthropic account**, API key, and model choice. Provider charges apply. Copy the release-root `.env.example` to `.env`, set `TUTOR_ANTHROPIC_KEY` and `TUTOR_MODEL`, and restart. See [the environment guide](docs/ENVIRONMENT_VARIABLES.md).

Only submitted chat and its conversation context are sent to Anthropic. The key stays in the local launcher; never paste it into the app, a lab, or a backup. Conversations stay in memory and disappear on reload. AI responses can be wrong, and future provider/model availability is not guaranteed. All other study tools work without it.

## Keep your work

Progress is specific to the browser profile and `127.0.0.1:4318` origin. Clearing browser data, using private browsing, or switching browsers/computers can lose it. Use **Settings → Export progress** regularly. Imports replace current progress after validation; export first if you want to keep both versions. Backups include lab drafts, so treat them as your personal files.

Only the previous browser flashcard store can migrate automatically. Old PostgreSQL accounts, exam history, and other database records do not migrate into this edition; retain your old database backup if you used the earlier development stack.

## For people who want to fork it

```sh
npm ci
npm ci --prefix apps/web
npm run release:build
```

Run these from the source repository root with the supported Node version. The build downloads and verifies pinned Python assets and produces the distributable app; subsequent use of the prebuilt release is offline. Source build and test instructions are in [SETUP.md](SETUP.md).

- [Architecture](docs/ARCHITECTURE.md)
- [Local HTTP and browser data contracts](docs/API_REFERENCE.md)
- [Security and maintenance policy](SECURITY.md)
- [Optional tutor evaluation and limitations](docs/AI_EVALUATION.md)
- [Content snapshot](docs/CONTENT_STRATEGY.md)

Original project code is ISC licensed. Bundled libraries and Python components retain their own licenses and notices; preserve those when redistributing.
