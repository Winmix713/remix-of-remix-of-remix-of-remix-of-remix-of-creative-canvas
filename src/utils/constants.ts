/** Pipeline + persistence constants, mirrored from the WinMix v2 (Part A) spec. */
export const SCHEMA_VERSION = 3;
/** Expected number of matches in one season CSV. */
export const EXPECTED_MATCH_COUNT = 240;
/** Accept EXPECTED ± TOLERANCE, flagged with a warning badge. */
export const MATCH_COUNT_TOLERANCE = 4;
/**
 * Prequential temperature refit cadence (matches).
 * PHASE 1 — was 50. A virtual league's generator drifts inside a season, so
 * the calibration must follow the fixture-round rhythm, not the season.
 */
export const CALIB_REFIT_INTERVAL = 18;
/** Minimum prior sample before the first temperature fit. PHASE 1 — was 50. */
export const CALIB_MIN_SAMPLE = 24;
/** Bounded concurrency for batch file reads. */
export const READ_CONCURRENCY = 6;
/** Cooperative yielding cadence during long recompute loops. */
export const YIELD_EVERY_N_MATCHES = 25;
/** Rolling evaluation window size. */
export const EVAL_WINDOW_SIZE = 100;

export const STORAGE_KEY = 'winmix-pipeline-v2-state';
/** Storage values are capped around 5MB; warn before we hit it. */
export const STORAGE_SOFT_CAP_BYTES = 4_500_000;

export const DEFAULT_WEIGHT = 5.0;

/* ---------------- Part D — predictor / pattern matcher ---------------- */
/** Fixture slots per league in one manually assembled round. */
export const SLOTS_PER_LEAGUE = 8;
/** Shrinkage strength: a pattern rate is pulled toward the league baseline. */
export const PATTERN_SHRINK_K = 4;
/** Minimum H2H meetings before a pattern may enter the safety core. */
export const PATTERN_WARM_SAMPLE = 5;
export const PATTERN_HOT_SAMPLE = 15;
/** Minimum stability for the safety core. */
export const CORE_STABILITY_MIN = 55;
/** Patterns below this shrunk rate are not surfaced at all. */
export const PATTERN_MIN_RATE = 0.5;
/** HT-dependent pattern families need this share of meetings with HT data. */
export const HT_COVERAGE_MIN = 0.6;
/** Feedback weight band applied to pattern stability. */
export const PATTERN_WEIGHT_MIN = 0.75;
export const PATTERN_WEIGHT_MAX = 1.25;

/* ---------------- P0 — measurement foundation ---------------- */
/** Bootstrap resampling iterations for every skill confidence interval. */
export const BOOTSTRAP_ITERATIONS = 1000;
/** Fixed RNG seed: the same input must always yield the same interval. */
export const BOOTSTRAP_SEED = 20260825;
/** Two-sided alpha for bootstrap percentile intervals (95% CI). */
export const BOOTSTRAP_CI_ALPHA = 0.05;
/** Below this log-loss headroom over the entropy floor, more modelling is overfitting. */
export const ORACLE_SATURATION_GAP = 0.03;
/** A reliability band below this sample size is reported as not evaluable. */
export const BAND_MIN_SAMPLE = 20;

/* ---------------- P1 — fitted M1 + ensemble weight ---------------- */
/**
 * PHASE 1 — ADAPTIVE LEARNING CADENCE
 * -----------------------------------
 * These four numbers govern how FAST the model adapts, never how WELL it fits.
 * At the old values (150 / 100) M1 ran on hand-coded fallback logits for an
 * entire first season and could not catch a mid-season generator shift while it
 * was still actionable. They are now expressed in fixture rounds (~18 matches).
 */
/** Prior samples required before the first as-of logistic fit. Was 150. */
export const M1_MIN_SAMPLE = 36;
/** Prequential refit cadence for the logistic model (matches). Was 100. */
export const M1_REFIT_INTERVAL = 18;
/** L2 penalty strength of the multinomial logistic fit. Governs fit QUALITY. */
export const M1_L2_LAMBDA = 1.0;
/** Full-batch gradient descent budget (deterministic, no randomness). */
export const M1_GD_ITERATIONS = 400;
export const M1_GD_LEARNING_RATE = 0.25;
/** Prior samples required before the ensemble weight is tuned. Was 150. */
export const ENSEMBLE_MIN_SAMPLE = 36;
export const ENSEMBLE_REFIT_INTERVAL = 18;
/** The tuned M1 share is confined to a narrow band around the 0.65 default. */
export const ENSEMBLE_WM1_MIN = 0.45;
export const ENSEMBLE_WM1_MAX = 0.85;

/* ---------------- P2 — experiments (feature flagged, off by default) ---------------- */
/** Prior samples required before the Dixon-Coles rho grid search runs. */
export const DC_MIN_SAMPLE = 200;
export const DC_REFIT_INTERVAL = 200;

/* ---------------- PHASE 1 — recency decay + schema guard ---------------- */
/**
 * Exponential recency decay of the venue attack/defence rates, passed as a
 * NAMED PARAMETER into `venueAttack()` / `venueDefense()` — never hardcoded
 * inside them. Was 0.95, which weighted a 20-match-old game at 36%; at 0.88
 * that drops to 8%, which is what a drifting virtual generator requires.
 */
export const VENUE_DECAY_LAMBDA = 0.88;
/** Rolling form window (matches). Unchanged. */
export const FORM_WINDOW = 5;

/**
 * PHASE 8 — SCHEMA GUARD.
 * Bump on EVERY `FeatureVector` shape change. A checkpoint stamped with a
 * different version is discarded whole: a logistic fit can never be migrated
 * across a dimensionality change, only rebuilt.
 *
 * v2 = 20-dimensional vector (14 base + 4 half-time + 2 momentum reversion).
 */
export const FEATURE_SCHEMA_VERSION = 2;

/**
 * RELEASE A/C — PIPELINE CONTRACT GUARD.
 *
 * DELIBERATELY SEPARATE from {@link FEATURE_SCHEMA_VERSION}. The team-goal work
 * does not change the shape of the `FeatureVector` at all, so the feature guard
 * would happily resume a checkpoint whose historical prefix was scored BEFORE
 * the new markets existed. The consequence is silent and severe: the
 * incremental tail would carry `secondary.homeOver05`, the reused prefix would
 * not, and the market-specific calibration would then be measured on a
 * truncated history.
 *
 * This version therefore stamps the whole PIPELINE OUTPUT contract — the score
 * matrix marginals, the `secondary` market block, the per-market evaluation
 * records and the checkpoint payload. Any change to what a completed walk
 * EMITS bumps this number and forces one full historical rebuild.
 *
 *   v1 — original pipeline.
 *   v2 — 20-dimensional feature vector, HT features, momentum, joint matrix,
 *        session checkpoint.
 *   v3 — RELEASE A: team-goal markets (`homeOver05` / `homeUnder05` /
 *        `awayOver05` / `awayUnder05`) on every `MatchPipeline.secondary`.
 *   v4 — RELEASE C: market-specific prequential calibration
 *        (`MARKET_EVAL_SPECS`, `MarketCalibrationBand`) accumulated during the
 *        walk and persisted on the checkpoint.
 *   v5 — GOAL-MARKET λ NORMALISER FIX: the venue defence rates in
 *        `forecastCore` were divided by the wrong league mean, biasing λ_home
 *        up and λ_away down and de-calibrating every market read off the joint
 *        score matrix (BTTS, O2.5, team-goal lines). Every stored `secondary`
 *        probability written before this build is unusable as an out-of-sample
 *        observation, so the market tallies must be re-measured from match one.
 *
 * Release A and Release C each require their own full rebuild. They ship in the
 * same build here, so the stamp lands on v4 directly: every checkpoint written
 * before this build (v1/v2, or unstamped) is discarded once and rebuilt from
 * match one, which is exactly the guarantee both releases demand. v5 forces the
 * same one-time discard for the λ fix.
 */
export const PIPELINE_CONTRACT_VERSION = 5;

/* ---------------- RELEASE B — underdog identification ---------------- */
/**
 * Minimum team-weight gap before a fixture HAS an underdog at all.
 *
 * Below it there is no favourite/underdog role to name, so the label and the
 * Underdog Goal Index are both withheld — the model-implied team-goal
 * probabilities stay visible regardless.
 */
export const UNDERDOG_MIN_WEIGHT_GAP = 1.0;

/* ------------------------------------------------------------------ *
 * PHASE 6 — market feedback warning gate.
 *
 * All THREE conditions must hold before the panel raises a warning:
 * a gap wider than `MARKET_FEEDBACK_GAP_PP`, at least
 * `MARKET_FEEDBACK_MIN_N` settled lines, AND the signalled average lying
 * outside the Wilson interval of the observed rate. The third condition is
 * what stops the panel from crying wolf on eight samples whose interval
 * spans sixty percentage points.
 * ------------------------------------------------------------------ */

/** Minimum |signalled − observed| gap, in percentage points. */
export const MARKET_FEEDBACK_GAP_PP = 10;
/** Minimum settled lines before a gap is allowed to mean anything. */
export const MARKET_FEEDBACK_MIN_N = 8;