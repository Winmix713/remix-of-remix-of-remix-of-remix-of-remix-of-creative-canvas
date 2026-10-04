import React, { useRef } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { cn } from '../../lib/utils';
import { DecisionMatrixBadge } from './Badges';
import { Table, Td, Th } from './DataTable';
import { Panel, PanelHeader, PanelTitle } from './Panel';
import type { MatchRow, Probs } from '../../types/winmix';

interface MatchInspectorModalProps {
  match: MatchRow;
  onClose: () => void;
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function MatchInspectorModal({ match, onClose }: MatchInspectorModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const pipeline = match.pipeline;

  // Real focus trap: Tab used to escape into the page behind the overlay.
  const trapRef = useFocusTrap<HTMLDivElement>({
    onEscape: onClose,
    initialFocusRef: closeRef
  });

  if (!pipeline) return null;

  const topProbability = Math.max(
    pipeline.calibrated.home,
    pipeline.calibrated.draw,
    pipeline.calibrated.away
  );

  const modelRows: Array<{label: string;probs: Probs;highlight?: boolean;}> = [
  { label: 'B0 prior bázis', probs: pipeline.b0 },
  { label: 'B1 Poisson (helyszín-korrigált)', probs: pipeline.b1 },
  {
    label:
    pipeline.m1Source === 'fitted' ?
    'M1 logisztikus (illesztett együtthatók)' :
    'M1 logisztikus (hidegindítási fallback)',
    probs: pipeline.m1
  },
  {
    label: `WinMix Ens. (Calibrated T=${pipeline.calibratedT.toFixed(2)})`,
    probs: pipeline.calibrated,
    highlight: true
  }];


  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}>
      
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Mérkőzés #${match.match_no} predikció részletei`}
        className="flex max-h-[90vh] w-full max-w-[820px] flex-col gap-4 overflow-y-auto rounded-xl border border-signal/20 bg-card p-6 shadow-panel-lg">
        
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <h2 className="text-data-base font-extrabold text-foreground">
            Mérkőzés #{match.match_no}: {match.home_team} vs {match.away_team} ({match.home_score} -{' '}
            {match.away_score})
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="btn btn--ghost btn--sm"
            aria-label="Bezárás"
            onClick={onClose}>
            
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-signal bg-pitch p-4">
          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-label text-muted-foreground">
              WinMix Final Recommendation
            </div>
            <div className="font-mono text-data-lg font-extrabold text-signal">
              {pipeline.recommendation}
            </div>
            <div className="mt-0.5 text-[12px] text-chart-4">
              {pipeline.caveat ?
              `⚠️ ${pipeline.caveat}` :
              'Statisztikailag megerősített, alacsony bizonytalanságú mérkőzés.'}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] font-bold uppercase tracking-label text-muted-foreground">
              Döntési mátrix (P × C, nem összevonva)
            </div>
            <DecisionMatrixBadge
              probability={topProbability}
              confidence={pipeline.confidence}
              quadrant={pipeline.decision}
              className="mt-1 px-3 py-1 text-[13px]" />
            
          </div>
        </div>

        <div className="rounded-lg border border-border bg-elevated/40 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-label text-muted-foreground">
              prior_divergence (diagnosztika)
            </span>
            <span className="font-mono text-[15px] font-bold tabular-nums text-foreground">
              {(pipeline.priorDivergence * 100).toFixed(2)} pp
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            A kalibrált eloszlás átlagos eltérése a modell saját B0 bázisától.{' '}
            <strong className="text-foreground">
              Adathiba- és anomáliajelző, nem fogadási érték
            </strong>{' '}
            — valódi érték csak külső, független piaci árhoz képest létezik, ilyen pedig itt nincs.
            Aktív ensemble súly: M1 = {pipeline.ensembleWM1.toFixed(2)}.
          </p>
        </div>

        <Panel>
          <PanelHeader>
            <PanelTitle>Modell valószínűségek összehasonlítása (Stage 2–4)</PanelTitle>
          </PanelHeader>
          <div className="overflow-x-auto">
            <Table minWidth={420} className="font-mono tabular-nums">
              <thead>
                <tr>
                  <Th>Modell</Th>
                  <Th align="center">Hazai (H)</Th>
                  <Th align="center">Döntetlen (D)</Th>
                  <Th align="center">Vendég (V)</Th>
                </tr>
              </thead>
              <tbody>
                {modelRows.map((row) =>
                <tr key={row.label} className={cn(row.highlight && 'bg-signal-soft font-extrabold')}>
                    <Td className={cn('font-sans', row.highlight && 'text-signal')}>{row.label}</Td>
                    <Td align="center" className={cn(row.highlight && 'text-signal')}>
                      {pct(row.probs.home)}
                    </Td>
                    <Td align="center" className={cn(row.highlight && 'text-signal')}>
                      {pct(row.probs.draw)}
                    </Td>
                    <Td align="center" className={cn(row.highlight && 'text-signal')}>
                      {pct(row.probs.away)}
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>As-of feature vektor (14 dimenzió, leakage-mentes)</PanelTitle>
          </PanelHeader>
          <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-4">
            {Object.entries(pipeline.features).map(([key, value]) =>
            <div
              key={key}
              className="rounded-sm border border-border bg-elevated/60 px-2.5 py-1.5 font-mono">
              
                <span className="block text-[10px] text-muted-foreground">{key}</span>
                <span className="text-[13px] font-bold tabular-nums text-foreground">
                  {value.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
          { label: 'Over 2.5 Gól', value: pct(pipeline.secondary.over25), tone: '' },
          { label: 'BTTS (Gólváltás)', value: pct(pipeline.secondary.btts), tone: '' },
          {
            label: 'Legvalószínűbb FT',
            value: pipeline.secondary.mostLikelyScore,
            tone: 'text-signal'
          }].
          map((item) =>
          <div
            key={item.label}
            className="flex flex-col gap-1 rounded-lg border border-border bg-elevated/40 px-4 py-3">
            
              <span className="font-mono text-[10px] font-bold uppercase tracking-label text-muted-foreground">
                {item.label}
              </span>
              <span className={cn('font-mono text-[18px] font-bold tabular-nums', item.tone)}>
                {item.value}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>);

}