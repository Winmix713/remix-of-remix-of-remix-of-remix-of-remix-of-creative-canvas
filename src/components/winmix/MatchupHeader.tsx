import React from 'react';
import { cn } from '../../lib/utils';
import type { FormResult, MatchupSummary } from '../../utils/h2h';
import { Panel } from './Panel';
import { TeamBadge } from './DataTable';
import { Chip } from './Panel';
import { MARQUEE_LEVEL_LABEL, marqueeSummaryText } from '../../utils/marqueePairs';
import type { MarqueeRiskVerdict } from '../../types/winmix';

const formTone: Record<FormResult, string> = {
  GY: 'border-positive/40 bg-positive-soft text-positive',
  D: 'border-border bg-elevated text-muted-foreground',
  V: 'border-negative/40 bg-negative-soft text-negative'
};

function Stat({ label, value, tone }: {label: string;value: React.ReactNode;tone?: string;}) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-ui-2xs uppercase tracking-label text-muted-foreground">
        {label}
      </dt>
      <dd className={cn('mt-0.5 font-mono text-data-sm font-bold tabular-nums text-foreground', tone)}>
        {value}
      </dd>
    </div>);

}

interface MatchupHeaderProps {
  summary: MatchupSummary;
  homeRecommendedWeight: number | null;
  awayRecommendedWeight: number | null;
  /** RANGADÓ — a kiválasztott irányított párosítás meg van-e jelölve. */
  marqueeOn?: boolean;
  onToggleMarquee?: (next: boolean) => void;
  /** A megjelölés melletti mikro-szöveg: kockázati szint és levonás. */
  marqueeVerdict?: MarqueeRiskVerdict | null;
}

/**
 * The verdict block for a selected matchup. H2H is the most narrative surface
 * in the product — "who is ahead" should be readable in one glance, not
 * reconstructed from nine numeric columns.
 */
export function MatchupHeader({
  summary,
  homeRecommendedWeight,
  awayRecommendedWeight,
  marqueeOn = false,
  onToggleMarquee,
  marqueeVerdict = null
}: MatchupHeaderProps) {
  const { played, aWins, draws, bWins } = summary;
  const pct = (n: number) => played > 0 ? n / played * 100 : 0;
  const verdict =
  aWins === bWins ?
  'Teljes egyensúly' :
  aWins > bWins ?
  `${summary.aDisplay} vezet` :
  `${summary.bDisplay} vezet`;

  return (
    <Panel className="gap-4 px-3 py-4 sm:px-5 sm:py-5">
      {/* --- The two sides ------------------------------------------------ */}
      <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <TeamBadge name={summary.aDisplay} className="h-8 w-8 sm:h-10 sm:w-10" />
          <div className="min-w-0">
            <p className="truncate text-ui-base font-bold text-foreground">{summary.aDisplay}</p>
            <p className="font-mono text-ui-2xs uppercase tracking-label text-muted-foreground">
              {aWins} győzelem
            </p>
            <Chip tone="signal" className="mt-1">Súly: {formatRecommendedWeight(homeRecommendedWeight)}</Chip>
          </div>
        </div>

        <div className="shrink-0 text-center">
          <p className="font-mono text-data-xl font-bold tabular-nums text-foreground">
            {aWins}
            <span className="mx-1 text-muted-foreground">–</span>
            {draws}
            <span className="mx-1 text-muted-foreground">–</span>
            {bWins}
          </p>
          <p className="font-mono text-ui-2xs uppercase tracking-label text-muted-foreground">
            GY / D / V
          </p>
        </div>

        <div className="flex min-w-0 items-center justify-start gap-2 text-left sm:justify-end sm:text-right sm:gap-3">
          <TeamBadge name={summary.bDisplay} className="h-8 w-8 order-2 sm:order-1 sm:h-10 sm:w-10" />
          <div className="min-w-0 order-1 sm:order-2">
            <p className="truncate text-ui-base font-bold text-foreground">{summary.bDisplay}</p>
            <p className="font-mono text-ui-2xs uppercase tracking-label text-muted-foreground">
              {bWins} győzelem
            </p>
            <Chip tone="signal" className="mt-1">Súly: {formatRecommendedWeight(awayRecommendedWeight)}</Chip>
          </div>
        </div>
      </div>

      {/* --- The balance bar ---------------------------------------------- */}
      <div>
        <div
          className="flex h-3 w-full overflow-hidden rounded-full bg-elevated"
          role="img"
          aria-label={`Mérleg: ${summary.aDisplay} ${aWins} győzelem, ${draws} döntetlen, ${summary.bDisplay} ${bWins} győzelem`}>
          
          <span className="bg-positive" style={{ width: `${pct(aWins)}%` }} />
          <span className="bg-elevated-2" style={{ width: `${pct(draws)}%` }} />
          <span className="bg-negative" style={{ width: `${pct(bWins)}%` }} />
        </div>
        <p className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-ui-xs">
          <span className="font-semibold text-foreground">{verdict}</span>
          <span className="font-mono text-muted-foreground">
            {played} találkozó · {summary.aGoals}–{summary.bGoals} gólarány
          </span>
        </p>
      </div>

      {/* --- Form + aggregate metrics ------------------------------------- */}
      <div className="flex flex-col gap-4 border-t border-border pt-3.5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-mono text-ui-2xs uppercase tracking-label text-muted-foreground">
            {summary.aDisplay} — utolsó {summary.aForm.length} találkozó
          </p>
          <ul className="mt-1.5 flex items-center gap-1">
            {summary.aForm.length === 0 ?
            <li className="text-ui-xs text-muted-foreground">Nincs adat</li> :

            summary.aForm.map((r, i) =>
            <li
              key={`${r}-${i}`}
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded border font-mono text-ui-2xs font-bold',
                formTone[r]
              )}>
              
                  {r}
                </li>
            )
            }
          </ul>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Stat label="Átl. gól" value={summary.avgGoals.toFixed(2)} tone="text-signal" />
          <Stat label="Össz. gól" value={summary.totalGoals} />
          <Stat label="BTTS" value={`${summary.bttsPct.toFixed(0)}%`} />
          <Stat label="Over 2.5" value={`${summary.over25Pct.toFixed(0)}%`} />
        </dl>
      </div>

      {/* --- RANGADÓ (BÜNTETŐPONT) ---------------------------------------- */}
      {onToggleMarquee ?
      <div className="flex flex-col gap-1.5 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <button
            type="button"
            role="switch"
            aria-checked={marqueeOn}
            onClick={() => onToggleMarquee(!marqueeOn)}
            className={cn(
              'relative h-5 w-9 shrink-0 rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal',
              marqueeOn ? 'border-signal/50 bg-signal/30' : 'border-border bg-elevated'
            )}>
            
              <span
              className={cn(
                'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-foreground transition-all',
                marqueeOn ? 'left-[18px]' : 'left-0.5'
              )} />
            
            </button>
            <span className="font-mono text-ui-2xs uppercase tracking-label text-muted-foreground">
              Rangadó (büntetőpont)
            </span>
          </div>
          <p className="min-w-0 text-ui-xs text-muted-foreground">
            {marqueeVerdict ?
          <>
                <span
              className={cn(
                'font-mono font-bold',
                marqueeVerdict.level === 'high' ?
                'text-negative' :
                marqueeVerdict.level === 'medium' ?
                'text-chart-4' :
                marqueeVerdict.level === 'low' ?
                'text-signal' :
                'text-muted-foreground'
              )}>
              
                  {marqueeSummaryText(marqueeVerdict)}
                </span>
                {marqueeVerdict.reasons.length > 0 ?
            <span className="ml-1.5">{marqueeVerdict.reasons[0]}</span> :
            null}
              </> :

          `Kockázat: ${MARQUEE_LEVEL_LABEL.none} — a címke önmagában nem büntet.`}
          </p>
        </div> :
      null}

      {summary.lastMeeting ?
      <p className="border-t border-border pt-3 text-ui-xs text-muted-foreground">
          <span className="font-mono uppercase tracking-label">Legutóbb</span>{' '}
          <span className="text-foreground">
            {summary.lastMeeting.home_team}{' '}
            <b>
              {summary.lastMeeting.home_score}–{summary.lastMeeting.away_score}
            </b>{' '}
            {summary.lastMeeting.away_team}
          </span>{' '}
          · {summary.lastMeeting.seasonName}
          {summary.lastMeeting.date ? ` · ${summary.lastMeeting.date}` : ''}
        </p> :
      null}
    </Panel>);

}

function formatRecommendedWeight(value: number | null): string {
  return value === null ? '—' : value.toFixed(1);
}