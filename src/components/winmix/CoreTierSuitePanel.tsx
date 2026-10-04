import React, { useMemo } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { runCoreTierSuite } from '../../utils/coreTierTests';
import { Collapsible } from './Collapsible';
import { EmptyRow, Table, TableScroll, Td, Th, Tr } from './DataTable';

/**
 * The Core tiering contract, verified on the operator's own build.
 *
 * The quadrant stopped being a hard Core entry gate and became a selection
 * tier: `volatile` candidates now fill Secondary Core cards instead of being
 * refused outright. Three properties make that safe, and none of them is
 * visible on a normal round — a Core card looks the same whether the ordering
 * invariant holds or not. They are pinned here as an executable suite: every
 * strict exclusion still excludes, a Secondary line can never displace an
 * available Primary one, and a thin round yields fewer cards rather than a
 * force-filled set.
 */
export function CoreTierSuitePanel() {
  const suite = useMemo(() => runCoreTierSuite(), []);

  return (
    <Collapsible
      title="Core szintezés (elsődleges / másodlagos) tesztek"
      subtitle={
      suite.passed ?
      `${suite.total}/${suite.total} eset rendben · ${suite.ruleVersion}` :
      `${suite.failed} HIBÁS eset — a core kiválasztás szerződése sérült`
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
          'Cselekvőképes → elsődleges core · volatilis → másodlagos core · lapos és elvetendő továbbra is kizárva. A hideg minta, a stabilitási padló, a cáfolt sáv és a modell-konfliktus kemény kizárás maradt, a másodlagos sor sosem szorít ki elérhető elsődlegest, és nincs kényszerkitöltés.' :
          'A szintezés nem a szerződés szerint működik — a core kártyák kiválasztása addig NEM megbízható.'}
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