import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useWinmix } from '../../contexts/WinmixContext';
import { ConfidenceBadge, RecommendationLabel, SufficiencyBadge } from './Badges';
import { EmptyRow, Table, TableScroll, Td, Th, Tr } from './DataTable';
import { MatchInspectorModal } from './MatchInspectorModal';
import { Chip, Panel, PanelHeader, PanelTitle } from './Panel';
import type { MatchRow, Probs } from '../../types/winmix';

function triple(p: Probs) {
  return `${(p.home * 100).toFixed(0)} / ${(p.draw * 100).toFixed(0)} / ${(p.away * 100).toFixed(0)}%`;
}

export function MatchLogPanel() {
  const { selectedSeason } = useWinmix();
  const [query, setQuery] = useState('');
  const [inspected, setInspected] = useState<MatchRow | null>(null);

  const matches = useMemo(() => {
    if (!selectedSeason) return [];
    const search = query.toLowerCase().trim();
    if (!search) return selectedSeason.matches;
    return selectedSeason.matches.filter(
      (m) =>
      m.home_team.toLowerCase().includes(search) || m.away_team.toLowerCase().includes(search)
    );
  }, [selectedSeason, query]);

  return (
    <Panel>
      <PanelHeader>
        <div className="flex flex-wrap items-center gap-3">
          <PanelTitle>Szezon mérkőzésnapló &amp; WinMix Pipeline v2 javaslatok</PanelTitle>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true" />
            
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Keresés csapatnévre…"
              aria-label="Keresés csapatnévre a mérkőzésnaplóban"
              className="field h-8 w-[210px] pl-8 text-[12px]" />
            
          </div>
        </div>
        <Chip>
          {matches.length} / {selectedSeason?.matches.length ?? 0} meccs
        </Chip>
      </PanelHeader>

      <TableScroll>
        <Table minWidth={1180}>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Időpont</Th>
              <Th align="right">Hazai csapat</Th>
              <Th align="center">FT</Th>
              <Th>Vendég csapat</Th>
              <Th align="center">Data Suff.</Th>
              <Th align="center">B1 Poisson</Th>
              <Th align="center">M1 LogReg</Th>
              <Th align="center" className="text-signal">
                WinMix Ens. (Calib)
              </Th>
              <Th align="center">Confidence</Th>
              <Th align="center">Javaslat</Th>
              <Th align="center">Audit</Th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {matches.length === 0 ?
            <EmptyRow colSpan={12}>
                {selectedSeason ?
              'Nincs a keresésnek megfelelő mérkőzés.' :
              'Nincs betöltött mérkőzés.'}
              </EmptyRow> :

            matches.map((m) => {
              const p = m.pipeline;
              if (!p) return null;
              return (
                <Tr key={`${m.match_no}-${m.home_team}`}>
                    <Td className="text-muted-foreground">{m.match_no}</Td>
                    <Td className="text-muted-foreground">{m.date}</Td>
                    <Td align="right" className="font-sans font-bold text-foreground">
                      {m.home_team}
                    </Td>
                    <Td align="center" className="font-extrabold">
                      <span className="rounded-sm bg-elevated px-2 py-1">
                        {m.home_score} - {m.away_score}
                      </span>
                    </Td>
                    <Td className="font-sans font-bold text-foreground">{m.away_team}</Td>
                    <Td align="center">
                      <SufficiencyBadge level={p.context.dataSufficiency} />
                    </Td>
                    <Td align="center" className="text-muted-foreground">
                      {triple(p.b1)}
                    </Td>
                    <Td align="center" className="text-chart-3">
                      {triple(p.m1)}
                    </Td>
                    <Td align="center" className="font-extrabold text-signal">
                      {triple(p.calibrated)}
                    </Td>
                    <Td align="center">
                      <ConfidenceBadge score={p.confidence} label={p.confidenceLabel} />
                    </Td>
                    <Td align="center">
                      <RecommendationLabel value={p.recommendation} />
                    </Td>
                    <Td align="center">
                      <button
                      type="button"
                      className="btn btn--outline btn--sm text-[10px]"
                      onClick={() => setInspected(m)}>
                      
                        Audit
                      </button>
                    </Td>
                  </Tr>);

            })
            }
          </tbody>
        </Table>
      </TableScroll>

      {inspected ?
      <MatchInspectorModal match={inspected} onClose={() => setInspected(null)} /> :
      null}
    </Panel>);

}