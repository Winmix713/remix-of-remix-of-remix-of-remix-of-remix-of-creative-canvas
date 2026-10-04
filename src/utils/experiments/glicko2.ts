/**
 * Glicko-2 dynamic rating — EXPERIMENT, feature flagged, off by default.
 *
 * P2 HYPOTHESIS
 * -------------
 * A dynamic rating and the Poisson venue attack/defence rates measure largely
 * the SAME latent quantity: team strength. Feeding both into one logistic
 * model would be textbook multicollinearity, so this module deliberately runs
 * on a PARALLEL branch: it predicts independently, and the audit screen
 * compares the two branches head to head with confidence intervals.
 *
 * The rating update is naturally as-of — a rating only ever absorbs matches
 * that have already been walked.
 */

import type { GlickoRating, Outcome, Probs } from '../../types/winmix';

const SCALE = 173.7178;
const DEFAULT_TAU = 0.5;
/** Ordered-logit draw threshold on the g-scaled rating difference. */
const DRAW_THRESHOLD = 0.42;
/** Home advantage, in the same g-scaled units. */
const HOME_ADVANTAGE = 0.28;

export function initialGlickoRating(): GlickoRating {
  return { rating: 1500, rd: 350, vol: 0.06 };
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + 3 * phi * phi / (Math.PI * Math.PI));
}

function expectedScore(mu: number, muOpp: number, phiOpp: number): number {
  return 1 / (1 + Math.exp(-g(phiOpp) * (mu - muOpp)));
}

/**
 * Ordered logit over the rating gap: P(home) < P(home or draw), so the draw
 * probability is the band between the two thresholds. Monotone by construction
 * — no probability can ever go negative.
 */
export function glickoProbs(home: GlickoRating, away: GlickoRating): Probs {
  const muH = (home.rating - 1500) / SCALE;
  const muA = (away.rating - 1500) / SCALE;
  const phi = Math.sqrt(
    (home.rd / SCALE * (home.rd / SCALE) + away.rd / SCALE * (away.rd / SCALE)) / 2
  );
  const d = g(phi) * (muH - muA) + HOME_ADVANTAGE;
  const pHome = 1 / (1 + Math.exp(-(d - DRAW_THRESHOLD)));
  const pHomeOrDraw = 1 / (1 + Math.exp(-(d + DRAW_THRESHOLD)));
  const draw = Math.max(1e-4, pHomeOrDraw - pHome);
  const away2 = Math.max(1e-4, 1 - pHomeOrDraw);
  const home2 = Math.max(1e-4, pHome);
  const s = home2 + draw + away2;
  return { home: home2 / s, draw: draw / s, away: away2 / s };
}

/** Glicko-2 volatility update (Illinois-style root finding, bounded budget). */
function newVolatility(
phi: number,
vol: number,
v: number,
delta: number,
tau: number)
: number {
  const a = Math.log(vol * vol);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi * phi - v - ex);
    const den = 2 * Math.pow(phi * phi + v + ex, 2);
    return num / den - (x - a) / (tau * tau);
  };

  let A = a;
  let B: number;
  const eps = 1e-6;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    B = a - k * tau;
    while (f(B) < 0 && k < 100) {
      k++;
      B = a - k * tau;
    }
  }

  let fA = f(A);
  let fB = f(B);
  let guard = 0;
  while (Math.abs(B - A) > eps && guard < 100) {
    const C = A + (A - B) * fA / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
    guard++;
  }
  return Math.exp(A / 2);
}

function updateOne(
self: GlickoRating,
opponent: GlickoRating,
score: number,
tau: number)
: GlickoRating {
  const mu = (self.rating - 1500) / SCALE;
  const phi = self.rd / SCALE;
  const muOpp = (opponent.rating - 1500) / SCALE;
  const phiOpp = opponent.rd / SCALE;

  const gOpp = g(phiOpp);
  const E = expectedScore(mu, muOpp, phiOpp);
  const v = 1 / Math.max(1e-9, gOpp * gOpp * E * (1 - E));
  const delta = v * gOpp * (score - E);

  const vol = newVolatility(phi, self.vol, v, delta, tau);
  const phiStar = Math.sqrt(phi * phi + vol * vol);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * gOpp * (score - E);

  return {
    rating: 1500 + SCALE * muNew,
    rd: Math.min(350, Math.max(30, SCALE * phiNew)),
    vol
  };
}

/** Applies one match result to both ratings. Pure — returns new objects. */
export function updateGlickoPair(
home: GlickoRating,
away: GlickoRating,
outcome: Outcome,
tau: number = DEFAULT_TAU)
: {home: GlickoRating;away: GlickoRating;} {
  const homeScore = outcome === 'H' ? 1 : outcome === 'D' ? 0.5 : 0;
  return {
    home: updateOne(home, away, homeScore, tau),
    away: updateOne(away, home, 1 - homeScore, tau)
  };
}

/** Convenience ledger so the pipeline does not hand-roll a rating map. */
export class GlickoLedger {
  private ratings = new Map<string, GlickoRating>();

  ratingOf(key: string): GlickoRating {
    return this.ratings.get(key) ?? initialGlickoRating();
  }

  predict(homeKey: string, awayKey: string): Probs {
    return glickoProbs(this.ratingOf(homeKey), this.ratingOf(awayKey));
  }

  observe(homeKey: string, awayKey: string, outcome: Outcome): void {
    const next = updateGlickoPair(this.ratingOf(homeKey), this.ratingOf(awayKey), outcome);
    this.ratings.set(homeKey, next.home);
    this.ratings.set(awayKey, next.away);
  }

  reset(): void {
    this.ratings.clear();
  }
}