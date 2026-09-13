# Build order

Reference checklist, adapted from the handover's developer reference (Document 3, §8). A
living document — reorder or drop steps as the actual plan diverges from this. Not a gate;
nothing here blocks a merge.

- [x] **1. Content graph + mapping table** — schema modelled in
      `apps/api/prisma/schema.prisma` (Qualification/Module/Topic/Objective/KeyPoint/
      KnowledgeItem/Rendering/ConfusableEdge), Zod shapes in `packages/shared`, one working
      example module (`apps/api/src/modules/content-graph/`) demonstrating the route →
      controller → service → repository pattern end to end. Build-time validation gates
      (item-count ranges, etc.) exist as constants only — no enforcement code yet.
- [x] **2. Scheduler states + review-event path** — per-item memory (Difficulty/Stability/
      Retrievability) via `ts-fsrs` (the official FSRS library, published default parameters,
      binary Good/Again grading), modelled as `ItemMemoryState` + append-only `ReviewEvent` in
      `apps/api/prisma/schema.prisma`. `apps/api/src/modules/scheduler/`: `POST
      /api/scheduler/reviews` grades one item; `GET /api/scheduler/due` returns due items,
      padded with never-reviewed items when nothing's due yet (a simplified stand-in for the
      spec's "opener" — no remediation ladder, no full never-empty guarantee, since the
      adaptive engine and session composition don't exist yet). Verified against real FSRS
      output, not just types (see the scheduler tests).

      **The FSRS release is now genuinely pinned.** `ts-fsrs` was declared as `^5.4.1` - a caret
      range that would have accepted any 5.x - and the config ID `fsrs-default-1` named nothing.
      The dependency is now exact (`5.4.1`), and `SCHEDULER_CONFIG` in `packages/shared` resolves
      that ID to library, build (`v5.4.1 using FSRS-6.0`), retention, fuzz and short-term
      settings. The scheduler is built FROM that object, so fuzz and short-term no longer ride on
      library defaults, and `scheduler-config.test.ts` fails if the installed build ever drifts.
      The ID is unchanged because the behaviour didn't change - it only became nameable.
- [x] **3. Mastery layer** — `apps/api/src/modules/mastery/`: live score computed on demand
      from `ItemMemoryState` via the content-graph relations (never-reviewed items score 0,
      matching Doc 2 B1); published (kind-but-honest) score in `PublishedMastery`, jumping to
      live on a gain and easing toward it with a 7-day half-life on a decline. `GET
      /api/mastery/:qualificationSlug`. Publishing happens synchronously after each graded
      review for now, since there's no session-end publish point yet (step 5) — a scaffold
      simplification, not the spec's real publish-point timing.
- [x] **4. Adaptive engine** — `apps/api/src/modules/adaptive/`: remediation status is
      *derived* from the existing `ReviewEvent` log (`remediation.util.ts`'s
      `deriveRemediationState`, unit-tested directly) rather than a new mutable table — any
      Again enters remediation and resets progress; two Goods on two different calendar days
      exit it, with the two also required to use different renderings whenever the caller
      supplied a `renderingId` on both. `GET /api/adaptive/wrong-answer-pool` (items currently
      in remediation, plus items that exited within the last 30 days) and `GET
      /api/adaptive/gap-queue` (per-module "Fixing gaps" readiness: ≥5 items in remediation or
      the oldest signal >7 days old, whichever first). **Simplified from the spec**: no
      rendering-format ladder (typed → cued → multiple-choice) — that needs authored rendering
      variants, which don't exist yet (every item has exactly one BASE rendering). Server-side
      answer-checking, the other prerequisite, now exists — see the note below. Calendar days
      are computed in UTC, not the learner's local timezone.

      **Remediation's "two different renderings" exit rule is now conditional.** Doc 2 B3 wants
      two corrects on two different renderings, which presumes its content model ("each item
      owns multiple renderings"). Once answers began recording which rendering was served,
      enforcing that against single-rendering content became unsatisfiable — both corrects carry
      the same id, so the item could never exit and "Fixing gaps" would grow without bound.
      `deriveRemediationState` now takes `enforceRenderingDistinctness`, set per item from its
      actual rendering count, so the rule re-activates by itself once variants are authored.
- [x] **5. Session/flow composition** — `apps/api/src/modules/composition/`: `GET
      /api/composition/next?qualificationSlug=...` composes the opener (reuses the scheduler's
      `getDueItems`), the "current topic" (first topic in module/topic order that isn't
      complete yet - complete = every item in it has been reviewed at least once, derived from
      `ItemMemoryState`, no new table), that topic's next quiz batch (uncovered items first,
      then weakest-retrievability first), and an activity-slot recommendation (`blurt`/`teach`
      by fact-heavy vs. conceptual majority among the topic's objectives, `null` on an exact
      tie or when the topic has no activity slot). Verified end to end against seeded content:
      routing correctly advances IP Addressing → OSI Model → `qualificationComplete: true`, and
      the activity slot flips blurt → teach to match. **Simplified from the spec**: the ~8
      named flow templates and their rotation constraints aren't built - Document 2 Part D #5
      says that library is itself still an open decision, authored during content production,
      so inventing one here would be exactly the "don't invent what isn't decided" mistake the
      handover warns against. No true mid-quiz resume (no quiz-taking UI exists yet to resume
      into), no recall day (needs blurting, step 6), no pairing-restriction logic beyond "one
      activity slot per topic" (moot until step 6 exists to violate it).
- [~] **6. Rubric activities (placeholder marking)** — `apps/api/src/modules/recall/`. Blurt
      and Teach Oggi share one endpoint pair (`GET /api/recall/topics/:topicId/key-points`,
      `POST /api/recall/topics/:topicId/score`), reflecting the spec's "one fair marker wearing
      two costumes" (Doc 2 B6/B7). **The marking itself is an explicit placeholder, not real AI
      marking** - per the user's direction to stand up something demoable now rather than wait
      for real semantic scoring: `recall.service.ts`'s `scoreText()` normalises the learner's
      text and checks whether enough of each key point's plain-name words appear in it (a ≥50%
      word-overlap threshold), purely computed per request, nothing persisted, no wiring into
      scheduler/mastery/economy/flight. A side effect of this simplification is that a key
      point only ever comes back Matched or Unmatched, never "Incorrect" - a keyword match can
      never safely detect a wrong statement - which happens to land on the same
      benefit-of-the-doubt behaviour the spec calls for, without deliberately implementing it.
      Frontend: `.../qualifications/[slug]/blurt/[topicId]/page.tsx` (freeform textarea →
      coverage % + matched/unmatched lists) and `.../teach/[topicId]/page.tsx` (turn-based chat;
      Oggi's cue questions cycle deterministically through untaught key points, client-tracked).
      Both surfaces carry a highly visible "Placeholder scoring" badge, never hidden in a
      footnote. Only seeded for `demo-cert` (`apps/api/prisma/seed.ts` - 12 key points across
      its 6 objectives); `demo-pm-basics` deliberately has none, so its dashboard doesn't offer
      Blurt/Teach at all rather than faking availability - verified live in the browser. Real
      semantic/AI marking is still the open item here.
- [x] **7. Economy (simplified)** — `apps/api/src/modules/economy/`: every graded answer
      auto-awards points (`priceReviewGrade` in `economy.service.ts`, hooked into
      `scheduler.service.gradeReview`). **Deliberately simple, not the spec's fuller design** -
      three tiers only: first-ever correct = 5, correct while the item was "due" (about to be
      forgotten) = 7 (the top rate - rewarding well-timed review is standard practice in
      spaced-repetition apps and is the actual anti-farming mechanism), correct while not due
      yet = 1 (small, so grinding easy material doesn't pay), incorrect = 0. No combo bonuses,
      hard-question multipliers, or session caps. Numbers are a starting point, not confirmed
      with the client yet. `GET /api/economy/balance` and `GET /api/economy/recent`. Verified
      live in the browser, not just curl.
- [x] **8. Flight physics (simplified)** — `apps/api/src/modules/flight/`. `physics.util.ts`'s
      `evaluateFill` is the pure altitude evaluator (grounded = leak-free accumulation;
      airborne = linear leak below 200ft, halving every 24h at/above it, piecewise across the
      boundary — matches Doc 2 B9's closed-form crossing). `flight-state.util.ts` replays a
      flight's pump history into current fill/peak/liftoff. Every earned point now pumps the
      flight (wired into `scheduler.service.gradeReview`, right after the economy award —
      litres and flight fill are the same currency). Touchdown is materialised at first
      discovery on any read, same pattern as mastery/adaptive. `GET /api/flight/state`.
      **Simplified**: a five-band slice of the altitude-firsts catalogue is implemented
      (`packages/shared/src/constants/awards.constants.ts`: First Lift 100ft, Above the
      Rooftops 200ft, High-rise View 300ft, Breaking the Skyline 500ft, The Ceiling 1000ft),
      generically — one pump can cross several thresholds at once and earns all of them, via
      the same `hasAward`/`recordAward` mechanism, not a special case per badge. The spec's
      full ~40-badge catalogue (flight-length streaks, big days, comebacks, course tie-ins) is
      Awards-page content work, not physics, and isn't built. Awards are learner-global (the
      DB's partial unique index is keyed on `learnerId` alone), so a learner only ever earns
      each one once regardless of which qualification's flight crosses it first — a real design
      choice, not an oversight. No push notifications (no delivery infra exists). No historical
      Longest-Flight/Highest-Altitude board across past flights — only the live flight's state
      and peak. Touchdown discovery uses "now" as the effective timestamp rather than the
      spec's exactly-solved crossing instant. `GET /api/flight/awards` (catalogue + earned
      state). Verified live: a single large pump correctly earned three thresholds at once; a
      normal liftoff earned exactly one award, once, never again on later pumps.
- [x] **9. Readiness (simplified)** — `apps/api/src/modules/readiness/`. `normal-cdf.util.ts`
      is a pure Φ (standard normal CDF) implementation; `readiness.service.ts` computes μ (every
      item's retrievability projected 14 days forward, aggregated through the same
      module/objective weighting mastery uses — `weightedObjectiveMean` and `mean` are now
      exported from `mastery.service.ts` and reused, not duplicated), a coverage-based σ, and
      `P(pass) = Φ((μ − passMark) / σ)`. Odds are withheld below 20% (the spec's "climb frame").
      A forecast (expected finish date) comes from an exponentially-weighted pace over the
      trailing 28 days of `ReviewEvent` history. `Qualification.passMark` is a new column
      (migration `qualification_pass_mark`; demo content seeded at 0.70 / 0.65 — placeholders,
      not researched). `GET /api/readiness/:qualificationSlug`. **Two deliberate deviations from
      the spec, both because no exam/mock system exists**: certainty bands (`early`/`fair`/
      `solid`) are computed from weighted coverage alone rather than also requiring exam-format
      run evidence. **That deviation is now closed** — step 12 built Exam Simulation, so
      `certainty-band.util.ts` applies Doc 2 B2's full rule (solid = coverage ≥70% and ≥2 runs
      in 30 days; fair = ≥40% and ≥1 in 45). Coverage alone can no longer buy a confident
      band, which is a deliberate, user-visible regression for existing data. Still deviating:
      σ is a simple coverage-only heuristic, not the spec's multi-factor formula, and μ has no
      calibration term (`ratio = achieved / projection`) — exam runs now make that possible but
      it is a separate piece of work. Verified live: odds correctly
      withheld at 0% coverage, rose to a real calibrated number once the qualification was fully
      covered, with a genuine forecast date computed from actual review-event history.
- [~] **10. Conversational layer (Oggi)** — context frames, notes store, role contracts,
      capability boundary: still parked, needs real AI integration. `app/(platform)/oggi/page.tsx`
      is a fully client-side chat shell with no backend call at all - a short rotation of canned
      replies, explicitly labelled in the UI as a preview ("Oggi's real AI brain is coming
      soon"), added purely so there's something to click through, not a step toward the real
      system.
- [~] **11. Learner-facing surfaces** — a first, deliberately plain pass exists, wired to real
      data only, nothing mocked:
      - `app/(platform)/page.tsx` - qualification picker.
      - `.../qualifications/[slug]/page.tsx` - mastery bars, points, "next up", a
        click-through multiple-choice quiz driven by composition's live next-item.
      - `.../progress/page.tsx` - mastery, points, live altitude, and the readiness "odds of
        passing" + forecast date, all per qualification
        (`components/progress/QualificationProgressCard.tsx`). Not built: the completion %
        figure itself (distinct from the forecast date, which *is* built).
      - `.../practice/page.tsx` - the "Recommended" section only
        (`components/practice/QualificationPracticeSection.tsx`): due-for-review items
        ("Keeping fresh") and the wrong-answer pool grouped by module ("Fixing gaps in: X"),
        each opening a fixed-batch quiz (`components/quiz/ItemQueueQuiz.tsx`). Skips the
        spec's 5-item/7-day batch-readiness gate on purpose - see the adaptive engine's note
        in step 4. Not built: jump-back-in, Exam Simulation, the custom test builder,
        completed-attempt history - all need systems that don't exist.
      - `.../awards/page.tsx` - the five-band altitude-award catalogue (step 8), earned/locked
        state and earn date, all real. Not built: everything outside that five-band slice.
      - `.../qualifications/[slug]/blurt/[topicId]/page.tsx` and `.../teach/[topicId]/page.tsx`
        (step 6) - Blurt and Teach Oggi, entry buttons on the qualification dashboard's "Next
        up" card, shown only for topics with seeded key points. `app/(platform)/oggi/page.tsx`
        (step 10) - the canned-reply Oggi chat shell, a 5th nav link.
      - **Answer-checking is server-side** (`POST /api/scheduler/answers`). The client submits
        the chosen option plus the `renderingId` it was shown; the API resolves the rendering,
        marks it, derives the grade and returns the verdict with the correct option. The prompt
        endpoint no longer returns `correctOptionIndex` at all — it is unauthenticated, so
        shipping the key there made every answer publicly readable, and the old
        `POST /api/scheduler/reviews` let any caller forge mastery, litres, altitude and pass
        odds by posting `grade: "good"`. That route is removed, not deprecated.
        **Retry safety** is handled by a client-supplied `attemptId` on the request: the act key
        `review:<learnerId>:<attemptId>` is stored on `ReviewEvent` under a unique index, and the
        litre and pump rows derive from it, so a retried request returns the original result and
        writes nothing new. `ReviewEvent.selectedOptionIndex` (the column deferred above) is what
        makes a reused id carrying a *different* answer a loud 409 rather than a silent swallow.
        **Deliberately NOT capped or cooled down**: answering the same item again with a new
        `attemptId` is legal, expected and priced at 1L. Doc 2 B8 calls that pricing "the only
        anti-farm mechanism; no access restrictions exist" and Doc 4 forbids policing the learner,
        so idempotency keys on the ATTEMPT and never on the item. There is a test pinning exactly
        this (`answers.integration.test.ts`, "treats a new attemptId on the same item as a fresh,
        priced learning act") — if it ever fails, someone has built the cooldown the spec rules out.
      - A small set of reusable primitives (`components/ui/{Card,Button,Badge,ProgressBar}.tsx`)
        and CSS custom properties (`globals.css`) give every page a consistent look - still
        explicitly a placeholder to prove the backend works end to end, not a design; it will be
        replaced once real designs arrive.

      **A real bug found and fixed while wiring Practice**: Express 4 doesn't forward an error
      thrown inside an `async` route handler to the error middleware - it crashes the whole
      process instead. Every controller in this codebase is an `async` function, so any
      malformed request (or any thrown `NotFoundError`, etc.) could take the API down. Fixed
      by importing `express-async-errors` at the top of `apps/api/src/app.ts`. Regression
      tests in `apps/api/src/__tests__/error-handling.test.ts`.
- [~] **12. Exam Simulation (core run)** — `apps/api/src/modules/exam/`. A randomised paper sat
      under exam conditions: `POST /api/exam/runs` generates it, `GET /api/exam/runs/:runId`
      serves it, `POST .../answers` saves a selection blind, `POST .../submit` marks and
      freezes it, `GET .../results` reveals the key. New `ExamRun`/`ExamRunItem` tables
      (migration `exam_runs`), plus the `knowledge_items(objectiveId)` index that every
      qualification-scoped query was missing.

      **Paper generation was not specified anywhere** (Doc 2 A5 says only "a fresh randomised
      paper each time"), so per Part D it was raised rather than invented: `paper-blueprint.util.ts`
      apportions questions across modules by `blueprintWeight` using largest-remainder, caps
      each module at its eligible content, redistributes any shortfall, and shuffles so position
      doesn't telegraph the blueprint. Eligible = has a BASE rendering in a format the marker
      supports. Target is 30 questions but the paper is capped by content — demo-cert yields 8 —
      and `allottedSeconds` derives from the real size, not the target.

      **Invariant 10 ("exam mode contains no aid machinery") is structural, not conditional**:
      `examQuestionSchema` has no field that could carry correctness, saving an answer returns
      only `{saved:true}`, and `components/exam/ExamOptions.tsx` is a separate component from
      `MultipleChoiceOptions` precisely so no future edit can leak a key through a shared prop.

      **Marking happens only at submit**, never at save. Three reasons: answers stay mutable, so
      per-save marking would write several review events for one served item (invariant 4);
      grading pumps the flight, so it would let a learner watch altitude tick up per question in
      a second tab (Doc 2 C4 forbids publishing mid-activity); and response timing would leak.
      Submit is two-phase — mark and freeze in the repo's first `$transaction`, then write engine
      events claim-first so a crashed submit resumes instead of double-writing an append-only
      log. One aggregate flight pump per paper, not one per question: `flightService.pump`
      replays the whole flight history, so per-item would be quadratic. Litres stay per item.

      **Unanswered questions score as wrong but write no review event.** FSRS grades a retrieval
      attempt and a skipped question isn't one; invariant 6 says mastery falls only via a failed
      previously-known item or time decay.

      Frontend: `(exam)/exam/[runId]` and `.../results`, `components/exam/*`, and an Exam
      Simulation entry on Practice. Results show score, pass/fail, time used, and Review Answers
      with the source topic — and no attempt number, count or history, per invariant 12 (which
      is also why attempt history stays deferred: a history list *is* an attempt counter).

      **Completion premiums are paid** (Doc 2 B8): +50L for an Exam Simulation, gated on ≥70% of
      questions being answered, written as a single `ASSESSMENT` litre event with a null
      `knowledgeItemId` — the premium is earned by finishing a run, not by any one question.
      Keyed `exam-run:<runId>:premium`, so a resumed or retried submit cannot pay it twice, and it
      pumps the flight like any other litres. The `MINI_MOCK` (+20L) and `CUSTOM` (+10L) rates are
      priced and unit-tested but unreachable until those run kinds exist. Below the gate the
      per-question litres are still paid — only the completion bonus is withheld. A full 8-question
      demo run pays 90L (8×5 + 50); the spec's ~150–200L assumes a 30-question paper.

      **Balance bug, found and fixed.** As first shipped, premiums were paid but never counted:
      the points balance and the Recent list reached a litre row's qualification *through its
      knowledge item*, and a premium has none. A learner holding 120L - 20L of answers plus two
      50L premiums - was shown 20 points. Every `LitreEvent` now carries a required
      `qualificationId` (migration `litre_event_qualification`: backfills per-question litres
      through the content graph and premiums through the exam run named in their key, then sets
      NOT NULL, so a payment that can't name its qualification cannot exist). The premium tests
      had summed raw litre rows, which is how it slipped through; a test now reads the balance
      and Recent list through the real queries.

      **Not built**: the pausable timer, per-question flagging, the question-navigation panel,
      pause/resume and jump-back-in, attempt history, and the mini-mock and first-mock-invitation
      kinds (the invitation threshold is Open Decision #2 and undecided). `startedAt` is set at run
      creation, so "time used" inflates if the learner leaves the tab before opening the paper —
      acceptable while the timer is deferred.
- [ ] **13. Whatever guardrails end up wanted** — the original spec pushed for a CI-blocking
      invariant suite and banned-vocabulary linter here; per the user's direction this pass
      keeps that reference-only. Revisit if/when enforcement actually becomes useful.

## Scaffold-only steps (this session)

- [x] pnpm monorepo: `apps/web` (Next.js App Router), `apps/api` (Express), `packages/shared`.
- [x] Backend layering conventions + typed error hierarchy + structured logging + `/health`.
- [x] `requireLearner` auth stub (dev header, TODO for real auth).
- [x] Frontend: `(platform)` / `(flow)` / `(exam)` route groups, exam mode structurally
      separate from the Flow's aid machinery, TanStack Query + typed API client + query-key
      factory, BFF proxy route handler.
- [x] Postgres via Prisma, `docker-compose.yml`, initial migration.
- [x] Tooling: TypeScript strict mode, ESLint + Prettier, Vitest, root scripts, `.env.example`.
- [x] `apps/api/prisma/seed.ts` — small, obviously-fake demo qualification ("demo-cert", 1
      module, 2 topics, 4 objectives, 6 knowledge items) so steps 2-3 are exercisable end to
      end. Idempotent. **Not** the real "first vertical" (Doc 2 Part D #1) — that's still open.
