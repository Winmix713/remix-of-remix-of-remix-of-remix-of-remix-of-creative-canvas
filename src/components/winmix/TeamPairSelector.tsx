import React from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, Play, Swords } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { TeamOption } from '../../utils/fixtures';
import { TeamSelect } from './TeamSelect';
import { Panel, PanelHeader, PanelTitle } from './Panel';

export type RunState = 'idle' | 'running' | 'done' | 'error';

interface TeamPairSelectorProps {
  homeKey: string | null;
  awayKey: string | null;
  teamPool: TeamOption[];
  runState: RunState;
  applied: { home: string; away: string } | null;
  displayOf: (key: string) => string;
  monogramOf: (key: string | null) => string;
  pairsCount: number;
  onHomeChange: (value: string | null) => void;
  onAwayChange: (value: string | null) => void;
  onRun: () => void;
  onReset: () => void;
}

export function TeamPairSelector({
  homeKey,
  awayKey,
  teamPool,
  runState,
  applied,
  displayOf,
  monogramOf,
  pairsCount,
  onHomeChange,
  onAwayChange,
  onRun,
  onReset,
}: TeamPairSelectorProps) {
  const excludedFromHome = new Set(awayKey ? [awayKey] : []);
  const excludedFromAway = new Set(homeKey ? [homeKey] : []);

  const statusText = runState === 'error'
    ? 'Az elemzés nem indult el. Ellenőrizd a kiválasztást, majd próbáld újra.'
    : applied
      ? `${displayOf(applied.home)} (H) – ${displayOf(applied.away)} (V) · ${pairsCount} találkozó`
      : teamPool.length === 0
        ? 'Nincs betöltött csapat az aktív ligában — töltsd fel a CSV-t a Taktikai Stúdióban.'
        : `${teamPool.length} csapat érhető el · futtatás nélkül az összes csapatpár látszik`;

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Csapatpár kiválasztása</PanelTitle>
        {applied ? (
          <button
            type="button"
            className="btn btn--ghost btn--sm tap"
            onClick={onReset}
          >
            Szűrő törlése
          </button>
        ) : null}
      </PanelHeader>

      <div className={cn(
        'flex flex-col gap-5 px-4 py-5 transition-opacity duration-base sm:px-5',
        runState === 'running' && 'pointer-events-none opacity-50',
      )}>
        <p className="max-w-prose text-ui-sm font-medium leading-relaxed text-foreground/80">
          Válaszd ki a hazai és a vendég csapatot. Ugyanaz a csapat a két
          oldalon nem jelölhető ki.
        </p>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] lg:items-end">
          <label className="min-w-0 rounded-lg border border-signal/20 bg-signal-soft/30 p-3 focus-within:border-signal focus-within:ring-2 focus-within:ring-signal/20">
            <span className="mb-2 flex items-center gap-2 text-ui-xs font-semibold uppercase text-foreground">
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-signal/10 text-signal"
                aria-hidden="true"
              >
                {monogramOf(homeKey)}
              </span>
              Hazai csapat
            </span>
            <TeamSelect
              value={homeKey}
              options={teamPool}
              excluded={excludedFromHome}
              placeholder="Hazai csapat kiválasztása"
              disabled={teamPool.length === 0 || runState === 'running'}
              onChange={onHomeChange}
            />
          </label>

          <span
            className="mx-auto grid h-12 w-12 shrink-0 place-items-center rounded-full border border-signal/30 bg-signal-soft text-signal shadow-panel"
            aria-label="ellenfél"
          >
            <Swords className="h-5 w-5" aria-hidden="true" />
          </span>

          <label className="min-w-0 rounded-lg border border-border bg-muted/30 p-3 focus-within:border-signal focus-within:ring-2 focus-within:ring-signal/20">
            <span className="mb-2 flex items-center gap-2 text-ui-xs font-semibold uppercase text-foreground">
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-signal/10 text-signal"
                aria-hidden="true"
              >
                {monogramOf(awayKey)}
              </span>
              Vendég csapat
            </span>
            <TeamSelect
              value={awayKey}
              options={teamPool}
              excluded={excludedFromAway}
              placeholder="Vendég csapat kiválasztása"
              disabled={teamPool.length === 0 || runState === 'running'}
              onChange={onAwayChange}
            />
          </label>

          <button
            type="button"
            className="btn btn--signal tap h-11 w-full shrink-0 gap-2 lg:w-auto"
            disabled={!homeKey || !awayKey || runState === 'running'}
            onClick={onRun}
          >
            {runState === 'running' ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : runState === 'done' ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
            {runState === 'running'
              ? 'Elemzés folyamatban'
              : runState === 'done'
                ? 'Elemzés kész'
                : 'Futtatás'}
          </button>
        </div>

        <div
          className={cn(
            'flex min-w-0 items-start gap-2 rounded-md border px-3 py-2 text-ui-xs font-medium animate-fade-in',
            runState === 'error'
              ? 'border-destructive/30 bg-destructive/5 text-destructive'
              : applied
                ? 'border-signal/30 bg-signal-soft text-signal'
                : 'border-border bg-muted/20 text-foreground/70',
          )}
          role="status"
          aria-live="polite"
        >
          {runState === 'error' ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : null}
          <span className="min-w-0">{statusText}</span>
        </div>
      </div>
    </Panel>
  );
}
