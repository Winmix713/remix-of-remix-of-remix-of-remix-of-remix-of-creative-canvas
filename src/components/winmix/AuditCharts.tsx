import React from 'react';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis } from
'recharts';
import type { ReliabilityPoint } from '../../utils/stats';
import { Panel, PanelHeader, PanelTitle } from './Panel';
import { Table, Td, Th, Tr } from './DataTable';

const OUTCOME_COLORS = ['var(--signal)', 'var(--chart-4)', 'var(--negative)'];

const tooltipStyle = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12
};

const legendFormatter = (value: React.ReactNode) =>
<span style={{ color: 'var(--muted-foreground)', fontSize: 11 }}>{value}</span>;


export interface OutcomeSlice {
  name: string;
  value: number;
}

/** Charts are SVG and unreadable to a screen reader, so each ships a data table. */
function ChartDataTable({
  caption,
  head,
  rows




}: {caption: string;head: string[];rows: (string | number)[][];}) {
  return (
    <details className="border-t border-border px-3 py-2 sm:px-4">
      <summary className="cursor-pointer text-ui-2xs uppercase tracking-label text-muted-foreground">
        Adatok táblázatként
      </summary>
      <div className="mt-2 overflow-x-auto">
        <Table minWidth={280}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {head.map((h, i) =>
              <Th key={h} align={i === 0 ? 'left' : 'right'}>
                  {h}
                </Th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) =>
            <Tr key={String(r[0])}>
                {r.map((c, i) =>
              <Td key={`${r[0]}-${i}`} align={i === 0 ? 'left' : 'right'}>
                    {c}
                  </Td>
              )}
              </Tr>
            )}
          </tbody>
        </Table>
      </div>
    </details>);

}

export function OutcomeDistributionChart({
  data,
  hasData



}: {data: OutcomeSlice[];hasData: boolean;}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle as="h3">Kimenetel megoszlás (valós H / D / A)</PanelTitle>
      </PanelHeader>
      <div className="h-[200px] w-full px-2 pt-3 sm:h-[240px]">
        {!hasData ?
        <p className="pt-14 text-center text-ui-sm text-muted-foreground">
            Nincs kiértékelt mérkőzés ehhez a ligához.
          </p> :

        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}>
              
                {data.map((entry, idx) =>
              <Cell key={entry.name} fill={OUTCOME_COLORS[idx % OUTCOME_COLORS.length]} />
              )}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend verticalAlign="bottom" formatter={legendFormatter} />
            </PieChart>
          </ResponsiveContainer>
        }
      </div>
      {hasData ?
      <ChartDataTable
        caption="Kimenetel megoszlás"
        head={['Kimenetel', 'Meccs', 'Arány']}
        rows={data.map((d) => [
        d.name,
        d.value,
        total > 0 ? `${(d.value / total * 100).toFixed(1)}%` : '—']
        )} /> :

      null}
    </Panel>);

}

export function ReliabilityDiagram({
  points,
  hasData



}: {points: ReliabilityPoint[];hasData: boolean;}) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle as="h3">Reliability diagram (kalibráció 5 sávban)</PanelTitle>
      </PanelHeader>
      <div className="h-[200px] w-full px-1 pt-3 sm:h-[240px] sm:px-2">
        {!hasData ?
        <p className="pt-14 text-center text-ui-sm text-muted-foreground">
            Nincs kiértékelt mérkőzés ehhez a ligához.
          </p> :

        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 4, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
              dataKey="label"
              tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
              stroke="var(--border)"
              tickLine={false} />
            
              <YAxis
              domain={[0, 100]}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
              stroke="var(--border)"
              tickLine={false}
              width={40} />
            
              <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number) => `${value.toFixed(1)}%`} />
            
              <Legend verticalAlign="bottom" formatter={legendFormatter} />
              <Line
              type="monotone"
              dataKey="actual"
              name="Tényleges arány (%)"
              stroke="var(--signal)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'var(--signal)' }}
              isAnimationActive={false} />
            
              <Line
              type="monotone"
              dataKey="perfect"
              name="Tökéletes kalibráció"
              stroke="var(--muted-foreground)"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false} />
            
            </LineChart>
          </ResponsiveContainer>
        }
      </div>
      {hasData ?
      <ChartDataTable
        caption="Reliability diagram adatai"
        head={['Sáv', 'Tényleges %', 'Tökéletes %']}
        rows={points.map((p) => [p.label, p.actual.toFixed(1), p.perfect.toFixed(1)])} /> :

      null}
    </Panel>);

}