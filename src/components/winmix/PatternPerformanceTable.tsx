import React, { useMemo } from 'react';
import { cn } from '../../lib/utils';
import { PATTERN_LABEL } from '../../utils/patterns';
import type { PatternPerformance } from '../../types/winmix';
import { DataGrid, type GridColumn } from './DataGrid';

function weightTone(weight: number): string {
  if (weight > 1.02) return 'text-positive';
  if (weight < 0.98) return 'text-negative';
  return 'text-muted-foreground';
}

export function PatternPerformanceTable({ rows }: {rows: PatternPerformance[];}) {
  const columns = useMemo<GridColumn<PatternPerformance>[]>(
    () => [
    {
      key: 'type',
      label: 'Mintatípus',
      primary: true,
      cell: (r) => <span className="font-sans font-semibold">{PATTERN_LABEL[r.type]}</span>
    },
    {
      key: 'issued',
      label: 'Kiadott',
      align: 'right',
      cell: (r) => r.issued
    },
    {
      key: 'settled',
      label: 'Lezárt',
      align: 'right',
      cell: (r) => r.settled
    },
    {
      key: 'hits',
      label: 'Találat',
      align: 'right',
      cell: (r) => r.hits
    },
    {
      key: 'hitRate',
      label: 'Találati arány',
      cardLabel: 'Arány',
      align: 'right',
      secondary: true,
      cell: (r) => r.hitRate !== null ? `${(r.hitRate * 100).toFixed(1)}%` : '—'
    },
    {
      key: 'smoothed',
      label: 'Simított',
      align: 'right',
      cellClassName: 'text-muted-foreground',
      cell: (r) => `${(r.smoothed * 100).toFixed(1)}%`
    },
    {
      key: 'weight',
      label: 'Súly',
      align: 'right',
      cell: (r) =>
      <span className={cn('font-bold', weightTone(r.weight))}>{r.weight.toFixed(2)}×</span>

    }],

    []
  );

  return (
    <DataGrid
      columns={columns}
      rows={rows}
      rowKey={(r) => r.type}
      minWidth={620}
      collapseBelow="md"
      scrollClassName="max-h-[420px]"
      empty="Még nincs kiadott tipp — minden mintatípus súlya 1.00 (semleges)." />);


}