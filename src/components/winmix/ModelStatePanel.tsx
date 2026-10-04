import React from 'react';
import type { PipelineRunInfo } from '../../hooks/useWinmixEngine';
import type { CalibrationState, ModelFitState } from '../../types/winmix';
import { DecisionMatrixLegend } from './DecisionMatrixBadge';
import { Panel, PanelHeader, PanelTitle } from './Panel';

function Row({ label, children }: {label: string;children: React.ReactNode;}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="font-mono text-ui-2xs uppercase tracking-label text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 break-words font-mono text-ui-xs tabular-nums text-muted-foreground">
        {children}
      </dd>
    </div>);

}

export function ModelStatePanel({
  cal,
  modelFit,
  lastRun




}: {cal: CalibrationState;modelFit: ModelFitState | null;lastRun: PipelineRunInfo | null;}) {
  const experiments =
  cal.experiments?.dixonColes || cal.experiments?.glicko2 ?
  [
  cal.experiments?.dixonColes ? 'Dixon-Coles' : null,
  cal.experiments?.glicko2 ? 'Glicko-2' : null].

  filter(Boolean).
  join(' · ') :
  'kikapcsolva';

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle as="h3">Aktív modellállapot és döntési mátrix</PanelTitle>
      </PanelHeader>

      <div className="flex flex-col gap-3 px-3 py-3.5 sm:px-4">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
          <Row label="M1 együtthatók">
            <strong className={modelFit?.m1Source === 'fitted' ? 'text-signal' : 'text-chart-4'}>
              {modelFit?.m1Source === 'fitted' ?
              `illesztett (n=${modelFit.m1SampleSize})` :
              'hidegindítási fallback'}
            </strong>
          </Row>
          <Row label="Ensemble súly (M1)">
            <strong className="text-foreground">{(modelFit?.ensembleWM1 ?? 0.65).toFixed(2)}</strong>{' '}
            {modelFit?.ensembleTuned ? '(hangolt)' : '(alapérték)'}
          </Row>
          <Row label="Kísérletek">
            <strong className="text-foreground">{experiments}</strong>
          </Row>
          <Row label="Utolsó futás">
            {lastRun ?
            <>
                <strong className={lastRun.kind === 'incremental' ? 'text-signal' : 'text-chart-4'}>
                  {lastRun.kind === 'incremental' ?
                `inkrementális — ${lastRun.reusedMatches} újrahasznosítva, ${lastRun.recomputedMatches} újraszámolva` :
                `teljes újraépítés — ${lastRun.recomputedMatches} meccs`}
                </strong>{' '}
                ({lastRun.mode})
              </> :

            <strong className="text-muted-foreground">nincs futás ebben a munkamenetben</strong>
            }
          </Row>
        </dl>

        {lastRun?.rebuildReason ?
        <p className="text-ui-xs text-muted-foreground">
            A checkpoint eldobásának oka: {lastRun.rebuildReason}
          </p> :
        null}

        <DecisionMatrixLegend />
      </div>
    </Panel>);

}