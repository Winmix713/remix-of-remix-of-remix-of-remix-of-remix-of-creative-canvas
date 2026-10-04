# WINMIX — CRITICAL AUDIT CORRECTION BEFORE PRODUCTION RELEASE

The latest audit demonstrates substantial architectural improvement, but it contains one critical internal contradiction that must be resolved before the system can legitimately be classified as production-ready.

## 1. Critical contradiction: `>= 0.58` exception vs. RED VETO simulation

The audit proposes the following Phase 6 logic:

```typescript
if (level === 'excluded' && (pattern.modelProb ?? 0) >= 0.58) {
  return true;
}
```

This explicitly means:

> An `excluded` / refuted-band record with `modelProb >= 58%` is allowed to pass the evidence filter and is only penalized in ranking.

However, the audit's later "Smoking Gun" simulation states that all three problematic Core candidates are hard-blocked:

* Elche – Real Madrid — 63.0% model probability → RED VETO
* Wolverhampton – Newcastle — 55.4% → RED VETO
* Real Madrid – Getafe — 55.9% → RED VETO

and concludes:

> `NO QUALIFIED CORE BTTS PICKS TODAY`

These two behaviors are not compatible.

### Concrete consequence

Under the explicitly provided `>= 0.58` exception:

```text
Elche – Real Madrid
modelProb = 63.0%
evidenceLevel = excluded
63.0% >= 58.0%
        ↓
PASS
        ↓
ranking penalty
        ↓
potentially Core-eligible
```

If Elche is the only surviving candidate, it could become Core 1.

Therefore, the `NO QUALIFIED CORE BTTS PICKS TODAY` conclusion does **not** follow from the provided implementation.

This must be corrected before release.

---

# 2. Required architectural decision

The team must choose one of two explicit policies.

## Policy A — Refuted evidence is a hard veto

If an own probability band is statistically refuted with sufficient evidence, the record becomes:

```text
RED / BLOCKED
```

and model probability cannot override that decision.

In this design:

```typescript
if (evidenceLevel === 'excluded') {
  return false;
}
```

The model may explain the prediction, but it cannot override a critical statistical contradiction.

This is the safer production architecture.

---

## Policy B — Refuted evidence is overridable

If the team genuinely wants high model probability to override a refuted band, then this must be explicitly designed as a controlled exception rather than presented as a hard evidence veto.

For example:

```text
RED evidence
      ↓
Override eligibility check
      ├── calibrated OOS model?
      ├── sufficient independent ESS?
      ├── strong calibration metrics?
      ├── acceptable interval width?
      ├── no material model-H2H conflict?
      ├── acceptable market risk?
      └── positive publication value?
              ↓
        OVERRIDE APPROVED
```

A raw:

```typescript
modelProb >= 0.58
```

condition is not sufficient.

A 63% uncalibrated model estimate should not automatically override independently measured evidence simply because it crosses an arbitrary threshold.

---

# 3. Do NOT declare 10/10 based only on switching the gates on

The audit identifies:

```text
BTTS_DEATHZONE_GATE_ACTIVE = false
PHASE6_MARKET_GATING_ACTIVE = false
MARQUEE_RANKING_ACTIVE = false
```

as major weaknesses. That diagnosis is valid.

However:

```typescript
false → true
```

does not by itself prove production readiness.

The thresholds themselves must be validated.

The audit explicitly acknowledges that the current implementation contains fixed:

```text
modelProb < 0.48
+25
-50
-100
```

values and that the penalty should ultimately depend on ESS and Wilson-interval distance.

This should not be deferred until after production.

---

# 4. Hardcoded thresholds require empirical validation

Before production, validate at minimum:

* 40–55% deathzone boundary
* 48% model threshold
* 58% exception threshold
* +25 / -50 / -100 evidence penalties
* H2H weighting
* confidence weighting
* model probability weighting
* evidence severity boundaries

The correct question is not:

> "Does this threshold look reasonable?"

It is:

> "Does this threshold improve out-of-sample decision quality on historical data?"

Required validation:

```text
Historical data
      ↓
Time-ordered train/test split
      ↓
Out-of-sample predictions
      ↓
Calibration
      ↓
Candidate generation
      ↓
Evidence gates
      ↓
Risk gates
      ↓
Value/publication gate
      ↓
Core selection
      ↓
Realized BTTS outcomes
```

No future information may leak into the historical decision.

---

# 5. Ranking weights also require backtesting

The audit reports:

```text
Model probability × 60
H2H × 25
Confidence × 15
priority bonus × 0.5
```

as the implemented ranking formula.

The formula is mathematically coherent, but mathematical coherence is not evidence of predictive superiority.

The team must demonstrate that these weights outperform reasonable alternatives in historical out-of-sample testing.

At minimum compare:

```text
A — current 60/25/15
B — model-only
C — calibrated probability + evidence
D — calibrated probability + evidence + risk
E — alternative optimized weighting
```

Measure:

* Brier Score
* Log Loss
* calibration error
* hit rate
* yield / ROI where applicable
* maximum drawdown
* tail-loss behavior
* selection stability
* Core publication frequency

The objective is not maximum historical hit rate.

The objective is **robust out-of-sample decision quality**.

---

# 6. H2H must remain evidence, not authority

The current architecture is moving toward Model-First ranking, which is a positive development.

However, H2H should not simply be replaced by model probability.

H2H should become one evidence component whose influence depends on:

```text
sample size
recency
stability
independence
league/context relevance
calibration
```

A 65% historical H2H figure should never automatically compensate for a materially contradictory current-model/evidence state.

---

# 7. Required production state machine

The production engine should expose explicit states:

```text
RAW
  ↓
CALIBRATED
  ↓
EVIDENCE_ASSESSED
  ↓
RISK_ASSESSED
  ↓
VALUE_ASSESSED
  ↓
CORE_ELIGIBLE
  ↓
CORE_PUBLISHED
```

With blocking states:

```text
RED / BLOCKED
RESEARCH_ONLY
FLAGGED
```

Critically:

```text
CORE_PUBLISHED
```

must never be reachable merely because the system needs to fill a slot.

---

# 8. Core selection rule

The correct invariant is:

```text
0 <= CoreCount <= 3
```

not:

```text
CoreCount = 3
```

The system must be allowed to produce:

```text
Core 0
Core 1
Core 2
Core 3
```

depending entirely on evidence and risk quality.

The empty state:

```text
NO QUALIFIED CORE BTTS PICKS TODAY
```

must therefore be treated as a valid successful production outcome, not a system failure.

The audit correctly identifies the importance of removing forced slot filling.

---

# 9. Immediate action list

Before calling this 10/10 production-ready:

### P0 — Resolve contradiction

Decide whether:

```text
excluded + modelProb >= 58%
```

can override RED evidence.

Do not leave both implementations/simulations in the specification.

### P0 — Remove arbitrary override

Do not use:

```typescript
modelProb >= 0.58
```

as the sole justification for overriding statistically refuted evidence.

### P0 — Validate thresholds

Backtest:

```text
0.48
0.58
40–55%
+25/-50/-100
```

using strictly out-of-sample historical data.

### P0 — Activate production gates only after validation

Do not simply flip:

```typescript
BTTS_DEATHZONE_GATE_ACTIVE = true
```

and declare victory.

### P1 — Remove duplicate logic

Keep exactly one canonical implementation of:

```typescript
evaluateBttsBandHealth()
```

The audit reports this function as duplicated between `coreEligibility.ts` and `coreEvidence.ts`; this should be verified against the actual source before modification.

### P1 — Add regression tests

The current problematic records must become permanent regression cases.

Especially:

```text
Elche – Real Madrid
Wolverhampton – Newcastle
Real Madrid – Getafe
```

The tests must assert not only the final ranking but the complete state transition:

```text
raw
→ evidence
→ risk
→ eligibility
→ ranking
→ publication
```

---

# 10. Final acceptance criterion

Do not use:

> "The code looks production-ready."

Use measurable acceptance criteria:

```text
Can the engine correctly refuse to publish
a Core pick when the evidence is insufficient?
```

```text
Can calibrated predictive probability outperform
the relevant baseline out-of-sample?
```

```text
Can statistically refuted evidence prevent
an unsafe publication unless a formally validated
override policy is satisfied?
```

```text
Can the system produce zero Core picks
without attempting to fill empty slots?
```

```text
Can every published Core pick be reconstructed
from an immutable decision trace?
```

Only if the answers are demonstrably YES should the system be considered production-grade.

## Bottom line

The implementation is substantially better than the previous version.

But the current audit has a **real specification/implementation contradiction**:

```text
excluded + modelProb >= 58%
        ↓
PASS
```

versus:

```text
Elche 63%
        ↓
RED VETO
```

Both cannot be true simultaneously.

Resolve this first.

Then validate the thresholds and ranking weights with genuine out-of-sample backtesting.

**Only after those steps should Winmix claim 10/10 production readiness.**
