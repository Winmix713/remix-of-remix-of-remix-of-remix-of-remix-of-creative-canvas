# Premium Development Prompt — Consistent Core 1–2–3 Selection from 16 Virtual Fixtures

## Role and implementation standard

You are a senior TypeScript/React quantitative-product engineer working inside the existing **WinMix Tactical Studio** codebase.

All currently implemented WinMix functionality is working and must remain working. Treat the existing prediction pipeline, directed H2H logic, recency weighting, Kish effective sample size, joint score matrix, strict Core gate, market definitions, prediction ledger, settlement flow, auditability, and UI as production behaviour. Do not remove, replace, silently weaken, or regress any of them.

Implement this feature as a transparent, testable, additive evolution of the current architecture. Do not build an opaque second model. Do not introduce odds feeds, EV/Kelly claims, external football data, or “guaranteed” language.

---

## Product objective

Implement a new Quick Core Strategy called:

```text
Top 3 BTTS Yes — Consistent Pattern
```

The strategy analyses a user-supplied set of **exactly 16 virtual fixtures** and returns up to three distinct BTTS Yes Core recommendations.

The objective is not merely to select the three fixtures with the highest isolated BTTS values. It is to select the strongest **three-fixture portfolio whose members also represent a coherent, stable scoring-pattern regime**.

Conceptually:

```text
16 virtual fixtures
→ individual evidence and strict BTTS Core eligibility
→ candidate feature profiles
→ three-fixture combination search
→ cohesion / outlier assessment
→ up to three stable and mutually consistent Core selections
```

An empty Core slot is valid. The system must never fill a third Core slot with a lower-quality or profile-conflicted fixture merely to reach three recommendations.

---

## Product rationale

### Team names are presentation, not the primary signal

For virtual/randomly generated fixtures, the displayed team names may be visually useful but are not necessarily the causal unit of the selection logic. The system already knows the underlying properties and historical patterns of each fixture pair.

For this strategy, team names may be hidden or de-emphasised in a dedicated **Pattern View**. Every fixture must still remain traceable and auditable by its true home/away teams, directed fixture identity, league, and source data.

Use a neutral fixture label in Pattern View, such as:

```text
Pattern Candidate A
Pattern Candidate B
Pattern Candidate C
```

Do not remove real team names from the normal Fixture View, saved slips, settlement screens, exports, or audit records.

### Strength gap is context, not a veto

WinMix already has team strength/rating values. For example:

```text
Home strength: 2.7
Away strength: 7.2
Strength gap: 4.5
```

This expresses a weaker-versus-stronger matchup. A large strength difference must not automatically disqualify BTTS.

A fixture with a BTTS probability around 64% can be an attractive two-sided scoring candidate even when one side is considerably weaker, if the evidence indicates that the weaker side consistently scores at least once. The desired outcome is not a specific full-time score; it is evidence that both sides tend to contribute to scoring.

### The important negative pattern

A high BTTS percentage can be deceptive when the directed pair’s historical distribution also contains recurrent high-scoring, one-sided clean-sheet results, such as:

```text
3-0, 4-0, 5-0, 6-0
0-3, 0-4, 0-5, 0-6
```

Those outcomes are high-scoring but BTTS No. They indicate that the pair may sometimes enter a one-sided blowout regime rather than a stable two-sided scoring regime.

Similarly, specific directed rivalry/pair profiles may show unusually frequent special outcomes or state transitions, including:

```text
0-0
4-0
0-3
HT 1-0 → FT 1-2
```

Examples named by the operator include Madrid White–Barcelona, Nottingham–Wolverhampton, Wolverhampton–Manchester Blue, Liverpool–London Gunners, London Gunners–Manchester Blue, and their reverse fixtures. These examples must not be hard-coded as special teams or exceptions. The system must detect the underlying patterns from directed historical data for every fixture pair.

---

## Non-negotiable principles

1. **Directed fixture identity:** `home → away` is distinct from `away → home`. Never silently merge directions.
2. **No name-based hard coding:** no special treatment for El Clásico, Liverpool, Barcelona, or any named team.
3. **One joint score matrix:** model BTTS, scoreline risk, total-goal distributions, and clean-sheet blowout probabilities must derive from the existing normalised joint score matrix.
4. **No raw-rate decision:** raw H2H counts are explanatory only. Decision values must respect recency weighting, shrinkage, effective sample size, and existing reliability handling.
5. **No automatic three-card fill:** return 0–3 cards. Do not use relaxed fallback in this Quick Strategy.
6. **No duplicate fixtures:** one fixture can appear only once across Core 1, Core 2, Core 3, and Joker.
7. **No hidden super-score:** do not multiply unrelated probabilities/confidence values into an opaque score. Keep all gating and ranking explainable.
8. **No false causality:** call these `pattern`, `profile`, `cohesion`, and `risk` signals. Do not claim to reverse-engineer or predict a random generator with certainty.
9. **No automatic parameter mutation:** settled outcomes may feed evaluation and normal historical imports, but may not silently alter model coefficients or Core thresholds.
10. **Backwards compatibility:** existing Custom Core configuration remains available and unchanged under an advanced mode.

---

## Required feature design

### 1. Quick Core Strategy selector

Add a daily-use selector above the Core cards:

```text
CORE STRATEGY
[ Top 3 BTTS Yes — Consistent Pattern ▼ ]

Fixtures analysed: 16
Strict BTTS candidates: N
Profile-safe candidates: N
Cohesive Core portfolio: N / 3
```

Add this strategy type:

```ts
export type QuickCoreStrategy =
  | 'btts_consistent_pattern'
  | 'btts_profile_safe'
  | 'btts_raw_h2h'
  | 'over25'
  | 'safety_trend'
  | 'custom'
```

The new mode permits only the exact BTTS market pattern. It must not let 1X2, double chance, team goals, totals, correct score, or first-half markets compete for the three Core cards.

Keep the existing per-card configuration under:

```text
Advanced / Custom Core Setup
```

Keep that panel collapsed by default. Do not remove any existing advanced setting.

### 2. Candidate eligibility

For each of the 16 fixtures, construct a BTTS candidate only if it passes the existing full **strict Core gate**.

The new strategy must additionally reject:

- relaxed fallback candidates;
- duplicate fixture candidates;
- fixtures with insufficient reliable directed evidence for profile classification;
- fixtures carrying a validated `one_sided_blowout_risk` status;
- fixtures with material model–H2H conflict under the existing agreement logic.

Do not invent hard-coded numeric thresholds in UI code. All candidate thresholds must be named, centralised, typed, versioned, and ready for prequential backtesting.

### 3. Canonical candidate pattern profile

Create a transparent, typed snapshot for every strict BTTS candidate.

```ts
export interface BttsCandidatePatternProfile {
  fixtureId: string
  directedFixtureKey: string
  leagueId: string

  homeTeamId: string
  awayTeamId: string
  homeStrength: number | null
  awayStrength: number | null
  strengthGap: number | null

  modelBttsProbability: number
  shrunkWeightedBttsRate: number
  weightedOver25Rate: number
  weightedAvgGoals: number
  h2hEffectiveSampleSize: number
  directSampleSize: number
  usedReverse: boolean
  agreement: 'agree' | 'neutral' | 'conflict'

  modelHighGoalNoBttsProbability: number
  modelCleanSheetBlowoutProbability: number
  weightedHighGoalNoBttsRate: number
  weightedCleanSheetBlowoutRate: number

  htBttsRate: number | null
  htCoverage: number | null
  htHomeLeadThenAwayWinRate: number | null

  profileLabel:
    | 'stable_two_sided'
    | 'btts_narrow'
    | 'underdog_scores'
    | 'one_sided_blowout_risk'
    | 'transition_volatile'
    | 'low_tempo'
    | 'high_variance'
    | 'insufficient_data'

  coreCohesionValue: number
  coreCohesionMetric: 'weighted_avg_goals'
  patternEligible: boolean
  patternExclusionReasons: string[]
}
```

### 4. Define the cohesion value explicitly

The operator’s examples such as `2.1`, `1.6`, `2.8`, `0.9`, and `5.7` must never remain an unlabeled number in the product.

For the first release, define the canonical Core Cohesion Value as:

```text
Recency-weighted, shrinkage-aware directed H2H average total goals
```

```ts
coreCohesionMetric: 'weighted_avg_goals'
coreCohesionValue: weightedAvgGoals
```

Display the exact label in every UI location. Do not call it only `Value`.

Future versions may compare a multi-dimensional profile distance, but do not overcomplicate the first release. The initial cohesion value is one transparent, interpretable signal; it does not replace BTTS probability, strict eligibility, or blowout-risk controls.

### 5. Blowout No-BTTS risk

Add two model-side metrics derived only from the existing normalised joint score matrix:

```ts
highGoalNoBtts = P((homeGoals + awayGoals >= 4) && (homeGoals === 0 || awayGoals === 0))

cleanSheetBlowout = P(
  Math.abs(homeGoals - awayGoals) >= 3 &&
  Math.min(homeGoals, awayGoals) === 0
)
```

Maintain and assert the invariants:

```text
0 <= cleanSheetBlowout <= highGoalNoBtts <= BTTS No <= 1
```

Add corresponding directed H2H rates using the same recency weighting, ESS handling, and league-prior shrinkage approach as other decision statistics.

Do not veto a fixture because of one old 5-0. Elevated blowout risk must require adequate evidence, must be visible, and must be validated in shadow mode before becoming a strict live exclusion.

### 6. Transition volatility evidence

Historical half-time/full-time patterns can reveal a volatile directed pair profile, including:

```text
HT home lead → FT away win
```

Compute this only from valid historical HT and FT records and expose:

```ts
htHomeLeadThenAwayWinRate: number | null
```

This is an explanatory and optional tie-break signal only in the first release. It must not be treated as a direct BTTS probability multiplier and it must not become a named-team rule.

---

## Portfolio selection algorithm

### Why isolated top-three ranking is insufficient

Selecting the three highest individual BTTS candidates can select a third candidate whose signal is structurally different from the other two. For example:

```text
Candidate A cohesion value: 2.1
Candidate B cohesion value: 1.6
Candidate C cohesion value: 2.8
```

These values represent a reasonably coherent moderate-to-open scoring regime.

By contrast:

```text
Candidate A cohesion value: 2.1
Candidate B cohesion value: 1.9
Candidate C cohesion value: 5.7
```

The `5.7` candidate may be a high-value BTTS candidate in isolation, but it is an extreme profile relative to the other two. It must be flagged as a portfolio outlier and must not automatically occupy Core 03.

### Required selection behaviour

1. Analyse exactly 16 input fixtures.
2. Build strict BTTS candidates.
3. Build `BttsCandidatePatternProfile` for each candidate.
4. Apply existing strict Core eligibility and the profile-risk gate.
5. Generate all valid 1-, 2-, and 3-fixture combinations from eligible candidates. The candidate set is small, so exhaustive enumeration is acceptable and preferable to a greedy shortcut.
6. For every combination, compute transparent portfolio cohesion metrics.
7. Select the best valid combination of up to three cards.
8. If no valid three-fixture portfolio exists, consider valid two-fixture and one-fixture portfolios. Never add a profile-conflicted third fixture just to fill the set.

### Cohesion calculation for a three-card set

For selected cohesion values \(x_1, x_2, x_3\):

\[
m = \operatorname{median}(x_1,x_2,x_3)
\]

\[
D = \max(x_1,x_2,x_3) - \min(x_1,x_2,x_3)
\]

\[
MAD = \operatorname{median}(|x_1-m|,|x_2-m|,|x_3-m|)
\]

For each candidate:

\[
d_i = |x_i-m|
\]

The system must calculate and display:

```ts
export interface CorePortfolioCohesion {
  metric: 'weighted_avg_goals'
  values: number[]
  median: number
  range: number
  mad: number
  outlierFixtureIds: string[]
  status: 'cohesive' | 'borderline' | 'outlier_detected' | 'not_applicable'
  explanation: string[]
}
```

### Important implementation rule

With only three observations, MAD can be zero or unstable. Therefore:

- do not use a naked z-score;
- do not use a naked MAD threshold without an absolute domain floor;
- do not hard-code a magic range in components;
- centralise versioned strategy parameters;
- calibrate the threshold prequentially against historical rounds;
- show the range, median, and candidate values to the operator.

### Portfolio ordering

Once the best portfolio is selected, order Core 1–3 by individual BTTS quality, not by the cohesion value itself:

1. highest strict, shrunk, recency-weighted BTTS evidence;
2. then model BTTS probability;
3. then ESS;
4. then agreement status;
5. then lower validated blowout-risk;
6. deterministic fixture key tie-break.

Cohesion chooses the compatible set. It must not disguise a weaker candidate as Core 01.

---

## Pattern View UI

Add a dedicated, optional display mode in the Fixture Predictor:

```text
[ Fixture View ] [ Pattern View ]
```

### Fixture View

Keep existing actual home/away names, league context, market evidence, and audit links.

### Pattern View

De-emphasise or hide team names in the main comparison table. Use neutral candidate labels while retaining an explicit reveal action:

```text
Candidate A     Reveal fixture
Candidate B     Reveal fixture
Candidate C     Reveal fixture
```

Pattern View must show:

```text
BTTS (model)
BTTS (weighted H2H + shrinkage)
Weighted average goals — Core Cohesion Value
Strength gap
Over 2.5 rate
H2H ESS
Model–H2H agreement
Clean-sheet blowout risk
Pair profile label
Cohesion status
```

This feature is a decision-hygiene aid to reduce team-name anchoring; it is not a claim that names contain no information. Underlying fixture identity must always remain available for audit and settlement.

---

## Core cards and exclusion states

### Selected Core card

```text
CORE 01
BTTS Yes
Pattern Candidate A

Model BTTS: 64.0%
Weighted H2H BTTS: 66.2%
Core Cohesion Value:
Weighted Avg Goals 2.10

Profile: Stable two-sided
Blowout No-BTTS risk: Low
Portfolio cohesion: Cohesive

[ Reveal fixture ] [ Open evidence ]
```

### Excluded candidate

```text
EXCLUDED FROM PROFILE-SAFE CORE
Pattern Candidate D

BTTS evidence: 68.0%
Core Cohesion Value: 5.70

Reason:
Outlier relative to the selected stable Core pattern.

Additional profile evidence:
Elevated high-scoring BTTS No / clean-sheet blowout risk.

[ Reveal fixture ] [ Open evidence ]
```

### Empty slot

```text
CORE 03
No third consistent BTTS Core candidate.

The remaining strict BTTS candidates were excluded because of
profile risk, insufficient evidence, or portfolio outlier status.
```

Avoid red/green language that implies betting certainty. Use `Actionable`, `Caution`, `Excluded from this strategy`, and evidence-based explanations.

---

## Shadow mode and validation

The cohesion rule is a hypothesis. It must be introduced in stages.

### Strategy A — baseline

```text
Top 3 strict BTTS candidates ranked independently.
```

### Strategy B — experiment

```text
Top 3 BTTS Yes — Consistent Pattern:
strict BTTS eligibility
+ validated blowout-risk control
+ portfolio cohesion/outlier filter
```

Initially run Strategy B in shadow mode. Do not change the existing live Core recommendation until the experimental strategy demonstrates a pre-declared, out-of-sample advantage.

### Historical round grouping

Never manufacture rounds by blindly splitting historical match rows into blocks of 16 or 8. A portfolio backtest requires verified fixture-batch / round identifiers or explicitly saved user-entered rounds with later settlements.

If verified round membership is unavailable, report pair-level calibration and mark the Top 3 portfolio backtest as unavailable.

### Required metrics

For both strategies report:

- issued Core lines;
- settled Core lines;
- number of 0/1/2/3-card rounds;
- BTTS hit rate;
- mean signalled BTTS probability;
- Brier score;
- log loss;
- Wilson 95% confidence interval for hit rate;
- cohort hit rate of excluded/outlier candidates;
- number and reason of profile exclusions;
- pre-declared strategy and threshold version.

Do not activate the new cohesion exclusion merely because it looks plausible or because a few named rivalry fixtures lost. Require meaningful prequential/out-of-sample evidence and publish the trade-off between higher precision and fewer issued Core cards.

---

## Architecture and files

Adapt exact filenames to the real repository, but preserve existing separation of concerns. Expected touchpoints include:

```text
types/winmix.ts
utils/forecastCore.ts
utils/patterns.ts
utils/fixtures.ts
utils/roundAnalysis.ts
utils/slip.ts
utils/marketCatalog.ts
utils/evalWindows.ts
utils/pipeline.ts
components/winmix/FixtureCard.tsx
components/winmix/PatternList.tsx
components/winmix/SlipPanel.tsx
components/winmix/marketPool/*
pages/FixturePredictor.tsx
pages/PipelineAudit.tsx
```

Suggested additions:

```text
utils/coreCohesion.ts
components/winmix/PatternView.tsx
components/winmix/CoreCohesionPanel.tsx
components/winmix/BttsProfileBlock.tsx
```

Keep pure calculation logic out of React components. The portfolio optimiser, profile derivation, threshold configuration, and explanatory reason generation must be deterministic, unit-testable utilities.

---

## Tests and acceptance criteria

### Regression

- Existing prediction, import, pipeline, fixture analysis, Custom Core setup, saving, settlement, and audit features still work.
- Existing market probabilities preserve their prior output when the new feature is disabled.
- No existing Core strategy’s behaviour changes unless `btts_consistent_pattern` is selected.

### Mathematical

- Joint score matrix remains normalised.
- `0 <= cleanSheetBlowout <= highGoalNoBtts <= bttsNo <= 1` holds over a broad lambda/rho test grid.
- Directional H2H is preserved.
- Reverse-assisted samples are disclosed and cannot obtain the strongest profile-safe classification.
- An old isolated blowout cannot produce a hard veto in a cold/thin sample.

### Selection

- Exactly 16 fixtures are required by this Quick Strategy; show a clear validation error otherwise.
- All Core lines are BTTS Yes lines.
- All Core lines come from unique fixtures.
- Relaxed fallback never enters this strategy.
- The selected set has at most three cards.
- When a high-isolated-score candidate is a confirmed cohesion outlier, the selector can prefer a more mutually consistent three-card portfolio.
- When every valid three-card set contains an unacceptable outlier, return two or fewer cards.
- Core 1–3 ordering is based on individual BTTS evidence after the cohesive portfolio has been chosen.

### UX

- The operator can select the strategy in one action.
- Core cards explain the chosen profile and the labelled cohesion value.
- Excluded candidates receive a clear non-promotional reason.
- Team names remain revealable and fully preserved in audit/settlement records.
- Advanced custom settings remain accessible but are not required for daily use.

### Validation discipline

- Cohesion thresholds are centralised, versioned, and shadow-mode capable.
- The new strategy ships initially as experimental unless evidence gates are already satisfied.
- Each saved slip persists the selected strategy, pattern profiles, cohesion result, parameters version, and feature snapshot so historical results can be audited honestly.

---

## Final operating rule

The feature must implement this principle:

> From 16 virtual fixtures, do not simply choose the three highest isolated BTTS signals. Choose up to three strict BTTS candidates that are individually credible, resistant to one-sided high-score clean-sheet risk, and mutually consistent within an explicitly labelled scoring-pattern regime. When a third candidate is a clear profile outlier, exclude it rather than forcing the Core 1–2–3 set to contain an unstable “cuckoo” selection.

The application must state uncertainty honestly. It is identifying evidence-supported pattern consistency, not guaranteeing the output of a random generator.
