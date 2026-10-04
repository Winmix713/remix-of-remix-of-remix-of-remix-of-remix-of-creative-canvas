import React from 'react';
import { Goal, Repeat, Swords, Users } from 'lucide-react';
import { MetricCard, MetricGrid } from './MetricCard';
import type { H2HPair } from '../../types/winmix';

interface HeadToHeadOverviewProps {
  allPairs: H2HPair[];
  teamPoolSize: number;
}

export function HeadToHeadOverview({ allPairs, teamPoolSize }: HeadToHeadOverviewProps) {
  const totalMatches = allPairs.reduce((a, p) => a + p.played, 0);
  const totalGoals = allPairs.reduce((a, p) => a + p.totalGoals, 0);
  const avgGoals = totalMatches > 0 ? totalGoals / totalMatches : null;
  const top = allPairs[0] ?? null;

  const hasData = allPairs.length > 0;

  return (
    <div className="border-l-4 border-signal pl-1">
      <MetricGrid>
        <MetricCard
          icon={Users}
          label="Egyedi csapatpárok"
          value={hasData ? allPairs.length : '—'}
          valueClassName="text-3xl font-semibold tabular-nums"
          sub={hasData ? `${teamPoolSize} csapat az aktív ligában` : 'Nincs betöltött adat'}
          tone="signal"
        />
        <MetricCard
          icon={Repeat}
          label="Legtöbbször játszott pár"
          value={
            top ? (
              <span title={`${top.homeDisplay} – ${top.awayDisplay}`} className="block">
                {top.homeDisplay} – {top.awayDisplay}
              </span>
            ) : (
              '—'
            )
          }
          valueClassName="truncate text-ui-lg font-semibold leading-snug"
          tone="signal"
          sub={top ? `${top.played} mérkőzés · történeti maximum` : 'Tölts fel CSV-t a Stúdióban'}
        />
        <MetricCard
          icon={Swords}
          label="Összes H2H mérkőzés"
          value={hasData ? totalMatches : '—'}
          valueClassName="text-3xl font-semibold tabular-nums"
          sub={hasData ? 'Betöltött szezonok összesen' : 'Nincs adat'}
          tone="positive"
        />
        <MetricCard
          icon={Goal}
          label="Átlagos gólszám / meccs"
          value={avgGoals !== null ? avgGoals.toFixed(2) : '—'}
          valueClassName="text-3xl font-semibold tabular-nums"
          tone="signal"
          sub={hasData ? 'Az összes H2H párra vetítve' : 'Nincs adat'}
        />
      </MetricGrid>
    </div>
  );
}
