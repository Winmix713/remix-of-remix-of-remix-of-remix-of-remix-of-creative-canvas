import React, { useMemo, useState } from 'react';
import {
  CheckCheck,
  ClipboardList,
  Download,
  Layers,
  LineChart,
  Percent,
  Search,
  Trash2,
  Trophy } from
'lucide-react';
import { useDialogs } from '../contexts/DialogContext';
import { useWinmix } from '../contexts/WinmixContext';
import {
  SLIP_STATUS_LABEL,
  computePatternPerformance,
  coreTierPerformance,
  ledgerTotals,
  ledgerTrend,
  slipStatus,
  zeroCoreCohort } from
'../utils/ledger';
import { downloadLedgerCsv } from '../utils/ledgerExport';
import { PATTERN_LABEL } from '../utils/patterns';
import { cn } from '../lib/utils';
import { LedgerTable } from '../components/winmix/LedgerTable';
import { LedgerTrendChart } from '../components/winmix/LedgerTrendChart';
import { MetricCard, MetricGrid } from '../components/winmix/MetricCard';
import { PageHeader } from '../components/winmix/PageHeader';
import {
  Panel,
  PanelFooter,
  PanelHeader,
  PanelSubtitle,
  PanelTitle,
  SectionHeading } from
'../components/winmix/Panel';
import { PatternPerformanceTable } from '../components/winmix/PatternPerformanceTable';
import type { SlipStatus } from '../types/winmix';

const INTRO =
'Minden kiadott Top 3+3 szelvény itt vár a lezárásra. Írd be soronként a félidei és a végeredményt — a rendszer azonnal kiértékeli a tippet, frissíti a szelvény státuszát, és újraszámolja a mintatípusok dinamikus súlyát, ami visszahat a Prediktor stabilitási pontszámaira.';

type StatusFilter = 'all' | SlipStatus;

const FILTERS: {key: StatusFilter;label: string;}[] = [
{ key: 'all', label: 'Mind' },
{ key: 'pending', label: SLIP_STATUS_LABEL.pending },
{ key: 'won', label: SLIP_STATUS_LABEL.won },
{ key: 'partial', label: SLIP_STATUS_LABEL.partial },
{ key: 'lost', label: SLIP_STATUS_LABEL.lost }];


export function PredictionLedger() {
  const { slips, updateSlipLine, deleteSlip, clearLedger } = useWinmix();
  const { confirm } = useDialogs();

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');

  const performance = useMemo(() => computePatternPerformance(slips), [slips]);
  const totals = useMemo(() => ledgerTotals(slips), [slips]);
  const trend = useMemo(() => ledgerTrend(slips), [slips]);
  const activeRows = useMemo(() => performance.filter((p) => p.issued > 0), [performance]);
  /* CORE TIERING — Primary, Secondary and Legacy core lines are measured as
     three separate cohorts. One merged core hit rate would make the tiering
     change unfalsifiable. */
  const tierRows = useMemo(
    () => coreTierPerformance(slips).filter((row) => row.issued > 0),
    [slips]
  );
  /* „0 CORE" KOHORSZ — a kiadás nélküli fordulók önálló mérési eredményként. */
  const zeroCore = useMemo(() => zeroCoreCohort(slips), [slips]);


  const counts = useMemo(() => {
    const acc: Record<StatusFilter, number> = {
      all: slips.length,
      pending: 0,
      won: 0,
      partial: 0,
      lost: 0
    };
    slips.forEach((s) => {
      acc[slipStatus(s)]++;
    });
    return acc;
  }, [slips]);

  const visibleSlips = useMemo(() => {
    const q = query.trim().toLowerCase();
    return slips.filter((s) => {
      if (filter !== 'all' && slipStatus(s) !== filter) return false;
      if (!q) return true;
      return (
        s.roundName.toLowerCase().includes(q) ||
        s.lines.some((l) => l.fixtureLabel.toLowerCase().includes(q)));

    });
  }, [filter, query, slips]);

  /** Best and worst settled pattern family — so the table does not have to be scanned by eye. */
  const extremes = useMemo(() => {
    const settled = activeRows.filter((r) => r.settled > 0 && r.hitRate !== null);
    if (settled.length === 0) return null;
    const sorted = [...settled].sort((a, b) => (b.hitRate ?? 0) - (a.hitRate ?? 0));
    return { best: sorted[0], worst: sorted[sorted.length - 1] };
  }, [activeRows]);

  const askClear = async () => {
    const ok = await confirm(
      `Biztosan törlöd mind a ${slips.length} elmentett szelvényt? A beírt eredmények és a mintatípusok dinamikus súlyai is elvesznek — ez nem visszavonható.`
    );
    if (ok) void clearLedger();
  };

  const askDelete = async (id: string) => {
    const ok = await confirm('Törlöd ezt a szelvényt a naplóból? A beírt eredmények elvesznek.');
    if (ok) deleteSlip(id);
  };

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        icon={ClipboardList}
        title="Tipp Napló & visszacsatolás"
        intro={INTRO}
        actions={
        <>
            <button
            type="button"
            className="btn btn--outline tap"
            disabled={slips.length === 0}
            onClick={() => downloadLedgerCsv(slips)}>
            
              <Download className="h-3.5 w-3.5" aria-hidden={true} />
              CSV export
            </button>
            <button
            type="button"
            className="btn btn--danger tap"
            disabled={slips.length === 0}
            onClick={() => void askClear()}>
            
              <Trash2 className="h-3.5 w-3.5" aria-hidden={true} />
              Napló törlése
            </button>
          </>
        } />
      

      <MetricGrid>
        <MetricCard
          icon={ClipboardList}
          label="Elmentett szelvények"
          value={totals.slips}
          sub={`${totals.pendingSlips} függőben`} />
        
        <MetricCard
          icon={Trophy}
          label="Nyert szelvények"
          value={totals.wonSlips}
          valueClassName="text-positive"
          tone="positive"
          sub="Minden sor bejött" />
        
        <MetricCard
          icon={CheckCheck}
          label="Lezárt tippsorok"
          value={`${totals.wonLines} / ${totals.settledLines}`}
          sub="Bejött / kiértékelt" />
        
        <MetricCard
          icon={Percent}
          label="Sor szintű találati arány"
          value={totals.lineHitRate !== null ? `${(totals.lineHitRate * 100).toFixed(1)}%` : '—'}
          valueClassName={cn(
            totals.lineHitRate === null ?
            'text-muted-foreground' :
            totals.lineHitRate >= 0.5 ?
            'text-positive' :
            'text-negative'
          )}
          tone={
          totals.lineHitRate === null ?
          'neutral' :
          totals.lineHitRate >= 0.5 ?
          'positive' :
          'negative'
          }
          sub="Az összes lezárt tippre vetítve" />
        
      </MetricGrid>

      {/* --- Evidence over time -------------------------------------------- */}
      <SectionHeading icon={LineChart} hint="Kumulatív + 20-sávos mozgóátlag">
        Teljesítmény alakulása
      </SectionHeading>
      <Panel>
        <PanelHeader>
          <PanelTitle as="h3">Találati arány a lezárt tippsorok mentén</PanelTitle>
          <PanelSubtitle>{trend.length} lezárt sor</PanelSubtitle>
        </PanelHeader>
        <LedgerTrendChart points={trend} />
      </Panel>

      {/* --- "0 core" fordulók kohorsza -------------------------------------- */}
      <SectionHeading icon={Layers} hint="A kiadás nélküli fordulók külön mérve">
        „0 core" fordulók
      </SectionHeading>
      <Panel>
        <PanelHeader>
          <PanelTitle as="h3">Kiadás nélküli fordulók aránya</PanelTitle>
          <PanelSubtitle>
            A 0 core forduló érvényes eredmény: a kapuk nem engedtek ki sort
          </PanelSubtitle>
        </PanelHeader>
        <MetricGrid>
          <MetricCard
            icon={Layers}
            label="0 core forduló"
            value={zeroCore.zeroCoreSlips}
            tone={zeroCore.zeroCoreSlips > 0 ? 'neutral' : 'positive'}
            sub="Egyetlen core sor sem került ki" />
          
          <MetricCard
            icon={CheckCheck}
            label="Core sort tartalmazó forduló"
            value={zeroCore.coreSlips}
            sub="Legalább egy kiadott core sor" />
          
          <MetricCard
            icon={Percent}
            label="0 core arány"
            value={
            zeroCore.zeroCoreRate !== null ?
            `${(zeroCore.zeroCoreRate * 100).toFixed(1)}%` :
            '—'
            }
            valueClassName={zeroCore.zeroCoreRate === null ? 'text-muted-foreground' : undefined}
            sub="A mért fordulókra vetítve" />
          
          <MetricCard
            icon={ClipboardList}
            label="Nem mért (régi) szelvény"
            value={zeroCore.unknownSlips}
            sub="A core-darabszám még nem került mentésre" />
          
        </MetricGrid>
      </Panel>

      {/* --- Core tier cohorts ---------------------------------------------- */}
      {tierRows.length > 0 ?
      <>
          <SectionHeading icon={Layers} hint="Elsődleges · másodlagos · örökölt, külön mérve">
            Core kiválasztási szintek teljesítménye
          </SectionHeading>
          <Panel>
            <PanelHeader>
              <PanelTitle as="h3">Szint szerinti kohorszok</PanelTitle>
              <PanelSubtitle>
                A másodlagos (volatilis) sorok külön mérve — sosem összevonva
              </PanelSubtitle>
            </PanelHeader>
            <div className="table-responsive">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr className="bg-black/20">
                    {[
                  ['Core szint', 'left'],
                  ['Kiadott', 'right'],
                  ['Lezárt', 'right'],
                  ['Bejött', 'right'],
                  ['Találati arány', 'right'],
                  ['95% Wilson', 'right']].
                  map(([label, align]) =>
                  <th
                    key={String(label)}
                    scope="col"
                    className={cn(
                      'px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-label text-muted-foreground',
                      align === 'right' ? 'text-right' : 'text-left'
                    )}>
                    
                        {label}
                      </th>
                  )}
                  </tr>
                </thead>
                <tbody>
                  {tierRows.map((row) =>
                <tr key={row.cohort} className="border-t border-white/[0.06]">
                      <td
                    className={cn(
                      'px-3 py-2 text-ui-xs font-medium',
                      row.cohort === 'primary' ?
                      'text-signal' :
                      row.cohort === 'secondary' ?
                      'text-chart-4' :
                      'text-muted-foreground'
                    )}>
                    
                        {row.label}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-ui-xs tabular-nums text-muted-foreground">
                        {row.issued}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-ui-xs tabular-nums text-muted-foreground">
                        {row.settled}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-ui-xs tabular-nums text-foreground">
                        {row.won}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-ui-xs tabular-nums text-foreground">
                        {row.hitRate !== null ? `${(row.hitRate * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                        {row.ci ?
                    `${(row.ci.lo * 100).toFixed(0)}–${(row.ci.hi * 100).toFixed(0)}%` :
                    '—'}
                      </td>
                    </tr>
                )}
                </tbody>
              </table>
            </div>
            <PanelFooter>
              <span>
                A másodlagos szint magasabb kockázatú kvadránst jelent, nem gyengébb
                evidenciát. Ezek a sorok azért kerültek core kártyára, mert az adott helyre
                nem volt elérhető elsődleges jelölt — a különbség csak külön mérve derül ki.
              </span>
            </PanelFooter>
          </Panel>
        </> :
      null}

      {/* --- The archive ---------------------------------------------------- */}
      <SectionHeading hint={`${visibleSlips.length} / ${slips.length} szelvény`}>
        Szelvénytár
      </SectionHeading>
      <Panel>
        <PanelHeader className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Szűrés státusz szerint">
            
            {FILTERS.map((f) =>
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'tap flex h-8 items-center gap-1.5 rounded-md px-2.5 text-ui-xs transition-colors',
                filter === f.key ?
                'bg-signal-soft text-signal' :
                'bg-surface-1 text-muted-foreground hover:bg-surface-pop hover:text-foreground'
              )}>
              
                {f.label}
                <span className="tabular-nums opacity-60">{counts[f.key]}</span>
              </button>
            )}
          </div>

          <div className="relative w-full sm:w-48 lg:w-56">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden={true} />
            
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Forduló vagy mérkőzés…"
              aria-label="Keresés a szelvénytárban"
              className="field w-full pl-8" />
            
          </div>
        </PanelHeader>

        <LedgerTable
          slips={visibleSlips}
          onUpdateLine={updateSlipLine}
          onDelete={(id) => void askDelete(id)}
          emptyMessage={
          slips.length === 0 ?
          'Még nincs elmentett szelvény. Állíts össze egy fordulót a Forduló Prediktorban, és mentsd el a Top 3+3 ajánlást.' :
          'Egy szelvény sem felel meg a szűrésnek.'
          } />
        
      </Panel>

      {/* --- Feedback loop -------------------------------------------------- */}
      <SectionHeading hint="Laplace-simított arány · súlysáv 0.75× – 1.25×">
        Mintateljesítmény és dinamikus súlyok
      </SectionHeading>
      <Panel>
        <PanelHeader>
          <PanelTitle as="h3">Mintatípusok</PanelTitle>
          <PanelSubtitle>{activeRows.length} aktív mintatípus</PanelSubtitle>
        </PanelHeader>

        <PatternPerformanceTable rows={activeRows} />

        {extremes ?
        <PanelFooter>
            <span className="flex items-center gap-1.5">
              <span>Legjobb</span>
              <span className="font-medium text-positive">
                {PATTERN_LABEL[extremes.best.type]}
              </span>
              <span className="tabular-nums">
                {((extremes.best.hitRate ?? 0) * 100).toFixed(1)}% ({extremes.best.settled} sor)
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span>Leggyengébb</span>
              <span className="font-medium text-negative">
                {PATTERN_LABEL[extremes.worst.type]}
              </span>
              <span className="tabular-nums">
                {((extremes.worst.hitRate ?? 0) * 100).toFixed(1)}% ({extremes.worst.settled} sor)
              </span>
            </span>
          </PanelFooter> :
        null}
      </Panel>
    </div>);

}