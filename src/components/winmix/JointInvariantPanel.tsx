import React, { useMemo } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { runJointMatrixInvariantTests } from '../../utils/invariants';
import { Collapsible } from './Collapsible';
import { EmptyRow, Table, TableScroll, Td, Th, Tr } from './DataTable';

/**
 * RELEASE A — the joint-matrix invariant suite, run on the operator's own build.
 *
 * The team-goal probabilities are marginals of the same normalised score matrix
 * as BTTS and the Over/Under lines, so six identities hold by construction.
 * "By construction" is exactly what quietly stops being true after a refactor,
 * so the contract is pinned down as an executable test — over several lambda
 * pairs, both signs of the Dixon-Coles correction, and a lambda tending to zero
 * — instead of a developer-mode warning nobody reads.
 */
export function JointInvariantPanel() {
  const suite = useMemo(() => runJointMatrixInvariantTests(), []);

  return (
    <Collapsible
      title="Joint-mátrix invariáns tesztek"
      subtitle={
      suite.passed ?
      `${suite.total}/${suite.total} eset rendben (tolerancia ${suite.tolerance.toExponential(0)})` :
      `${suite.failed}/${suite.total} eset HIBÁS`
      }>
      
      <div className="flex flex-col gap-2 px-3 py-3 sm:px-4">
        <p
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-[11px] ${
          suite.passed ?
          'border-positive/30 bg-positive-soft text-positive' :
          'border-negative/35 bg-negative-soft text-negative'}`
          }>
          
          {suite.passed ?
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden={true} /> :

          <XCircle className="h-4 w-4 shrink-0" aria-hidden={true} />
          }
          {suite.passed ?
          'homeOver05 + homeUnder05 = 1 · awayOver05 + awayUnder05 = 1 · bttsYes ≤ mindkét 0.5+ · under 0.5 ≥ P(0-0) · Σ mátrix = 1 · highGoalNoBtts ≤ cleanSheetBlowout ≤ bttsNo · a két kiütés-mező különbsége pontosan P(3-0) + P(0-3) — minden λ/ρ kombinációra teljesül.' :
          'A mátrix szerződése sérült — a csapatgól-piacok NEM használhatók, amíg ez fennáll.'}
        </p>

        <TableScroll className="max-h-[320px]">
          <Table minWidth={620} className="font-mono tabular-nums">
            <thead>
              <tr>
                <Th>Eset</Th>
                <Th align="center">λ hazai</Th>
                <Th align="center">λ vendég</Th>
                <Th align="center">ρ</Th>
                <Th align="center">Ellenőrzés</Th>
                <Th align="center">Eredmény</Th>
              </tr>
            </thead>
            <tbody>
              {suite.cases.length === 0 ?
              <EmptyRow colSpan={6}>Nincs regisztrált teszteset.</EmptyRow> :

              suite.cases.map((testCase) =>
              <Tr key={testCase.label}>
                    <Td>
                      <span className="font-sans text-foreground">{testCase.label}</span>
                    </Td>
                    <Td align="center">{testCase.lambdaH}</Td>
                    <Td align="center">{testCase.lambdaA}</Td>
                    <Td align="center">{testCase.rho}</Td>
                    <Td align="center">{testCase.checks.length}</Td>
                    <Td
                  align="center"
                  className={testCase.passed ? 'text-positive' : 'text-negative'}>
                  
                      {testCase.passed ?
                  'OK' :
                  testCase.checks.
                  filter((c) => !c.passed).
                  map((c) => c.name).
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