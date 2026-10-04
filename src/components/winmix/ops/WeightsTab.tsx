import React, { useMemo } from 'react';
import { RotateCcw, Undo2 } from 'lucide-react';
import type { League } from '../../../types/winmix';
import type { WeightRow } from '../../../hooks/useOpsActions';
import type { checkDirectedFixtureMatrix } from '../../../utils/fixtureMatrix';
import { DataGrid, type GridColumn } from '../DataGrid';
import { Chip, Panel, PanelActions, PanelHeader, PanelSubtitle, PanelTitle } from '../Panel';

type FixtureReport = ReturnType<typeof checkDirectedFixtureMatrix>;

interface WeightsTabProps {
  league: League;
  rows: WeightRow[];
  fixtureReport: FixtureReport;
  busy: boolean;
  canRevert: boolean;
  onApplyAuto: () => void;
  onRevert: () => void;
  onSave: () => void;
  onWeightChange: (league: League, key: string, value: number) => void;
}

export function WeightsTab({
  league,
  rows,
  fixtureReport,
  busy,
  canRevert,
  onApplyAuto,
  onRevert,
  onSave,
  onWeightChange
}: WeightsTabProps) {
  const columns = useMemo<GridColumn<WeightRow>[]>(
    () => [
    {
      key: 'team',
      label: 'Csapat',
      primary: true,
      cell: (r) =>
      <span className="flex min-w-0 items-center gap-2 font-sans font-bold text-foreground">
            <span className="truncate">{r.displayName}</span>
            {r.auto ? <Chip tone="signal">auto</Chip> : null}
          </span>

    },
    {
      key: 'netHome',
      label: 'Net (hazai)',
      cardLabel: 'Net (H)',
      align: 'center',
      cell: (r) => r.rec ? r.rec.netHome.toFixed(2) : '—'
    },
    {
      key: 'netAway',
      label: 'Net (vendég)',
      cardLabel: 'Net (V)',
      align: 'center',
      cell: (r) => r.rec ? r.rec.netAway.toFixed(2) : '—'
    },
    {
      key: 'ppg',
      label: 'PPG',
      align: 'center',
      cell: (r) => r.rec ? r.rec.ppg.toFixed(2) : '—'
    },
    {
      key: 'rec',
      label: 'Javaslat',
      align: 'center',
      cellClassName: 'font-bold text-signal',
      cell: (r) => r.rec ? r.rec.recommendedWeight.toFixed(1) : '—'
    },
    {
      key: 'delta',
      label: 'Δ',
      align: 'center',
      cellClassName: 'text-muted-foreground',
      cell: (r) => r.rec ? `${r.delta > 0 ? '+' : ''}${r.delta.toFixed(1)}` : '—'
    },
    {
      key: 'current',
      label: 'Aktív súly',
      cardLabel: 'Aktív',
      align: 'center',
      secondary: true,
      cellClassName: 'font-extrabold',
      cell: (r) => r.current.toFixed(1)
    },
    {
      key: 'slider',
      label: 'Csúszka',
      cell: (r) =>
      <input
        type="range"
        min={0}
        max={10}
        step={0.1}
        value={r.current}
        aria-label={`${r.displayName} súlyozása`}
        onChange={(e) => onWeightChange(league, r.key, parseFloat(e.target.value))}
        className="tap w-full min-w-[120px] max-w-[180px] accent-signal" />


    }],

    [league, onWeightChange]
  );

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader>
          <div className="flex min-w-0 flex-col gap-0.5">
            <PanelTitle>Csapat súlyozási index (0.0 – 10.0)</PanelTitle>
            <PanelSubtitle>
              z-score standardizálás 5.0 középpont körül · helyszín szerint bontott
            </PanelSubtitle>
          </div>
          <PanelActions>
            {canRevert ?
            <button
              type="button"
              className="btn btn--ghost btn--sm tap gap-1.5"
              disabled={busy}
              onClick={onRevert}>
              
                <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                Visszaállítás
              </button> :
            null}
            <button
              type="button"
              className="btn btn--outline btn--sm tap gap-1.5"
              disabled={busy || rows.length === 0}
              onClick={onApplyAuto}>
              
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Automatikus súlyok alkalmazása
            </button>
            <button
              type="button"
              className="btn btn--signal btn--sm tap"
              disabled={busy || rows.length === 0}
              onClick={onSave}>
              
              Súlyok mentése
            </button>
          </PanelActions>
        </PanelHeader>

        <DataGrid
          columns={columns}
          rows={rows}
          rowKey={(r) => r.key}
          minWidth={880}
          collapseBelow="lg"
          scrollClassName="max-h-[620px]"
          empty="Ebben a ligában még nincs betöltött csapat — tölts fel egy CSV/JSON archívumot." />
        
      </Panel>

      {!fixtureReport.complete && fixtureReport.missingExamples.length > 0 ?
      <Panel>
          <PanelHeader>
            <PanelTitle as="h3">Irányított menetrend hiányosságai</PanelTitle>
          </PanelHeader>
          <div className="px-3 py-3.5 sm:px-4">
            <p className="max-w-prose text-ui-xs leading-relaxed text-muted-foreground">
              Egy zárt kettős körmérkőzés {fixtureReport.teamCount} csapat esetén pontosan{' '}
              {fixtureReport.expectedPairs} irányított párt tartalmaz. A hiányzó irányok gyengítik a
              helyszín szerinti becslést (a súlyok emiatt tájékoztató jellegűek):
            </p>
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {fixtureReport.missingExamples.map((pair) =>
            <li key={pair}>
                  <Chip tone="neutral">{pair}</Chip>
                </li>
            )}
            </ul>
          </div>
        </Panel> :
      null}
    </div>);

}