import React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis } from
'recharts';
import type { LedgerTrendPoint } from '../../utils/ledger';

const axisStyle = { fontSize: 10, fill: 'var(--muted-foreground)' };

/**
 * Cumulative vs. rolling hit rate over every settled line, chronologically.
 * The 50% reference line is the coin-flip floor — anything that spends time
 * under it is not a signal, and that has to be visible, not inferred.
 */
export function LedgerTrendChart({ points }: {points: LedgerTrendPoint[];}) {
  if (points.length < 2) {
    return (
      <p className="px-4 py-10 text-center text-ui-sm text-muted-foreground">
        A görbéhez legalább két lezárt tippsor kell. Írd be az eredményeket a szelvénytárban, és a
        teljesítmény alakulása itt jelenik meg.
      </p>);

  }

  return (
    <div className="h-[200px] w-full px-1 py-3 sm:h-[240px] sm:px-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="index"
            tick={axisStyle}
            stroke="var(--border)"
            tickLine={false}
            minTickGap={24} />
          
          <YAxis
            domain={[0, 100]}
            tick={axisStyle}
            stroke="var(--border)"
            tickLine={false}
            width={44}
            tickFormatter={(v: number) => `${v}%`} />
          
          <ReferenceLine
            y={50}
            stroke="var(--chart-4)"
            strokeDasharray="4 4"
            label={{ value: '50%', position: 'right', fill: 'var(--chart-4)', fontSize: 10 }} />
          
          <Tooltip
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 11
            }}
            labelFormatter={(label) => `${label}. lezárt tippsor`}
            formatter={(value: number, name) => [
            `${value.toFixed(1)}%`,
            name === 'hitRate' ? 'Kumulatív' : 'Utolsó 20']
            } />
          
          <Line
            type="monotone"
            dataKey="hitRate"
            stroke="var(--signal)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false} />
          
          <Line
            type="monotone"
            dataKey="rolling"
            stroke="var(--chart-3)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false} />
          
        </LineChart>
      </ResponsiveContainer>
      <ul className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-ui-2xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-signal" aria-hidden={true} />
          Kumulatív találati arány
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-chart-3" aria-hidden={true} />
          Utolsó 20 tippsor
        </li>
      </ul>
    </div>);

}