# DevNet StudyLab

A full-stack study platform for the **Cisco DevNet Associate (200-901)** certification exam. Built with Next.js, PostgreSQL, and mock Cisco APIs to provide an interactive, hands-on learning experience.

## Features

- **Study Hub** -- Track progress across all 6 exam domains with 61 objectives and completion checkboxes
- **Flashcards** -- SM-2 spaced repetition algorithm with 97 cards across all domains, synced to the database when authenticated
- **Practice Exams** -- 2 full 40-question practice exams and focused domain quizzes with scoring and attempt history
- **Study Guides** -- In-depth study guides for all 6 exam domains with objective-level progress tracking
- **Hands-on Labs** -- 7 labs (Python, REST API, Git, Docker, Bash, Ansible, NETCONF) with a CodeMirror editor featuring syntax highlighting, bracket matching, and autocompletion
- **AI Tutor** -- Claude-powered conversational tutor with domain-specific system prompts
- **Progress Persistence** -- All study progress saved to PostgreSQL (flashcards, exams, labs, objectives)
- **Authentication** -- Auth.js v5 with credentials provider and JWT sessions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TailwindCSS v4, shadcn/ui, CodeMirror 6, Lucide icons |
| Backend | Next.js API Routes, Drizzle ORM |
| Database | PostgreSQL 16 |
| Auth | Auth.js v5 (NextAuth 5 beta) |
| AI | Anthropic Claude API |
| Lab Engine | FastAPI (Python) with sandboxed code execution |
| Mock APIs | Meraki Dashboard, Catalyst Center, Webex Teams |
| Testing | Playwright (E2E), Vitest (unit) |
| Infrastructure | Docker Compose, Gitea (Git labs) |

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/E-Conners-Lab/DevNet_StudyLab.git devnet-studylab
cd devnet-studylab
npm install
cd apps/web && npm install && cd ../..

# 2. Start PostgreSQL
docker compose -f docker/docker-compose.yml up -d postgres

# 3. Configure environment
cp apps/web/.env.example apps/web/.env.local
# Edit .env.local with your values (see docs/ENVIRONMENT_VARIABLES.md)

# 4. Run migrations and seed data
cd apps/web
npm run db:generate
npm run db:migrate
npm run db:seed

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with `student@devnet.lab` / `devnet123`.

See [SETUP.md](./SETUP.md) for the full setup guide.

## Project Structure

```
devnet-studylab/
  apps/web/              Next.js frontend + API routes
  content/               Exam blueprint, flashcards, practice exams, labs, study guides
  docker/                Docker Compose and database init scripts
  docs/                  Architecture, API reference, routes, schema docs
  labs/                  Lab solution files
  scripts/               Database seeding and doc generation scripts
  services/lab-engine/   FastAPI lab execution engine + mock Cisco APIs
  tests/                 Content validation tests
```

## Documentation

- [SETUP.md](./SETUP.md) -- Step-by-step setup guide
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) -- System architecture and design decisions
- [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) -- Complete API documentation
- [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) -- Database schema reference
- [docs/ROUTES.md](./docs/ROUTES.md) -- Frontend route map
- [docs/CONTENT_STRATEGY.md](./docs/CONTENT_STRATEGY.md) -- Content authoring guidelines
- [docs/ENVIRONMENT_VARIABLES.md](./docs/ENVIRONMENT_VARIABLES.md) -- Environment variable reference

## Running Tests

```bash
# Unit tests
cd apps/web && npm test

# E2E tests (starts dev server automatically)
cd apps/web && npm run test:e2e

# Content validation
cd apps/web && npm run test:content

# All tests
cd apps/web && npm run test:all
```

## Exam Domains (200-901 v1.1)

| # | Domain | Weight |
|---|--------|--------|
| 1 | Software Development and Design | 15% |
| 2 | Understanding and Using APIs | 20% |
| 3 | Cisco Platforms and Development | 15% |
| 4 | Application Deployment and Security | 15% |
| 5 | Infrastructure and Automation | 20% |
| 6 | Network Fundamentals | 15% |

## License

ISC
