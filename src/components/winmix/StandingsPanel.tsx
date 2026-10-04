import React, { useMemo } from 'react';
import { useWinmix } from '../../contexts/WinmixContext';
import { computeStandings } from '../../utils/standings';
import { cn } from '../../lib/utils';
import {
  EmptyRow,
  Table,
  TableLegend,
  TableScroll,
  Td,
  TdLabel,
  TeamBadge,
  Th,
  Tr,
  type Zone } from
'./DataTable';
import { Panel, PanelHeader, PanelSubtitle, PanelTitle } from './Panel';

const LEGEND: {zone: Zone;label: string;}[] = [
{ zone: 'zone-1', label: 'Bajnokok Ligája' },
{ zone: 'zone-2', label: 'Európa Liga' },
{ zone: 'zone-3', label: 'Konferencia Liga' },
{ zone: 'zone-4', label: 'Kiesőzóna' }];


/** European / relegation bands, sized to the actual table length. */
function zoneOf(rank: number, total: number): Zone | undefined {
  if (rank <= 4) return 'zone-1';
  if (rank === 5) return 'zone-2';
  if (rank === 6) return 'zone-3';
  if (total >= 10 && rank > total - 3) return 'zone-4';
  return undefined;
}

export function StandingsPanel() {
  const { selectedSeason, teamWeights, teamAliasMap } = useWinmix();

  const rows = useMemo(() => {
    if (!selectedSeason) return [];
    return computeStandings(
      selectedSeason.matches,
      teamWeights[selectedSeason.league] ?? {},
      teamAliasMap[selectedSeason.league] ?? {}
    );
  }, [selectedSeason, teamWeights, teamAliasMap]);

  return (
    <Panel>
      <PanelHeader>
        <div className="flex flex-col gap-0.5">
          <PanelTitle>
            {selectedSeason ?
            `${selectedSeason.name} — Tabella` :
            'Bajnokság Tabella & Poisson Erősség'}
          </PanelTitle>
          <PanelSubtitle>
            {selectedSeason ?
            `${selectedSeason.matches.length} mérkőzés | Forrás: ${selectedSeason.fileName}` :
            'Húzz be egy CSV fájlt!'}
          </PanelSubtitle>
        </div>
      </PanelHeader>

      <TableScroll>
        <Table minWidth={840}>
          <colgroup>
            <col style={{ width: 52 }} />
            <col />
            <col style={{ width: 48 }} />
            <col style={{ width: 48 }} />
            <col style={{ width: 48 }} />
            <col style={{ width: 48 }} />
            <col style={{ width: 72 }} />
            <col style={{ width: 56 }} />
            <col style={{ width: 60 }} />
            <col style={{ width: 68 }} />
            <col style={{ width: 200 }} />
          </colgroup>
          <thead>
            <tr>
              <Th align="center">#</Th>
              <Th className="pl-4">Csapat</Th>
              <Th align="center">M</Th>
              <Th align="center">GY</Th>
              <Th align="center">D</Th>
              <Th align="center">V</Th>
              <Th align="center">Gólok</Th>
              <Th align="center">GK</Th>
              <Th align="center" sortable sortDirection="desc" className="text-foreground">
                Pont
              </Th>
              <Th align="center">Súly (W)</Th>
              <Th align="right" className="pr-4">
                Venue erősség (H/A Att)
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ?
            <EmptyRow colSpan={11}>Nincs betöltött bajnokság.</EmptyRow> :

            rows.map((row, idx) => {
              const rank = idx + 1;
              const gd = row.gf - row.ga;
              const zone = zoneOf(rank, rows.length);
              return (
                <Tr
                  key={row.key}
                  dividerBelow={rank === 4 || rank === 6 || rank === rows.length - 3}>
                  
                    <Td align="center" zone={zone} className="text-[13px] text-muted-foreground">
                      {rank}
                    </Td>
                    <TdLabel className="pl-4">
                      <span className="flex items-center gap-2.5">
                        <TeamBadge name={row.displayName} />
                        <span className="truncate text-[14px]">{row.displayName}</span>
                      </span>
                    </TdLabel>
                    <Td align="center">{row.played}</Td>
                    <Td align="center">{row.wins}</Td>
                    <Td align="center">{row.draws}</Td>
                    <Td align="center">{row.losses}</Td>
                    <Td align="center">
                      {row.gf}:{row.ga}
                    </Td>
                    <Td
                    align="center"
                    className={cn(
                      gd > 0 ?
                      'text-positive' :
                      gd < 0 ?
                      'text-negative' :
                      'text-muted-foreground'
                    )}>
                    
                      {gd > 0 ? `+${gd}` : gd}
                    </Td>
                    <Td align="center" className="font-semibold text-foreground">
                      {row.points}
                    </Td>
                    <Td align="center" className="text-chart-3">
                      {row.weight.toFixed(1)}
                    </Td>
                    <Td align="right" className="pr-4">
                      {row.homeAtt.toFixed(2)} (H) / {row.awayAtt.toFixed(2)} (A)
                    </Td>
                  </Tr>);

            })
            }
          </tbody>
        </Table>
      </TableScroll>

      {rows.length > 0 ? <TableLegend items={LEGEND} /> : null}
    </Panel>);

}