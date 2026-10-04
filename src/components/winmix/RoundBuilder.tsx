import React from 'react';
import { Eraser } from 'lucide-react';
import { LEAGUE_FLAG, LEAGUE_LABEL } from '../../data/leagues';
import { cn } from '../../lib/utils';
import { isComplete } from '../../utils/fixtures';
import type { TeamOption } from '../../utils/fixtures';
import type { Fixture, League } from '../../types/winmix';
import { Chip } from './Panel';
import { TeamSelect } from './TeamSelect';

interface RoundBuilderProps {
  league: League;
  fixtures: Fixture[];
  pool: TeamOption[];
  used: Set<string>;
  patternCounts: Record<string, number>;
  onSelect: (fixtureId: string, side: 'home' | 'away', key: string | null) => void;
  onClear: (fixtureId: string) => void;
}

export function RoundBuilder({
  league,
  fixtures,
  pool,
  used,
  patternCounts,
  onSelect,
  onClear
}: RoundBuilderProps) {
  const filled = fixtures.filter(isComplete).length;
  const empty = pool.length === 0;

  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-border bg-card shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-elevated/60 px-3 py-2.5 sm:px-4 sm:py-3">
        <h3 className="flex items-center gap-2 text-ui-base font-bold text-foreground">
          <span aria-hidden={true}>{LEAGUE_FLAG[league]}</span>
          {LEAGUE_LABEL[league]} forduló
        </h3>
        <Chip tone={filled === fixtures.length ? 'signal' : 'neutral'}>
          {filled} / {fixtures.length}
        </Chip>
      </div>

      {empty ?
      <p className="px-4 py-8 text-center text-ui-sm leading-relaxed text-muted-foreground">
          Nincs betöltött {LEAGUE_LABEL[league].toLowerCase()} szezon — töltsd fel a CSV-t a Taktikai
          Stúdióban, hogy a csapatlista feltöltődjön.
        </p> :

      <ul className="flex flex-col divide-y divide-border">
          {fixtures.map((fixture) => {
          const complete = isComplete(fixture);
          const count = patternCounts[fixture.id] ?? 0;
          return (
            <li
              key={fixture.id}
              className={cn(
                'flex items-center gap-2 px-2.5 py-2 sm:px-3',
                complete ? 'bg-background/40' : undefined
              )}>
              
                <span className="w-4 shrink-0 text-center font-mono text-ui-xs text-muted-foreground">
                  {fixture.slot}
                </span>

                {/* Stacked on a phone: two 40px selects side by side leave no
                   room for either team name. */}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                  <TeamSelect
                  value={fixture.homeKey}
                  options={pool}
                  excluded={used}
                  placeholder="Hazai"
                  onChange={(key) => onSelect(fixture.id, 'home', key)} />
                
                  <span
                  className="hidden shrink-0 font-mono text-ui-2xs uppercase text-muted-foreground sm:inline"
                  aria-hidden={true}>
                  
                    vs
                  </span>
                  <TeamSelect
                  value={fixture.awayKey}
                  options={pool}
                  excluded={used}
                  placeholder="Vendég"
                  onChange={(key) => onSelect(fixture.id, 'away', key)} />
                
                </div>

                <span className="w-8 shrink-0 text-right font-mono text-ui-xs text-signal">
                  {count > 0 ? `✦${count}` : <span className="text-muted-foreground">—</span>}
                </span>
                <button
                type="button"
                aria-label={`${fixture.slot}. sor kiürítése`}
                disabled={!fixture.homeKey && !fixture.awayKey}
                onClick={() => onClear(fixture.id)}
                className="tap flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-elevated hover:text-negative disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground">
                
                  <Eraser className="h-3.5 w-3.5" aria-hidden={true} />
                </button>
              </li>);

        })}
        </ul>
      }
    </section>);

}