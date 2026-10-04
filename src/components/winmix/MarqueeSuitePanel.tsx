import React, { useMemo } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { runMarqueeSuite } from '../../utils/marqueePairsTests';
import { Collapsible } from './Collapsible';
import { EmptyRow, Table, TableScroll, Td, Th, Tr } from './DataTable';

/**
 * The marquee-pair (RANGADÓ) ranking contract, verified on the operator's own
 * build. The label alone never penalises, a thin sample never penalises, the
 * verdict never excludes, other markets are bit-identical, and while the
 * shadow flag is off the ordering does not move at all — none of which is
 * visible on a normal round.
 */
export function MarqueeSuitePanel() {
  const suite = useMemo(() => runMarqueeSuite(), []);

  return (
    <Collapsible
      title="Rangadó (büntetőpont) rangsor-tesztek"
      subtitle={
      suite.passed ?
      `${suite.total}/${suite.total} eset rendben · ${suite.ruleVersion} · ${
      suite.shadowActive ? 'ÉLES' : 'árnyék mód'}` :
      `${suite.failed} HIBÁS eset — a rangadó rangsor-szerződés sérült`
      }>
      
      <div className="flex flex-col gap-2 px-3 py-3 sm:px-4">
        <p
          className={`flex items-start gap-1.5 rounded-md border px-2.5 py-2 text-[11px] ${
          suite.passed ?
          'border-positive/30 bg-positive-soft text-positive' :
          'border-negative/35 bg-negative-soft text-negative'}`
          }>
          
          {suite.passed ?
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden={true} /> :

          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden={true} />
          }
          {suite.passed ?
          'A rangadó-címke önmagában nem büntet · kis mintán soha nincs korrekció · a verdikt sosem zár ki sort · a nem-BTTS piacok bitre azonosak · árnyék módban a sorrend változatlan.' :
          'A rangadó-korrekció nem a szerződés szerint működik — a rangsor addig NEM megbízható.'}
        </p>

        <TableScroll className="max-h-[360px]">
          <Table minWidth={720}>
            <thead>
              <tr>
                <Th>Eset</Th>
                <Th>Kötelező elvárás</Th>
                <Th align="center">Eredmény</Th>
              </tr>
            </thead>
            <tbody>
              {suite.cases.length === 0 ?
              <EmptyRow colSpan={3}>Nincs regisztrált teszteset.</EmptyRow> :

              suite.cases.map((testCase) =>
              <Tr key={testCase.label}>
                    <Td className="whitespace-normal font-sans text-foreground">
                      {testCase.label}
                    </Td>
                    <Td className="whitespace-normal font-sans text-muted-foreground">
                      {testCase.requirement}
                    </Td>
                    <Td
                  align="center"
                  className={testCase.passed ? 'text-positive' : 'text-negative'}>
                  
                      {testCase.passed ?
                  'OK' :
                  testCase.checks.
                  filter((c) => !c.passed).
                  map((c) => `${c.name} → ${c.actual}`).
                  join(', ')}
                    </Td>
                  </Tr>
              )
              }
            </tbody>
          </Table>
        </TableScroll>
      </div>
    </Collapsible>);

}
