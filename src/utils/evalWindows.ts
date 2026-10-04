import { bootstrapSkillCI, skillPairsOf } from './bootstrap';
import { EVAL_WINDOW_SIZE } from './constants';
import type { ScoredMatch } from './pipeline';
import { computeECEForSlice, pairedSignTest } from './stats';
import type { EvalWindow, SignTestResult, SkillCI } from '../types/winmix';

/**
 * Rolling walk-forward evaluation windows. This used to live inline in
 * PipelineAudit's render body; it is measurement maths, not markup.
 */
export function computeEvalWindows(scored: ScoredMatch[]): EvalWindow[] {
  const count = Math.floor(scored.length / EVAL_WINDOW_SIZE);
  return Array.from({ length: count }, (_, w) => {
    const slice = scored.slice(w * EVAL_WINDOW_SIZE, (w + 1) * EVAL_WINDOW_SIZE);
    const logLossB1 =
    slice.reduce((a, m) => a + m.pipeline.reconciliation.logLossB1, 0) / EVAL_WINDOW_SIZE;
    const logLossEns =
    slice.reduce((a, m) => a + m.pipeline.reconciliation.logLossEns, 0) / EVAL_WINDOW_SIZE;
    return {
      index: w + 1,
      from: w * EVAL_WINDOW_SIZE + 1,
      to: (w + 1) * EVAL_WINDOW_SIZE,
      logLossB1,
      logLossEns,
      brier: slice.reduce((a, m) => a + m.pipeline.reconciliation.brierEns, 0) / EVAL_WINDOW_SIZE,
      skill: logLossB1 > 0 ? (1 - logLossEns / logLossB1) * 100 : 0,
      ece: computeECEForSlice(slice),
      sign: pairedSignTest(slice),
      skillCI: bootstrapSkillCI(skillPairsOf(slice))
    };
  });
}

/* ------------------------------------------------------------------ *
 * The verdict
 *
 * The audit page used to render eight equal-weight telemetry blocks. An
 * operator arrives with exactly one question — "is the model well calibrated
 * right now, yes or no" — and had to reconstruct the answer from tables. This
 * turns the same numbers into one stated conclusion plus its causes.
 * ------------------------------------------------------------------ */

export type VerdictLevel = 'ok' | 'watch' | 'degrading' | 'unknown';

export interface CalibrationVerdict {
  level: VerdictLevel;
  headline: string;
  /** Ordered, most important first. */
  reasons: string[];
}

export const VERDICT_LABEL: Record<VerdictLevel, string> = {
  ok: 'Kalibrált',
  watch: 'Figyelendő',
  degrading: 'Romlik',
  unknown: 'Nincs elég adat'
};

interface VerdictInput {
  evaluated: number;
  ece: number | null;
  skillCI: SkillCI | null;
  sign: SignTestResult | null;
  windows: EvalWindow[];
  /** Entropy floor saturation, when it could be estimated. */
  saturated: boolean | null;
}

export function calibrationVerdict({
  evaluated,
  ece,
  skillCI,
  sign,
  windows,
  saturated
}: VerdictInput): CalibrationVerdict {
  if (evaluated === 0 || ece === null) {
    return {
      level: 'unknown',
      headline: 'Nincs kiértékelt mérkőzés ebben a ligában.',
      reasons: [
      'Töltsd fel a szezon CSV-ket, majd futtasd a pipeline-t a Pipeline Üzemeltetés képernyőn.']

    };
  }

  const reasons: string[] = [];
  let level: VerdictLevel = 'ok';
  const escalate = (next: VerdictLevel) => {
    const rank: Record<VerdictLevel, number> = { unknown: 0, ok: 1, watch: 2, degrading: 3 };
    if (rank[next] > rank[level]) level = next;
  };

  const lastWindow = windows[windows.length - 1] ?? null;

  if (ece > 0.08) {
    escalate('degrading');
    reasons.push(`Az ECE ${ece.toFixed(3)} — jóval a 0.05-es küszöb fölött, T újrakalibrálás kell.`);
  } else if (ece >= 0.05) {
    escalate('watch');
    reasons.push(`Az ECE ${ece.toFixed(3)} — a 0.05-es küszöb fölött, rekalibráció ajánlott.`);
  } else {
    reasons.push(`Az ECE ${ece.toFixed(3)} — a 0.05-es küszöb alatt.`);
  }

  if (lastWindow?.sign.significant && lastWindow.sign.direction === 'b1_better') {
    escalate('degrading');
    reasons.push(
      `A legutolsó 100 meccses ablakban a B1 bázis szignifikánsan jobb (p=${lastWindow.sign.p.toFixed(3)}) — a modell felülvizsgálandó.`
    );
  }

  if (skillCI) {
    if (skillCI.hi < 0) {
      escalate('degrading');
      reasons.push(
        `A skill 95% CI teljes egészében negatív (${skillCI.lo.toFixed(2)}% … ${skillCI.hi.toFixed(2)}%).`
      );
    } else if (skillCI.crossesZero) {
      escalate('watch');
      reasons.push(
        `A skill 95% CI átmegy a nullán (${skillCI.lo.toFixed(2)}% … ${skillCI.hi.toFixed(2)}%) — nincs igazolt előny a bázishoz képest.`
      );
    } else {
      reasons.push(
        `Igazolt előny a B1 bázishoz képest: ${skillCI.lo.toFixed(2)}% … ${skillCI.hi.toFixed(2)}%${
        sign ? ` (sign-test p=${sign.p.toFixed(3)})` : ''}.`

      );
    }
  }

  if (saturated) {
    escalate('watch');
    reasons.push(
      'Az entrópia-plafon telített: a bázis és az elméleti plafon közti rés túl kicsi, további modellbonyolítás túlillesztés.'
    );
  }

  if (windows.length === 0) {
    escalate('watch');
    reasons.push(
      `Még nincs lezárt 100 meccses ablak (${evaluated} kiértékelt meccs) — a verdikt egyetlen minta alapján készült.`
    );
  }

  const headline =
  level === 'ok' ?
  'A modell kalibrált, és igazolt előnye van a bázishoz képest.' :
  level === 'watch' ?
  'A modell használható, de van legalább egy figyelendő jel.' :
  'A kalibráció romlik — beavatkozás javasolt a döntések előtt.';

  return { level, headline, reasons };
}