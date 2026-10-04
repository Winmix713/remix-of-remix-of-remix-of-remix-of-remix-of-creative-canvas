import React from 'react';
import { cn } from '../../lib/utils';
import { BAND_MIN_SAMPLE } from '../../utils/constants';
import { BandDiagnosisBadge } from './Badges';
import { EmptyRow, Table, TableScroll, Td, Th, Tr } from './DataTable';
import type { BandDiagnosis } from '../../types/winmix';

/**
 * The shared band-table RENDERING primitive.
 *
 * Two different measurements render through this component: the 1X2 confidence
 * bands (`ReliabilityBand`) and the market-specific probability bands
 * (`MarketCalibrationBand`). They share columns, not semantics — the row shape
 * below is deliberately structural and minimal so neither type has to be
 * widened, merged or cast into the other.
 */
export interface BandRow {
  key: string;
  label: string;
  range: string;
  n: number;
  avgP: number;
  hitRate: number;
  gap: number;
  ciLo: number;
  ciHi: number;
  evaluable: boolean;
  diagnosis: BandDiagnosis;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function gapTone(row: BandRow): string {
  if (!row.evaluable) return 'text-muted-foreground';
  if (row.diagnosis === 'overconfident') return 'text-negative';
  if (row.diagnosis === 'underconfident') return 'text-chart-4';
  return 'text-positive';
}

export function BandRowsTable({
  rows,
  firstColumnLabel,
  empty,
  minWidth = 880






}: {rows: readonly BandRow[]; /** Header of the first column — the only column whose meaning differs. */firstColumnLabel: string;empty: React.ReactNode;minWidth?: number;}) {
  const total = rows.reduce((acc, row) => acc + row.n, 0);

  return (
    <TableScroll>
      <Table minWidth={minWidth} className="font-mono tabular-nums">
        <thead>
          <tr>
            <Th>{firstColumnLabel}</Th>
            <Th align="center">Minta (n)</Th>
            <Th align="center">Átlagos jelzett P</Th>
            <Th align="center">Tényleges beválás</Th>
            <Th align="center">Wilson 95% CI</Th>
            <Th align="center">Eltérés (Gap)</Th>
            <Th align="center">Diagnózis</Th>
          </tr>
        </thead>
        <tbody>
          {total === 0 ?
          <EmptyRow colSpan={7}>{empty}</EmptyRow> :

          rows.map((row) =>
          <Tr key={row.key}>
                <Td>
                  <span className="font-sans font-bold text-foreground">{row.label}</span>{' '}
                  <span className="text-muted-foreground">({row.range})</span>
                </Td>
                <Td align="center">{row.n}</Td>
                <Td align="center">{row.n === 0 ? '—' : pct(row.avgP)}</Td>
                <Td align="center" className="font-bold text-foreground">
                  {row.evaluable ? pct(row.hitRate) : '—'}
                </Td>
                <Td align="center" className="text-[11px] text-muted-foreground">
                  {row.evaluable ?
              `${pct(row.ciLo)} – ${pct(row.ciHi)}` :
              `nincs elég eset (min. ${BAND_MIN_SAMPLE})`}
                </Td>
                <Td align="center" className={cn('font-bold', gapTone(row))}>
                  {row.evaluable ?
              `${row.gap >= 0 ? '+' : ''}${(row.gap * 100).toFixed(1)} pp` :
              '—'}
                </Td>
                <Td align="center">
                  <BandDiagnosisBadge diagnosis={row.diagnosis} />
                </Td>
              </Tr>
          )
          }
        </tbody>
      </Table>
    </TableScroll>);

}