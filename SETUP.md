# Setup — final local edition

This guide describes the downloadable local edition. Accounts, PostgreSQL, Docker, and the old server-side Python execution service are not part of this edition.

## Run the prebuilt release

Install Node.js **24.21.0 or later within 24.x** and a current browser. Download and extract the prebuilt ZIP from [Releases](https://github.com/E-Conners-Lab/DevNet_StudyLab/releases). Open a terminal in the folder containing `package.json` and run:

```sh
npm start
```

You can also invoke the launcher directly:

```sh
node runtime/start.mjs
```

Open [http://127.0.0.1:4318](http://127.0.0.1:4318). The separate Python runner uses `127.0.0.1:4319`. Both ports must be free. Keep the terminal running and use Ctrl+C to stop. No package installation or network connection is required for core study in this prebuilt package.

Do not open the HTML files with `file://`, change the hostname to `localhost`, expose the ports to a network, or place the app behind a public tunnel. The two exact origins are part of the browser isolation boundary.

## Enable optional AI tutoring

You need an Anthropic API account, an API key, and a model available to your account. API usage may incur charges independently of a chat subscription.

From the extracted release root, copy the example configuration:

```sh
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead. Edit `.env` locally and set `TUTOR_ANTHROPIC_KEY` and `TUTOR_MODEL`. Use a model ID from [Anthropic's model documentation](https://platform.claude.com/docs/en/models/overview). Both values are required; the app deliberately supplies no permanently promised default model.

Restart StudyLab with `npm start`. Environment variables already set in the launching process take precedence over `.env`. Never commit, upload, or share `.env`; never paste the key into chat or a lab. Remove the key and restart to turn tutoring off.

The tutor sends submitted chat and recent conversation context to Anthropic. Conversations remain in browser memory and are excluded from progress backups. Core study still works if the key is missing, the provider is unavailable, or a model is retired. Local request limits reduce accidental bursts but are not a monetary spending cap: set account limits with the provider.

## Save, back up, and restore

Objective completion, flashcard scheduling, the latest 100 exam attempts, lab drafts/completion, and preferences are stored in your browser profile. Drafts are limited to 128 KiB each; backup imports are limited to 2 MiB.

- In **Settings**, select **Export progress** and keep the downloaded JSON somewhere safe.
- To move to another browser or computer, launch the same edition and import that file through **Settings**. Import replaces the destination progress after full validation.
- Unsupported schema/content versions, unknown curriculum IDs, and malformed backups are rejected. An invalid import does not erase your current progress.
- If storage is full or unavailable, the page retains recoverable changes in memory and shows a warning. Export before closing or reloading.
- **Reset progress** clears this edition's progress after confirmation. Export first if you may need it later.

The old `devnet-flashcard-progress` browser entry is migrated only when no new-format progress exists. The old entry remains unchanged. Old database records do not migrate; keep a separate backup of that database rather than running destructive reset commands.

Use one study tab for edits. Tabs do not synchronize: a save checks whether stored progress changed since the tab loaded and stops on a detected conflict. Export the unsaved tab before reloading; import/reset also require a reload after a conflict. Backups include your lab text and are not encrypted. Do not enter real secrets or confidential information into exercises.

## Build from source

The GitHub **Code → Download ZIP** and **Source code** release assets contain source, not a ready-to-run app. Extract them, then run these commands from the repository root:

```sh
npm ci
npm ci --prefix apps/web
npm run release:build
```

The build requires internet access for npm packages and any uncached, pinned Python assets. Python runtime files are checked against the committed integrity manifest. The output is the release artifact to run or redistribute; follow the build output for its location. Do not distribute a developer checkout containing `.env`, caches, test traces, or personal data.

Checks available to contributors:

```sh
npm test
npm run test:content --prefix apps/web
npm run test:coverage --prefix apps/web
npm run lint --prefix apps/web
node --test runtime/tests/*.test.mjs
npx --prefix apps/web playwright install chromium
npm run test:e2e --prefix apps/web
npm run test:sandbox
npm run test:tutor-browser
```

Browser verification must target the built release and its local launcher. See [the release review](docs/RELEASE_REVIEW.md) for the exact commands/results used for the final artifact. A passing source test alone does not establish that a packaged download contains every required asset.

## Troubleshooting

To check a download, compare the ZIP's SHA-256 with the accompanying `SHA256SUMS.txt`. On macOS use `shasum -a 256 devnet-studylab-1.0.0.zip`; on Linux use `sha256sum devnet-studylab-1.0.0.zip`; on Windows PowerShell use `Get-FileHash devnet-studylab-1.0.0.zip -Algorithm SHA256`. These checks detect corruption; an unsigned checksum is not proof of publisher identity. The launcher also verifies the extracted files before starting.

**“Unsupported Node version.”** Run `node --version` in the same terminal. Use Node 24.21.0 or a later patched 24.x release; reopen the terminal after installation.

**Missing build or runtime files.** Extract the complete prebuilt release ZIP. A source ZIP needs the build steps above. Do not use files from two different releases together.

**Port already in use.** Stop the earlier StudyLab process with Ctrl+C or identify the application using ports 4318/4319. Do not terminate unrelated processes or change the configured origins to work around this.

**Page denied or runner will not connect.** Use exactly `http://127.0.0.1:4318`. Keep both launcher listeners available. Browser extensions or managed-browser policies may block workers/Wasm; reading, flashcards, and downloadable code remain useful without the runner.

**Python reports an unavailable module or blocked network request.** Only bundled packages are supported. No `pip`/CDN installation or external API access is available inside the browser runner. Use the exercise's instructions and download option where a separate environment is required.

**Tutor unavailable or rate limited.** Check both local environment variables, model access, provider account/usage limits, and connectivity. Restart after configuration changes. Wait at least one minute after a local rate limit; start a new conversation when the context limit is reached. Do not share your key in a bug report.

There is no maintained help desk or promised response time for this snapshot.
