# Environment variables — final local edition

Core offline study requires **no environment variables**. The launcher optionally reads `.env` next to the release-root `package.json` using Node's environment-file support. Existing process environment values take precedence. Restart after edits.

| Name | Default | Purpose |
|---|---|---|
| `TUTOR_ANTHROPIC_KEY` | Unset | Your Anthropic API key, used only by the local launcher |
| `TUTOR_MODEL` | Unset | Exact model ID available to your Anthropic account |

Both values are required to enable the AI tutor. The model is configurable because API offerings age; no particular model is guaranteed to remain available. Consult [Anthropic's model IDs](https://platform.claude.com/docs/en/models/overview) and your account permissions. A provider chat subscription does not by itself configure this API integration.

Copy `.env.example` to `.env` and edit locally. Do not prefix these variables with `NEXT_PUBLIC_`, insert them into browser code, paste keys in chat, or include `.env` in a backup, issue, Git commit, or redistributed archive. `.env` is ignored by Git but is still a plaintext local file: restrict access on shared machines.

`ANTHROPIC_API_KEY` is **not** an alias in this project. The explicit `TUTOR_ANTHROPIC_KEY` name avoids accidentally reusing another tool's credentials. The old `DATABASE_URL`, `AUTH_SECRET`, `SKIP_AUTH`, `ALLOW_AUTH_BYPASS`, `LAB_ENGINE_URL`, and `SEED_DEMO_USER` configuration is not used by the final local runtime.

The launcher uses fixed loopback study/runner origins, not configurable public bind addresses. Do not add a public listener or arbitrary provider URL without a separate security design.

No provider request is made merely by opening guides, flashcards, exams, or labs. Tutor submission sends the entered chat/context to Anthropic and may incur charges. Local quotas limit bursts, not total cost; review provider billing limits. Remove the key and restart to disable the tutor.
