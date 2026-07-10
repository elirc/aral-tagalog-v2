# Aral Upskill Curriculum

A training lab built on this repository for one learner: a **junior fullstack JS engineer** (React/Node/TS CRUD experience) who wants to reach mid-level fast, build senior judgment, and pass interviews for mid-level fullstack roles.

Every page teaches two things at once:

1. **This codebase** — where things live, how its real flows work, with exact file/line anchors.
2. **Transferable skill** — why the pattern exists, its alternatives and failure modes, and how to talk about it in an interview.

## What this repo is (the 6-sentence version)

Aral is a Duolingo-style app teaching Tagalog to English speakers: a **pnpm + Turborepo monorepo** with a pure-TypeScript game engine ([packages/core](../../packages/core)), a YAML→JSON content compiler ([packages/content](../../packages/content)), a Postgres schema ([packages/db](../../packages/db)), a Fastify REST API ([apps/api](../../apps/api)), a Next.js web client ([apps/web](../../apps/web)), and an Expo mobile client ([apps/mobile](../../apps/mobile)). Its defining design decision: **all user progress is an append-only event log**. Clients (even logged-out guests) record events locally, derive XP/streaks/hearts by folding the log with [`reduceEvents`](../../packages/core/src/events.ts#L49), and sync batches to a single idempotent `POST /sync` endpoint. The server derives the same state with the same shared function. This makes offline-first mobile, guest mode, and multi-device merge fall out of one design instead of three features. That decision — and everything it costs — is the spine of this curriculum.

## Learning tracks

| Track | Folder | You'll be able to… |
| --- | --- | --- |
| Cartography | `01-codebase-cartography/` | Navigate any monorepo in hours, not weeks |
| Stack mastery | `02-stack-and-language-mastery/` | Explain TS/React/Node behavior from first principles |
| Architecture | `03-architecture-and-patterns/` | Name boundaries, critique designs, spot leaks |
| Reading gym | `04-code-reading-gym/` | Read unfamiliar code fast and precisely |
| Quality | `05-quality-engineering/` | Test, debug, secure, and observe like a professional |
| Contribution | `06-contribution-practice/` | Ship changes a maintainer would accept |
| Career | `07-career-and-collaboration/` | Review, write PRs/RFCs, communicate |
| **Interview prep** | `08-interview-prep/` | Answer with evidence from real code, not trivia |
| Reference | `09-reference/` | Commands, risks, rubrics, verification log |

## Recommended paths

- **Brand-new junior:** `00-fast-track.md` → `01-cartography` (all) → `02-stack` → `04-reading-gym` drills as you go. Two weeks of evenings.
- **Junior who knows React/Node:** `00-fast-track.md` → `01/05-key-flows.md` → `03-architecture` → `05-quality` → start tickets in `06/01`.
- **Mid-level, new to the repo:** `01/01-system-map.md` + `01/05-key-flows.md` → `03/06-architecture-critique.md` → `06/02-mid-level-feature-tickets.md`.
- **Senior doing architecture review:** `03/06-architecture-critique.md` → `09-reference/risk-register.md` → `06/04-refactor-and-design-katas.md`.
- **Interview in two weeks:** go directly to [08-interview-prep/07-two-week-cram-plan.md](08-interview-prep/07-two-week-cram-plan.md). It schedules everything else.

## Conventions

- **Anchors:** `[file.ts](../../path/file.ts#L10-L20)` links point at real code. Line numbers were verified against the working tree on 2026-07-09 (see [verification log](09-reference/verification-log.md)). If the repo has moved on, trust the symbol name over the line number.
- **Fake code** is always labeled `// Illustrative fake code: not from this repo.` Everything unlabeled is real.
- **Drills** end with self-grading criteria (Basic / Solid / Strong). Grade yourself honestly; the gap between Solid and Strong is exactly the junior→mid gap.
- **"Investigate" / "possible risk"** labels mean the author suspects but did not prove an issue. Confirmed behavior is stated plainly.
- **Interview vocabulary** (invariant, idempotency, boundary, contract, blast radius…) is defined where first used and flagged — these words are how interviewers detect seniority.

## The mindset ladder

- **Junior asks:** "How do I make it work?"
- **Mid-level asks:** "Is this the right pattern? What does it cost?"
- **Senior asks:** "What does this commit us to, who pays that cost later, and how do we reduce the risk?"

Mid-level interviews test the second question and probe for the third. Every module here ends with an interview angle for exactly that reason.
