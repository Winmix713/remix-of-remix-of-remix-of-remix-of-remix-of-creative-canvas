import React, { useState } from 'react';
import { BAND_MIN_SAMPLE } from '../../utils/constants';
import { EVALUATED_MARKET_CODES } from '../../utils/marketCatalog';
import { MARKET_EVAL_SPECS } from '../../utils/marketEval';
import { BandRowsTable } from './BandRowsTable';
import { Panel, PanelHeader, PanelSubtitle, PanelTitle } from './Panel';
import type { MarketCalibrationReport, MarketCalibrationState } from '../../types/winmix';

const VERDICT_TONE: Record<MarketCalibrationReport['verdict'], string> = {
  calibrated: 'border-positive/30 bg-positive-soft text-positive',
  overconfident: 'border-negative/35 bg-negative-soft text-negative',
  underconfident: 'border-chart-4/30 bg-chart-4/10 text-chart-4',
  unevaluable: 'border-border bg-elevated text-muted-foreground'
};

const VERDICT_LABEL: Record<MarketCalibrationReport['verdict'], string> = {
  calibrated: 'Kalibrált',
  overconfident: 'Túl magabiztos',
  underconfident: 'Túl óvatos',
  unevaluable: 'Nem értékelhető'
};

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * RELEASE C — the market-specific, out-of-sample calibration panel.
 *
 * It answers the question the 1X2 reliability table cannot: "did the events
 * this ONE market priced at 65–75% actually happen 65–75% of the time?" The
 * measurement runs on the as-of model probability and the realized outcome —
 * never on `stability`, `marketConfidence` or the H2H hit rate.
 *
 * The rolling evaluation windows and the calibration verdict bar elsewhere on
 * this page stay 1X2: the two evaluation levels are deliberately not mixed.
 */
export function MarketCalibrationPanel({
  markets,
  className



}: {markets?: MarketCalibrationState | null;className?: string;}) {
  const [selected, setSelected] = useState<string>('HOME_O0.5');
  const report = markets?.[selected] ?? null;

  return (
    <Panel className={className}>
      <PanelHeader>
        <div>
          <PanelTitle>Piacspecifikus kalibráció (out-of-sample)</PanelTitle>
          <PanelSubtitle>
            Valószínűségi sávonként: a modell szerinti esély és a TÉNYLEGES beválás
            ugyanarra a piacra. A mérés egysége a mérkőzés előtti modellvalószínűség és a
            tény — nem a stabilitás és nem a H2H konfidencia. Minimális értékelhető minta
            sávonként: {BAND_MIN_SAMPLE} eset.
          </PanelSubtitle>
        </div>
      </PanelHeader>

      <div className="flex flex-col gap-3 px-3 py-3 sm:px-4">
        <div
          role="group"
          aria-label="Piac választó"
          className="flex flex-wrap gap-1.5">
          
          {EVALUATED_MARKET_CODES.map((code) => {
            const active = code === selected;
            const n = markets?.[code]?.n ?? 0;
            return (
              <button
                key={code}
                type="button"
                aria-pressed={active}
                onClick={() => setSelected(code)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] font-semibold leading-none outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-ring/50 ${
                active ?
                'border-signal/50 bg-signal-soft text-signal' :
                'border-border bg-elevated text-muted-foreground hover:border-signal/30 hover:text-foreground'}`
                }>
                
                {MARKET_EVAL_SPECS[code].label}
                <span className="tabular-nums opacity-70">({n})</span>
              </button>);

          })}
        </div>

        {report ?
        <>
            <p
            className={`rounded-md border px-2.5 py-2 text-[11px] ${VERDICT_TONE[report.verdict]}`}>
            
              <span className="font-mono font-bold uppercase tracking-label">
                {VERDICT_LABEL[report.verdict]}
              </span>{' '}
              — {report.headline}
            </p>

            <dl className="grid grid-cols-2 gap-2 rounded-md border border-border bg-background/60 px-3 py-2 sm:grid-cols-5">
              {[
            { label: 'Megfigyelés', value: `${report.n}` },
            { label: 'Átlagos jelzett P', value: report.n ? pct(report.avgP) : '—' },
            { label: 'Tényleges arány', value: report.n ? pct(report.hitRate) : '—' },
            { label: 'Brier', value: report.n ? report.brier.toFixed(3) : '—' },
            { label: 'ECE', value: report.n ? report.ece.toFixed(3) : '—' }].
            map((cell) =>
            <div key={cell.label}>
                  <dt className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
                    {cell.label}
                  </dt>
                  <dd className="font-mono text-[12px] font-bold tabular-nums">{cell.value}</dd>
                </div>
            )}
            </dl>
          </> :

        <p className="rounded-md border border-border bg-elevated px-2.5 py-2 text-[11px] text-muted-foreground">
            Ehhez a ligához még nincs piacspecifikus mérés — futtasd le a pipeline-t. A
            piac-kontraktus verzióváltása után az első futás mindig teljes, kronologikus
            újraépítés, hogy minden múltbeli mérkőzés a meccs előtti állapotból adja a
            valószínűségét.
          </p>
        }
      </div>

      <BandRowsTable
        rows={report?.bands ?? []}
        firstColumnLabel="Valószínűségi sáv"
        empty="Nincs megfigyelés ehhez a piachoz ebben a ligában." />
      

      <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground sm:px-4">
        A Core-jogosultság mindig a MINTA SAJÁT modellvalószínűségéhez tartozó sávon dől el,
        nem a piac átlagán: egy 0,68-as HOME_O0.5 becslést kizárólag a 65–75%-os sáv
        minősíthet. A csapatgól-család addig Joker-only, amíg az adott liga és az adott piac
        saját sávja nem lesz egyszerre értékelhető és kalibrált.
      </p>
    </Panel>);

}