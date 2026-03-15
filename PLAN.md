# Recall — Build Plan (Codex Edition)

> Spaced repetition with LLM-graded open-ended responses. Next.js app with API routes, Postgres, ts-fsrs scheduling, served over Tailscale from Mac Studio.

**How to use:** Open a new Codex thread for each phase. Copy the phase section as your prompt. Check off tasks as you complete them.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  Mac Studio (studio.tail*.ts.net)                        │
│                                                          │
│  ┌─────────────────────┐                                 │
│  │ Caddy (~/code/caddy)│   handle_path /recall/*         │
│  │ gateway :18080      │──────────────────┐              │
│  │                     │                  ▼              │
│  │  /office → :18101   │   ┌──────────┐  ┌───────────┐  │
│  │  /tabs   → :18102   │   │ Next.js  │─►│ OpenRouter│  │
│  │  /ledger → :18103   │   │ :18104   │  │ API (ext) │  │
│  │  /recall → :18104   │   └────┬─────┘  └───────────┘  │
│  └─────────────────────┘        │                        │
│                          ┌──────┴──────┐  ┌──────────┐   │
│                          │ Pages +     │  │ Postgres │   │
│                          │ API routes  │  │ :5432    │   │
│                          └─────────────┘  └──────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
         ▲
         │ Tailscale (studio:18080/recall)
         ▼
   ┌───────────┐
   │ Browser / │
   │ iOS PWA   │
   └───────────┘
```

**Stack:** Next.js · TypeScript · Postgres · ts-fsrs · OpenRouter API · Caddy · Tailscale · PWA

**Deployment conventions (from `~/code/caddy`):**

- Gateway port: `:18080` (Caddy)
- Service pool: `:18100–18199` (one port per service)
- Recall allocation: `:18104`
- Each service gets a launchd plist in `~/code/caddy/deploy/`, copied to `~/Library/LaunchAgents/`
- Caddy routes via `handle_path` — strips prefix before forwarding, upstream apps use `basePath`
- Plist naming: `com.wesleyflorence.<service>.plist`
- Update `~/code/caddy/PORTS.md` when adding Recall

---

## Phase 1 — Foundation (THE-144, THE-145)

**Goal:** Postgres schema in place, Next.js app scaffolded and responding behind Caddy.

### 1a. Postgres Setup

- [ ] Confirm existing Postgres instance on Mac Studio (`:5432`)
- [ ] Create `recall` database and dedicated role
- [ ] Apply schema migration (Prisma or raw SQL in `db/migrations/`)

**Schema:**

| Table | Purpose |
|-------|---------|
| `decks` | id, name, description, source_material, created_at |
| `cards` | id, deck_id, question, rubric/reference_answer, difficulty_hint, created_at |
| `reviews` | id, card_id, response_text, llm_grade (0.0–1.0), llm_feedback, fsrs_rating, reviewed_at |
| `card_state` | id, card_id, FSRS state fields (stability, difficulty, due, last_review, etc.) |

- [ ] Validate with manual inserts

**ORM decision:** Prisma — typed queries, migration management, schema-as-docs. Alternative: raw `pg` if staying lightweight.

### 1b. Next.js App

- [ ] `bunx create-next-app@latest recall --typescript --app`
- [ ] Configure `basePath: '/recall'` in `next.config.ts`
- [ ] Set `PORT=18104` for dev/prod server
- [ ] Wire up Postgres connection (Prisma client or `pg` pool)
- [ ] Implement API routes:

| Route | Method | Purpose |
|-------|--------|---------|
| `/recall` | GET | Dashboard page (due count, deck list) |
| `/recall/api/decks` | POST | Create deck |
| `/recall/api/decks/[id]/generate` | POST | Trigger LLM card generation |
| `/recall/api/reviews/next` | GET | Next due card(s) |
| `/recall/api/reviews` | POST | Submit response → grade → update FSRS |
| `/recall/api/decks/[id]/stats` | GET | Deck statistics |
| `/recall/api/health` | GET | Health check |

> Note: with `basePath: '/recall'`, Next.js handles the prefix natively. Caddy strips `/recall` and forwards to `:18104`, but Next.js expects it via `basePath`, so these align cleanly.

### 1c. Caddy + launchd Integration

- [ ] Add Caddyfile entry:
  ```
  handle_path /recall/* {
      reverse_proxy localhost:18104
  }
  ```
- [ ] Update `~/code/caddy/PORTS.md` — add `18104: Recall`
- [ ] Create launchd plist (`~/code/caddy/deploy/com.wesleyflorence.recall.plist`)
- [ ] Copy plist to `~/Library/LaunchAgents/` and load
- [ ] Reload Caddy to pick up new route
- [ ] Verify: `curl studio:18080/recall/api/health` returns 200 over Tailscale
- [ ] Verify: `lsof -nP -iTCP -sTCP:LISTEN | rg "(18080|18104)"` shows both ports

**Done when:** `curl studio:18080/recall/api/health` returns 200 over Tailscale, routed through Caddy → Next.js on `:18104`.

---

## Phase 2 — Core Loop (THE-146, THE-147)

**Goal:** The essential review cycle works end-to-end: create deck → generate cards → review → grade → schedule.

### 2a. FSRS Integration (THE-146)

- [ ] `bun add ts-fsrs`
- [ ] On card creation: initialize FSRS state (New card)
- [ ] On review submission: map LLM grade to FSRS rating

| LLM Grade | FSRS Rating |
|-----------|-------------|
| 0.0–0.3 | Again |
| 0.3–0.5 | Hard |
| 0.5–0.8 | Good |
| 0.8–1.0 | Easy |

- [ ] Call `fsrs.repeat()` → persist updated state + next due date to `card_state`
- [ ] `/api/reviews/next` queries cards ordered by due date
- [ ] Confirm ts-fsrs runs server-side only (no client bundle bloat)

### 2b. LLM Integration (THE-147)

**Card Generation:**
- [ ] Input: deck topic + optional source material
- [ ] Model: `anthropic/claude-sonnet-4` via OpenRouter
- [ ] Output: N questions with reference answers/rubrics + difficulty hints
- [ ] Store generated cards in `cards` table

**Response Grading:**
- [ ] Input: question + rubric + user's response
- [ ] Model: `anthropic/claude-haiku-4` via OpenRouter
- [ ] Output: grade (0.0–1.0) + written feedback
- [ ] Store in `reviews` table, feed grade into FSRS

**Implementation details:**
- [ ] OpenRouter OpenAI-compatible endpoint — use `fetch()` or `openai` with `baseURL`
- [ ] `OPENROUTER_API_KEY` in `.env.local`
- [ ] Set `HTTP-Referer` and `X-Title` headers per OpenRouter docs
- [ ] Model names configurable via `GENERATION_MODEL` / `GRADING_MODEL` env vars
- [ ] Retry with backoff on 429/5xx
- [ ] V1 grading prompt (tuning is Phase 4)

**Done when:** You can create a deck, generate cards, submit a text answer, receive a grade + feedback, and see the next review scheduled.

---

## Phase 3 — Frontend + PWA (THE-148, THE-149)

**Goal:** Usable web UI bookmarkable as an iOS PWA.

### 3a. Pages (THE-148)

- [ ] **`/recall`** — Dashboard: due card count, deck list, "Start Review" button
- [ ] **`/recall/review`** — Review session: question → text input → submit → grade + feedback → next
- [ ] **`/recall/decks`** — Deck management: create deck, view cards, trigger generation
- [ ] **`/recall/stats`** (stretch) — Review history, retention rate, streak

**Tech choices:**
- [ ] React Server Components for data-fetching pages (dashboard, stats)
- [ ] Client Components for interactive views (review, deck creation)
- [ ] Tailwind for styling (from Next.js scaffold)
- [ ] Responsive / mobile-first (phone-sized for PWA use)

### 3b. PWA Manifest (THE-148)

- [ ] `manifest.json` in `public/` (or `next-pwa` package)
- [ ] `display: standalone`, icons, theme color
- [ ] Service worker for offline caching of static assets
- [ ] iOS meta tags for home screen icon

### 3c. Voice Input (THE-149)

- [ ] Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`)
- [ ] Mic button next to text input — tap to record, tap to stop
- [ ] Transcribed text populates textarea; user edits before submitting
- [ ] Hide mic button if API unavailable (graceful degradation)
- [ ] Client Component (browser API dependency)

**Done when:** You can open `studio:18080/recall` on your phone over Tailscale, add to home screen, create a deck, generate cards, and complete a full review session (text or voice).

---

## Phase 4 — Content Loading + Validation (THE-150, THE-151)

**Goal:** Real content in the system, grading quality validated through daily use.

### 4a. Seed Initial Decks (THE-150)

- [ ] **Music Theory** — intervals, chord construction, modes, voice leading, shell voicings
- [ ] **European History** — broad coverage, open-ended "explain what happened" questions
- [ ] **Distributed Systems** — Kafka internals, consensus, K8s networking
- [ ] **Philosophy** — Stoicism, epistemology, key thinkers and arguments

**Per deck:**
- [ ] Write rich topic description + paste relevant source material
- [ ] Generate 15–25 cards via LLM
- [ ] Review generated questions — prune bad ones, manually add gaps
- [ ] Start reviewing

### 4b. Tune Grading + Scheduling (THE-151)

After 1–2 weeks of daily use:

**Grading quality:**
- [ ] Evaluate leniency/harshness — adjust system prompt
- [ ] Assess feedback specificity — iterate on grading prompt
- [ ] Validate partial credit (0.4–0.6 range) is meaningful

**Grade → FSRS mapping:**
- [ ] Thresholds (0.3/0.5/0.8) producing sensible intervals?
- [ ] Cards returning too often or disappearing too long?
- [ ] Adjust thresholds or explore continuous mapping

**Done when:** You're using Recall daily, grading feels fair, and review intervals match your actual retention.

---

## Phase 5 — Hardening + Quality of Life

**Goal:** Make the deployment robust and pleasant long-term.

### Reliability

- [ ] Postgres backup script (pg_dump cron via launchd `StartCalendarInterval` → local + offsite)
- [ ] Structured logging (stdout/stderr → launchd → `/tmp/recall.*.log`)
- [ ] Consolidate log paths to `~/Library/Logs/recall/` for reboot persistence
- [ ] Basic alerting if service goes down (Tailscale health check + pushover/ntfy)

### UX Polish

- [ ] Keyboard shortcuts in review session (Enter to submit, arrow keys for nav)
- [ ] Dark mode (Tailwind `dark:` classes)
- [ ] Review session timer / streak counter
- [ ] Deck import/export (JSON)
- [ ] Markdown rendering in questions and feedback (`react-markdown`)

### Developer Experience

- [ ] `bun run dev` with hot reload on `:18104`
- [ ] `bun run build && bun start` for production (plist target)
- [ ] Prisma Studio (`bunx prisma studio`) for DB inspection
- [ ] Deploy script: `git pull && bun install && bun run build && launchctl unload/load`

---

## Deployment Checklist

```
[ ] Postgres running on Mac Studio (:5432)
[ ] recall database + role created
[ ] Tailscale active, studio hostname resolving
[ ] bun install && bun run build succeeds in ~/code/recall
[ ] .env.local with OPENROUTER_API_KEY, GENERATION_MODEL, GRADING_MODEL, DATABASE_URL
[ ] basePath: '/recall' set in next.config.ts
[ ] handle_path /recall/* entry added to ~/code/caddy/Caddyfile
[ ] 18104 added to ~/code/caddy/PORTS.md
[ ] com.wesleyflorence.recall.plist in ~/code/caddy/deploy/
[ ] Plist copied to ~/Library/LaunchAgents/ and loaded
[ ] Caddy reloaded to pick up new route
[ ] curl studio:18080/recall/api/health returns 200 over Tailscale
[ ] lsof confirms :18104 listening
[ ] PWA manifest + icons in place
[ ] Postgres backup plist scheduled
[ ] Test full review loop from phone over Tailscale
```

---

## Issue Mapping

| Phase | Linear Issues | Milestone |
|-------|--------------|-----------|
| 1 — Foundation | THE-144, THE-145 | M1: Personal POC |
| 2 — Core Loop | THE-146, THE-147 | M1: Personal POC |
| 3 — Frontend + PWA | THE-148, THE-149 | M1: Personal POC |
| 4 — Content + Validation | THE-150, THE-151 | M2: Load Content & Validate |
| 5 — Hardening | (new issues) | M2 |
| — Ship Decision | THE-152 | M3: Product / Ship Decision |

---

## Open Questions

1. **OpenRouter model defaults** — Start with `anthropic/claude-sonnet-4` / `anthropic/claude-haiku-4`, make configurable in `.env.local`.
2. **Prisma vs raw `pg`?** — Prisma recommended for DX. Raw `pg` if you want minimal abstraction.
3. **`basePath` + Caddy interaction** — Pattern proven by Office and Tabs. Confirm strip-before-forward behavior.
4. **Card versioning?** — Probably not for V1. Revisit if grading prompts change significantly.
5. **Anki import** — Phase 5 stretch goal if existing decks exist.
