import { ListChecks, Route } from 'lucide-react';
import type { CoreCandidateRow, CoreExecutionTrace, StrategyReadout } from '../../utils/slip';
import { GATE_LABEL, coreConfidenceOf } from '../../utils/slip';
import { DECISION_META } from '../../utils/decision';
import { MARQUEE_LEVEL_LABEL, marqueeSummaryText } from '../../utils/marqueePairs';
import { CandidateStateBadge } from './CandidateStateBadge';
import { CoreEvidenceBadge } from './CoreEvidenceBadge';
import { CoreTierBadge } from './CoreTierBadge';

const EXECUTION_PATH_COPY: Record<string, string> = {
  strategy: 'stratégia',
  pooled: 'piac-készlet',
  fixed: 'fix'
};

const SPEC_NULL_REASON_COPY: Record<string, string> = {
  custom_mode: 'egyedi mód',
  empty_codes: 'nincs piac-kód',
  no_settings: 'hiányzó beállítás'
};

/**
 * ONE candidate ledger for the whole core side.
 *
 * Previously each empty core card rendered its own rejected-candidate list, so
 * the same three fixtures appeared three times and still did not say whether a
 * line was refused or merely unmeasured. Every candidate of the strategy's
 * market appears here exactly once, with its evidence level, its cohesion value
 * and one concrete reason.
 */

interface CoreCandidateTableProps {
  readout: StrategyReadout;
  /**
   * The draft's execution trace. It is a SIBLING of the readout on `SlipDraft`,
   * not a part of it — reading `executionPath` / `configuredMarketPool` off the
   * readout is what crashed this table.
   */
  trace?: CoreExecutionTrace | null;
}

function percentage(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function CandidateRow({ row }: {row: CoreCandidateRow;}) {
  const { pattern } = row;
  const snap = pattern.coreEvidence ?? null;
  const marquee = pattern.code === 'BTTS' ? pattern.marqueeRisk ?? null : null;
  const cohesion = pattern.goalProfile?.weightedAvgGoals ?? null;
  const placed = row.slot !== null;
  const quadrant = DECISION_META[row.quadrant];
  const confidence = coreConfidenceOf(pattern);
  const confidenceOk = confidence.value >= confidence.threshold;

  return (
    <tr
      className={`border-t border-white/[0.06] align-top ${
      placed ? 'bg-signal/[0.06]' : ''}`
      }>
      
      <td className="px-2.5 py-2">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-foreground">
            {pattern.fixtureLabel}
          </span>
          <span className="flex flex-wrap items-center gap-1">
            {/* ÁLLAPOTGÉP — a döntési lánc végállapota, minden soron. */}
            <CandidateStateBadge state={row.candidateState} />
            {placed ?
            <span className="rounded-sm border border-signal/30 bg-signal-soft px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-label text-signal">
                Core {row.slot}
              </span> :
            null}
            {/* CORE TIERING — the tier is shown on every Core-eligible
                 candidate, placed or not, so the table never implies a volatile
                 line was refused for being volatile. */}
            {row.coreTier && (row.failed?.length ?? 0) === 0 ?
            <CoreTierBadge tier={row.coreTier} confidence={confidence} /> :
            null}
            <CoreEvidenceBadge level={row.evidence} snapshot={snap} withCoverage={true} />
            {/* RANGADÓ (BÜNTETŐPONT) — kizárólag rangsorolási figyelmeztetés.
                 A sor Core-jogosult marad, egyetlen mért érték sem változik. */}
            {marquee && marquee.registered && marquee.level !== 'none' ?
            <span
              className="rounded-sm border border-chart-4/40 bg-chart-4/10 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-label text-chart-4"
              title={`${marqueeSummaryText(marquee)}\n${marquee.reasons.join('\n')}`}>

                Rangadó {MARQUEE_LEVEL_LABEL[marquee.level].toLowerCase()} · −{marquee.penalty}
                {marquee.applied ? '' : ' (árnyék)'}
              </span> :
            null}
            {(row.failed ?? []).map((condition) =>
            <span
              key={condition}
              className="rounded-sm border border-negative/30 bg-negative-soft px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-label text-negative">
              
                {GATE_LABEL[condition]}
              </span>
            )}
          </span>
        </div>
      </td>

      <td className="px-2.5 py-2">
        <span className="flex flex-col gap-0.5">
          <span
            className={`inline-flex w-fit items-center rounded-sm border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-label ${quadrant.tone}`}
            title={quadrant.description}>

            {quadrant.label}
          </span>
          <span className="text-[9px] text-muted-foreground">
            {quadrant.coreTierLabel ?? 'core-ra nem jogosult'}
          </span>
        </span>
      </td>

      <td className="px-2.5 py-2 text-right font-mono text-[11px] tabular-nums text-foreground">
        {percentage(pattern.hitRate, 1)}
      </td>
      <td className="px-2.5 py-2 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
        {typeof pattern.modelProb === 'number' ? percentage(pattern.modelProb, 1) : '—'}
      </td>
      <td
        className={`px-2.5 py-2 text-right font-mono text-[11px] tabular-nums ${
        confidenceOk ? 'text-foreground' : 'text-chart-4'}`
        }
        title={
        confidence.marketSpecific ?
        'Piacspecifikus konfidencia (élesség × elegendőség × egyezés) és az elsődleges küszöb.' :
        'Stability (1X2 tengely) és az elsődleges küszöb.'
        }>

        {Math.round(confidence.value)} / {confidence.threshold}
      </td>
      <td className="px-2.5 py-2 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
        {cohesion !== null ? cohesion.toFixed(2) : '—'}
      </td>
      <td className="px-2.5 py-2 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
        {snap ?
        <>
            {snap.observations} / {snap.required}
            <span className="block text-[9px] opacity-70">
              {snap.environmentLabel ?? snap.bandLabel ?? '—'}
              {snap.widened ? ' · bővített' : ''}
            </span>
          </> :

        '—'
        }
      </td>
      <td className="px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground">
        {row.reason}
      </td>
    </tr>);

}

/** Evidence-level histogram of a named population of candidate rows. */
function tally(rows: readonly CoreCandidateRow[]) {
  return {
    calibrated: rows.filter((r) => r.evidence === 'calibrated').length,
    conditional: rows.filter((r) => r.evidence === 'conditional').length,
    excluded: rows.filter((r) => r.evidence === 'excluded').length,
    total: rows.length
  };
}

export function CoreCandidateTable({ readout, trace = null }: CoreCandidateTableProps) {
  const candidates = readout.candidates ?? [];
  if (candidates.length === 0) return null;

  const executionPath = trace?.executionPath ?? 'strategy';
  const specNullReason = trace?.specNullReason ?? null;
  const configuredMarketPool = trace?.configuredMarketPool ?? null;
  /* A quick strategy governs the core side by its own market codes, so a
   * configured per-card pool present on a `strategy` run IS an override. */
  const specOverridesMarkets = executionPath === 'strategy' && configuredMarketPool !== null;

  /* THREE populations, never one number.
   *
   * The header used to print a single "N kalibrált · M feltételes · K cáfolt"
   * triple that counted only GATE-PASSING candidates, while the table below
   * listed every candidate — so four visible `Kalibrált` rows looked like a
   * contradiction of "1 kalibrált". The evidence level states what the MEASURED
   * band says; eligibility states what the GATES say. They are independent, so
   * they get separate, explicitly labelled denominators. */
  const all = tally(candidates);
  const eligible = tally(candidates.filter((r) => (r.failed?.length ?? 0) === 0));
  const placed = tally(candidates.filter((r) => r.slot !== null));

  return (
    <section
      aria-label="Core jelöltek és kizárások"
      className="overflow-hidden rounded-md border border-border bg-background/40">
      
      <header className="flex flex-col gap-1.5 border-b border-border px-3 py-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-label text-muted-foreground">
            <ListChecks className="h-3.5 w-3.5" aria-hidden={true} />
            Core-eredmény · {all.total} vizsgált jelölt
          </h3>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1" title="Végrehajtási útvonal">
              <Route className="h-3 w-3" aria-hidden={true} />
              {EXECUTION_PATH_COPY[executionPath] ?? executionPath}
            </span>
            {specNullReason &&
            <span className="text-warning" title="A stratégia spec null ok">
                {SPEC_NULL_REASON_COPY[specNullReason] ?? specNullReason}
              </span>
            }
            {specOverridesMarkets &&
            <span title="A stratégia kódjai felülírták a coreCards piac-készletet">
                piac-felülírás
              </span>
            }
          </div>
          <p className="font-mono text-[9px] text-muted-foreground">
            evidencia-szabály {readout.evidenceRuleVersion} · kiválasztási szabály{' '}
            {readout.selectionRuleVersion}
          </p>
        </div>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-0.5 font-mono text-[10px] sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-[9px] uppercase tracking-label text-muted-foreground">
              Core-kártyára került
            </dt>
            <dd className="text-foreground">
              {readout.coreFilled} / {readout.coreSlots} ·{' '}
              <span className="text-signal">{readout.primaryCoreCount} elsődleges</span> ·{' '}
              <span className="text-chart-4">{readout.secondaryCoreCount} másodlagos</span>
              <span className="block text-[9px] text-muted-foreground">
                evidencia: {placed.calibrated} kalibrált · {placed.conditional} feltételes
              </span>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[9px] uppercase tracking-label text-muted-foreground">
              Core-ra jogosult (kanonikus, kapun belüli)
            </dt>
            <dd className="text-foreground">
              {eligible.total} ·{' '}
              <span className="text-signal">
                {readout.primaryEligibleCandidates} elsődleges
              </span>{' '}
              ·{' '}
              <span className="text-chart-4">
                {readout.secondaryEligibleCandidates} másodlagos
              </span>
              <span className="block text-[9px] text-muted-foreground">
                Nyers stratégia-piaci rekordok: {all.total}
              </span>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[9px] uppercase tracking-label text-muted-foreground">
              Evidencia-szintek az ÖSSZES jelölt között
            </dt>
            <dd className="text-foreground">
              <span className="text-positive">{all.calibrated} kalibrált</span> ·{' '}
              <span className="text-chart-4">{all.conditional} feltételes</span> ·{' '}
              <span className="text-negative">{all.excluded} kizárt</span>
            </dd>
          </div>
        </dl>
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          A három szám három külön populáció. Az evidencia-szint a MÉRÉSRŐL szól, a
          jogosultság a KAPUKRÓL, a core szint pedig a KVADRÁNSRÓL: cselekvőképes =
          elsődleges, volatilis = másodlagos (magasabb kockázat, de attól még lehet
          visszamért sávja). Lapos és elvetendő sor továbbra sem kerülhet core kártyára.
        </p>
        {configuredMarketPool !== null && configuredMarketPool.length > 0 &&
        <div className="flex flex-col gap-0.5 font-mono text-[9px] text-muted-foreground">
            <span className="uppercase tracking-label">Konfigurált core piac-készlet</span>
            <div className="flex flex-wrap gap-1.5">
              {configuredMarketPool.map((pool, i) =>
            <span key={i} className="rounded-sm border border-border bg-muted/20 px-1.5 py-0.5">
                  Core {i + 1}: {pool && pool.length > 0 ? pool.join(' · ') : '—'}
                </span>
            )}
            </div>
          </div>
        }
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="bg-black/20">
              {[
              ['Mérkőzés és szint', 'left'],
              ['Kvadráns · core szint', 'left'],
              ['H2H', 'right'],
              ['Modell', 'right'],
              ['Konfidencia', 'right'],
              ['Átlaggól', 'right'],
              ['Auditált sáv', 'right'],
              ['Ok', 'left']].
              map(([label, align]) =>
              <th
                key={String(label)}
                scope="col"
                className={`px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-label text-muted-foreground ${
                align === 'right' ? 'text-right' : 'text-left'}`
                }>
                
                  {label}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {readout.candidates.map((row) =>
            <CandidateRow key={row.pattern.id} row={row} />
            )}
          </tbody>
        </table>
      </div>

      <p className="border-t border-border px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
        Az „Átlaggól” a recency-súlyozott, zsugorított direkt H2H átlagos összgólszám —
        a core kohéziós érték. Az „Auditált sáv” azt mutatja, hány visszamért
        megfigyelés áll a sor jelzett valószínűsége mögött; a cáfolt sávú sor nem
        adathiányos, hanem megmért és elutasított.
      </p>
    </section>);

}