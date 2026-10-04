import React, { useMemo } from 'react';
import { Star } from 'lucide-react';
import { Panel, PanelHeader, PanelTitle } from './Panel';
import { EmptyRow, Table, TableScroll, Td, TdLabel, Th, Tr } from './DataTable';
import { marqueeHistoryRows } from '../../utils/marqueePairs';
import type { MarqueeStore } from '../../utils/marqueePairs';
import type { League } from '../../types/winmix';

/**
 * RANGADÓ-TÁBLA — körökön átívelő nézet. A jelölések körhöz kötve maradnak
 * meg, így itt a MÚLT körök rangadói is látszanak, nem csak az aktuálisé.
 * A tábla kizárólag megjelenít: sem kaput, sem mért értéket nem befolyásol.
 */
export function MarqueeRoundsTable({
  store,
  league,
  displayOf






}: {store: MarqueeStore;league?: League | null;displayOf?: (key: string) => string;}) {
  const rows = useMemo(() => marqueeHistoryRows(store, league), [store, league]);
  const name = (key: string): string => displayOf?.(key) ?? key;

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle as="h3">Rangadók körönként</PanelTitle>
        <span className="text-ui-xs text-muted-foreground">
          {rows.length} jelölés · {store.rounds.length} nyilvántartott kör
        </span>
      </PanelHeader>

      <TableScroll>
        <Table minWidth={620}>
          <thead>
            <tr>
              <Th>Kör</Th>
              <Th>Liga</Th>
              <Th>Hazai → Vendég</Th>
              <Th align="right">Rögzítve</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ?
            <EmptyRow colSpan={4}>
                <span className="flex flex-col items-center gap-2">
                  <Star className="h-5 w-5 text-muted-foreground/50" aria-hidden={true} />
                  <span>Még egyetlen körben sincs rangadóként megjelölt párosítás.</span>
                </span>
              </EmptyRow> :

            rows.map((row) =>
            <Tr key={`${row.roundId}::${row.league}::${row.homeKey}::${row.awayKey}`}>
                  <TdLabel>
                    {row.roundName}
                    {row.isCurrentRound ?
                <span className="ml-2 rounded border border-signal/40 bg-signal/15 px-1.5 py-0.5 font-sans text-ui-2xs text-signal">
                        aktuális
                      </span> :
                null}
                  </TdLabel>
                  <Td className="font-sans">{row.league}</Td>
                  <Td className="font-sans">
                    {name(row.homeKey)} → {name(row.awayKey)}
                  </Td>
                  <Td align="right" className="text-muted-foreground">
                    {row.createdAt ? row.createdAt.slice(0, 10) : '—'}
                  </Td>
                </Tr>
            )}
          </tbody>
        </Table>
      </TableScroll>
    </Panel>);

}
