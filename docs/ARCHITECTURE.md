# Architecture reference

Transcribed from the handover documents' Part C (Architecture & Governance) for convenience.
**This is reference documentation, not a review gate** — see `CLAUDE.md` for why (the handover
docs are a client's spec, not strict law, and Document 4 in particular is de-prioritized). Keep
it updated as the real data flows diverge from what's described here; don't treat divergence as
a bug to fix.

## Canonical data-flow map

```
CONTENT GRAPH ──views──► mapping table · rubrics · cue banks · renderings ·
                          lesson chunks · confusable edges · templates

RUNTIME STATE                          owner
  per-item memory states (D, S, R)     scheduler (read by mastery, readiness)
  remediation bank + rungs             adaptive engine
  flight event log                     flight physics
  notes store (Oggi)                   conversational layer
  published mastery / odds / forecast  mastery / readiness

FLOWS
  graded answer (any surface)   ──► one review event ──► scheduler state update
                                                       AND adaptive-engine entry/exit
  blurt / teach / debrief scoring ──► per-key-point writes ──► same review-event path
  scheduler due sets + adaptive-engine batches ──► openers & recommended queue
  litre events (source-itemised) ──► flight pumps ──► altitude, records, awards
  forecast ──► spacing horizon ──► scheduler interval ceilings
  engine states + graph ──► conversational-layer context frames
  published values only ──► progress surfaces, admin surfaces
```

The original spec calls the "no arrow outside this map" rule release-blocking. That's not
enforced here — but it's still a genuinely useful discipline: before wiring a new read/write
path, it's worth updating this file so the map keeps describing what's actually true.

## Event model summary (flight log)

Append-only. Event types: `pump` (source-itemised, idempotent key) · `liftoff` (synchronous
with its crossing pump) · `touchdown` (materialised once at first discovery, one per flight) ·
`award_earned` (same pattern, one per award) · `notification_sent` · config/timezone markers ·
`annul` (a correction event that references the invalidated event and never deletes it).

Bi-temporal: `effectiveAt` is physics time (when something actually happened, which can be
backdated for offline syncs), `sequence` is append order (breaks ties, resolves races). Ordinary
reads append nothing — displayed values are computed at render time from cached state + now, so
there's no such thing as a stale cached number.

This shape is reflected in `apps/api/prisma/schema.prisma` (`FlightEvent`, `Flight`) and in the
migration SQL (idempotency-key uniqueness, a partial unique index for one-touchdown-per-flight,
a partial unique index for one-award-per-learner).

## Configuration registry

| Config | Rough contents |
|---|---|
| LitreConfig | class payout rates, unit rates, bonus values, session caps |
| PhysicsConfig | leak rates, liftoff/touchdown thresholds, cap, push timing |
| SchedulerConfig | desired retention, fuzz, floors/ceilings, FSRS version pin |
| MasteryConfig | displayed-decline half-life, rollover timing |
| OggiConfig | unstick triggers, offer caps, greet frequency |
| ReadinessConfig | projection window, clamps, certainty-band thresholds |

Governance idea worth keeping even though it's not enforced: configs as immutable, versioned
documents (a new version is a new row, never an edit), with events stamped by the versions in
force at the time, so replay can pick the right version for its era. Modelled in
`apps/api/prisma/schema.prisma` as `ConfigDocument` (unique on `(configType, version)`).

## Publish-point table

| Moment | Recomputes |
|---|---|
| Every graded answer | item memory state, remediation entry/exit |
| Every pump / exit / read | flight state (computed at render) |
| Session end / practice-run end | published mastery, biggest opportunity, odds, forecast |
| Daily rollover (inactivity) | the same four, once |
| Blurt/Teach/Debrief scoring moment | their single engine write |
| Engine batch-queue changes | the recommended queue |
| Never mid-activity | any published display value |

## Twelve cross-system invariants

See `CLAUDE.md` — duplicated there since it's the more likely first stop. Two are already
reflected as DB constraints in this scaffold: litres never subtract (`CHECK (amount >= 0)` on
`litre_events`), and ordinary reads append nothing (the event log tables have no update path in
the repository layer, by convention — not yet enforced at the DB level).

## Source-of-truth table

See `CLAUDE.md` for the condensed version. Full version: `docs/handover/Ogwi_Handover_2_...pdf`,
Part C6.

## What's actually implemented right now

Only the content graph + mapping table (fully modelled, no build-time-gate enforcement code
yet) and schema-only skeletons for the flight event log, litre events, and config versioning
(tables and structural constraints exist; no service logic reads or writes them yet). Everything
else in this document describes the target shape, not current behaviour.
