import React, { useMemo } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { runCoreCanonicalSuite } from '../../utils/coreCanonicalTests';
import { Collapsible } from './Collapsible';
import { EmptyRow, Table, TableScroll, Td, Th, Tr } from './DataTable';

/**
 * Gate-first canonicalisation, verified on the operator's own build.
 *
 * Three populations decide a Core round — raw records, gate-passing records,
 * and the canonical one-per-(fixture, market) set — and the order matters: if
 * duplicates are collapsed BEFORE the hard gates run, a gated record can
 * silently delete a gate-passing sibling and leave a Core card empty. Cases
 * A–H pin that order, the population invariant, and the counting scopes.
 */
export function CoreCanonicalSuitePanel() {
  const suite = useMemo(() => runCoreCanonicalSuite(), []);

  return (
    <Collapsible
      title="Core kanonikus populációk (kapu-először) tesztek"
      subtitle={
      suite.passed ?
      `${suite.total}/${suite.total} eset rendben · ${suite.ruleVersion}` :
      `${suite.failed} HIBÁS eset — a kanonikus kiválasztás szerződése sérült`
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
          'A kemény kapuk ELŐBB futnak, mint a duplikátum-összevonás: kapun kívüli rekord nem nyomhat el kapun belülit, egy mérkőzés legfeljebb egy core kártyát kap, és a kártyára került ⊆ kanonikus jogosult ⊆ nyers rekordok invariáns minden lépésnél tartja magát.' :
          'A kanonikus populációk nem a szerződés szerint állnak elő — a core kártyák számlálói és kiválasztása addig NEM megbízható.'}
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
