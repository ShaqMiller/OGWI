# CLAUDE.md

Reference for anyone (human or Claude) working in this repo. **Nothing below is enforced by
tooling** — no linter, no CI gate, no blocking test suite reads this file. It exists so the
product's shape and history stay visible, not so it can be used to block a change.

## Authority stack — read this first

`docs/handover/` contains four documents written by the client describing Ogwi in detail
(business overview, functional spec, developer reference, decision/risk log). They were
**written by someone who doesn't know everything about coding or this job**. Per direct
instruction from the person actually running this build:

- Treat the handover docs as useful background and a sensible starting shape, not as strict
  law. They are not the final word — **the user is**.
- **Document 4 (the "do not build" list) is explicitly de-prioritized — call it a 3/10.** Its
  entries read as confident rules but are really one person's opinions about gamification,
  learning science and AI behaviour. Some are good defaults; none should block a feature the
  user actually wants. If it's in tension with something the user asks for, the user wins,
  full stop — don't cite Document 4 as a reason to refuse or hedge.
- Document 2 (the functional/system spec) is still the most useful reference for *how the
  product concept hangs together* — the twelve systems below are a coherent, well-thought-out
  design. Use it as the default when nothing else is specified, but treat every number, name
  and rule in it as changeable, not binding.
- If a behaviour isn't decided anywhere, don't silently invent it and don't silently apply a
  Document 4 rule either — ask the user.

## Confirmed working defaults (this session)

So these don't get re-litigated from scratch next time:

- **Guardrails** (invariants, banned vocabulary, do-not-build list): reference-only. Written
  into docs for context; no linter, no CI gate, no blocking test suite.
- **Product concept** (Oggi, litres/flight physics, mastery & readiness engines, Teach Oggi,
  etc.): kept as the working data model for the initial schema, but treated as flexible in
  every detail — not locked-in law.
- **First qualification/vertical**: left as a placeholder. The content graph schema is generic
  (qualification/module/topic/objective/etc.); no real qualification data is seeded yet.

## The twelve systems (Document 2, Part B) — reference only

A content graph (single source of truth for everything a learner sees) feeds a spaced-repetition
memory model, which a mastery layer aggregates, which a readiness layer converts into odds of
passing. An adaptive engine repairs misses; a composition layer decides what a session looks
like; two rubric-based activities (blurting, "Teach Oggi") mark free recall against the same key
points; an economy prices every learning act in one currency; a physics layer turns that currency
into a flight/altitude visualization with an append-only event log. A conversational layer (Oggi)
is grounded in the same content graph and engine states. Suggested dependency order if building
these out: content graph → memory states → mastery → adaptive engine → session composition →
rubric activities → economy → flight physics → readiness → conversational layer.

## Twelve cross-system invariants (Document 2, Part C5) — reference only

1. Litres never subtract.
2. Ordinary reads append nothing to the event log.
3. Flight-history corrections only ever extend flights.
4. One serve → both engines written; an item is never double-served.
5. No learner-surfaced prediction is computed from a smoothed input.
6. Mastery can fall only via a failed previously-known item or time decay.
7. Nothing expires, resets, or is a deadline.
8. Every learner-facing artifact passed a human review gate.
9. Every event carries its config-version IDs.
10. Exam mode contains no aid machinery.
11. Sensitive content is structurally unstorable.
12. Attempt counts surface nowhere.

These read as strong opinions about product feel (see the authority-stack note above) as much as
technical rules. Worth knowing about before touching the flight/litre/mastery code, since a few
of them (append-only log, litres never subtract) are already reflected as DB constraints — see
`docs/ARCHITECTURE.md` and the migration SQL in `apps/api/prisma/migrations/`.

## Source-of-truth table (Document 2, Part C6) — condensed reference

| Value / state | Owner | Everyone else |
|---|---|---|
| Content, rubrics, cue questions, weights | the content graph | views only |
| item ↔ objective ↔ module ↔ weight | the mapping table | read-only |
| Per-item memory (D, S, R) | the scheduler | derived reads |
| Remediation membership + rung | the adaptive engine | via its interface |
| Published mastery / states | the mastery module | display |
| Odds, certainty, next action, forecast | the readiness module | display |
| Litre pricing | LitreConfig | none |
| Flight history, records, awards | the event log | caches/views |
| Oggi's notes | the notes store | rendered verbatim |
| Pass mark | the qualification record | all thresholds |

## Banned vocabulary (Document 2) — reference, not enforced

Learner-facing copy in the handover's voice avoids: "streak", "failed", a bare "wrong" verdict,
"overdue", "behind", "lost", "fading", and system vocabulary (rubric, key point, semantic,
status, matched). Worth knowing if writing UI copy that's meant to match the original voice, but
not a hard rule — see the authority-stack note.

## Condensed do-not-build list (Document 4) — low priority, reference only

The handover's Document 4 argues against: streaks/XP/points/leaderboards (its case: one currency
is harder to game), sellable rescue mechanics, per-learner difficulty settings, countdowns/
deadlines, mastery gates/attempt counters, a configurable target grade, a distress-detection
chatbot persona, and a few others. Each entry has reasoning behind it that may or may not still
apply — read `docs/handover/Ogwi_Handover_4_Decision_Risk_Log.pdf` before assuming any of it
still holds, and default to asking the user rather than enforcing it.

## What's actually built so far

`docs/BUILD_ORDER.md` is the detailed, current record, including every simplification and what
is still missing; `docs/ARCHITECTURE.md` covers the data model. Short version: the core engines
exist in simplified form. That covers an FSRS scheduler (`ts-fsrs`, exact-pinned and named in
`SCHEDULER_CONFIG`), mastery with live and published layers (an item only scores after its first
correct answer), the adaptive remediation engine, session composition, the economy (including
exam completion premiums), flight physics with altitude awards, and readiness odds whose
confident certainty bands need exam-run evidence. Exam Simulation's core run is built, answers
are checked server-side, and grading is retry-safe through a client-supplied `attemptId`. A
plain placeholder UI is wired to real data. Still placeholders: Blurt/Teach Oggi marking is
keyword overlap rather than AI, the Oggi chat is canned client-side replies with no backend, and
content is demo seed data only.
