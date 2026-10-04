# Core Gate-First Canonicalisation — Audit and Repair

## The problem, confirmed in code

`buildStrategyCore` (src/utils/slip.ts) collapses duplicate `(fixtureId, code)` records **before** any gate runs:

```text
rawCandidates → canonicalCandidates(...) → quality → evidence → conflict → tier → veto
```

The Core Decision Trace (src/utils/coreTrace.ts) instead builds its whole candidate list from the **raw** family (`allPatterns.filter(code in familyCodes)`), so the same round reports "11 examined candidates" in the Core summary and "12 BTTS candidates" in the trace — one duplicate record (e.g. `angol-8::streak::BTTS` and `angol-8::goal_market::BTTS` for Tottenham–Nottingham).

Beyond the count mismatch this can silently lose a valid Core card: if the early canonical winner later fails a hard gate, its equally-valid duplicate was already discarded and can never take the slot.

## The fix

Invert the order everywhere: **evaluate every raw record against every active hard gate, then canonicalise only the survivors.**

```text
allPatterns
  → rawCandidates                    (market-code filter, duplicates kept)
  → qualityPassedRaw
  → afterEvidenceRaw
  → afterConditionalModelConflictRaw
  → afterActiveProfileVetoRaw        (live veto only; shadow never removes)
  → canonicalEligible                (canonicalise here, and only here)
  → ranking → distinct fixtures → Core slots
```

Invariants: a canonical winner must itself be gate-passing; one record's gate failure never removes another; a shadow profile flag never changes eligibility; a live veto removes the raw record before canonicalisation; one fixture, at most one Core slot; every Core card traces to one canonical gate-passing record.

## Work items

### 1. src/utils/slip.ts — gate-first funnel

- Replace the STAGE 0 canonicalisation with raw-record gating in the order above, applying the live profile veto (`spec.profileVeto && vetoActive && bttsRisk.wouldVeto`) as a hard gate before `canonicalCandidates(...)`.
- Derive `baseline`, `experiment`, ranking and slot selection from `canonicalEligible`; keep the existing tier/fixture-dedup rules unchanged.
- Extend `StrategyReadout` with population-explicit counts: `rawCandidatesCount`, `qualityPassedRawCount`, `afterEvidenceRawCount`, `afterModelConflictRawCount`, `afterActiveProfileVetoRawCount`, `canonicalEligibleCount`, `selectedCoreCount`, `mergedEligibleDuplicatesCount`, `rawDuplicateGroupsCount`. Keep existing fields that consumers read, but repoint them at the correct populations so no count mixes scopes.
- Annotate candidate rows with `canonicalWinner: boolean`, `mergedInto: string | null`, `canonicalStatus: 'winner' | 'merged' | 'no_eligible_winner' | null`. A hard-gate failure is never labelled "merged".
- Document the canonical comparator order (tier → evidence → H2H → stability → Kish ESS → generator priority → `pattern.id`) and keep it applied only within a surviving `(fixtureId, code)` group. `PatternHit.id` stays `fixtureId::type::code`.

### 2. src/utils/coreTrace.ts — two explicit populations

- Keep `rawFamily` for the audit tables, and add the same gate-first raw stages plus `canonicalEligible`.
- Rebuild the funnel with 8 stages (raw records → quality → own disproved band → conditional conflict → active veto → canonical gate-passing → ranking/distinct fixtures → Core cards), each derived strictly from the stage above it, with `assertFunnelStep(previous, current, name)` guarding every candidate stage. Fixtures→patterns stays informational.
- Relabel counters so raw and canonical are never both called "jelölt": `Nyers stratégiajelölt-rekordok`, `Kanonikus, kapun belüli Core-jelöltek`, `Core-kártyára került`.
- Evidence tally becomes three named populations: `raw`, `eligible` (canonical gate-passing), `placed`.
- Duplicate groups keep being built from `rawFamily`, titled `Nyers rekord-duplikátumok — nem számolnak a kanonikus Core-nevezőbe`, each row showing generator, H2H, stability, ESS, quadrant, evidence, hard-gate result, canonical status, winner id and comparator reason.
- Attribution stays first-failed-gate only, plus a separate non-hard bucket `Duplikátum összevonva (kanonikus vesztes)` counting only full gate survivors that lost canonicalisation.
- Text export gains the raw→canonical counts and duplicate winner reasons.

### 3. UI — one denominator

- `CoreDecisionTracePanel.tsx`: add a compact population summary (raw → gate-passing raw → canonical → merged duplicates); render merged records dimmed with `összevonva → <winner id>`, gate failures with their actual first failed gate; keep the expanded raw duplicate audit.
- `CoreCandidateTable.tsx` and the Core header: use the canonical gate-passing count, worded `Core-ra jogosult (kanonikus, kapun belüli): X`. If a raw count is shown at all, it is labelled `Nyers stratégia-piaci rekordok: N`.

### 4. Regression suite

This project has no vitest runner; executable suites live in-repo (`coreEvidenceTests.ts`, `coreTierTests.ts`) and are surfaced through audit panels. Following that convention, add `src/utils/coreCanonicalTests.ts` exporting `runCoreCanonicalSuite()` with cases A–H (gate failure cannot suppress a passing duplicate; live veto cannot suppress an unflagged duplicate; shadow flag does not exclude; deterministic winner among two passing duplicates; all-fail group yields no winner and no false "merged"; trace/summary population equality; funnel monotonicity; the 6→1→0 negative-count regression), and surface it in the audit page next to the existing suite panels.

## Verification

Typecheck plus the new suite green, then a real 16-fixture run showing the same canonical count in the Core header, the candidate table, the Decision Trace and the text export.
