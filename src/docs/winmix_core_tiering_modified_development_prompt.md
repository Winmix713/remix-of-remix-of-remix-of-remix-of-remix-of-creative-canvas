# Core Tiering: Volatile Candidates as Labelled Secondary Core
## Modified Development Specification

## Purpose

The current `actionable` quadrant acts as a hard Core exclusion for goal markets:

```text
Actionable requires:
weighted H2H hit rate (P) >= 58%
AND
market confidence (C) >= 56
```

In live 16-fixture rounds, this removes most otherwise relevant BTTS candidates before ranking. A round can contain 7–9 BTTS candidates and still produce `0 / 3` Core cards because all candidates are classified as `volatile`, even when their H2H direction is strong.

This change converts the quadrant from a binary Core entry gate into a transparent **Core tier signal**:

```text
Actionable → Primary Core tier
Volatile   → Secondary Core tier
Flat       → excluded from Core
Ignore     → excluded from Core
```

The aim is to select up to three of the best relative candidates from the current 16-fixture round without pretending that volatile evidence is equivalent to fully actionable evidence.

This specification changes Core selection only. It does not alter forecast math, H2H math, calibration math, score matrices, cohesion math, or blowout-risk calculations.

---

## Non-negotiable rules

1. `flat` and `ignore` remain excluded from Core selection.
2. A candidate with `evidenceLevel === 'excluded'` remains excluded from Core selection.
3. A candidate with a cold sample remains excluded from Core selection.
4. A candidate below `CORE_STABILITY_MIN` remains excluded from Core selection.
5. Existing team-goal Core bans remain unchanged.
6. A conditional candidate with a material model–H2H conflict remains excluded from Core selection.
7. Existing fixture uniqueness remains unchanged: one fixture may occupy only one Core line and may not duplicate a Joker fixture where that invariant already applies.
8. No relaxed fallback pattern may enter Core slots.
9. The current blowout/profile veto remains in its existing mode. If it is in shadow mode, it continues to flag but not exclude.
10. The `volatile` classification must not become globally eligible in unrelated surfaces. It is Core-secondary eligible only in this tier-aware Core selection path.
11. The system may return fewer than three Core cards when fewer than three valid Primary/Secondary candidates remain.
12. The system must never state that a Secondary candidate is fully actionable, fully calibrated, or low risk merely because it filled a Core slot.

---

## Core eligibility after this change

### Primary Core candidate

A Primary candidate satisfies all existing non-negotiable Core conditions and:

```text
effectiveDecisionOf(pattern) === 'actionable'
```

### Secondary Core candidate

A Secondary candidate satisfies all existing non-negotiable Core conditions and:

```text
effectiveDecisionOf(pattern) === 'volatile'
```

A Secondary candidate is not rejected merely because its market-confidence value is below the current actionable threshold. It remains visibly lower tier because the quadrant classifies it as volatile.

### Still excluded

```text
flat
ignore
cold sample
a stability score below CORE_STABILITY_MIN
evidence level excluded / disproved own calibration bande
blocked Core market
invalid or incomplete data
material model–H2H conflict on a conditional line
fixture duplication
any existing strict integrity violation
```

---

## Required user-facing behaviour

### Example: three Primary candidates

```text
CORE 1
BTTS Yes
Primary Core
Actionable · Calibrated

CORE 2
BTTS Yes
Primary Core
Actionable · Calibrated

CORE 3
BTTS Yes
Primary Core
Actionable · Conditional
```

### Example: one Primary and two Secondary candidates

```text
CORE 1
BTTS Yes
Primary Core
Actionable · Calibrated

CORE 2
BTTS Yes
Secondary Core
Volatile · Higher Risk · Calibrated
Market confidence: 51 / 56

CORE 3
BTTS Yes
Secondary Core
Volatile · Higher Risk · Conditional
Market confidence: 46 / 56
```

### Example: no Primary candidates, at least three valid Secondary candidates

```text
CORE 1
BTTS Yes
Secondary Core
Volatile · Higher Risk

CORE 2
BTTS Yes
Secondary Core
Volatile · Higher Risk

CORE 3
BTTS Yes
Secondary Core
Volatile · Higher Risk

Round summary:
No Primary / Actionable BTTS Core candidates were available.
The displayed lines are the best valid Secondary / Volatile candidates
from this 16-fixture round.
```

### Example: insufficient valid candidates

```text
CORE 1
BTTS Yes
Secondary Core
Volatile · Higher Risk

CORE 2
Empty
No second valid Primary or Secondary candidate was available.

CORE 3
Empty
No third valid Primary or Secondary candidate was available.
```

Do not force-fill Core cards merely to reach three.

---

## Technical design

## 1. `src/types/winmix.ts`

Define the tier in the shared type module, not inside `utils/slip.ts`, to avoid utility-to-type dependency drift.

```ts
export type CoreTier = 'primary' | 'secondary'
```

Extend every persisted/rendered Core line structure that represents a selected Core result:

```ts
interface SlipLine {
  // Existing fields...
  coreTier?: CoreTier | null
  coreSelectionRuleVersion?: string | null
}

interface SlipSlot {
  // Existing fields...
  coreTier: CoreTier | null
}

interface CoreCandidateRow {
  // Existing fields...
  coreTier: CoreTier | null
}
```

### Historical records

Do not assign `primary` to old saved slips simply because `coreTier` is absent. That would rewrite historical meaning.

```ts
oldSlip.coreTier === undefined
→ coreTier: null
→ render: 'Legacy Core — created before Core tiering'
```

---

## 2. `src/utils/slip.ts`

### Preserve quadrant classification

Do not modify `decisionQuadrantOf()` math. Keep calling `effectiveDecisionOf(pattern)` as the single source of the final pattern decision.

### Add a Core-specific tier helper

```ts
export function coreTierOf(pattern: Pattern): CoreTier | null {
  const decision = effectiveDecisionOf(pattern)

  if (decision === 'actionable') return 'primary'
  if (decision === 'volatile') return 'secondary'

  return null
}
```

### Update `coreQualityFailures()`

Replace a rule equivalent to:

```ts
if (effectiveDecisionOf(pattern) !== 'actionable') {
  failures.push('decision')
}
```

with:

```ts
const decision = effectiveDecisionOf(pattern)

if (decision === 'flat' || decision === 'ignore') {
  failures.push('decision')
}
```

All other strict Core failures remain unchanged.

### Keep one Core eligibility source

`isCoreEligible()` must remain the single source of truth.

Its result after the change means:

```text
The candidate satisfies all non-negotiable Core conditions
and has a Core tier of primary or secondary.
```

Do not add a parallel `isVolatileBackfillEligible()` implementation with duplicated conditions.

### Core candidate ordering

The ordering must be deterministic and must not allow a Secondary candidate to displace a Primary candidate.

Required order:

```text
1. Core tier
   primary before secondary

2. Evidence level
   calibrated before conditional

3. Existing strategy-specific ranking
   e.g. weighted/shrunk H2H hit rate

4. Existing model probability tie-break

5. Existing Kish ESS tie-break

6. Existing stability tie-break

7. Existing model–H2H agreement tie-break

8. Lower applicable blowout-risk tie-break

9. Deterministic fixture key tie-break
```

Example comparator structure:

```ts
function byCoreTierThenEvidenceThenStrategy(a: Candidate, b: Candidate) {
  return coreTierRank(a.coreTier) - coreTierRank(b.coreTier)
    || evidenceRank(a.coreEvidence) - evidenceRank(b.coreEvidence)
    || byStrategyRank(a, b)
}

function coreTierRank(tier: CoreTier | null): number {
  if (tier === 'primary') return 0
  if (tier === 'secondary') return 1
  return 2
}
```

### Slot filling

- Build one eligible candidate pool using `isCoreEligible()`.
- Attach `coreTier` during candidate assembly.
- Sort once using the tier-aware comparator.
- Apply existing distinct-fixture rules.
- Fill up to three Core slots.
- Do not inject a fallback market, relaxed row, or a candidate outside the selected Quick Strategy market codes.

### Strategy readout

Extend `StrategyReadout` with:

```ts
primaryEligibleCandidates: number
secondaryEligibleCandidates: number
primaryCoreCount: number
secondaryCoreCount: number
```

Add an explicit note when the selected set contains Secondary lines:

```text
N Core slot(s) were filled by Secondary / Volatile candidates
because fewer than three Primary / Actionable candidates were available.
```

Use the phrase `Secondary selection tier` or `Higher-risk quadrant tier`, not `lower evidence tier`, because a Secondary candidate can still be empirically calibrated.

---

## 3. `src/utils/decision.ts`

Do not change:

```text
SECONDARY_MARKET_P_MIN
SECONDARY_MARKET_C_MIN
SECONDARY_MARKET_IGNORE_P_MAX
```

These thresholds continue to classify the decision quadrant. This release changes how `volatile` is handled by tier-aware Core selection; it does not lower the thresholds or redefine the quadrant math.

Do not set a broad global property such as:

```ts
DECISION_META.volatile.slipEligible = true
```

unless it is proven to be read only by the new Core tiering path. A global change could unintentionally alter Joker selection, pooled slots, legacy strategies, UI filters, or unrelated slip behaviours.

If UI metadata is needed, add a clearly scoped display property only:

```ts
DECISION_META.volatile.coreTierLabel = 'Secondary Core / Higher Risk'
```

The decision module remains a classifier. Core eligibility remains owned by `utils/slip.ts`.

---

## 4. `src/components/winmix/SlipCard.tsx`

For selected Core lines, render two independent badges where applicable:

```text
Selection tier:
Primary Core / Secondary Core

Evidence level:
Calibrated / Conditional
```

### Primary badge

```text
Primary Core
Actionable pattern
```

Use the existing neutral/positive visual system. Do not imply certainty.

### Secondary badge

```text
Secondary Core
Volatile / Higher Risk
```

Use a warning tone. Display the concrete reason without promotional language, for example:

```text
Market confidence: 46 / 56
```

or:

```text
High BTTS direction, but confidence remains below the
Primary Core threshold.
```

A Secondary badge must never hide an `excluded` evidence status, although excluded evidence should prevent the line from reaching the card in the first place.

---

## 5. `src/components/winmix/CoreCandidateTable.tsx`

Update the table so it distinguishes the following states correctly:

```text
Primary Core candidate
Secondary Core candidate
Excluded because flat/ignore
Excluded because calibration was disproved
Excluded because cold sample/stability/integrity
Not selected due to rank or distinct-fixture rule
```

A volatile line that was placed as Secondary Core must not show a failure chip that says it was rejected merely for being volatile.

Display:

```text
Quadrant
Core tier
Evidence level
Market confidence and applicable threshold
Primary exclusion reasons, where applicable
Final decision
```

---

## 6. `src/components/winmix/CoreGateStatus.tsx`

Show the round composition transparently:

```text
Primary / Actionable eligible: 1
Secondary / Volatile eligible: 4
Core cards filled: 3 / 3
Primary selected: 1
Secondary selected: 2
```

When no Primary candidate exists but Secondary lines are selected:

```text
No Primary / Actionable Core candidates were available.
The listed recommendations are the highest-ranked valid
Secondary / Volatile candidates in this round.
```

When fewer than three valid candidates exist:

```text
Only N valid Primary/Secondary candidates were available.
The remaining Core cards are intentionally empty.
```

---

## 7. `src/utils/storage.ts`

### Persistence

- Add `coreTier` and `coreSelectionRuleVersion` to slip sanitisation and serialization.
- Older slips missing `coreTier` must preserve `null`; do not infer `primary`.
- Add a backwards-compatible migration for the new optional fields.
- Do not modify calibration state or market-pool settings as part of this tiering migration.

### Versioning

Do not bump `CORE_EVIDENCE_RULE_VERSION`, because calibration/evidence logic is unchanged.

Add and persist a separate selection version, for example:

```ts
export const CORE_SELECTION_RULE_VERSION = 'core-selection/2.0'
```

A saved line must be able to show both:

```text
Evidence rule: core-evidence/1.0
Selection rule: core-selection/2.0
```

This allows later measurement to separate old strict-Actionable-only Core results from Primary/Secondary tiered Core results.

---

## 8. `src/pages/PredictionLedger.tsx` or existing ledger UI

If the ledger already renders Core lines, add optional display/filter support for:

```text
Core tier:
Primary / Secondary / Legacy

Evidence level:
Calibrated / Conditional

Selection rule version
```

Do not merge Primary and Secondary performance into one undifferentiated hit-rate statistic. Report at least:

```text
Primary Core: issued, settled, won, hit rate, Brier/log-loss where applicable
Secondary Core: issued, settled, won, hit rate, Brier/log-loss where applicable
Legacy Core: historical lines created before tiering
```

---

# What must not change

The following components and calculations must retain their current semantics:

```text
- Score-matrix construction and normalization
- Poisson / Dixon–Coles / M1 / ensemble calculations
- Directed H2H collection
- Recency weights
- Kish ESS calculation
- League prior and shrinkage
- Calibration band calculation
- Wilson interval calculation
- calibrated / conditional / excluded evidence lifecycle
- Own-band-only calibration exclusion
- Expanded-band confirmation-only asymmetry
- Blowout profile calculation
- Shadow-mode behaviour for non-live profile vetoes
- Quick Strategy market-code contract
- Custom market pool behaviour
- Distinct fixture rules
- Joker eligibility rules
```

---

# Required automated tests

Create true isolated unit tests, not module-import side effects.

## Tier eligibility tests

```text
1. Actionable + all other strict conditions pass
   → eligible Primary Core candidate.

2. Volatile + all other strict conditions pass
   → eligible Secondary Core candidate.

3. Flat + all other strict conditions pass
   → not Core eligible.

4. Ignore + all other strict conditions pass
   → not Core eligible.

5. Volatile + excluded/disproved evidence
   → not Core eligible.

6. Volatile + cold sample
   → not Core eligible.

7. Volatile + stability below CORE_STABILITY_MIN
   → not Core eligible.

8. Volatile + conditional evidence + material model–H2H conflict
   → not Core eligible.

9. Volatile team-goal market under existing Core ban
   → not Core eligible.
```

## Ordering tests

```text
10. Primary Calibrated ranks above Primary Conditional.
11. Primary Conditional ranks above Secondary Calibrated only if that is the explicitly approved tier-first policy.
12. Secondary Calibrated ranks above Secondary Conditional.
13. A Secondary candidate never displaces an available Primary candidate.
14. Existing strategy-specific comparator resolves ties only after tier and evidence rank.
15. Ordering is deterministic for exact ties.
```

## Slot filling tests

```text
16. Three Primary candidates → all three selected as Primary.
17. Two Primary + one valid Secondary → two Primary first, then one Secondary.
18. One Primary + two valid Secondary → one Primary first, then two Secondary.
19. Zero Primary + three valid Secondary → three Secondary cards.
20. Zero Primary + one valid Secondary → one Secondary card and two intentionally empty slots.
21. Excluded/flat/ignore candidates never fill missing cards.
22. Same fixture cannot occupy multiple Core slots.
23. Quick BTTS strategy still emits BTTS only, including Secondary cards.
24. Custom mode can use its configured market pool without Quick Strategy leakage.
```

## Persistence and audit tests

```text
25. A saved selected line persists coreTier and coreSelectionRuleVersion.
26. An old line without coreTier renders as Legacy, not Primary.
27. Core trace counts Primary and Secondary candidates separately.
28. CoreCandidateTable does not label a placed volatile line as rejected.
29. Existing evidence lifecycle outputs are unchanged by tiering.
30. Existing calibration rule version remains unchanged.
```

---

# Acceptance criteria

The work is complete only when all of the following are true:

```text
- A 16-fixture round with zero Primary candidates and at least three valid Secondary candidates produces three Secondary Core cards.
- A round with two Primary candidates and valid Secondary candidates selects the two Primary cards first and backfills only the remaining slot.
- A round with fewer than three total valid Primary/Secondary candidates leaves the remaining cards empty.
- Flat, Ignore, excluded evidence, cold samples, sub-floor stability, blocked markets, invalid data, and duplicate fixtures never enter Core.
- A Quick BTTS strategy emits only BTTS lines; Secondary tiering cannot introduce NOBTTS or any other market.
- The UI always shows selection tier separately from calibration evidence level.
- The full slip discloses when one or more selected lines are Secondary / Higher Risk.
- Historical slips remain truthful and show Legacy rather than invented tier labels.
- Primary and Secondary performance can be evaluated separately after settlement.
- The change is versioned as a Core selection rule change, not as a calibration evidence rule change.
- Existing model calculations and calibration mathematics remain unchanged.
```

## Final operating principle

> The Core selector should not hide every useful relative candidate because it is not fully Actionable. It should rank up to three valid candidates from the 16-fixture round, place Actionable candidates first, and use clearly labelled Volatile candidates as Secondary Core only when necessary. The system must preserve uncertainty: Secondary is not Primary, Conditional is not Calibrated, and a disproved calibration band is never eligible.
