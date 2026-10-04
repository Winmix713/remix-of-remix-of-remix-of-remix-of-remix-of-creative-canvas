import React from 'react';
import { Clock, Hash, Target, TrendingUp, Zap } from 'lucide-react';
import type {
  CoreEvidenceLevel,
  H2HGoalStats,
  H2HHtStats,
  H2HModalScore,
  H2HRecord,
  H2HReversalStats,
  SlipLine } from
'../../types/winmix';
import { ROLE_SPEC, activeRoleOf } from '../../utils/slip';
import type { ActiveSlipRole } from '../../utils/slip';
import { CoreTierBadge } from './CoreTierBadge';

const EVIDENCE_LEVEL_BADGE: Record<CoreEvidenceLevel, {label: string;className: string;}> = {
  calibrated: { label: 'Kalibrált', className: 'bg-positive-soft text-positive' },
  conditional: { label: 'Feltételes', className: 'bg-warning-soft text-warning' },
  excluded: { label: 'Kizárt', className: 'bg-negative-soft text-negative' }
};

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function pct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

function fmtOdds(n: number): string {
  return n > 0 ? n.toFixed(2) : '–';
}

const ROLE_ICON: Record<ActiveSlipRole, React.ReactNode> = {
  btts_top: <Target className="h-3.5 w-3.5" aria-hidden="true" />,
  btts_second: <Target className="h-3.5 w-3.5" aria-hidden="true" />,
  over25: <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />,
  joker_score: <Hash className="h-3.5 w-3.5" aria-hidden="true" />,
  joker_ht: <Clock className="h-3.5 w-3.5" aria-hidden="true" />,
  joker_trend: <Zap className="h-3.5 w-3.5" aria-hidden="true" />
};

/* ------------------------------------------------------------------ *
 * Sub-blocks
 * ------------------------------------------------------------------ */

/** H/D/A breakdown row with percentage bar segments. */
function H2HRecordBlock({ rec }: {rec: H2HRecord;}) {
  const { homeWins, draws, awayWins, total, homeWinPct, drawPct, awayWinPct } = rec;

  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[9px] font-bold uppercase tracking-label text-muted-foreground">
        H2H tényadatok ({total} meccs)
      </span>

      <div className="flex h-2 w-full overflow-hidden rounded-full">
        <div
          className="bg-signal"
          style={{ width: `${homeWinPct * 100}%` }}
          title={`Hazai: ${pct(homeWinPct, 1)}`} />
        
        <div
          className="bg-muted-foreground/40"
          style={{ width: `${drawPct * 100}%` }}
          title={`Döntetlen: ${pct(drawPct, 1)}`} />
        
        <div
          className="bg-destructive/70"
          style={{ width: `${awayWinPct * 100}%` }}
          title={`Vendég: ${pct(awayWinPct, 1)}`} />
        
      </div>

      <div className="flex justify-between font-mono text-[10px] text-foreground">
        <span>
          <span className="font-bold text-signal">{homeWins} GY</span>
          <span className="text-muted-foreground"> ({pct(homeWinPct, 0)})</span>
        </span>
        <span>
          <span className="font-bold">{draws} D</span>
          <span className="text-muted-foreground"> ({pct(drawPct, 0)})</span>
        </span>
        <span>
          <span className="font-bold text-destructive/80">{awayWins} V</span>
          <span className="text-muted-foreground"> ({pct(awayWinPct, 0)})</span>
        </span>
      </div>

      {(rec.homeUnbeatenStreak > 1 || rec.awayUnbeatenStreak > 1) &&
      <div className="flex gap-2 text-[10px] text-muted-foreground">
          {rec.homeUnbeatenStreak > 1 &&
        <span>
              Hazai veretlenségi sorozat:{' '}
              <span className="font-bold text-signal">{rec.homeUnbeatenStreak}</span>
            </span>
        }
          {rec.awayUnbeatenStreak > 1 &&
        <span>
              Vendég veretlenségi sorozat:{' '}
              <span className="font-bold text-destructive/80">{rec.awayUnbeatenStreak}</span>
            </span>
        }
        </div>
      }
    </div>);

}

/** Goal market stats row. */
function GoalStatsBlock({ gs }: {gs: H2HGoalStats;}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[9px] font-bold uppercase tracking-label text-muted-foreground">
        Gólpiaci arányok
      </span>
      <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
        <StatCell label="Átl. gól" value={gs.avgGoals.toFixed(2)} />
        <StatCell label="BTTS" value={pct(gs.bttsPct, 0)} />
        <StatCell label="O2.5" value={pct(gs.over25Pct, 0)} />
        <StatCell label="O1.5" value={pct(gs.over15Pct, 0)} />
        <StatCell label="O3.5" value={pct(gs.over35Pct, 0)} />
      </div>
    </div>);

}

/** Half-time stats row. */
function HtStatsBlock({ ht }: {ht: H2HHtStats;}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[9px] font-bold uppercase tracking-label text-muted-foreground">
        Félidei arányok ({ht.htSampleSize} meccs)
      </span>
      <div className="grid grid-cols-4 gap-x-2 gap-y-0.5">
        <StatCell label="Gólos HT" value={pct(ht.htGoalRate, 0)} />
        <StatCell label="HT:1" value={pct(ht.htHomeLeadRate, 0)} />
        <StatCell label="HT:X" value={pct(ht.htDrawRate, 0)} />
        <StatCell label="HT:2" value={pct(ht.htAwayLeadRate, 0)} />
      </div>
    </div>);

}

/** Top modal scores list. */
function ModalScoresBlock({ scores }: {scores: H2HModalScore[];}) {
  if (scores.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[9px] font-bold uppercase tracking-label text-muted-foreground">
        Leggyakoribb eredmények
      </span>
      <div className="flex flex-wrap gap-2">
        {scores.map((s) =>
        <span
          key={s.score}
          className="inline-flex items-center gap-1 rounded border border-border bg-muted/30 px-1.5 py-0.5 font-mono text-[10px]">
          
            <span className="font-bold">{s.score}</span>
            <span className="text-muted-foreground">
              ×{s.count} · {pct(s.pct, 0)}
            </span>
          </span>
        )}
      </div>
    </div>);

}

/** HT/FT reversal stats. */
function ReversalBlock({ rev }: {rev: H2HReversalStats;}) {
  const fairOdds = rev.turnaroundRate > 0 ? 1 / rev.turnaroundRate : 0;
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[9px] font-bold uppercase tracking-label text-muted-foreground">
        HT/FT fordulat ({rev.htSampleSize} meccs)
      </span>
      <div className="flex items-center gap-3 font-mono text-[10px]">
        <span>
          <span className="font-bold text-foreground">{rev.turnaroundCount}</span>
          <span className="text-muted-foreground"> fordulat</span>
        </span>
        <span>
          <span className="font-bold text-foreground">{pct(rev.turnaroundRate, 0)}</span>
          <span className="text-muted-foreground"> arány</span>
        </span>
        {fairOdds > 0 &&
        <span>
            <span className="text-muted-foreground">Fair szorzó: </span>
            <span className="font-bold text-signal">{fmtOdds(fairOdds)}</span>
          </span>
        }
      </div>
    </div>);

}

/** Three-column telemetry footer. */
function TelemetryFooter({
  stability,
  hitRate,
  sample




}: {stability: number;hitRate: number;sample: number;}) {
  return (
    <div className="mt-1 grid grid-cols-3 divide-x divide-border rounded-md border border-border bg-muted/20 text-center font-mono text-[9px]">
      <div className="flex flex-col gap-0.5 px-2 py-1.5">
        <span className="font-bold text-foreground">{stability}</span>
        <span className="uppercase tracking-label text-muted-foreground">Stabilitás</span>
      </div>
      <div className="flex flex-col gap-0.5 px-2 py-1.5">
        <span className="font-bold text-foreground">{pct(hitRate, 1)}</span>
        <span className="uppercase tracking-label text-muted-foreground">Hit rate</span>
      </div>
      <div className="flex flex-col gap-0.5 px-2 py-1.5">
        <span className="font-bold text-foreground">{sample}</span>
        <span className="uppercase tracking-label text-muted-foreground">Minta</span>
      </div>
    </div>);

}

/** Tiny label+value cell used in stat grids. */
function StatCell({ label, value }: {label: string;value: string;}) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      <span className="font-mono text-[10px] font-bold text-foreground">{value}</span>
    </div>);

}

/* ------------------------------------------------------------------ *
 * SlipLine variant — used in the saved-slip ledger view
 * ------------------------------------------------------------------ */

interface SlipLineCardProps {
  line: SlipLine;
}

export function SlipLineCard({ line }: SlipLineCardProps) {
  const role: ActiveSlipRole = activeRoleOf(line.role);
  const hasEnrichedStats = Boolean(line.headToHeadRecord && line.goalStats);
  /* CORE TIERING — a core line saved BEFORE tiering existed has no tier at all
     (`undefined`). It is rendered as Legacy rather than assumed to be primary,
     which would rewrite what the line actually meant when it was issued. */
  const isCoreLine = ROLE_SPEC[role].kind === 'core';
  const legacyCore = isCoreLine && line.coreTier === undefined;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-panel">
      <div className="flex items-center gap-2">
        <span className="text-signal">{ROLE_ICON[role]}</span>
        <span className="text-[12px] font-bold text-foreground">{ROLE_SPEC[role].title}</span>
      </div>

      <div>
        <div className="text-[10px] text-muted-foreground">{line.fixtureLabel}</div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="rounded bg-signal/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-signal">
            {line.code}
          </span>
          <span className="text-[11px] text-foreground">{line.label}</span>
          {isCoreLine && (line.coreTier || legacyCore) ?
          <CoreTierBadge
            tier={line.coreTier ?? null}
            legacy={legacyCore}
            className="ml-auto" /> :

          null}
          {line.evidenceLevel &&
          <span
            className={`ml-auto rounded-sm px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-label ${
            EVIDENCE_LEVEL_BADGE[line.evidenceLevel].className}`}
            title={`Evidencia-szint: ${EVIDENCE_LEVEL_BADGE[line.evidenceLevel].label}`}>
              {EVIDENCE_LEVEL_BADGE[line.evidenceLevel].label}
            </span>
          }
        </div>
      </div>

      {hasEnrichedStats ?
      <>
          <H2HRecordBlock rec={line.headToHeadRecord} />
          <GoalStatsBlock gs={line.goalStats} />
          {line.htStats && <HtStatsBlock ht={line.htStats} />}
          {Array.isArray(line.topModalScores) && line.topModalScores.length > 0 &&
        <ModalScoresBlock scores={line.topModalScores} />
        }
          {line.reversalStats && <ReversalBlock rev={line.reversalStats} />}
        </> :

      <p className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground">
          Ehhez a korábban mentett tipphez még nem érhetők el a részletes H2H statisztikák.
        </p>
      }

      <TelemetryFooter
        stability={line.stability}
        hitRate={line.hitRate}
        sample={line.sample} />
      
    </section>);

}