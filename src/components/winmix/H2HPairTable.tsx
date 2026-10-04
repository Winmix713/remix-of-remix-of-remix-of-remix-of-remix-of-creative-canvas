import React, { useMemo } from 'react';
import { cn } from '../../lib/utils';
import { h2hFormTail } from '../../utils/h2h';
import type { H2HPair } from '../../types/winmix';
import { DataGrid, type GridColumn } from './DataGrid';
import { Chip } from './Panel';

interface H2HPairTableProps {
  pairs: H2HPair[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  empty: React.ReactNode;
}

function MatchList({ pair }: { pair: H2HPair }) {
  return (
    <div className="animate-fade-in">
      <p className="section-label mb-2">Mérkőzéslista — {pair.matches.length} találkozó</p>
      <ul className="flex flex-col gap-1.5 lg:divide-y lg:divide-border/60">
        {pair.matches.map((m, idx) => (
          <li
            key={`${pair.id}-${idx}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md bg-elevated/40 px-3 py-2.5 text-ui-xs lg:rounded-none lg:bg-transparent lg:px-3"
          >
            <span className="font-mono text-muted-foreground">{m.date || '—'}</span>
            <span className="font-medium text-foreground">
              {m.home_team}{' '}
              <b className="font-mono text-ui-sm tabular-nums text-foreground">
                {m.home_score}–{m.away_score}
              </b>{' '}
              {m.away_team}
            </span>
            <Chip tone="neutral" className="font-sans">{m.seasonName}</Chip>
            <span className="font-mono text-muted-foreground">Σ {m.total_goals}</span>
            {m.btts ? (
              <Chip tone="positive">BTTS</Chip>
            ) : (
              <Chip tone="neutral">BTTS ✘</Chip>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function H2HPairTable({ pairs, expanded, onToggle, empty }: H2HPairTableProps) {
  const columns = useMemo<GridColumn<H2HPair>[]>(
    () => [
      {
        key: 'pair',
        label: 'Csapatpár (Hazai – Vendég)',
        primary: true,
        cell: (p) => (
          <span className="flex min-w-0 items-center gap-1.5 font-sans font-bold text-foreground">
            <span className="truncate">{p.homeDisplay}</span>
            <span className="shrink-0 font-normal text-muted-foreground">(H)</span>
            <span className="shrink-0 text-muted-foreground">–</span>
            <span className="truncate">{p.awayDisplay}</span>
            <span className="shrink-0 font-normal text-muted-foreground">(V)</span>
          </span>
        ),
      },
      {
        key: 'played',
        label: 'Lejátszott',
        cardLabel: 'Meccs',
        align: 'right',
        secondary: true,
        sortable: true,
        cell: (p) => <span className="font-extrabold text-signal">{p.played}</span>,
      },
      {
        key: 'form',
        label: 'Forma (hazai, utolsó 5)',
        cardLabel: 'Forma',
        align: 'center',
        cell: (p) => (
          <span className="text-ui-xs">{h2hFormTail(p).join('-') || '—'}</span>
        ),
      },
      {
        key: 'wdl',
        label: 'GY / D / V',
        align: 'center',
        cell: (p) => `${p.winsHome} / ${p.draws} / ${p.winsAway}`,
      },
      {
        key: 'goals',
        label: 'Gólok (össz.)',
        cardLabel: 'Gólok',
        align: 'right',
        sortable: true,
        cell: (p) => `${p.goalsHome}–${p.goalsAway} (Σ${p.totalGoals})`,
      },
      {
        key: 'avg',
        label: 'Átl. gól/meccs',
        cardLabel: 'Átl. gól',
        align: 'right',
        cell: (p) => p.avgGoals.toFixed(2),
      },
      {
        key: 'btts',
        label: 'BTTS %',
        align: 'right',
        sortable: true,
        cell: (p) => (
          <span className={cn(p.bttsPct >= 60 ? 'text-positive' : 'text-muted-foreground')}>
            {p.bttsPct.toFixed(0)}%
          </span>
        ),
      },
      {
        key: 'over',
        label: 'Over 2.5 %',
        cardLabel: 'Over 2.5',
        align: 'right',
        sortable: true,
        cell: (p) => (
          <span className={cn(p.over25Pct >= 55 ? 'text-signal' : 'text-muted-foreground')}>
            {p.over25Pct.toFixed(0)}%
          </span>
        ),
      },
      {
        key: 'last',
        label: 'Utolsó találkozó',
        cardLabel: 'Utolsó',
        align: 'center',
        cell: (p) => (
          <span className="text-ui-xs">
            {p.lastMeeting
              ? `${p.lastMeeting.home_team} ${p.lastMeeting.home_score}–${p.lastMeeting.away_score} ${p.lastMeeting.away_team}`
              : '—'}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <DataGrid
      columns={columns}
      rows={pairs}
      rowKey={(p) => p.id}
      empty={empty}
      minWidth={1040}
      collapseBelow="lg"
      scrollClassName="max-h-[640px]"
      expandable={{
        isOpen: (p) => expanded.has(p.id),
        onToggle: (p) => onToggle(p.id),
        label: (p) => `${p.homeDisplay} – ${p.awayDisplay} mérkőzéslista`,
        content: (p) => <MatchList pair={p} />,
      }}
    />
  );
}
