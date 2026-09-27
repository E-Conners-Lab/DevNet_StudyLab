# Browser routes — final local edition

All pages are built as static assets and served by the loopback launcher. No account or login is required.

| Path | Purpose |
|---|---|
| `/` | Entry point |
| `/dashboard` | Progress overview |
| `/dashboard/study` | Domain objectives and completion |
| `/dashboard/study/{slug}` | Bundled guide for one of six domains |
| `/dashboard/flashcards` | Flashcard browser and spaced review |
| `/dashboard/practice` | Full exams, domain quizzes, recent attempts |
| `/dashboard/practice/exam` | Exam questions, optional timer, scoring |
| `/dashboard/labs` | Lab catalog |
| `/dashboard/labs/{slug}` | Editor, drafts, hints, solutions, browser Python/download |
| `/dashboard/tutor` | Optional bring-your-own-key AI chat |
| `/dashboard/settings` | Local backup/import/reset and edition information |

The study and lab slugs are generated from bundled content. Unknown resources fail closed. Former `/login` and `/signup` pages, PostgreSQL persistence, and Next.js API routes are not part of this edition. See [API_REFERENCE.md](API_REFERENCE.md) for the two real versioned HTTP endpoints and the in-browser data adapter.
