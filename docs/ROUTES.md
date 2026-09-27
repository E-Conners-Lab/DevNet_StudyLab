# DevNet StudyLab -- Frontend Route Map

> **Last updated:** 2026-02-27
> **Version:** 1.0.0
> **Framework:** Next.js 16 App Router

---

## Table of Contents

1. [Route Overview](#route-overview)
2. [Root (/)](#root-)
3. [Dashboard (/dashboard)](#dashboard-dashboard)
4. [Study Hub (/dashboard/study)](#study-hub-dashboardstudy)
5. [Study Guide (/dashboard/study/[slug])](#study-guide-dashboardstudyslug)
6. [Hands-on Labs (/dashboard/labs)](#hands-on-labs-dashboardlabs)
7. [Lab Execution (/dashboard/labs/[slug])](#lab-execution-dashboardlabsslug)
8. [Practice Exams (/dashboard/practice)](#practice-exams-dashboardpractice)
9. [Exam Taking (/dashboard/practice/exam)](#exam-taking-dashboardpracticeexam)
10. [Flashcards (/dashboard/flashcards)](#flashcards-dashboardflashcards)
11. [AI Tutor (/dashboard/tutor)](#ai-tutor-dashboardtutor)
12. [API Routes](#api-routes)

---

## Route Overview

| Path | Page File | Type | Purpose |
|------|-----------|------|---------|
| `/` | `app/page.tsx` | Server | Redirect to `/dashboard` |
| `/login` | `app/login/page.tsx` | Client | Authentication login form |
| `/signup` | `app/signup/page.tsx` | Client | Account creation form |
| `/dashboard` | `app/dashboard/page.tsx` | Client | Main dashboard with progress overview |
| `/dashboard/study` | `app/dashboard/study/page.tsx` | Client | Study hub with domains and objectives |
| `/dashboard/study/[slug]` | `app/dashboard/study/[slug]/page.tsx` | Client | Domain study guide with topics and resources |
| `/dashboard/labs` | `app/dashboard/labs/page.tsx` | Client | Hands-on lab catalog with filters |
| `/dashboard/labs/[slug]` | `app/dashboard/labs/[slug]/page.tsx` | Client | Lab execution environment with code editor |
| `/dashboard/practice` | `app/dashboard/practice/page.tsx` | Client | Practice exams and past attempts |
| `/dashboard/practice/exam` | `app/dashboard/practice/exam/page.tsx` | Client | Exam-taking interface with timer and grading |
| `/dashboard/flashcards` | `app/dashboard/flashcards/page.tsx` | Client | Spaced repetition flashcard system |
| `/dashboard/tutor` | `app/dashboard/tutor/page.tsx` | Client | AI Tutor chat interface |
| `/dashboard/settings` | `app/dashboard/settings/page.tsx` | Client | User settings and study preferences |

### Layout Hierarchy

```
app/layout.tsx (root -- html, body, metadata, SessionProvider)
  app/page.tsx (redirect to /dashboard)
  app/login/page.tsx
  app/signup/page.tsx
  app/dashboard/layout.tsx (sidebar + main content)
    app/dashboard/page.tsx
    app/dashboard/study/page.tsx
    app/dashboard/study/[slug]/page.tsx
    app/dashboard/labs/page.tsx
    app/dashboard/labs/[slug]/page.tsx
    app/dashboard/practice/page.tsx
    app/dashboard/practice/exam/page.tsx
    app/dashboard/flashcards/page.tsx
    app/dashboard/tutor/page.tsx
    app/dashboard/settings/page.tsx
```

---

## Login (/login)

**File:** `apps/web/src/app/login/page.tsx`
**Component:** `LoginPage` (Client Component)

### Purpose
Authentication page for email/password login. Redirects to `/dashboard` on successful authentication.

### Key Components

| Component | Purpose |
|-----------|---------|
| Login form | Email and password fields with submit button |
| Error display | Shows authentication errors |
| Brand header | App name and description |

### Behavior
- Protected routes (`/dashboard/*`) redirect here when the user is not authenticated
- On successful login, redirects to `/dashboard`
- When `SKIP_AUTH=true` or `DATABASE_URL` is unset, this page is bypassed

---

## Signup (/signup)

**File:** `apps/web/src/app/signup/page.tsx`
**Component:** `SignupPage` (Client Component)

### Purpose
Account creation page. Registers a local account, then signs the new user in and
sends them to `/dashboard`.

### Key Components

| Component | Purpose |
|-----------|---------|
| Signup form | Name, email, password and confirm-password fields |
| Error display | Shows validation and registration errors |
| Brand header | App name and description |

### Behavior
- Submits to `POST /api/auth/signup`, then calls `signIn("credentials", ...)`
- On success, redirects to `/dashboard`; if the automatic sign-in fails, falls
  back to `/login`
- Requires a configured `DATABASE_URL` - registration returns `503` without one
- The endpoint is rate limited to 5 attempts per minute per caller address

### Data Requirements
- `POST /api/auth/signup` (account creation)

---

## Root (/)

**File:** `apps/web/src/app/page.tsx`
**Component:** `Home` (Server Component)

### Purpose
Entry point that immediately redirects to the dashboard. No UI is rendered.

### Behavior
- Uses Next.js `redirect("/dashboard")` for a server-side 308 redirect
- Users landing on the root URL are seamlessly sent to the dashboard

### Key Components
- None (redirect only)

### Data Requirements
- None

---

## Dashboard (/dashboard)

**File:** `apps/web/src/app/dashboard/page.tsx`
**Component:** `DashboardPage` (Client Component)

### Purpose
Main overview page showing the student's exam preparation progress at a glance. Provides weighted progress across all six domains, key statistics, and recent activity.

### Layout
The dashboard layout (`dashboard/layout.tsx`) wraps all dashboard pages with:
- **Desktop sidebar** (280px, always visible on `md+` screens)
- **Mobile sidebar** (Sheet component, triggered by hamburger menu)
- **Main content area** with ScrollArea

### Key Components

| Component | Purpose |
|-----------|---------|
| `StatsCard` (x4) | Overall Progress %, Study Streak, Best Score, Study Time |
| `DomainCard` (x6) | Per-domain progress card with objectives, flashcards due, labs done |
| `Progress` | Exam Readiness progress bar with weighted calculation |
| `Badge` | Status indicators (Exam Ready / On Track / Keep Going) |
| Recent Activity list | Last 4 study actions with icons and timestamps |

### Data Requirements

| Data | Source | Description |
|------|--------|-------------|
| Domain progress | `GET /api/dashboard/stats` (DB) | Percentage per domain |
| Domain weights | Hardcoded (matches exam blueprint) | 15-20% per domain |
| Objectives stats | `GET /api/dashboard/stats` (DB) | Completed vs total |
| Flashcards due | `GET /api/dashboard/stats` (DB) | Cards needing review |
| Lab completion | `GET /api/dashboard/stats` (DB) | Labs done vs total |
| Recent activity | `GET /api/dashboard/stats` (DB) | Last actions with timestamps |

### Interactive Features
- Domain cards link to the study page
- Stats cards display trend indicators
- Responsive grid layout (1 col mobile, 2 col tablet, 3 col desktop for domain cards)

---

## Study Hub (/dashboard/study)

**File:** `apps/web/src/app/dashboard/study/page.tsx`
**Component:** `StudyPage` (Client Component)

### Purpose
Comprehensive study tracker organized by exam domain. Students can expand each domain to see all objectives, toggle completion status, and link to related labs.

### Key Components

| Component | Purpose |
|-----------|---------|
| Overall completion card | Total objectives completed / total with progress bar |
| Domain accordion (x6) | Expandable cards for each exam domain |
| Objective checklist | Per-objective toggle with completion state |
| Lab link button | Quick link to related lab (when `labSlug` exists) |
| Study link button | Opens domain study material |

### Data Requirements

| Data | Source | Description |
|------|--------|-------------|
| Study domains (6) | `GET /api/study/progress` (DB with file fallback) | Domain metadata |
| Objectives per domain | `GET /api/study/progress` (DB with file fallback) | All 61 exam objectives |
| Completion state | `GET/POST /api/study/progress` (DB) | Which objectives are done |
| Lab slugs | Hardcoded per objective | Links objectives to related labs |

### Interactive Features
- **Expand/collapse** domains with chevron animation
- **Toggle completion** per objective (checkbox-style)
- **Progress calculation** updates in real-time as objectives are toggled
- **Lab shortcut** icon appears on hover for objectives with associated labs
- **Study shortcut** icon appears on hover for all objectives
- Completed objectives show strikethrough text styling

---

## Study Guide (/dashboard/study/[slug])

**File:** `apps/web/src/app/dashboard/study/[slug]/page.tsx`
**Component:** `StudyDomainPage` (Client Component)

### Purpose
Domain-specific study guide providing in-depth coverage of exam topics. Each guide covers the domain's objectives with key points, exam tips, practice scenarios, and external resources.

### Key Components

| Component | Purpose |
|-----------|---------|
| Breadcrumb navigation | Back link to Study Hub |
| Domain overview card | Domain name, exam weight percentage, description |
| Topic cards (expandable) | Key objectives with expandable content |
| Key points list | Important facts and concepts per topic |
| Exam tips | Tips specific to the exam for each topic |
| External resources | Links to Cisco docs and other references |
| Practice scenarios sidebar | Real-world scenarios for applied learning |
| Common mistakes sidebar | Pitfalls to avoid on the exam |

### Data Requirements

| Data | Source | Description |
|------|--------|-------------|
| Study guide content | `GET /api/study/{slug}` | Full study guide data from JSON files |
| Completion state | Local state | Objective completion tracking |

---

## Hands-on Labs (/dashboard/labs)

**File:** `apps/web/src/app/dashboard/labs/page.tsx`
**Component:** `LabsPage` (Client Component)

### Purpose
Catalog of all hands-on coding labs. Students can filter by technology category, see difficulty levels, track completion status, and launch labs.

### Key Components

| Component | Purpose |
|-----------|---------|
| Header with badges | Shows completed and in-progress counts |
| Filter tabs | Category filter (All, Python, API, Git, Docker, Bash, Ansible, NETCONF) |
| Lab card grid | 2-column grid of lab cards |
| Lab card | Title, description, domain badge, difficulty badge, time estimate, status, action button |

### Data Requirements

| Data | Source | Description |
|------|--------|-------------|
| Lab definitions (7) | `GET /api/labs` (DB with file fallback) | Lab metadata and content |
| Lab status | `GET /api/labs/attempts` (DB) | not_started, in_progress, completed |
| Categories | Hardcoded enum | All, Python, API, Git, Docker, Bash, Ansible, NETCONF |

### Interactive Features
- **Tab filtering** by technology category with instant re-render
- **Difficulty badges** color-coded (blue=beginner, amber=intermediate, red=advanced)
- **Status indicators** with icons (circle=not started, rotating=in progress, check=completed)
- **Action button** changes label: "Start" / "Continue" / "Redo"
- **Responsive grid** (1 col mobile, 2 col tablet+)

### Lab Categories

| Category | Icon | Labs |
|----------|------|------|
| Python | Code2 | Python Data Parsing |
| API | Globe | REST API Client |
| Git | GitBranch | Git Version Control |
| Docker | Container | Docker Containers |
| Bash | Terminal | Bash Scripting |
| Ansible | Terminal | Ansible Playbooks |
| NETCONF | Server | NETCONF/RESTCONF |

---

## Lab Execution (/dashboard/labs/[slug])

**File:** `apps/web/src/app/dashboard/labs/[slug]/page.tsx`
**Component:** `LabExecutionPage` (Client Component)

### Purpose
Interactive lab environment with a split-view layout: instructions on the left, code editor and terminal output on the right. Students write code, execute it, and see results in real time.

### Key Components

| Component | Purpose |
|-----------|---------|
| Top bar | Lab title, difficulty badge, estimated time, back button |
| Instructions panel (60%) | Markdown-rendered instructions with code blocks |
| Hints tab | Progressive hint reveal system |
| Learning objectives box | Emerald-styled objectives list |
| Code editor (40%) | CodeMirror 6 with Python syntax highlighting, oneDark theme, bracket matching, and autocompletion |
| Editor toolbar | Copy code, reset to starter code |
| Action buttons | Run Code, Reset, Show Solution |
| Output terminal | Execution output with pass/fail indicator and timing |
| Solution panel | Reference solution (hidden by default) |

### Data Requirements

| Data | Source | Description |
|------|--------|-------------|
| Lab content | `GET /api/labs/{slug}` | Instructions, starter code, hints, objectives |
| Solution | `GET /api/labs/{slug}/solution` | Reference solution and expected output |
| Execution result | `POST /api/labs/{slug}/run` | Output, success status, execution time |

### Interactive Features
- **Split-view layout** (60/40 instructions/editor)
- **Tab key** inserts 4 spaces in the editor
- **Run Code** sends code to the server for execution
- **Progressive hints** revealed one at a time
- **Show Solution** toggles reference solution panel
- **Copy button** copies code to clipboard
- **Reset button** clears editor to blank state
- **Execution status** (green check = success, red X = failure) with timing

---

## Practice Exams (/dashboard/practice)

**File:** `apps/web/src/app/dashboard/practice/page.tsx`
**Component:** `PracticePage` (Client Component)

### Purpose
Practice exam system with two modes: full 40-question exams and focused domain quizzes. Includes historical attempt tracking with scores and timing.

### Key Components

| Component | Purpose |
|-----------|---------|
| `StatsCard` (x4) | Total Attempts, Average Score, Best Score, Pass Rate |
| Start New Exam card | Two options: Full Practice Exam or Domain Quiz |
| Full exam launcher | 40 questions, all domains, ~120 minutes |
| Domain quiz launcher | 10-15 questions, domain selector dropdown |
| Past Attempts list | Scored history with pass/fail badges |
| Domain filter | Dropdown to filter past attempts by domain |

### Data Requirements

| Data | Source | Description |
|------|--------|-------------|
| Past attempts | `GET /api/exams/attempts` (DB) | Score, questions, time, date, pass/fail |
| Statistics | Computed from attempts | Average, best, pass rate |
| Domain options | Hardcoded (6 domains) | For quiz selector and filter |

### Interactive Features
- **Start full exam** button launches 40-question practice test
- **Domain quiz selector** with dropdown for focused study
- **Past attempts list** with score circles (color-coded pass/fail)
- **Domain filter** dropdown for attempt history
- **Review button** on each past attempt
- **Score visualization** with circular badge (emerald=pass, red=fail)

---

## Exam Taking (/dashboard/practice/exam)

**File:** `apps/web/src/app/dashboard/practice/exam/page.tsx`
**Component:** `ExamPage` (Client Component)

### Purpose
Full exam-taking interface with support for multiple question types, a real-time countdown timer, question navigation, and detailed results with domain breakdown.

### Key Components

| Component | Purpose |
|-----------|---------|
| Countdown timer | Real-time timer with color warnings (amber < 10min, red < 5min) |
| Question display | Renders different question types (MC, MS, fill-in-the-blank, drag-and-drop) |
| Question navigation sidebar | Visual indicators for answered, unanswered, and flagged questions |
| Submit button | Grades the exam and shows results |
| Results view | Score, pass/fail, domain breakdown, per-question review |
| Domain breakdown chart | Correct/total per domain with percentage |

### Data Requirements

| Data | Source | Description |
|------|--------|-------------|
| Exam questions | `GET /api/exams/{examId}` | Questions with answers stripped |
| Grading results | `POST /api/exams/{examId}/grade` | Score, per-question results, domain breakdown |

### Interactive Features
- **Multiple question types:** multiple choice, multiple select, fill-in-the-blank, drag-and-drop
- **Question flagging** for review before submission
- **Auto-navigation** between questions
- **Domain quiz mode** via `?domain=` query parameter
- **Results review** showing correct/incorrect answers with explanations
- **Keyboard shortcuts** for answer selection

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `examId` | `string` | Exam identifier (e.g., `sample-exam-1`) |
| `domain` | `string` | Optional domain slug for focused quiz mode |

---

## Flashcards (/dashboard/flashcards)

**File:** `apps/web/src/app/dashboard/flashcards/page.tsx`
**Component:** `FlashcardsPage` (Client Component)

### Purpose
Spaced repetition flashcard system implementing the SM-2 algorithm. Students review cards, rate their recall, and the system schedules future reviews based on performance.

### Key Components

| Component | Purpose |
|-----------|---------|
| `StatsCard` (x3) | Total Cards, Due Today, Mastered |
| Domain filter | Select dropdown to filter by domain |
| Start Review card | Launch button with due card count |
| Flashcard viewer | Front/back flip card with domain and difficulty badges |
| SM-2 rating buttons | Again (1), Hard (2), Good (3), Easy (4) |
| Review progress bar | Shows progress through current session |
| Card Library grid | Preview grid of all flashcards |
| Review Complete card | Session summary with reviewed count |

### Data Requirements

| Data | Source | Description |
|------|--------|-------------|
| Flashcards (199) | `GET /api/flashcards` (DB with file fallback) | Question/answer pairs |
| Card difficulty state | `GET /api/flashcards/progress` (DB) | new, learning, review, mastered |
| SM-2 parameters | `GET/POST /api/flashcards/progress` (DB) | ease, interval, repetitions, next_review |
| Domain filter | User selection | Filters card library |

### Interactive Features
- **Domain filter** dropdown to focus on specific exam areas
- **Start Review** launches the review session
- **Card flip** on click or Space/Enter key
- **SM-2 rating** via buttons or keyboard shortcuts (1-4)
- **Progress tracking** with progress bar during review
- **Session completion** summary with reviewed count
- **Card library** grid showing all cards with difficulty badges
- **Keyboard shortcuts:**
  - `Space` / `Enter` -- Flip card
  - `1` -- Again (fail)
  - `2` -- Hard
  - `3` -- Good
  - `4` -- Easy

### SM-2 Algorithm

The flashcard system implements the SM-2 spaced repetition algorithm:

| Rating | Effect |
|--------|--------|
| Again | Reset interval to 0, decrease ease factor |
| Hard | Short interval, slight ease decrease |
| Good | Normal interval progression |
| Easy | Longer interval, increase ease factor |

Parameters stored per card per user:
- `ease` (default 2.5): Easiness factor affecting interval growth
- `interval` (days): Current spacing between reviews
- `repetitions`: Consecutive correct answers

---

## AI Tutor (/dashboard/tutor)

**File:** `apps/web/src/app/dashboard/tutor/page.tsx`
**Component:** `TutorPage` (Client Component)

### Purpose
Conversational AI tutor powered by Claude (claude-opus-5). Students can ask questions about any DevNet exam topic, select a focus domain, and maintain conversation history.

### Key Components

| Component | Purpose |
|-----------|---------|
| Conversation sidebar | List of past conversations with domain badges |
| New Chat button | Creates a fresh conversation |
| Domain filter (sidebar) | Filter conversations by domain |
| Domain selector (header) | Set active domain for system prompt |
| Chat message list | Displays user and assistant messages |
| `ChatMessage` | Individual message bubble with role styling |
| `TypingIndicator` | Animated dots while Claude is responding |
| Quick prompts grid | 6 starter prompts for empty state |
| Input textarea | Auto-resizing text input with domain badge |
| Send button | Sends message (Enter key shortcut) |

### Data Requirements

| Data | Source | Description |
|------|--------|-------------|
| Conversations | `GET /api/tutor/conversations` (DB) | Conversation history |
| Messages | `useChat` hook + `GET/POST /api/tutor/conversations/{id}/messages` (DB) | Chat messages |
| Domain selection | Local state | Current focus domain |
| Quick prompts | Hardcoded (6 prompts) | Starter suggestions |

### Interactive Features
- **Domain selector** in header switches Claude's system prompt
- **Streaming responses** via the `useChat` hook calling `POST /api/chat`
- **Conversation history** sidebar with create, select, delete operations
- **Mobile sidebar** overlay for smaller screens
- **Quick prompts** displayed in empty state (2-column grid)
- **Auto-resize textarea** grows up to 5 lines
- **Auto-scroll** to latest message
- **Domain badge** displayed in input area when domain is selected
- **Conversation filtering** by domain in sidebar
- **Keyboard shortcuts:**
  - `Enter` -- Send message
  - `Shift+Enter` -- New line in message

### Domain-Specific Prompts

When a domain is selected, the tutor receives a specialized system prompt:

| Domain | Focus Areas |
|--------|------------|
| Software Dev (D1) | Python, design patterns, Git, testing, data formats |
| APIs (D2) | REST, HTTP methods, auth, pagination, Cisco API platforms |
| Cisco Platforms (D3) | Meraki, Catalyst Center, ACI, SD-WAN, NSO, Webex |
| Deployment (D4) | Docker, CI/CD, cloud, OWASP, security |
| Infrastructure (D5) | Ansible, Terraform, NETCONF, RESTCONF, YANG |
| Networking (D6) | IP addressing, subnetting, VLANs, routing, DHCP, DNS |

---

## Settings (/dashboard/settings)

**File:** `apps/web/src/app/dashboard/settings/page.tsx`
**Component:** `SettingsPage` (Client Component)

### Purpose
User settings page for managing profile information, study preferences, and account actions.

### Key Components

| Component | Purpose |
|-----------|---------|
| Profile card | Displays name and email from session |
| Study Preferences card | Daily flashcard goal and review batch size sliders |
| About card | App version, exam blueprint version, Cisco DevNet link |
| Account card | Sign-out button |

### Data Requirements

| Data | Source | Description |
|------|--------|-------------|
| User profile | `useSession()` (Auth.js) | Name and email |
| Study preferences | `localStorage` (`devnet-settings` key) | Daily goal and batch size |

### Interactive Features
- **Range sliders** for daily flashcard goal (5-50) and review batch size (5-30)
- **Persistent preferences** saved to localStorage, surviving page reloads
- **Sign-out button** calls `signOut()` and redirects to `/login`
- **External link** to Cisco DevNet Associate certification page

---

## API Routes

| Route | Method | File | Purpose |
|-------|--------|------|---------|
| `/api/auth/[...nextauth]` | GET/POST | `app/api/auth/[...nextauth]/route.ts` | Auth.js handlers |
| `/api/chat` | POST | `app/api/chat/route.ts` | AI Tutor streaming chat |
| `/api/dashboard/stats` | GET | `app/api/dashboard/stats/route.ts` | Dashboard aggregated stats |
| `/api/exams` | GET | `app/api/exams/route.ts` | List practice exams |
| `/api/exams/{examId}` | GET | `app/api/exams/[examId]/route.ts` | Get exam with questions |
| `/api/exams/{examId}/grade` | POST | `app/api/exams/[examId]/grade/route.ts` | Grade exam submission |
| `/api/exams/attempts` | GET | `app/api/exams/attempts/route.ts` | Past exam attempts |
| `/api/flashcards` | GET | `app/api/flashcards/route.ts` | List flashcards |
| `/api/flashcards/progress` | GET/POST | `app/api/flashcards/progress/route.ts` | SM-2 progress sync |
| `/api/labs` | GET | `app/api/labs/route.ts` | List labs |
| `/api/labs/{slug}` | GET | `app/api/labs/[slug]/route.ts` | Get lab details |
| `/api/labs/{slug}/run` | POST | `app/api/labs/[slug]/run/route.ts` | Execute lab code |
| `/api/labs/{slug}/solution` | GET | `app/api/labs/[slug]/solution/route.ts` | Get lab solution |
| `/api/labs/attempts` | GET | `app/api/labs/attempts/route.ts` | Lab completion status |
| `/api/study/{slug}` | GET | `app/api/study/[slug]/route.ts` | Get study guide |
| `/api/study/progress` | GET/POST | `app/api/study/progress/route.ts` | Objective completions |
| `/api/tutor/conversations` | GET/POST | `app/api/tutor/conversations/route.ts` | List/create tutor conversations |
| `/api/tutor/conversations/{id}` | GET/PATCH/DELETE | `app/api/tutor/conversations/[id]/route.ts` | Get/update/delete conversation |
| `/api/tutor/conversations/{id}/messages` | POST | `app/api/tutor/conversations/[id]/messages/route.ts` | Save message |

See [API_REFERENCE.md](./API_REFERENCE.md) for complete API documentation.
