import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MARKET_FEEDBACK_GAP_PP, MARKET_FEEDBACK_MIN_N } from '../../utils/constants';
import {
  marketFeedbackRows,
  type MarketFeedback,
  type MarketFeedbackRow } from
'../../utils/ledger';
import { EmptyRow, Table, TableScroll, Td, Th, Tr } from './DataTable';
import { Panel, PanelHeader, PanelSubtitle, PanelTitle } from './Panel';

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function gapTone(row: MarketFeedbackRow): string {
  if (row.n === 0) return 'text-muted-foreground';
  if (row.warn) return 'text-negative';
  if (row.outsideInterval) return 'text-chart-4';
  return 'text-positive';
}

function verdict(row: MarketFeedbackRow): React.ReactNode {
  if (row.n === 0) {
    return <span className="text-muted-foreground">nincs lezárt tipp</span>;
  }
  if (row.warn) {
    return <span className="font-bold text-negative">szisztematikus torzítás</span>;
  }
  if (row.n < MARKET_FEEDBACK_MIN_N) {
    return (
      <span className="text-muted-foreground">
        minta &lt; {MARKET_FEEDBACK_MIN_N}, nem értékelhető
      </span>);

  }
  if (Math.abs(row.gapPp) > MARKET_FEEDBACK_GAP_PP) {
    return <span className="text-chart-4">eltérés a hibahatáron belül</span>;
  }
  return <span className="text-positive">konzisztens</span>;
}

function warningText(row: MarketFeedbackRow): string {
  const gap = Math.abs(row.gapPp).toFixed(1);
  return row.direction === 'over' ?
  `${row.label}: a modell szisztematikusan ${gap} pp-tal TÚLJELZI, ${row.n} lezárt tippen. ` +
  `A liga Poisson lambda becslései felfelé torzíthatnak. Kompenzáció: a Csapatsúlyok ` +
  `oldalon állítsd lejjebb az érintett csapatok súlyát.` :
  `${row.label}: a modell szisztematikusan ${gap} pp-tal ALULJELZI, ${row.n} lezárt tippen. ` +
  `A liga Poisson lambda becslései lefelé torzíthatnak. Kompenzáció: a Csapatsúlyok ` +
  `oldalon állítsd feljebb az érintett csapatok súlyát.`;
}

/**
 * PHASE 6 — the closed feedback loop's surface.
 *
 * The ledger knows whether each line won; this panel is where that knowledge
 * finally meets the model. For every market it puts the mean SIGNALLED
 * probability next to the MEASURED hit rate, with a Wilson 95% interval on the
 * observed rate — a hit rate on 11 settled lines without an interval is
 * precisely the false confidence this build exists to remove.
 *
 * The warning banner fires only when all three conditions hold:
 * `|gap| > MARKET_FEEDBACK_GAP_PP` AND `n >= MARKET_FEEDBACK_MIN_N` AND the
 * signalled average lies outside the observed Wilson interval.
 *
 * READ-ONLY with respect to model parameters (hard invariant 5): it never
 * mutates a lambda, a baseline or a weight. It reports; the operator decides.
 */
export function MarketFeedbackPanel({
  feedback,
  className



}: {feedback: MarketFeedback;className?: string;}) {
  const rows = React.useMemo(() => marketFeedbackRows(feedback), [feedback]);
  const settled = rows.reduce((acc, r) => acc + r.n, 0);
  const warnings = rows.filter((r) => r.warn);

  return (
    <Panel className={className}>
      <PanelHeader>
        <div>
          <PanelTitle>Piaci visszacsatolás (zárt hurok, csak diagnosztika)</PanelTitle>
          <PanelSubtitle>
            {`Piaconként: mennyit jelzett a modell, és mennyi lett belőle valóban a Tipp Naplóban. Figyelmeztetés csak akkor, ha |eltérés| > ${MARKET_FEEDBACK_GAP_PP} pp ÉS n ≥ ${MARKET_FEEDBACK_MIN_N} ÉS a jelzett átlag a Wilson-intervallumon kívül esik. A panel egyetlen modellparamétert sem módosít.`}
          </PanelSubtitle>
        </div>
      </PanelHeader>

      <TableScroll>
        <Table minWidth={880} className="font-mono tabular-nums">
          <thead>
            <tr>
              <Th>Piac</Th>
              <Th align="center">Jelzett átlag</Th>
              <Th align="center">Tényleges beválás</Th>
              <Th align="center">Eltérés (Gap)</Th>
              <Th align="center">Lezárt tipp (n)</Th>
              <Th align="center">Wilson 95% CI</Th>
              <Th align="center">Állapot</Th>
            </tr>
          </thead>
          <tbody>
            {settled === 0 ?
            <EmptyRow colSpan={7}>
                Még nincs lezárt szelvénysor — rögzíts eredményeket a Tipp Naplóban, és a
                visszacsatolás azonnal megjelenik itt.
              </EmptyRow> :

            rows.map((row) =>
            <Tr key={row.key}>
                  <Td>
                    <span className="font-sans font-bold text-foreground">{row.label}</span>
                  </Td>
                  <Td align="center">{row.n === 0 ? '—' : pct(row.predicted)}</Td>
                  <Td align="center" className="font-bold text-foreground">
                    {row.n === 0 ? '—' : pct(row.observed)}
                  </Td>
                  <Td align="center" className={cn('font-bold', gapTone(row))}>
                    {row.n === 0 ?
                '—' :
                `${row.gapPp >= 0 ? '+' : ''}${row.gapPp.toFixed(1)} pp`}
                  </Td>
                  <Td align="center">
                    {row.n} {row.n > 0 ? <span className="text-muted-foreground">({row.hits} nyert)</span> : null}
                  </Td>
                  <Td align="center" className="text-[11px] text-muted-foreground">
                    {row.n === 0 ? 'nincs adat' : `${pct(row.ci.lo)} – ${pct(row.ci.hi)}`}
                  </Td>
                  <Td align="center" className="text-[11px]">
                    {verdict(row)}
                  </Td>
                </Tr>
            )
            }
          </tbody>
        </Table>
      </TableScroll>

      {warnings.length > 0 ?
      <div className="flex flex-col gap-2 border-t border-border px-4 py-3" role="status">
          {warnings.map((row) =>
        <div
          key={row.key}
          className="flex items-start gap-2 rounded-md border border-negative/30 bg-negative-soft px-3 py-2">
          
              <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-negative"
            aria-hidden="true" />
          
              <p className="text-[11.5px] leading-relaxed text-foreground">{warningText(row)}</p>
            </div>
        )}
        </div> :
      settled > 0 ?
      <div className="border-t border-border px-4 py-3">
          <p className="text-[11.5px] text-muted-foreground">
            Nincs olyan piac, amelynél a jelzett átlag mind a három feltételt kimerítve kilépne a
            mért beválás hibahatárából. A modell szintjén nincs kimutatható szisztematikus
            torzítás.
          </p>
        </div> :
      null}
    </Panel>);

}