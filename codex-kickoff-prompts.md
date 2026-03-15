# Recall — Codex Kickoff Prompts

> Copy the prompt for the phase you're starting into a new Codex thread.

---

## Phase 1 — Foundation

```
Read AGENTS.md and recall-build-plan.md in the repo root. You are implementing Phase 1 — Foundation (THE-144, THE-145).

Goal: Postgres schema in place, Next.js app scaffolded and responding behind Caddy on :18104.

Steps:
1a. Set up the Prisma schema with decks, cards, reviews, and card_state tables. Create and run the initial migration.
1b. Scaffold the Next.js app with basePath: '/recall', PORT=18104, Prisma client singleton, and all API route stubs (health, decks, reviews/next, reviews). Health route should return 200 with { status: "ok" }.
1c. Create the launchd plist at deploy/com.wesleyflorence.recall.plist and document the Caddyfile entry and PORTS.md update needed (don't modify files outside this repo).

Done when: `bun run build` succeeds, `bun start` serves on :18104, and GET /recall/api/health returns 200.
```

---

## Phase 2 — Core Loop

```
Read AGENTS.md and recall-build-plan.md in the repo root. You are implementing Phase 2 — Core Loop (THE-146, THE-147).

Goal: End-to-end review cycle — create deck → generate cards → review → grade → schedule.

Steps:
2a. FSRS integration: bun add ts-fsrs. Initialize FSRS state on card creation. On review submission, map LLM grade to FSRS rating (0–0.3 Again, 0.3–0.5 Hard, 0.5–0.8 Good, 0.8–1.0 Easy). Call fsrs.repeat(), persist updated state and next due date to card_state. Wire /api/reviews/next to query by due date.
2b. LLM integration via OpenRouter: implement card generation (POST /api/decks/[id]/generate) using GENERATION_MODEL and response grading (POST /api/reviews) using GRADING_MODEL. Use fetch() with OpenRouter's OpenAI-compatible endpoint. Set HTTP-Referer and X-Title headers. Retry with backoff on 429/5xx. Store results in cards and reviews tables respectively.

All LLM and FSRS logic must be server-side only (API routes / lib/). Never import in client components.

Done when: you can create a deck via API, generate cards, submit a text response, receive a grade + feedback, and the next review is scheduled with a future due date.
```

---

## Phase 3 — Frontend + PWA

```
Read AGENTS.md and recall-build-plan.md in the repo root. You are implementing Phase 3 — Frontend + PWA (THE-148, THE-149).

Goal: Usable mobile-first web UI that works as an iOS PWA.

Steps:
3a. Build pages: Dashboard at /recall (due count, deck list, start review button), Review session at /recall/review (question → text input → submit → grade + feedback → next card), Deck management at /recall/decks (create deck with topic + source material, view cards, trigger generation).
3b. PWA: add manifest.json to public/ with display: standalone, icons, and theme color. Add iOS home screen meta tags.
3c. Voice input: add a mic button on the review page using Web Speech API. Transcribed text fills the textarea for editing before submit. Hide the button if the API is unavailable.

Use React Server Components for data-fetching pages, Client Components for interactive views. Tailwind for styling. Mobile-first responsive design.

Done when: the full review loop works in a browser at localhost:18104/recall — create deck, generate cards, review with text or voice input, see grade and feedback, next card loads.
```

---

## Phase 4 — Content + Validation

```
Read AGENTS.md and recall-build-plan.md in the repo root. You are implementing Phase 4 — Content Loading + Validation (THE-150, THE-151).

Goal: Seed real decks and establish a baseline for grading quality.

Steps:
4a. Create a seed script (e.g. scripts/seed-decks.ts) that creates 4 decks via the API: Music Theory (intervals, chords, modes, voice leading), European History (broad coverage, open-ended), Distributed Systems (Kafka, consensus, K8s networking), Philosophy (Stoicism, epistemology, key thinkers). Each deck should have a rich topic description. After creation, trigger card generation for each (15–25 cards per deck).
4b. Review the grading prompt in lib/llm.ts. Add logging that captures the full grading prompt + response for each review so grading quality can be evaluated after a week of use. Expose a /recall/api/decks/[id]/stats endpoint that returns: total cards, cards due, average grade, grade distribution histogram, and review count over time.

Done when: all 4 decks exist with generated cards, the seed script is repeatable, and stats endpoint returns meaningful data.
```

---

## Phase 5 — Hardening

```
Read AGENTS.md and recall-build-plan.md in the repo root. You are implementing Phase 5 — Hardening + Quality of Life.

Goal: Make the deployment robust and pleasant for long-term daily use.

Steps:
Reliability: Create a Postgres backup plist (pg_dump via launchd StartCalendarInterval, daily to ~/backups/recall/). Move log paths from /tmp/ to ~/Library/Logs/recall/ in the main plist.
UX: Add keyboard shortcuts to the review session (Enter to submit, Escape to skip). Add dark mode via Tailwind dark: classes with a toggle. Add react-markdown rendering for question and feedback text. Add deck export/import as JSON via /api/decks/[id]/export and /api/decks/import.
DX: Create a deploy.sh script that runs: git pull, bun install, bun run build, launchctl unload/load of the recall plist.

Done when: backup plist runs successfully, dark mode works, markdown renders in reviews, deploy.sh works end-to-end.
```
