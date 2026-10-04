import React, { useMemo } from 'react';
import type { EvalWindow } from '../../types/winmix';
import { DataGrid, type GridColumn } from './DataGrid';

function SignCell({ w }: {w: EvalWindow;}) {
  if (w.sign.n === 0) return <span className="text-muted-foreground">n/a</span>;
  if (w.sign.significant && w.sign.direction === 'ensemble_better') {
    return (
      <span className="font-bold text-signal">✓ szign. jobb (p={w.sign.p.toFixed(3)})</span>);

  }
  if (w.sign.significant && w.sign.direction === 'b1_better') {
    return (
      <span className="font-bold text-negative">✗ szign. rosszabb (p={w.sign.p.toFixed(3)})</span>);

  }
  return (
    <span className="text-muted-foreground">nem különböztethető (p={w.sign.p.toFixed(3)})</span>);

}

function StateCell({ w }: {w: EvalWindow;}) {
  if (w.ece > 0.05) return <span className="text-chart-4">T újrakalibrálás szükséges</span>;
  if (w.sign.significant && w.sign.direction === 'ensemble_better') {
    return <span className="text-signal">Kalibrált, ensemble szign. jobb</span>;
  }
  if (w.sign.significant && w.sign.direction === 'b1_better') {
    return <span className="text-negative">B1 jobb — modell felülvizsgálandó</span>;
  }
  return <span className="text-muted-foreground">Kalibrált, de nincs bizonyított előny</span>;
}

/**
 * Nine columns of rolling-window telemetry. Below `lg` it becomes a card list
 * — the old 1020px minimum width put four columns permanently off-screen on a
 * phone.
 */
export function EvalWindowTable({ windows, empty }: {windows: EvalWindow[];empty: React.ReactNode;}) {
  const columns = useMemo<GridColumn<EvalWindow>[]>(
    () => [
    {
      key: 'index',
      label: 'Ablak #',
      primary: true,
      cell: (w) => <span className="font-mono">#{w.index}. ablak</span>
    },
    {
      key: 'range',
      label: 'Meccs tartomány',
      cardLabel: 'Tartomány',
      secondary: true,
      cell: (w) => `${w.from}–${w.to}`
    },
    {
      key: 'b1',
      label: 'B1 LogLoss',
      cardLabel: 'B1 LL',
      align: 'center',
      cell: (w) => w.logLossB1.toFixed(3)
    },
    {
      key: 'ens',
      label: 'Ens LogLoss',
      cardLabel: 'Ens LL',
      align: 'center',
      cellClassName: 'font-bold text-signal',
      cell: (w) => w.logLossEns.toFixed(3)
    },
    {
      key: 'skill',
      label: 'Skill vs B1',
      cardLabel: 'Skill',
      align: 'center',
      cell: (w) =>
      <span className={w.skill >= 0 ? 'text-signal' : 'text-negative'}>
            {w.skill >= 0 ? '+' : ''}
            {w.skill.toFixed(2)}%
          </span>

    },
    {
      key: 'sign',
      label: 'Szignifikancia (sign-test)',
      cardLabel: 'Szign.',
      align: 'center',
      cellClassName: 'text-ui-xs',
      cell: (w) => <SignCell w={w} />
    },
    {
      key: 'brier',
      label: 'Brier',
      align: 'center',
      cell: (w) => w.brier.toFixed(3)
    },
    {
      key: 'ece',
      label: 'ECE',
      align: 'center',
      cell: (w) =>
      <span className={w.ece > 0.05 ? 'text-chart-4' : undefined}>{w.ece.toFixed(3)}</span>

    },
    {
      key: 'state',
      label: 'Állapot / döntés',
      cardLabel: 'Állapot',
      align: 'center',
      cellClassName: 'text-ui-xs font-bold',
      cell: (w) => <StateCell w={w} />
    }],

    []
  );

  return (
    <DataGrid
      columns={columns}
      rows={windows}
      rowKey={(w) => String(w.index)}
      empty={empty}
      minWidth={1020}
      collapseBelow="lg"
      scrollClassName="max-h-[520px]" />);


}