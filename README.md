# Ogwi

A pnpm monorepo: `apps/web` (Next.js, App Router) is a client of `apps/api` (Express), which
owns all domain logic and the Postgres database via Prisma. See `CLAUDE.md` for how this repo
relates to the client's original spec documents in `docs/handover/`, and `docs/ARCHITECTURE.md`
/ `docs/BUILD_ORDER.md` for the data model and what's left to build.

## Prerequisites

- Node.js 20+
- pnpm 9+ (`corepack enable && corepack prepare pnpm@9 --activate`, or `npm install -g pnpm@9`)
- Docker (for local Postgres via `docker-compose.yml`)

## Setup from a cold clone

```bash
# 1. Install dependencies
pnpm install

# 2. Start Postgres
docker-compose up -d

# 3. Configure environment
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 4. Generate the Prisma client and apply migrations
pnpm --filter @ogwi/api db:generate
pnpm db:migrate

# 5. (Optional) seed a small fake qualification so the scheduler and
#    mastery endpoints have something to exercise
pnpm db:seed

# 6. Start both apps
pnpm dev
```

`apps/api` listens on `http://localhost:4000` (`/health` checks the database).
`apps/web` listens on `http://localhost:3000`.

## Scripts (run from the repo root)

| Script | What it does |
|---|---|
| `pnpm dev` | Runs both apps in dev mode, in parallel |
| `pnpm build` | Builds `packages/shared` then both apps, in dependency order |
| `pnpm lint` | Lints every workspace |
| `pnpm test` | Runs Vitest in every workspace that has tests |
| `pnpm typecheck` | Type-checks every workspace with no emit |
| `pnpm db:migrate` | Runs `prisma migrate dev` against the local database |
| `pnpm db:studio` | Opens Prisma Studio against the local database |

## Layout

```
apps/
  web/          Next.js App Router client. No fetch in components - everything goes through
                a typed API client (src/lib/apiClient.ts) and domain hooks (src/hooks/<domain>/).
                Two "worlds" as route groups: (platform) for normal nav, (flow) for the
                full-screen learning shell, plus a sibling (exam) group whose shell never
                imports the Flow's aid-machinery components (structural, not conditional).
  api/          Express + TypeScript. All domain logic lives here, layered per module as
                route -> controller -> service -> repository (see any module under
                src/modules/ for the pattern). Prisma owns the Postgres schema; migrations
                only, never db push once real data exists.
packages/
  shared/       Zod schemas + inferred TypeScript types shared between web and api, so
                request/response shapes are typed on both sides from one source.
docs/
  handover/     The client's four original spec documents (context, not strict law - see
                CLAUDE.md).
  ARCHITECTURE.md, BUILD_ORDER.md   Reference docs for the target data model and what's built.
```

## Notes

- **Auth is stubbed.** `requireLearner` (`apps/api/src/middleware/requireLearner.ts`) reads a
  dev header (`x-dev-learner-id`) instead of validating a real session. There's a `TODO(auth)`
  at both ends (the middleware, and the Next BFF proxy that currently injects a fixed dev
  learner id from `DEV_LEARNER_ID`). Don't build on top of this without replacing it first.
- **No real qualification data is seeded.** `pnpm db:seed` creates two small, clearly-labelled
  fake qualifications (`demo-cert`, `demo-pm-basics`) for exercising everything below - neither
  is the real "first vertical", which is still an open decision (see the handover's Part D).
- **The points system is deliberately simple and unconfirmed.** Three tiers on a graded
  answer (`packages/shared/src/constants/economy.constants.ts`): first-ever correct = 5,
  correct while due = 7 (top rate, rewards well-timed review), correct while not due = 1,
  incorrect = 0. Reasonable industry-standard defaults, not signed off by the client yet.
- **The frontend at `/` and `/qualifications/[slug]` is a functional placeholder**, not a
  design - unstyled-ish, built only to prove the backend works end to end by being clickable.
  Expect it to be replaced once real designs arrive.
- **What's callable right now**, behind `requireLearner` (send `x-dev-learner-id`): `GET
  /api/content-graph/qualifications[/:slug]`, `GET
  /api/content-graph/knowledge-items/:id` (a question's prompt/options, for display),
  `POST /api/scheduler/reviews` (grade a knowledge item `good`/`again` - also auto-awards
  points), `GET /api/scheduler/due?qualificationSlug=...` (due + new items), `GET
  /api/mastery/:qualificationSlug` (live + published mastery per module), `GET
  /api/adaptive/wrong-answer-pool?qualificationSlug=...` and `GET
  /api/adaptive/gap-queue?qualificationSlug=...` (remediation status, derived from the review
  log - step 4), `GET /api/composition/next?qualificationSlug=...` (what a learner should do
  next - step 5), `GET /api/economy/balance?qualificationSlug=...` and `GET
  /api/economy/recent?qualificationSlug=...` (points - step 7), `GET
  /api/flight/state?qualificationSlug=...` (live altitude, computed on read, never stale -
  step 8), `GET /api/readiness/:qualificationSlug` (odds of passing + forecast - step 9).
- **The points system is also what feeds the flight/altitude mechanic** - same currency, same
  events. Grading enough correct answers lifts the flight off the ground at 100L; altitude then
  decays over real time exactly like the spec's "helium leaks" idea, computed fresh on every
  read (never a stored, staleable number).
- **Readiness's pass mark is a per-qualification placeholder** (`Qualification.passMark`,
  currently 0.70 / 0.65 in the two demo qualifications) - not a researched value.
