# DevNet StudyLab -- Setup Guide

Complete setup instructions from a fresh clone to a running development environment.

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | JavaScript runtime |
| npm | 10+ | Package management |
| Docker | 24+ | PostgreSQL and lab services |
| Docker Compose | 2.20+ | Multi-container orchestration |
| Git | 2.40+ | Version control |

**macOS users**: The easiest way to install Docker is via [Docker Desktop](https://www.docker.com/products/docker-desktop/), which includes both Docker and Docker Compose:

```bash
brew install --cask docker
```

After installing, **open the Docker Desktop app** and wait for it to finish starting (the whale icon in the menu bar should stop animating). Docker commands will not work until the Docker Desktop daemon is running.

Optional:
- **Python 3.11+** -- Only needed if developing the lab engine locally (instead of via Docker)

## Step 1: Clone and Install Dependencies

**Option A: Git clone (recommended)**

```bash
git clone https://github.com/E-Conners-Lab/DevNet_StudyLab.git devnet-studylab
cd devnet-studylab

# Install root dependencies
npm install

# Install web app dependencies
cd apps/web
npm install
cd ../..
```

**Option B: Download ZIP**

If you don't have Git installed, click the green **Code** button on the GitHub repo page and select **Download ZIP**. Extract the archive and open a terminal in the extracted folder:

```bash
cd DevNet_StudyLab-main

# Install root dependencies
npm install

# Install web app dependencies
cd apps/web
npm install
cd ../..
```

## Step 2: Start PostgreSQL

The database runs in Docker. Make sure Docker Desktop is running first (macOS: open the Docker Desktop app), then start PostgreSQL:

```bash
docker compose -f docker/docker-compose.yml up -d postgres
```

Verify it's healthy:

```bash
docker compose -f docker/docker-compose.yml ps
# Should show studylab-db as "healthy"
```

Default connection: `postgresql://studylab:studylab_dev_2024@localhost:5432/studylab`

## Step 3: Configure Environment Variables

Create the environment file:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/web/.env.local` with your values:

```env
# Required -- PostgreSQL connection string
DATABASE_URL=postgresql://studylab:studylab_dev_2024@localhost:5432/studylab

# Required -- Auth.js session encryption key
# Generate with: openssl rand -base64 32
AUTH_SECRET=your-generated-secret-here

# Optional -- Enables the AI Tutor feature
# To enable the AI Tutor, remove the leading "#" from the line below
# and replace with your Anthropic API key (get one at https://console.anthropic.com/)
TUTOR_ANTHROPIC_KEY=sk-ant-...
```

> **Tip:** In the `.env.example` file, `TUTOR_ANTHROPIC_KEY` is commented out with a `#` at the start of the line. To enable it, delete the `#` and the space after it, then paste your actual API key after the `=` sign.

See [docs/ENVIRONMENT_VARIABLES.md](./docs/ENVIRONMENT_VARIABLES.md) for the full variable reference.

## Step 4: Run Database Migrations and Seed

```bash
cd apps/web

# Generate migration files from the Drizzle schema
npm run db:generate

# Apply migrations to PostgreSQL
npm run db:migrate

# Seed content data (domains, objectives, flashcards, exams, labs)
# Also creates the default dev user: student@devnet.lab / devnet123
npm run db:seed
```

## Step 5: Start the Development Server

```bash
cd apps/web
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Log in with:
- **Email:** `student@devnet.lab`
- **Password:** `devnet123`

## Step 6: Start Lab Services (Optional)

The hands-on labs require the lab engine and mock APIs. Start all Docker services:

```bash
docker compose -f docker/docker-compose.yml up -d
```

This starts:

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL | 5432 | Database |
| Lab Engine | 8100 | Code execution sandbox |
| Mock Meraki | 8201 | Meraki Dashboard API simulator |
| Mock Catalyst | 8202 | Catalyst Center API simulator |
| Mock Webex | 8203 | Webex Teams API simulator |
| Gitea | 3001 | Git server for Git labs |

Each mock platform runs as its own service on the port above, and is *also*
mounted inside the lab engine under `/mock/<platform>` (e.g.
`http://localhost:8100/mock/meraki/api/v1/organizations`). Either address works.

Verify the stack is up - all services except Gitea report a health status:

```bash
docker compose -f docker/docker-compose.yml ps
```

To let labs execute code in the container sandbox rather than a local `python3`,
point the app at the lab engine. This must be the **full endpoint URL**, not just
the host:

```bash
# apps/web/.env.local
LAB_ENGINE_URL=http://localhost:8100/api/v1/sandbox/run
```

Bash, Docker and Ansible labs require this; without it they report that the lab
engine is needed.

## Running Without Docker

The app works without Docker or PostgreSQL. When `DATABASE_URL` is unset:

- All content loads from JSON files in `content/`
- Flashcard progress uses localStorage only
- Exam/lab/study progress is not persisted between sessions
- Authentication is bypassed (no login required)

This mode is used for E2E testing and quick development.

## Running Tests

```bash
cd apps/web

# Unit tests (Vitest)
npm test

# E2E tests (Playwright -- starts its own dev server)
npm run test:e2e

# Content validation (checks JSON content files)
npm run test:content

# Coverage report
npm run test:coverage

# All unit + content tests
npm run test:all
```

The lab engine has its own Python suite. It runs in a container, so no local
Python setup is required:

```bash
# from the repo root
docker run --rm -v "$PWD/services/lab-engine:/app" -w /app python:3.12-slim \
  sh -c 'pip install -q -r requirements-dev.txt && python -m pytest tests/ -v'
```

Two repo-level checks CI also runs:

```bash
# requirements.txt pins must match requirements.lock.txt (the image installs the lock)
python3 scripts/check-lock-drift.py

# every route, page, table and Python endpoint must be documented
cd apps/web && npm run docs:validate
```

## Drizzle Studio

Browse the database visually:

```bash
cd apps/web
npm run db:studio
```

Opens a web UI at [https://local.drizzle.studio](https://local.drizzle.studio).

## Troubleshooting

### Port 5432 already in use

Another PostgreSQL instance is running. Either stop it or change the port in `docker-compose.yml`:

```yaml
ports:
  - "5433:5432"  # Use port 5433 instead
```

Then update `DATABASE_URL` in `.env.local` to use port 5433.

### Migration errors

If migrations fail, reset the database:

```bash
docker compose -f docker/docker-compose.yml down -v
docker compose -f docker/docker-compose.yml up -d postgres
cd apps/web && npm run db:generate && npm run db:migrate && npm run db:seed
```

### E2E tests fail with login redirect

Make sure `reuseExistingServer` is `false` in `playwright.config.ts` and no other dev server is running on port 3000. Playwright needs to start its own server with `SKIP_AUTH=true`.

### AI Tutor shows "API key not configured"

Set `TUTOR_ANTHROPIC_KEY` in `apps/web/.env.local`. The tutor page still loads without it; you just cannot send messages. (This variable is intentionally named `TUTOR_ANTHROPIC_KEY` rather than `ANTHROPIC_API_KEY` to avoid conflicts with the Claude Code CLI environment.)
