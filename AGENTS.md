# AGENTS.md

> Instructions for AI coding agents (Codex, Claude Code, etc.) working in this repo.

## Project Overview

**Recall** is a spaced repetition app with LLM-graded open-ended responses. It runs as a Next.js app with API routes, Postgres, ts-fsrs scheduling, and is served over Tailscale from a Mac Studio.

- **Repo location:** `~/code/recall`
- **Runtime:** Bun (not npm/yarn — use `bun` for all commands)
- **Framework:** Next.js (App Router) with TypeScript
- **Database:** Postgres (local, `:5432`, database name `recall`)
- **ORM:** Prisma (schema in `prisma/schema.prisma`)
- **Scheduling:** ts-fsrs (server-side only)
- **LLM provider:** OpenRouter (OpenAI-compatible API)
- **Reverse proxy:** Caddy gateway at `:18080`, this app on `:18104`
- **Access:** Tailscale only — no public internet exposure

## Key Conventions

### Package Manager

**Always use `bun`.** Never use `npm`, `yarn`, or `npx`. Equivalents:

| Instead of | Use |
|-----------|-----|
| `npm install` | `bun install` |
| `npm run dev` | `bun run dev` |
| `npx prisma migrate` | `bunx prisma migrate` |
| `npx create-next-app` | `bunx create-next-app` |

### basePath

This app runs behind Caddy at `/recall`. `next.config.ts` sets `basePath: '/recall'`. This means:

- All pages are served under `/recall/*`
- API routes are at `/recall/api/*`
- Internal `<Link>` and `fetch('/api/...')` work automatically — Next.js prepends the basePath
- **Do not** hardcode `/recall` in links or fetch calls; let the framework handle it
- Caddy `handle_path /recall/*` strips the prefix before forwarding to `:18104`

### Port Allocation

This app listens on **`:18104`**. Set via `PORT=18104` in `.env.local` and the launchd plist. Do not change this without updating:

1. `~/code/caddy/Caddyfile`
2. `~/code/caddy/PORTS.md`
3. `~/code/caddy/deploy/com.wesleyflorence.recall.plist`

### Environment Variables

All secrets and config live in `.env.local` (Next.js convention, auto-loaded):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `GENERATION_MODEL` | Model for card generation (e.g. `anthropic/claude-sonnet-4`) |
| `GRADING_MODEL` | Model for response grading (e.g. `anthropic/claude-haiku-4`) |
| `PORT` | Server port (`18104`) |

**Never commit `.env.local` or log secret values.**

## Architecture

```
Caddy (:18080)
  └─ handle_path /recall/* → localhost:18104

Next.js (:18104)
  ├─ app/              # App Router pages
  │   ├─ page.tsx      # Dashboard (/)
  │   ├─ review/       # Review session
  │   ├─ decks/        # Deck management
  │   └─ stats/        # Statistics (stretch)
  ├─ app/api/          # API routes
  │   ├─ health/       # GET — health check
  │   ├─ decks/        # POST — create deck
  │   │   └─ [id]/
  │   │       ├─ generate/  # POST — LLM card generation
  │   │       └─ stats/     # GET — deck statistics
  │   └─ reviews/
  │       ├─ route.ts       # POST — submit response → grade → FSRS update
  │       └─ next/          # GET — next due card(s)
  ├─ prisma/
  │   └─ schema.prisma      # Database schema (source of truth)
  └─ lib/
      ├─ db.ts              # Prisma client singleton
      ├─ fsrs.ts            # ts-fsrs wrapper, grade mapping
      └─ llm.ts             # OpenRouter client, prompts
```

### Database Tables

| Table | Purpose |
|-------|---------|
| `decks` | id, name, description, source_material, created_at |
| `cards` | id, deck_id, question, rubric/reference_answer, difficulty_hint, created_at |
| `reviews` | id, card_id, response_text, llm_grade (0.0–1.0), llm_feedback, fsrs_rating, reviewed_at |
| `card_state` | id, card_id, FSRS state fields (stability, difficulty, due, last_review, etc.) |

### LLM Grade → FSRS Rating Mapping

| LLM Grade | FSRS Rating |
|-----------|-------------|
| 0.0–0.3 | Again |
| 0.3–0.5 | Hard |
| 0.5–0.8 | Good |
| 0.8–1.0 | Easy |

## Common Commands

```bash
bun install              # Install dependencies
bun run dev              # Dev server with hot reload on :18104
bun run build            # Production build
bun start                # Start production server (what launchd runs)
bunx prisma migrate dev  # Run migrations (dev)
bunx prisma generate     # Regenerate Prisma client
bunx prisma studio       # DB GUI for inspection
```

## Code Style

- TypeScript strict mode
- React Server Components for data-fetching pages; Client Components for interactive views
- Tailwind CSS for styling — mobile-first, responsive
- ts-fsrs runs **server-side only** — never import in client components
- OpenRouter calls happen in API routes only — never expose keys to the client
- Prefer `fetch()` for OpenRouter calls (OpenAI-compatible endpoint)
- Set `HTTP-Referer` and `X-Title` headers on all OpenRouter requests

## Testing

- Validate API routes return correct status codes and shapes
- Test FSRS state transitions: new card → first review → subsequent reviews
- Test grade mapping boundaries (0.3, 0.5, 0.8 thresholds)
- `curl localhost:18104/recall/api/health` should always return 200

## Deployment

This is a personal single-user app running on a Mac Studio behind Tailscale. Deployment is via launchd:

```bash
cd ~/code/recall
git pull
bun install
bun run build
launchctl unload ~/Library/LaunchAgents/com.wesleyflorence.recall.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.wesleyflorence.recall.plist
```

The plist lives in `~/code/caddy/deploy/com.wesleyflorence.recall.plist` and is copied to `~/Library/LaunchAgents/` on install.

## Things to Avoid

- **Don't use npm/yarn/npx** — this project uses bun exclusively
- **Don't hardcode `/recall` in links/fetches** — use Next.js basePath
- **Don't import ts-fsrs in client components** — server-side only
- **Don't expose API keys to the browser** — all LLM calls go through API routes
- **Don't change port 18104** without updating Caddy config and PORTS.md
- **Don't add authentication** — Tailscale provides the access boundary
- **Don't install a separate web server** — Next.js serves everything, Caddy proxies
