import React from 'react';
import { useWinmix } from '../../contexts/WinmixContext';
import { cn } from '../../lib/utils';
import { Chip } from './Panel';

export function SeasonPills() {
  const { leagueSeasons, selectedSeasonId, selectSeason, deleteSeason, currentLeague } =
  useWinmix();

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-4 shadow-panel sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-ui-xs text-muted-foreground">
          Bajnokság szezonválasztó · ~240 mérkőzéses sorozatok
        </h2>
        {selectedSeasonId ?
        <button
          type="button"
          className="btn btn--danger btn--sm tap"
          onClick={() => void deleteSeason(selectedSeasonId)}>
          
            Aktív szezon törlése
          </button> :
        null}
      </div>

      {leagueSeasons.length === 0 ?
      <p className="py-1.5 text-ui-xs text-muted-foreground">
          Még nincs rögzített {currentLeague} bajnokság.
        </p> :

      <div className="scrollbar-none flex items-center gap-2 overflow-x-auto pb-1">
          {leagueSeasons.map((season) => {
          const isActive = season.id === selectedSeasonId;
          return (
            <button
              key={season.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => selectSeason(season.id)}
              className={cn(
                'tap flex min-h-[38px] shrink-0 items-center gap-2 rounded-lg border px-3.5 text-ui-xs transition-colors duration-fast ease-enter',
                isActive ?
                'border-signal/40 bg-signal-soft text-signal' :
                'border-border bg-surface-1 text-muted-foreground hover:bg-surface-pop hover:text-foreground'
              )}>
              
                <span>{season.name}</span>
                <Chip tone={isActive ? 'signal' : 'neutral'}>
                  {season.actualMatchCount || season.matches.length} M
                  {season.countWarning ? ' ⚠' : ''}
                </Chip>
              </button>);

        })}
        </div>
      }
    </section>);

}