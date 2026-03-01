# DevNet StudyLab -- 8-Phase Refactor

**Branch:** `feature/full-refactor`
**Net impact:** +258 / -1,464 lines across 16 modified files and 15 new files

---

## 1. Overview

This refactor tackled the most common maintenance problems in the codebase:

- **Domain data was hardcoded in 5+ files.** Every page that mentioned the six DevNet exam domains had its own copy of the slug, name, weight, and number arrays. Updating the exam blueprint would have required hunting through unrelated files.
- **API routes had inconsistent error handling.** Some used `NextResponse.json({ error }, { status })`, others returned bare objects. No standard shape.
- **Large page components were doing everything.** The tutor page was ~700 lines. The flashcards page was ~800 lines. Both had inline sub-components, duplicated helpers, and business logic mixed with presentation.
- **No shared hooks.** Every page that fetched JSON wrote its own `useEffect -> fetch -> setState` boilerplate.
- **Difficulty badge classes were duplicated** across the flashcard and lab pages.

The refactor was done in 8 phases. Every phase focused on one category of duplication or structural problem. No features were added or removed -- the UI is identical before and after.

---

## 2. Phase-by-Phase Breakdown

### Phase 1 -- Canonical Domain Data (`lib/domains.ts`)

**Problem:** The six DevNet 200-901 exam domains (slugs, names, weights, numbers) were hardcoded in at least five places:
- `dashboard/page.tsx` (defaultDomains array, ~70 lines)
- `dashboard/tutor/page.tsx` (Domain interface + domains array, ~10 lines)
- `dashboard/flashcards/page.tsx` (DOMAIN_TABS array, ~9 lines)
- `dashboard/practice/page.tsx` (inline domain options)
- `lib/data/study.ts` (SLUG_TO_FILE map, ~8 lines)
- `lib/flashcards.ts` (DOMAIN_SLUGS map, ~8 lines)

**Solution:** Created `src/lib/domains.ts` -- a single source of truth.

**Files created:** `src/lib/domains.ts`
**Files modified:** 6 consumers (listed above) now import from `@/lib/domains`

**Before/after:**
- Before: ~105 lines of duplicated domain data scattered across 6 files
- After: 94 lines in one file, 1-line imports elsewhere

---

### Phase 2 -- API Response Helpers (`lib/api-helpers.ts`)

**Problem:** API route handlers had verbose, inconsistent response construction:

```ts
// Before -- repeated in every route
return NextResponse.json({ error: "flashcardId and quality are required" }, { status: 400 });
return NextResponse.json({ error: "Failed to compute progress" }, { status: 500 });
return NextResponse.json(data);
```

**Solution:** Created `src/lib/api-helpers.ts` with four helpers:

```ts
jsonOk(data, status?)       // 200 by default
jsonError(message, status?) // 500 by default
jsonBadRequest(message)     // 400
jsonNotFound(resource?)     // 404
```

**Files created:** `src/lib/api-helpers.ts`
**Files modified:** 6 API routes
- `api/auth/signup/route.ts`
- `api/exams/[examId]/route.ts`
- `api/exams/[examId]/grade/route.ts`
- `api/exams/attempts/route.ts`
- `api/flashcards/progress/route.ts`
- `api/study/progress/route.ts`

**Before/after per route (example -- flashcards/progress):**
```ts
// Before (4 lines)
return NextResponse.json(
  { error: "flashcardId and quality are required" },
  { status: 400 },
);

// After (1 line)
return jsonBadRequest("flashcardId and quality are required");
```

---

### Phase 3 -- Auth Page Components (`components/auth/`)

**Problem:** The login and signup pages duplicated ~120 lines of identical UI code -- the same layout shell, input styling, error banner, and submit button with loading spinner.

**Solution:** Extracted four shared components:

| Component | Purpose |
|-----------|---------|
| `AuthLayout` | Centered card shell with logo and subtitle |
| `AuthInput` | Styled label + input with consistent focus ring |
| `AuthError` | Red error banner (renders nothing when message is empty) |
| `AuthButton` | Submit button with loading spinner |

**Files created:**
- `src/components/auth/auth-layout.tsx`
- `src/components/auth/auth-input.tsx`
- `src/components/auth/auth-error.tsx`
- `src/components/auth/auth-button.tsx`
- `src/components/auth/index.ts`

**Files modified:**
- `src/app/login/page.tsx` -- dropped from ~190 lines to ~110
- `src/app/signup/page.tsx` -- dropped from ~260 lines to ~137

**Import pattern:**
```ts
import { AuthLayout, AuthInput, AuthError, AuthButton } from "@/components/auth";
```

---

### Phase 4 -- Tutor Sub-Components (`components/tutor/`)

**Problem:** `dashboard/tutor/page.tsx` was ~700 lines. It contained inline definitions for the sidebar, quick prompts panel, chat input, and a `Conversation` type -- none of which were reusable.

**Solution:** Extracted five modules:

| Module | Lines | Purpose |
|--------|-------|---------|
| `tutor-sidebar.tsx` | 198 | Conversation list with domain filter |
| `quick-prompts.tsx` | 79 | Welcome screen with starter prompts |
| `chat-input.tsx` | 105 | Auto-resizing textarea with domain badge |
| `types.ts` | 10 | Shared `Conversation` interface |
| `index.ts` | 6 | Barrel re-exports |

**Files created:** 5 files in `src/components/tutor/`
**Files modified:** `src/app/dashboard/tutor/page.tsx` -- dropped from ~700 to ~260 lines

The tutor sidebar now imports `DEVNET_DOMAINS` and `getDomainBySlug` from `@/lib/domains` instead of carrying its own domain array.

---

### Phase 5 -- Flashcard Sub-Components (`components/flashcards/`)

**Problem:** `dashboard/flashcards/page.tsx` was ~800 lines. It inlined the review card (with flip animation, rating buttons, keyboard shortcuts), the review-complete summary, and the card browser grid -- plus duplicated `DOMAIN_TABS`, `RATING_CONFIG`, difficulty color maps, and helper functions.

**Solution:** Extracted three components:

| Module | Lines | Purpose |
|--------|-------|---------|
| `review-card.tsx` | 315 | Flashcard with flip, rating buttons, shortcuts |
| `review-complete.tsx` | 115 | Session summary with stats |
| `card-browser.tsx` | 241 | Filterable/searchable card grid |
| `index.ts` | 3 | Barrel re-exports |

**Files created:** 4 files in `src/components/flashcards/`
**Files modified:** `src/app/dashboard/flashcards/page.tsx` -- dropped from ~800 to ~140 lines

`card-browser.tsx` calls `getDomainTabItems()` from `@/lib/domains` instead of hardcoding the tabs.
`review-card.tsx` calls `getDifficultyClasses()` from `@/lib/ui-constants` instead of inline color strings.

---

### Phase 6 -- Shared UI Constants (`lib/ui-constants.ts`)

**Problem:** Difficulty badge color classes (easy/medium/hard for flashcards, beginner/intermediate/advanced for labs) were duplicated between the flashcards page and the labs page.

**Solution:** Created `src/lib/ui-constants.ts` with a single `DIFFICULTY_BADGE_CLASSES` map and a `getDifficultyClasses()` lookup function.

**Files created:** `src/lib/ui-constants.ts`
**Files modified:**
- `src/components/flashcards/review-card.tsx` -- uses `getDifficultyClasses()`
- `src/components/flashcards/card-browser.tsx` -- uses `getDifficultyClasses()`
- `src/app/dashboard/labs/page.tsx` -- replaced inline color map with `getDifficultyClasses()` calls

---

### Phase 7 -- `useApi` Hook + Hooks Barrel (`hooks/use-api.ts`, `hooks/index.ts`)

**Problem:** Multiple pages repeated the same `useEffect -> fetch -> setState -> loading/error` pattern for GET requests.

**Solution:** Created a generic `useApi<T>` hook.

```ts
const { data, isLoading, error, refetch } = useApi<MyType>({
  url: "/api/whatever",
  transform: (raw) => raw.items,  // optional
  skip: !userId,                   // optional
});
```

Also created `src/hooks/index.ts` as a barrel export for all hooks.

**Files created:**
- `src/hooks/use-api.ts`
- `src/hooks/index.ts`

The barrel exports:
```ts
export { useChat } from "./use-chat";
export type { ChatMessage } from "./use-chat";
export { useFlashcards } from "./use-flashcards";
export { useApi } from "./use-api";
```

---

### Phase 8 -- Server-Side Caching + Dashboard Domain Dedup

**Problem:**
- `lib/data/study.ts` re-read and re-parsed the JSON study guide from disk on every request.
- `lib/flashcards.ts` re-read all 6 flashcard JSON files on every request.
- `dashboard/page.tsx` had a ~90-line `defaultDomains` array with hardcoded names/slugs/weights.

**Solution:**
- Added a `Map`-based cache to `getStudyGuide()` in `lib/data/study.ts`.
- Added a module-level `flashcardCache` to `getAllFlashcards()` in `lib/flashcards.ts`.
- Replaced the ~90-line `defaultDomains` array in `dashboard/page.tsx` with a derived array from `DEVNET_DOMAINS`.

**Files modified:**
- `src/lib/data/study.ts` -- added `studyGuideCache` Map, results are cached after first read
- `src/lib/flashcards.ts` -- added `flashcardCache` variable, results are cached after first read
- `src/app/dashboard/page.tsx` -- reduced by ~80 lines, now derives defaults from `DEVNET_DOMAINS`

---

## 3. New Shared Modules -- Quick Reference

### `src/lib/domains.ts`
| Export | Type | Description |
|--------|------|-------------|
| `DevNetDomain` | interface | Shape: `{ number, slug, name, shortName, weight }` |
| `DEVNET_DOMAINS` | `readonly DevNetDomain[]` | The six exam domains |
| `getDomainBySlug(slug)` | function | Lookup by slug |
| `getDomainByNumber(num)` | function | Lookup by 1-based number |
| `domainSlugToNumber(slug)` | function | Slug to number (or null) |
| `domainNumberToSlug(num)` | function | Number to slug (or null) |
| `getDomainSelectOptions(includeAll?)` | function | `{ value, label }[]` for dropdowns |
| `getDomainTabItems(includeAll?)` | function | `{ slug, label, short }[]` for tab bars |
| `SLUG_TO_STUDY_FILE` | `Record<string, string>` | Slug to JSON filename |
| `NUMBER_TO_SLUG` | `Record<number, string>` | Domain number to slug |

### `src/lib/api-helpers.ts`
| Export | Description |
|--------|-------------|
| `jsonOk(data, status?)` | Success response (default 200) |
| `jsonError(message, status?)` | Error response (default 500) |
| `jsonBadRequest(message)` | 400 error |
| `jsonNotFound(resource?)` | 404 error |

### `src/lib/ui-constants.ts`
| Export | Description |
|--------|-------------|
| `DIFFICULTY_BADGE_CLASSES` | Map of difficulty level to Tailwind classes |
| `getDifficultyClasses(difficulty)` | Lookup with fallback |

### `src/hooks/use-api.ts`
| Export | Description |
|--------|-------------|
| `useApi<T>(options)` | Generic GET-fetch hook with loading/error/refetch |

### `src/hooks/index.ts`
Barrel: `useChat`, `ChatMessage` (type), `useFlashcards`, `useApi`

### `src/components/auth/index.ts`
Barrel: `AuthLayout`, `AuthInput`, `AuthError`, `AuthButton`

### `src/components/tutor/index.ts`
Barrel: `ChatMessage`, `TypingIndicator`, `TutorSidebar`, `QuickPrompts`, `ChatInput`, `Conversation` (type)

### `src/components/flashcards/index.ts`
Barrel: `ReviewComplete`, `ReviewCard`, `CardBrowser`

### `src/components/dashboard/index.ts`
Barrel: `DomainCard`, `DomainData` (type), `Sidebar`, `StatsCard`

---

## 4. Migration Patterns

### Using `lib/domains.ts` instead of hardcoding domain data

**Dropdowns:**
```ts
import { getDomainSelectOptions } from "@/lib/domains";

const options = getDomainSelectOptions(); // includes "All Domains"
// [{ value: "all", label: "All Domains" }, { value: "software-dev", label: "1. Software Development & Design" }, ...]

const optionsNoAll = getDomainSelectOptions(false); // domain options only
```

**Tab bars:**
```ts
import { getDomainTabItems } from "@/lib/domains";

const tabs = getDomainTabItems();
// [{ slug: "all", label: "All Domains", short: "All" }, { slug: "software-dev", label: "1. Software Dev", short: "D1" }, ...]
```

**Looking up a domain:**
```ts
import { getDomainBySlug, getDomainByNumber } from "@/lib/domains";

const domain = getDomainBySlug("apis");
// { number: 2, slug: "apis", name: "Understanding & Using APIs", shortName: "APIs", weight: 20 }
```

**Iterating all domains:**
```ts
import { DEVNET_DOMAINS } from "@/lib/domains";

DEVNET_DOMAINS.map(d => <Tab key={d.slug}>D{d.number} {d.shortName}</Tab>);
```

### Using `lib/api-helpers.ts` instead of `NextResponse.json`

```ts
import { jsonOk, jsonBadRequest, jsonNotFound, jsonError } from "@/lib/api-helpers";

// Success
return jsonOk({ items });
return jsonOk({ success: true }, 201);

// Client errors
return jsonBadRequest("email is required");
return jsonNotFound("Exam");  // -> { error: "Exam not found" }, 404

// Server errors
return jsonError("Database connection failed");  // 500
return jsonError("Service unavailable", 503);
```

### Using auth components

```tsx
import { AuthLayout, AuthInput, AuthError, AuthButton } from "@/components/auth";

function MyAuthPage() {
  return (
    <AuthLayout subtitle="Reset your password">
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthError message={error} />
        <AuthInput id="email" label="Email" type="email" required value={email} onChange={...} />
        <AuthButton loading={loading} label="Send Link" loadingLabel="Sending..." />
      </form>
    </AuthLayout>
  );
}
```

### Using `getDifficultyClasses()`

```tsx
import { getDifficultyClasses } from "@/lib/ui-constants";

<Badge className={getDifficultyClasses("hard")}>Hard</Badge>
// Returns "bg-red-500/10 text-red-400 border-red-500/20"

<Badge className={getDifficultyClasses("beginner")}>Beginner</Badge>
// Returns "bg-blue-500/10 text-blue-400 border-blue-500/20"

<Badge className={getDifficultyClasses("unknown")}>Unknown</Badge>
// Falls back to "bg-zinc-800 text-zinc-400"
```

### Using `useApi<T>`

```ts
import { useApi } from "@/hooks/use-api";

const { data, isLoading, error, refetch } = useApi<{ items: Item[] }>({
  url: "/api/items",
  transform: (raw) => raw as { items: Item[] },
  skip: !isAuthenticated,
});
```

---

## 5. Bonus Fix -- Test Type Error

A pre-existing TypeScript error in `src/__tests__/api/progress.test.ts` was also fixed. The mock's chainable query builder used `Record<string, unknown>` for its chain object, but then assigned `Symbol.iterator` as a key. Symbols are not strings, so TypeScript flagged the assignment.

**Fix:**
```diff
-  const chain: Record<string, unknown> = {};
+  const chain: Record<string | symbol, unknown> = {};
```

This resolved the type error without changing any test behavior.
