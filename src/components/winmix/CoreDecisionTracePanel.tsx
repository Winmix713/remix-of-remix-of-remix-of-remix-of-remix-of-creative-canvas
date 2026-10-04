import React, { useMemo } from 'react';
import { ClipboardCopy, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import {
  CORE_GATE_REGISTRY,
  buildCoreTrace,
  traceToText,
  type CoreGateEffect,
  type CoreTraceCandidate,
  type CoreTraceLevelTally,
  type CoreTracePopulations } from
'../../utils/coreTrace';
import type { StrategyReadout } from '../../utils/slip';
import type { FixtureAnalysis } from '../../types/winmix';
import { EVIDENCE_COPY } from '../../utils/coreEvidence';
import { Collapsible } from './Collapsible';
import { EmptyRow, Table, TableScroll, Td, Th, Tr } from './DataTable';

/**
 * THE FULL CORE DECISION TRACE, on the operator's own run.
 *
 * A round can produce twelve BTTS lines and still fill 0 / 3 core cards. Until
 * now the surface answered that with a sentence; this answers it with the
 * derivation — the funnel, the ordered gate chain with its real files and
 * thresholds, one row per candidate with every gated value side by side, a
 * per-candidate proof for each disproved band including its Wilson bounds, and
 * the reconciliation of conditional rows inside versus outside the strategy's
 * market (two different denominators that must never look like a contradiction).
 *
 * It adds no gate and changes no verdict: every value is re-read from the same
 * production functions that built the cards.
 */

interface CoreDecisionTracePanelProps {
  analyses: FixtureAnalysis[];
  readout: StrategyReadout | null;
  /** The strategy's market codes — the family the trace is about. */
  familyCodes: string[];
  /** Does the active strategy consult the blowout profile filter? */
  profileVeto: boolean;
}

const EFFECT_COPY: Record<CoreGateEffect, {label: string;className: string;}> = {
  hard: { label: 'Kizárás', className: 'text-negative' },
  conditional_hard: { label: 'Feltételes kizárás', className: 'text-chart-4' },
  scope: { label: 'Jelölt-kör', className: 'text-muted-foreground' },
  rank: { label: 'Csak rangsor', className: 'text-signal' },
  display: { label: 'Csak megjelenítés', className: 'text-muted-foreground' }
};

function pct(value: number | null | undefined, digits = 1): string {
  return typeof value === 'number' && Number.isFinite(value) ?
  `${(value * 100).toFixed(digits)}%` :
  '—';
}

function SubHeading({ children }: {children: React.ReactNode;}) {
  return (
    <h4 className="mt-1 font-mono text-[10px] font-bold uppercase tracking-label text-muted-foreground">
      {children}
    </h4>);

}

function evidenceTone(row: CoreTraceCandidate): string {
  const tone = EVIDENCE_COPY[row.evidence].tone;
  return tone === 'positive' ? 'text-positive' : tone === 'warning' ? 'text-chart-4' : 'text-negative';
}

function TallyCard({
  title,
  tally,
  note,
  tone





}: {title: string;tally: CoreTraceLevelTally;note: string;tone: 'signal' | 'default' | 'muted';}) {
  const shell =
  tone === 'signal' ?
  'border-signal/30 bg-signal/[0.07]' :
  tone === 'default' ?
  'border-border bg-background/60' :
  'border-border bg-background/30';
  return (
    <div className={`flex flex-col gap-1 rounded-md border px-3 py-2 ${shell}`}>
      <p className="font-mono text-[10px] font-bold uppercase tracking-label text-foreground">
        {title}
      </p>
      <p className="font-mono text-[11px] tabular-nums">
        <span className="text-positive">{tally.calibrated} kalibrált</span>
        <span className="text-muted-foreground"> · </span>
        <span className="text-chart-4">{tally.conditional} feltételes</span>
        <span className="text-muted-foreground"> · </span>
        <span className="text-negative">{tally.excluded} kizárt</span>
      </p>
      <p className="text-[10px] leading-relaxed text-muted-foreground">{note}</p>
    </div>);

}

/**
 * The four ordered populations of one Core run, on one strip:
 * raw → inside the gates → canonical → placed on a card.
 * Each segment names its own set, so the numbers can never read as a
 * contradiction of one another.
 */
function PopulationBar({ populations }: {populations: CoreTracePopulations;}) {
  const steps = [
  {
    key: 'raw',
    label: 'Nyers rekord',
    value: populations.rawRecords,
    note: 'A stratégia piacának minden sora, kapun belül és kívül.',
    className: 'border-border bg-background/50 text-muted-foreground'
  },
  {
    key: 'gated',
    label: 'Kapun belüli (nyers)',
    value: populations.afterActiveProfileVetoRaw,
    note: 'Minden aktív kemény kapun átjutott NYERS rekord, még összevonás előtt.',
    className: 'border-border bg-background/70 text-foreground'
  },
  {
    key: 'canonical',
    label: 'Kanonikus jogosult',
    value: populations.canonicalEligible,
    note: `Mérkőzés + piac szerint összevonva — ${populations.mergedEligibleDuplicates} rekord olvadt be.`,
    className: 'border-signal/30 bg-signal/[0.07] text-foreground'
  },
  {
    key: 'placed',
    label: 'Core kártyán',
    value: populations.placed,
    note: 'A kártyákat ténylegesen elfoglaló kanonikus sorok.',
    className: 'border-positive/30 bg-positive-soft text-positive'
  }];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-stretch">
        {steps.map((step, index) =>
        <React.Fragment key={step.key}>
            <div
            className={`flex min-w-0 flex-1 flex-col gap-0.5 rounded-md border px-2.5 py-1.5 ${step.className}`}>
            
              <span className="font-mono text-[9px] font-bold uppercase tracking-label">
                {step.label}
              </span>
              <span className="font-mono text-[15px] font-bold tabular-nums">
                {step.value}
              </span>
              <span className="text-[9px] leading-snug text-muted-foreground">{step.note}</span>
            </div>
            {index < steps.length - 1 ?
          <span
            aria-hidden={true}
            className="hidden shrink-0 self-center px-0.5 font-mono text-[11px] text-muted-foreground sm:block">
            
                →
              </span> :
          null}
          </React.Fragment>
        )}
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Négy külön populáció, ebben a sorrendben: nyers → kapun belüli → kanonikus →
        összevont/kártyára került. Egyik szám sem helyettesíthető a másikkal, és a
        csökkenés minden lépésnél megnevezett okból történik.
      </p>
    </div>);

}

/** The one-line Wilson verdict of a row, spelled out. */
function wilsonVerdict(row: CoreTraceCandidate): {text: string;className: string;} {
  if (row.ciLo === null || row.ciHi === null) {
    return {
      text: `nincs intervallum (n = ${row.observations} / ${row.required})`,
      className: 'text-chart-4'
    };
  }
  if (row.outsideInterval === null) {
    return { text: 'nincs jelzett érték', className: 'text-chart-4' };
  }
  return row.outsideInterval ?
  { text: 'jelzett érték KÍVÜL → cáfolt', className: 'text-negative' } :
  { text: 'jelzett érték BELÜL → igazolt', className: 'text-positive' };
}

export function CoreDecisionTracePanel({
  analyses,
  readout,
  familyCodes,
  profileVeto
}: CoreDecisionTracePanelProps) {
  const trace = useMemo(
    () =>
    readout ?
    buildCoreTrace({ analyses, readout, familyCodes, profileVeto }) :
    null,
    [analyses, readout, familyCodes, profileVeto]
  );

  if (!trace) {
    return (
      <Collapsible
        title="Core decision trace — teljes levezetés"
        subtitle="Nincs elérhető trace"
        defaultOpen={true}>
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <GitBranch className="h-8 w-8 text-muted-foreground" aria-hidden={true} />
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Még nincs core decision trace. Ez a panel a core kártyák
            felépítésének minden lépését megmutatja — a tölcsértől a kapun
            keresztül a kártyára kerülésig. A trace akkor jelenik meg, amikor
            a stratégia futtatása eredményt ad.
          </p>
        </div>
      </Collapsible>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(traceToText(trace));
      toast.success('A teljes core decision trace a vágólapon.');
    } catch {
      toast.error('A vágólap nem elérhető ebben a környezetben.');
    }
  };

  return (
    <Collapsible
      title="Core decision trace — teljes levezetés"
      subtitle={`${trace.fixtures} meccs · ${trace.patternsTotal} piaci sor · ${trace.candidates.length} jelölt · ${trace.coreFilled} / ${trace.coreSlots} kártya`}
      defaultOpen={trace.coreFilled === 0}>
      
      <div className="flex min-w-0 flex-col gap-4 px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
            Minden érték ugyanabból a függvényből származik, amely a kártyákat is
            felépítette (<span className="font-mono">gateFailuresForKind</span>,{' '}
            <span className="font-mono">coreQualityFailures</span>,{' '}
            <span className="font-mono">resolveCoreEvidence</span>). Ez a nézet nem
            vezet be új kaput és nem módosít verdiktet — ha a trace és a kártyák
            ellentmondanak, a trace a hibás.
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background/60 px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-label text-foreground transition-colors hover:bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal">
            
            <ClipboardCopy className="h-3.5 w-3.5" aria-hidden={true} />
            Trace másolása
          </button>
        </div>

        {/* --- 0. Counter reconciliation ----------------------------------- */}
        <SubHeading>0. Core-eredmény — három populáció, három számláló</SubHeading>
        <PopulationBar populations={trace.populations} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <TallyCard
            title={`Core kártyára került: ${trace.coreFilled} / ${trace.coreSlots}`}
            tally={trace.evidenceTally.placed}
            note="Csak a három kártyát elfoglaló sorok."
            tone="signal" />
          
          <TallyCard
            title={`Core-ra jogosult: ${trace.evidenceTally.eligible.total}`}
            tally={trace.evidenceTally.eligible}
            note="A teljes szigorú kapun belüli jelöltek. A core összesítő fejléce EZT számolja."
            tone="default" />
          
          <TallyCard
            title={`Összes vizsgált jelölt: ${trace.evidenceTally.raw.total}`}
            tally={trace.evidenceTally.raw}
            note="A stratégia piacának minden sora, kapun belül és kívül. A lenti táblázat EZT listázza."
            tone="muted" />
          
        </div>
        <p className="rounded-md border border-border bg-background/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Miért nem egy szám.</strong> Egy sor lehet
          „Kalibrált” (a saját sávja visszamért) ÉS ugyanakkor kapun kívüli (pl. a
          kvadráns miatt). Az evidencia-szint a MÉRÉSRŐL szól, a jogosultság a
          KAPUKRÓL — a kettő független, ezért három külön nevező van, és egyik sem
          nevezhető egyszerűen „kalibrált”-nak.
        </p>

        {/* --- 1–2. Funnel ------------------------------------------------- */}
        <SubHeading>1–2. Tölcsér: mérkőzéstől a kártyáig</SubHeading>
        <TableScroll className="max-h-none">
          <Table minWidth={720}>
            <thead>
              <tr>
                <Th>Lépés</Th>
                <Th align="center">Darab</Th>
                <Th align="center">Elveszett</Th>
                <Th>Mi történik itt</Th>
              </tr>
            </thead>
            <tbody>
              {trace.stages.map((stage) =>
              <Tr key={stage.id}>
                  <Td className="whitespace-normal font-sans text-foreground">
                    {stage.label}
                  </Td>
                  <Td align="center" className="font-bold text-foreground">
                    {stage.count}
                  </Td>
                  <Td
                  align="center"
                  className={stage.lost > 0 ? 'text-negative' : 'text-muted-foreground'}>
                  
                    {stage.lost > 0 ? `−${stage.lost}` : '0'}
                  </Td>
                  <Td className="whitespace-normal font-sans text-[11px] text-muted-foreground">
                    {stage.detail}
                  </Td>
                </Tr>
              )}
            </tbody>
          </Table>
        </TableScroll>

        <p className="rounded-md border border-border bg-background/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Fogalmak.</strong> „Piaci sor” = egy
          mérkőzés egy piacára készült pattern. „Jelölt” = piaci sor, amely a
          stratégia piacába tartozik. „Core-jelölt” = jelölt, amely a teljes szigorú
          kapun belül van. „Feltételes” = core-jelölt, amelynek saját sávja még nincs
          visszamérve (adathiány, nem cáfolat). „Kizárt” = megmért sáv cáfolta, core
          kártyára feltételesen sem kerülhet. „Core kártyára került” = a rangsor és az
          egy-mérkőzés szabály után a három hely valamelyikére jutott.
        </p>

        {/* --- 3. Gate registry -------------------------------------------- */}
        <SubHeading>3. Kapu-nyilvántartás: mi zár ki és mi csak rangsorol</SubHeading>
        <TableScroll className="max-h-[420px]">
          <Table minWidth={1040}>
            <thead>
              <tr>
                <Th align="center">#</Th>
                <Th>Feltétel</Th>
                <Th>Fájl és függvény</Th>
                <Th>Küszöb</Th>
                <Th align="center">Hatás</Th>
                <Th>Miért létezik</Th>
              </tr>
            </thead>
            <tbody>
              {CORE_GATE_REGISTRY.map((gate) =>
              <Tr key={gate.id}>
                  <Td align="center">{gate.step}</Td>
                  <Td className="whitespace-normal font-sans text-foreground">{gate.name}</Td>
                  <Td className="whitespace-normal text-[10px] text-muted-foreground">
                    {gate.file}
                    <span className="block opacity-70">{gate.fn}</span>
                  </Td>
                  <Td className="whitespace-normal text-[10px] text-foreground">
                    {gate.threshold}
                  </Td>
                  <Td align="center" className={EFFECT_COPY[gate.effect].className}>
                    {EFFECT_COPY[gate.effect].label}
                  </Td>
                  <Td className="whitespace-normal font-sans text-[11px] text-muted-foreground">
                    {gate.why}
                  </Td>
                </Tr>
              )}
            </tbody>
          </Table>
        </TableScroll>

        {/* --- 4. Candidate matrix ----------------------------------------- */}
        <SubHeading>
          4. Jelölt-mátrix — {trace.candidates.length} sor a stratégia piacából (
          {trace.familyCodes.join(', ') || '—'})
        </SubHeading>
        <TableScroll className="max-h-[520px]">
          <Table minWidth={1760}>
            <thead>
              <tr>
                <Th>Mérkőzés · jelölt-rekord</Th>
                <Th align="center">Modell</Th>
                <Th align="center">Súly. H2H</Th>
                <Th align="center">Stab.</Th>
                <Th align="center">Kish ESS</Th>
                <Th align="center">Kvadráns</Th>
                <Th align="center">Egyezés</Th>
                <Th align="center">Saját sáv</Th>
                <Th align="center">Auditált n · hits</Th>
                <Th align="center">Jelzett</Th>
                <Th align="center">Mért arány</Th>
                <Th align="center">Wilson</Th>
                <Th align="center">Evidencia</Th>
                <Th align="center">Kiütés-risk</Th>
                <Th align="center">Kapuk</Th>
                <Th align="center">Döntés</Th>
                <Th>Elsődleges ok</Th>
              </tr>
            </thead>
            <tbody>
              {trace.candidates.length === 0 ?
              <EmptyRow colSpan={17}>
                  Ebben a fordulóban egyetlen mérkőzés sem adott ilyen piaci sort.
                </EmptyRow> :

              trace.candidates.map((row) =>
              <Tr key={row.id} active={row.slot !== null}>
                    <Td className="whitespace-normal font-sans text-foreground">
                      {row.fixture}
                      <span className="mt-0.5 block font-mono text-[9px] text-muted-foreground">
                        {row.code} · {row.patternType}
                      </span>
                      <span className="block font-mono text-[9px] text-muted-foreground opacity-70">
                        id: {row.id}
                      </span>
                    </Td>
                    <Td align="center">{pct(row.modelProb)}</Td>
                    <Td align="center">{pct(row.h2hRate)}</Td>
                    <Td align="center">{row.stability.toFixed(0)}</Td>
                    <Td align="center">{row.ess.toFixed(2)}</Td>
                    {/* CORE TIERING — volatile is no longer a refusal: it is
                     the Secondary core tier, so it reads as caution, not as
                     an exclusion. Only flat/ignore are refused. */}
                    <Td
                  align="center"
                  className={
                  row.quadrant === 'actionable' ?
                  'text-positive' :
                  row.quadrant === 'volatile' ?
                  'text-chart-4' :
                  'text-negative'
                  }
                  title={
                  row.quadrant === 'actionable' ?
                  'Elsődleges core szint' :
                  row.quadrant === 'volatile' ?
                  'Másodlagos core szint — magasabb kockázat, de core-ra jogosult' :
                  'Core-ra nem jogosult kvadráns'
                  }>
                  
                      {row.quadrant}
                    </Td>
                    <Td align="center">{row.agreement}</Td>
                    <Td align="center">
                      {row.bandLabel ?? '—'}
                      {row.widened ?
                  <span className="block text-[9px] opacity-70">bővített</span> :
                  null}
                      <span className="block text-[9px] opacity-70">
                        {row.judgedBy === 'market' ? 'piacspecifikus' : 'globális 1X2'}
                      </span>
                    </Td>
                    <Td
                  align="center"
                  className={
                  row.observations >= row.required && row.required > 0 ?
                  'text-foreground' :
                  'text-chart-4'
                  }>
                  
                      {row.observations} / {row.required}
                      <span className="block text-[9px] opacity-70">
                        {row.hits === null ? 'hits: —' : `${row.hits} találat`}
                      </span>
                    </Td>
                    <Td align="center">{pct(row.signalledProb)}</Td>
                    <Td align="center">{pct(row.measuredRate)}</Td>
                    <Td align="center">
                      {row.ciLo === null || row.ciHi === null ?
                  '—' :
                  `${pct(row.ciLo)}–${pct(row.ciHi)}`}
                      <span
                    className={`block text-[9px] ${wilsonVerdict(row).className}`}>
                    
                        {wilsonVerdict(row).text}
                      </span>
                    </Td>
                    <Td align="center" className={evidenceTone(row)}>
                      {EVIDENCE_COPY[row.evidence].short}
                      <span className="block text-[9px] opacity-70">
                        {row.evidenceKind ?? '—'}
                      </span>
                    </Td>
                    <Td align="center">
                      {pct(row.blowoutHistorical, 0)} / {pct(row.blowoutModel, 0)}
                      {row.wouldVeto ?
                  <span className="block text-[9px] text-chart-4">megjelölve</span> :
                  null}
                    </Td>
                    <Td align="center" className="text-[10px]">
                      {row.gates.
                  filter((g) => !g.passed).
                  map((g) =>
                  <span
                    key={g.id}
                    className={`block ${g.binding ? 'text-negative' : 'text-muted-foreground line-through'}`}>
                    
                            {g.id}
                          </span>
                  )}
                      {row.gates.every((g) => g.passed) ?
                  <span className="text-positive">mind rendben</span> :
                  null}
                    </Td>
                    <Td
                  align="center"
                  className={
                  row.slot !== null ?
                  'text-signal' :
                  row.verdict === 'blocked' ?
                  'text-negative font-bold' :
                  row.verdict === 'gate_failed' ?
                  'text-negative' :
                  'text-muted-foreground'
                  }>
                  
                      {row.slot !== null ? `CORE ${row.slot}` : row.verdict}
                    </Td>
                    <Td className="whitespace-normal font-sans text-[11px] text-muted-foreground">
                      <strong className="text-foreground">{row.primaryCause}</strong> —{' '}
                      {row.primaryCauseDetail}
                    </Td>
                  </Tr>
              )
              }
            </tbody>
          </Table>
        </TableScroll>
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Az áthúzott kapu-név azt jelenti, hogy a feltétel ebben a futásban NEM
          kötelező érvényű (pl. a kiütés-profil ÁRNYÉK módban, vagy a modell–H2H
          konfliktus egy kalibrált sornál) — a sor tehát nem emiatt esett ki. A
          „Jelzett” a sávnak jelzett átlagos modell-valószínűség, a „Mért arány” a
          tényleges beválás ugyanabban a sávban: a kettő és a Wilson-korlátok együtt
          adják az evidencia-verdiktet, tehát a verdikt soronként ellenőrizhető.
        </p>

        {/* --- 4b. The quadrant gate, unfolded ----------------------------- */}
        <SubHeading>
          4b. Kvadráns-kapu — tengelyek, koordináták és a bukó feltétel
        </SubHeading>
        <dl className="grid grid-cols-1 gap-2 rounded-md border border-border bg-background/60 px-3 py-2 text-[11px] leading-relaxed lg:grid-cols-2">
          {[
          ['Hol számolódik', trace.quadrantDoc.computedIn],
          ['Hol rendelődik a sorhoz', trace.quadrantDoc.assignedIn],
          ['Hol lesz belőle kapu', trace.quadrantDoc.gatedIn],
          ['X tengely (P)', trace.quadrantDoc.xAxis],
          ['Y tengely (C)', trace.quadrantDoc.yAxis],
          ['Teljes boolean feltétel', trace.quadrantDoc.formula],
          ['Küszöbök', trace.quadrantDoc.thresholds],
          ['C képlete', trace.quadrantDoc.confidenceFormula]].
          map(([label, value]) =>
          <div key={label} className="min-w-0">
              <dt className="font-mono text-[9px] font-bold uppercase tracking-label text-muted-foreground">
                {label}
              </dt>
              <dd className="break-words font-mono text-[10px] text-foreground">{value}</dd>
            </div>
          )}
        </dl>
        <p className="rounded-md border border-chart-4/30 bg-chart-4/10 px-3 py-2 text-[11px] leading-relaxed text-chart-4">
          <strong>Miért kizáró kapu és nem rangsor-jel.</strong>{' '}
          {trace.quadrantDoc.whyHard}
        </p>
        <TableScroll className="max-h-[480px]">
          <Table minWidth={1500}>
            <thead>
              <tr>
                <Th>Mérkőzés · jelölt-rekord</Th>
                <Th align="center">Tengely-rendszer</Th>
                <Th align="center">P (súly. H2H) / pMin</Th>
                <Th align="center">C (konfidencia) / cMin</Th>
                <Th align="center">C bontása</Th>
                <Th align="center">Kvadráns</Th>
                <Th align="center">Melyik feltétel hamis</Th>
                <Th>Mi kell az actionable-höz</Th>
              </tr>
            </thead>
            <tbody>
              {trace.candidates.length === 0 ?
              <EmptyRow colSpan={8}>Nincs jelölt ebben a piacban.</EmptyRow> :

              trace.candidates.map((row) => {
                const q = row.quadrantExplain;
                return (
                  <Tr key={`q-${row.id}`} active={q.actionable}>
                      <Td className="whitespace-normal font-sans text-foreground">
                        {row.fixture}
                        <span className="mt-0.5 block font-mono text-[9px] text-muted-foreground">
                          {row.code} · {row.patternType}
                        </span>
                      </Td>
                      <Td align="center" className="text-[10px]">
                        {q.system === 'market' ? 'piacspecifikus' : '1X2 alapú'}
                        <span className="block text-[9px] opacity-70">{q.cSource}</span>
                      </Td>
                      <Td
                      align="center"
                      className={q.pOk ? 'text-positive' : 'text-negative'}>
                      
                        {pct(q.p)} / {pct(q.pMin, 0)}
                        <span className="block text-[9px] opacity-80">
                          {q.pOk ?
                        'teljesül' :
                        `hiányzik ${pct(q.pShortfall)}${
                        q.belowIgnoreFloor ?
                        ` · az ignore-padló (${pct(q.ignorePMax, 0)}) alatt` :
                        ''}`
                        }
                        </span>
                      </Td>
                      <Td
                      align="center"
                      className={q.cOk ? 'text-positive' : 'text-negative'}>
                      
                        {q.c} / {q.cMin}
                        <span className="block text-[9px] opacity-80">
                          {q.cOk ? 'teljesül' : `hiányzik ${q.cShortfall?.toFixed(0) ?? '—'} pont`}
                        </span>
                      </Td>
                      <Td align="center" className="text-[10px]">
                        {q.terms ?
                      <>
                            <span className="block">
                              élesség {q.terms.sharpness.toFixed(2)}
                            </span>
                            <span
                          className={`block ${
                          q.terms.sufficiency < 0.5 ? 'text-chart-4' : ''}`
                          }>
                          
                              elegendőség {q.terms.sufficiency.toFixed(2)}
                            </span>
                            <span
                          className={`block ${
                          q.terms.agreement < 0.5 ? 'text-negative' : ''}`
                          }>
                          
                              egyezés {q.terms.agreement.toFixed(2)}
                            </span>
                            <span className="block opacity-70">
                              |H2H−modell| {pct(q.terms.spread)}
                            </span>
                          </> :

                      '—'
                      }
                      </Td>
                      <Td
                      align="center"
                      className={q.actionable ? 'text-positive' : 'text-negative'}>
                      
                        {q.quadrant}
                        {q.consistent ? null :
                      <span className="block text-[9px] text-negative">
                            eltérés! újraszámolva: {q.recomputed}
                          </span>
                      }
                      </Td>
                      <Td align="center" className="text-[10px]">
                        {q.failing === 'none' ?
                      '—' :
                      q.failing === 'both' ?
                      'P ÉS C' :
                      q.failing === 'p' ?
                      'P (súlyozott H2H)' :
                      'C (konfidencia)'}
                      </Td>
                      <Td className="whitespace-normal font-sans text-[11px] text-muted-foreground">
                        {q.needed.note}
                      </Td>
                    </Tr>);

              })
              }
            </tbody>
          </Table>
        </TableScroll>
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          A kvadráns tengelyei NEM a modell valószínűsége és NEM a kalibráció. Egy
          2230 megfigyeléssel kalibrált sor is bukhat itt, mert a C tengely a
          MÉRKŐZÉS súlyozott előzményének elegendőségét és a modell–H2H
          egyirányúságát méri, nem a piac visszamért pontosságát. A két érték
          egymást nem helyettesíti — ez a kapu ezért nem lazul és nem szigorodik
          addig, amíg a fenti bontás alapján el nem dől, hogy melyik tengely a
          valódi szűk keresztmetszet.
        </p>

        {/* --- 4c. One fixture, several candidate records ------------------- */}
        {trace.duplicates.length > 0 ?
        <>
            <SubHeading>
              4c. Egy mérkőzés — több jelölt-rekord ({trace.duplicates.length} mérkőzés)
            </SubHeading>
            <div className="flex flex-col gap-2">
              {trace.duplicates.map((group) =>
            <div
              key={group.fixtureId}
              className="rounded-md border border-border bg-background/60 px-3 py-2">
              
                  <p className="text-[12px] font-semibold text-foreground">
                    {group.fixture}
                    <span className="ml-2 font-mono text-[9px] font-normal text-muted-foreground">
                      {group.fixtureId}
                    </span>
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {group.rows.map((row) =>
                <li
                  key={`dup-${row.id}`}
                  className={`rounded-sm border border-white/[0.06] px-2 py-1.5 font-mono text-[10px] text-muted-foreground ${
                  row.mergedInto ? 'bg-black/10 opacity-55' : 'bg-black/20'}`
                  }>
                  
                        <span className="block text-foreground">
                          {row.id}
                          {row.canonicalWinner ?
                    <span className="ml-2 rounded-sm border border-signal/30 px-1 py-px text-[9px] font-normal text-signal">
                              kanonikus nyertes
                            </span> :
                    null}
                        </span>
                        {row.mergedInto ?
                  <span className="block text-[9px] text-muted-foreground">
                            összevonva → {row.mergedInto}
                          </span> :
                  null}
                        kód {row.code} · generátor {row.patternType} · H2H{' '}
                        {pct(row.h2hRate)} · modell {pct(row.modelProb)} · ESS{' '}
                        {row.ess.toFixed(2)} · kvadráns {row.quadrant} · evidencia{' '}
                        {EVIDENCE_COPY[row.evidence].short} ·{' '}
                        <span
                    className={
                    row.slot !== null ? 'text-signal' : 'text-negative'
                    }>
                    
                          {row.slot !== null ? `CORE ${row.slot}` : row.primaryCause}
                        </span>
                        <span className="block opacity-70">{row.patternLabel}</span>
                      </li>
                )}
                  </ul>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                    {group.explanation}
                  </p>
                </div>
            )}
            </div>
          </> :
        null}

        {/* --- 5. Disproved bands ------------------------------------------ */}
        <SubHeading>
          5. Cáfolt sávok egyenkénti bizonyítása — {trace.disproved.length} sor
        </SubHeading>
        <TableScroll className="max-h-[320px]">
          <Table minWidth={1100}>
            <thead>
              <tr>
                <Th>Mérkőzés</Th>
                <Th align="center">Saját sáv</Th>
                <Th align="center">n ≥ 20?</Th>
                <Th align="center">Jelzett</Th>
                <Th align="center">Tényleges</Th>
                <Th align="center">Wilson alsó</Th>
                <Th align="center">Wilson felső</Th>
                <Th align="center">Kívül esik?</Th>
                <Th align="center">Ítélő sávrendszer</Th>
              </tr>
            </thead>
            <tbody>
              {trace.disproved.length === 0 ?
              <EmptyRow colSpan={9}>
                  Ebben a futásban egyetlen jelöltet sem cáfolt a saját visszamért sávja.
                  Ha a core mégis üres, az ok a fenti mátrix „Elsődleges ok” oszlopában
                  van — nem kalibrációs cáfolat.
                </EmptyRow> :

              trace.disproved.map((row) =>
              <Tr key={row.id}>
                    <Td className="whitespace-normal font-sans text-foreground">
                      {row.fixture}
                    </Td>
                    <Td align="center">
                      {row.bandLabel ?? '—'}
                      {row.widened ?
                  <span className="block text-[9px] text-negative">
                          bővített — kizárásra NEM használható
                        </span> :
                  null}
                    </Td>
                    <Td
                  align="center"
                  className={
                  row.observations >= row.required ? 'text-positive' : 'text-negative'
                  }>
                  
                      {row.observations} / {row.required}
                      <span className="block text-[9px] opacity-70">
                        {row.hits === null ? 'hits: —' : `${row.hits} találat`}
                      </span>
                    </Td>
                    <Td align="center">{pct(row.signalledProb)}</Td>
                    <Td align="center">{pct(row.measuredRate)}</Td>
                    <Td align="center">{pct(row.ciLo)}</Td>
                    <Td align="center">{pct(row.ciHi)}</Td>
                    <Td
                  align="center"
                  className={
                  row.outsideInterval === null ?
                  'text-chart-4' :
                  row.outsideInterval ?
                  'text-negative' :
                  'text-chart-4'
                  }>
                  
                      {row.outsideInterval === null ?
                  'nincs intervallum' :
                  row.outsideInterval ?
                  'IGEN' :
                  'NEM — ellenőrizd'}
                    </Td>
                    <Td
                  align="center"
                  className={
                  row.judgedBy === 'market' ? 'text-foreground' : 'text-chart-4'
                  }>
                  
                      {row.judgedBy === 'market' ?
                  'piacspecifikus (helyes)' :
                  'globális 1X2 (legacy)'}
                    </Td>
                  </Tr>
              )
              }
            </tbody>
          </Table>
        </TableScroll>

        {/* --- 7–8. Conditional accounting -------------------------------- */}
        <SubHeading>7. Feltételes sorok elszámolása — két különböző nevező</SubHeading>
        <p className="rounded-md border border-border bg-background/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          A core összesítő KIZÁRÓLAG a stratégia piacának kapun belüli jelöltjeit
          számolja: {trace.conditional.familyEligible} feltételes. A stratégia
          piacában összesen {trace.conditional.familyTotal} feltételes szintű sor
          van, ebből {trace.conditional.familyBlocked} a minőségi kapun kívül. Más
          piacokból és szerepkörökből (joker, csapatgól, kimenet-trend) további{' '}
          {trace.conditional.outsideTotal} feltételes sor létezik — ezek nem BTTS
          Core-jelöltek, és nem szabad egy számként olvasni őket.
        </p>
        <TableScroll className="max-h-[280px]">
          <Table minWidth={640}>
            <thead>
              <tr>
                <Th>Piac kód</Th>
                <Th align="center">Szerep</Th>
                <Th align="center">Feltételes sor</Th>
                <Th align="center">Ebből kapun belül</Th>
              </tr>
            </thead>
            <tbody>
              {trace.conditional.byCode.length === 0 ?
              <EmptyRow colSpan={4}>Nincs feltételes szintű sor ebben a futásban.</EmptyRow> :

              trace.conditional.byCode.map((row) =>
              <Tr key={row.code}>
                    <Td>{row.code}</Td>
                    <Td
                  align="center"
                  className={row.inFamily ? 'text-signal' : 'text-muted-foreground'}>
                  
                      {row.inFamily ? 'stratégia piaca' : 'más piac / joker'}
                    </Td>
                    <Td align="center">{row.total}</Td>
                    <Td align="center">{row.eligible}</Td>
                  </Tr>
              )
              }
            </tbody>
          </Table>
        </TableScroll>

        <SubHeading>
          8. Engedi-e a(z) „{trace.strategyLabel}” stratégia a feltételes core sort?
        </SubHeading>
        <p className="rounded-md border border-chart-4/30 bg-chart-4/10 px-3 py-2 text-[11px] leading-relaxed text-chart-4">
          {trace.admitsConditional.reason}
        </p>

        {/* --- 9. Attribution + slot trail -------------------------------- */}
        <SubHeading>9. A három kártya döntési nyomvonala</SubHeading>
        <TableScroll className="max-h-[320px]">
          <Table minWidth={720}>
            <thead>
              <tr>
                <Th>Kiesés oka</Th>
                <Th align="center">Sor</Th>
                <Th>Pontosan mi</Th>
              </tr>
            </thead>
            <tbody>
              {trace.attribution.map((row) =>
              <Tr key={row.cause}>
                  <Td className="font-sans text-foreground">{row.cause}</Td>
                  <Td
                  align="center"
                  className={row.count > 0 ? 'text-negative' : 'text-muted-foreground'}>
                  
                    {row.count}
                  </Td>
                  <Td className="whitespace-normal font-sans text-[11px] text-muted-foreground">
                    {row.detail}
                  </Td>
                </Tr>
              )}
            </tbody>
          </Table>
        </TableScroll>

        <ul className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          {trace.slots.map((slot) =>
          <li key={slot.index} className="font-mono">
              Core {slot.index}:{' '}
              {slot.fixture ?
            <span className="text-foreground">
                  {slot.fixture} · {slot.evidence ? EVIDENCE_COPY[slot.evidence].label : '—'}
                </span> :

            <span className="text-negative">üres</span>
            }
            </li>
          )}
          <li className="font-mono">
            A rangsor lépésig eljutott jelöltek:{' '}
            <span className="text-foreground">
              {trace.candidates.filter((c) => c.failed.length === 0).length}
            </span>{' '}
            · ebből kártyára került:{' '}
            <span className="text-foreground">{trace.coreFilled}</span>
          </li>
        </ul>
      </div>
    </Collapsible>);

}