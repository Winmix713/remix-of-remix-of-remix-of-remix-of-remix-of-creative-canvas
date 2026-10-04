import React, { useMemo } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { runCoreEvidenceSuite } from '../../utils/coreEvidenceTests';
import { EVIDENCE_COPY } from '../../utils/coreEvidence';
import { Collapsible } from './Collapsible';
import { EmptyRow, Table, TableScroll, Td, Th, Tr } from './DataTable';

const TONE_CLASS: Record<'positive' | 'warning' | 'negative', string> = {
  positive: 'text-positive',
  warning: 'text-chart-4',
  negative: 'text-negative'
};

/**
 * The core evidence lifecycle, verified on the operator's own build.
 *
 * The gate's whole correction is one inequality: "nincs elég mérés" is NOT "a
 * jelölt rossz". That distinction is invisible on a normal round — an empty core
 * card looks identical whether the cause is missing data or a real refusal — so
 * it is pinned here as an executable suite over a synthetic round that contains
 * all three states at once: a thin-but-good band, a measured and calibrated
 * band, and a measured and disproved band. It also proves the asymmetry the fix
 * rests on: a widened neighbour environment may confirm a line, never exclude
 * it.
 */
export function CoreEvidenceSuitePanel() {
  const suite = useMemo(() => runCoreEvidenceSuite(), []);

  return (
    <Collapsible
      title="Core evidencia-életciklus tesztek"
      subtitle={
      suite.passed ?
      `${suite.total}/${suite.total} eset rendben · minta-minimum ${suite.minSample} · ${suite.ruleVersion}` :
      `${suite.failed} HIBÁS ellenőrzés — a core-kapu szerződése sérült`
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
          `Kevés adat + jó egyéb jel → ${EVIDENCE_COPY.conditional.label} · elég adat + jó kalibráció → ${EVIDENCE_COPY.calibrated.label} · elég adat + rossz kalibráció → ${EVIDENCE_COPY.excluded.label}. A bővített szomszédos környezet megerősíthet, de nem zárhat ki, és cáfolat kizárólag a sor saját sávjából származhat.` :
          'Az evidencia-szintek nem a szerződés szerint állnak elő — a core-kártyák állítása addig NEM megbízható.'}
        </p>

        <TableScroll className="max-h-[360px]">
          <Table minWidth={860}>
            <thead>
              <tr>
                <Th>Eset</Th>
                <Th>Kötelező elvárás</Th>
                <Th align="center">Elvárt</Th>
                <Th align="center">Kapott</Th>
                <Th align="center">Indok</Th>
                <Th align="center">Megfigyelés</Th>
                <Th align="center">Sáv / környezet</Th>
                <Th align="center">Eredmény</Th>
              </tr>
            </thead>
            <tbody>
              {suite.cases.length === 0 ?
              <EmptyRow colSpan={8}>Nincs regisztrált teszteset.</EmptyRow> :

              suite.cases.map((testCase) =>
              <Tr key={testCase.label}>
                    <Td className="whitespace-normal font-sans text-foreground">
                      {testCase.label}
                    </Td>
                    <Td className="whitespace-normal font-sans text-muted-foreground">
                      {testCase.requirement}
                    </Td>
                    <Td align="center" className={TONE_CLASS[EVIDENCE_COPY[testCase.expected].tone]}>
                      {EVIDENCE_COPY[testCase.expected].label}
                    </Td>
                    <Td align="center" className={TONE_CLASS[EVIDENCE_COPY[testCase.actual].tone]}>
                      {EVIDENCE_COPY[testCase.actual].label}
                    </Td>
                    <Td align="center" className="font-mono text-[10px]">
                      {testCase.kind}
                    </Td>
                    <Td align="center" className="font-mono tabular-nums">
                      {testCase.observations} / {testCase.required}
                    </Td>
                    <Td align="center" className="font-mono">
                      {testCase.scope}
                      {testCase.widened ? ' (bővített)' : ''}
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

        <ul className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          {suite.gate.map((g) =>
          <li key={g.name} className="flex items-start gap-1.5">
              {g.passed ?
            <CheckCircle2
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive"
              aria-hidden={true} /> :


            <XCircle
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-negative"
              aria-hidden={true} />

            }
              <span className={g.passed ? undefined : 'text-negative'}>
                {g.name}
                {g.passed ? '' : ` → ${g.actual}`}
              </span>
            </li>
          )}
        </ul>
      </div>
    </Collapsible>);

}