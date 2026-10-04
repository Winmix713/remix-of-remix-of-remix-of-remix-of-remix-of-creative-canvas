import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { LEAGUE_FLAG } from '../../data/leagues';
import { cn } from '../../lib/utils';
import type { FixtureAnalysis } from '../../types/winmix';
import { ConfidenceBadge, RecommendationLabel, SufficiencyBadge } from './Badges';
import { BttsProfileBlock } from './BttsProfileBlock';
import { PatternList } from './PatternList';
import { TeamGoalBlock } from './TeamGoalBlock';

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function FixtureCard({ analysis }: {analysis: FixtureAnalysis;}) {
  const [open, setOpen] = useState(false);
  const evidence = analysis.patterns[0]?.evidence ?? [];

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-panel sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-ui-base font-medium tracking-tight text-foreground">
            <span aria-hidden={true}>{LEAGUE_FLAG[analysis.league]}</span>
            <span className="truncate">{analysis.label}</span>
          </h3>
          <p className="mt-1 text-ui-xs text-muted-foreground">
            H2H {analysis.directMeetings} egyirányú · HT adat{' '}
            {Math.round(analysis.htCoverage * 100)}%
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SufficiencyBadge level={analysis.sufficiency} />
          <ConfidenceBadge score={analysis.confidence} label={analysis.confidenceLabel} />
        </div>
      </header>

      <div className="flex flex-col gap-2">
        <div
          className="flex h-2 gap-0.5 overflow-hidden rounded-full"
          role="img"
          aria-label="Kalibrált valószínűségek">
          
          <div className="h-full bg-signal" style={{ width: `${analysis.probs.home * 100}%` }} />
          <div
            className="h-full bg-elevated-2"
            style={{ width: `${analysis.probs.draw * 100}%` }} />
          
          <div className="h-full bg-warning" style={{ width: `${analysis.probs.away * 100}%` }} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-ui-xs tabular-nums">
          <span className="text-signal">1 · {pct(analysis.probs.home)}</span>
          <span className="text-muted-foreground">X · {pct(analysis.probs.draw)}</span>
          <span className="text-warning">2 · {pct(analysis.probs.away)}</span>
          <RecommendationLabel value={analysis.recommendation} />
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2.5">
        <div>
          <dt className="text-ui-xs text-muted-foreground">Over 2.5</dt>
          <dd className="mt-0.5 text-ui-base font-medium tabular-nums text-foreground">
            {pct(analysis.over25)}
          </dd>
        </div>
        <div>
          <dt className="text-ui-xs text-muted-foreground">BTTS</dt>
          <dd className="mt-0.5 text-ui-base font-medium tabular-nums text-foreground">
            {pct(analysis.btts)}
          </dd>
        </div>
        <div>
          <dt className="text-ui-xs text-muted-foreground">Poisson csúcs</dt>
          <dd className="mt-0.5 text-ui-base font-medium tabular-nums text-foreground">
            {analysis.mostLikelyScore}
          </dd>
        </div>
      </dl>

      {analysis.notes.length > 0 ?
      <ul className="flex flex-col gap-1.5">
          {analysis.notes.map((note) =>
        <li
          key={note}
          className="rounded-lg border border-warning/25 bg-warning-soft px-2.5 py-1.5 text-ui-xs text-warning">
          
              {note}
            </li>
        )}
        </ul> :
      null}

      <TeamGoalBlock analysis={analysis} />

      <BttsProfileBlock analysis={analysis} />

      <PatternList patterns={analysis.patterns} />

      {evidence.length > 0 ?
      <div>
          <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1.5 text-ui-xs text-muted-foreground transition-colors hover:text-foreground">
          
            {open ?
          <ChevronDown className="h-3.5 w-3.5" aria-hidden={true} /> :

          <ChevronRight className="h-3.5 w-3.5" aria-hidden={true} />
          }
            Bizonyítékok ({evidence.length})
          </button>
          {open ?
        <ul className={cn('mt-2 flex flex-col gap-1')}>
              {evidence.map((line) =>
          <li
            key={line}
            className="rounded-md bg-surface-1 px-2.5 py-1.5 text-ui-xs text-muted-foreground">
            
                  {line}
                </li>
          )}
            </ul> :
        null}
        </div> :
      null}
    </article>);

}