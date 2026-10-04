import React, { useMemo } from 'react';
import { Activity, BarChart3, Gauge, History, Ruler, Sigma, Thermometer } from 'lucide-react';
import { useWinmix } from '../contexts/WinmixContext';
import { useLeagueForecastStats } from '../hooks/useLeagueForecastStats';
import { LEAGUE_LABEL } from '../data/leagues';
import { calibrationVerdict, computeEvalWindows } from '../utils/evalWindows';
import { computeDebugInSampleT } from '../utils/pipeline';
import { computeReliability } from '../utils/stats';
import { OutcomeDistributionChart, ReliabilityDiagram } from '../components/winmix/AuditCharts';
import { CalibrationVerdictBar } from '../components/winmix/CalibrationVerdictBar';
import { Collapsible } from '../components/winmix/Collapsible';
import { EntropyFloorPanel } from '../components/winmix/EntropyFloorPanel';
import { EvalWindowTable } from '../components/winmix/EvalWindowTable';
import { JointInvariantPanel } from '../components/winmix/JointInvariantPanel';
import { CoreEvidenceSuitePanel } from '../components/winmix/CoreEvidenceSuitePanel';
import { CoreTierSuitePanel } from '../components/winmix/CoreTierSuitePanel';
import { CoreCanonicalSuitePanel } from '../components/winmix/CoreCanonicalSuitePanel';
import { MarqueeSuitePanel } from '../components/winmix/MarqueeSuitePanel';

import { MarketCalibrationPanel } from '../components/winmix/MarketCalibrationPanel';
import { EmptyRow, Table, TableScroll, Td, Th, Tr } from '../components/winmix/DataTable';
import { MarketFeedbackPanel } from '../components/winmix/MarketFeedbackPanel';
import { MetricCard, MetricGrid } from '../components/winmix/MetricCard';
import { ModelStatePanel } from '../components/winmix/ModelStatePanel';
import { PageHeader } from '../components/winmix/PageHeader';
import { SectionHeading } from '../components/winmix/Panel';
import { ReliabilityBandTable } from '../components/winmix/ReliabilityBandTable';

const INTRO =
'100 meccses gördülő ablakok: Brier Score, LogLoss, Expected Calibration Error (ECE) és Skill vs B1 baseline. Ez a lap kizárólag mérési felület — az újraszámítás, a teljes újraépítés és a beállítások a Pipeline Üzemeltetés képernyőn érhetők el.';

export function PipelineAudit() {
  const { calibration, currentLeague, settings, seasons, marketFeedback, pipelineRuns } =
  useWinmix();

  const stats = useLeagueForecastStats();
  const cal = calibration[currentLeague];
  const lastRun = pipelineRuns[currentLeague] ?? null;
  const floor = cal.entropyFloor ?? null;
  const modelFit = cal.modelFit ?? null;

  const windows = useMemo(() => computeEvalWindows(stats.scored), [stats.scored]);
  const reliability = useMemo(() => computeReliability(stats.scored), [stats.scored]);

  const outcomeData = useMemo(
    () => [
    { name: 'Hazai (H)', value: stats.scored.filter((m) => m.outcome === 'H').length },
    { name: 'Döntetlen (D)', value: stats.scored.filter((m) => m.outcome === 'D').length },
    { name: 'Vendég (V)', value: stats.scored.filter((m) => m.outcome === 'A').length }],

    [stats.scored]
  );

  const verdict = useMemo(
    () =>
    calibrationVerdict({
      evaluated: stats.evaluated,
      ece: stats.ece,
      skillCI: stats.skillCI,
      sign: stats.sign,
      windows,
      saturated: floor ? floor.saturated : null
    }),
    [floor, stats.ece, stats.evaluated, stats.sign, stats.skillCI, windows]
  );

  const debugFit = useMemo(
    () => settings.debugInSampleT ? computeDebugInSampleT(seasons, currentLeague) : null,
    [settings.debugInSampleT, seasons, currentLeague]
  );

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        icon={Gauge}
        title="L4 értékelési & kalibrációs réteg"
        intro={INTRO} />
      

      {/* --- The answer, first --------------------------------------------- */}
      <CalibrationVerdictBar verdict={verdict} league={LEAGUE_LABEL[currentLeague]} />

      <MetricGrid>
        <MetricCard
          icon={Sigma}
          label="LogLoss (ensemble vs B1)"
          tone={
          stats.skillCI ? stats.skillCI.crossesZero ? 'negative' : 'positive' : 'neutral'
          }
          value={
          stats.hasPipeline ?
          `${stats.logLossEns.toFixed(3)} / ${stats.logLossB1.toFixed(3)}` :
          '— / —'
          }
          interval={
          stats.skillCI ?
          `Skill 95% CI: ${stats.skillCI.lo >= 0 ? '+' : ''}${stats.skillCI.lo.toFixed(2)}% … ${
          stats.skillCI.hi >= 0 ? '+' : ''}${
          stats.skillCI.hi.toFixed(2)}% (${stats.skillCI.iterations} bootstrap)` :
          'Skill 95% CI: nincs adat'
          }
          sub={
          stats.skillCI ?
          stats.skillCI.crossesZero ?
          'Nincs kimutatható előny a bázishoz képest' :
          `Skill vs B1: ${stats.skill >= 0 ? '+' : ''}${stats.skill.toFixed(2)}%${
          stats.sign ? ` · igazolt (p=${stats.sign.p.toFixed(3)})` : ''}` :

          'Skill vs B1: —'
          } />
        
        <MetricCard
          icon={Ruler}
          label="Brier Score"
          value={stats.hasPipeline ? stats.brier.toFixed(3) : '—'}
          sub="Alacsonyabb = jobb" />
        
        <MetricCard
          icon={Activity}
          label="ECE (kalibrációs hiba)"
          value={stats.ece !== null ? stats.ece.toFixed(3) : '—'}
          valueClassName={
          stats.ece === null ? undefined : stats.ece < 0.05 ? 'text-positive' : 'text-warning'
          }
          tone={stats.ece === null ? 'neutral' : stats.ece < 0.05 ? 'positive' : 'warning'}
          sub={
          stats.ece !== null ?
          stats.ece < 0.05 ?
          'Jó — a küszöb alatt' :
          'Rekalibráció ajánlott' :
          'Küszöb: < 0.05'
          } />
        
        <MetricCard
          icon={Thermometer}
          label="Aktív kalibrációs hőmérséklet"
          value={`T = ${(cal.T || 1).toFixed(2)}`}
          tone={debugFit ? 'warning' : 'neutral'}
          sub={
          debugFit ?
          `In-sample (leakage) T = ${debugFit.T.toFixed(2)} — csak összehasonlításhoz` :
          settings.debugInSampleT ?
          'In-sample T: nincs elég adat (min. 50 meccs)' :
          'Temp scaling — prequenciális fit'
          } />
        
      </MetricGrid>

      {/* --- Calibration --------------------------------------------------- */}
      <SectionHeading icon={Activity} hint="Elméleti korlát és sávonkénti megbízhatóság">
        Kalibráció
      </SectionHeading>
      <EntropyFloorPanel floor={floor} />
      <ReliabilityBandTable bands={stats.bands} />
      {/* RELEASE C — market-specific evaluation. Deliberately a SEPARATE panel:
           the verdict bar and the rolling windows above stay 1X2, because the two
           evaluation levels answer two different questions. */}
      <MarketCalibrationPanel markets={stats.marketCalibration} />
      <JointInvariantPanel />
      {/* The core gate's three evidence levels, verified on a synthetic round
           that holds all three states at once — the only way to see that
           "nincs elég mérés" and "megcáfolt" stay separate. */}
      <CoreEvidenceSuitePanel />
      {/* CORE TIERING — the quadrant is now a selection tier, not a hard entry
           gate. This suite pins the three properties that make that safe. */}
      <CoreTierSuitePanel />
      {/* CORE CANONICALISATION — the hard gates run before duplicate merging;
           these cases pin that order and the raw/eligible/placed populations. */}
      <CoreCanonicalSuitePanel />
      {/* RANGADÓ — a rangsor-levonás szerződése: nincs levonás evidencia
           nélkül, kis mintán soha, kizárás sosem, más piac bitre azonos. */}
      <MarqueeSuitePanel />


      {/* --- Windows ------------------------------------------------------- */}
      <SectionHeading icon={BarChart3} hint={`${windows.length} lezárt ablak`}>
        Gördülő kiértékelési ablakok
      </SectionHeading>
      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-panel">
        <EvalWindowTable
          windows={windows}
          empty={
          stats.evaluated === 0 ?
          'Nincs adat ehhez a ligához.' :
          `Legalább 100 mérkőzés szükséges az első ablak lezárásához. Jelenlegi minta: ${stats.evaluated} db.`
          } />
        
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OutcomeDistributionChart data={outcomeData} hasData={stats.hasPipeline} />
        <ReliabilityDiagram points={reliability} hasData={stats.hasPipeline} />
      </div>

      {/* --- Feedback + state ---------------------------------------------- */}
      <SectionHeading icon={History} hint="Zárt hurok és modellállapot">
        Visszacsatolás és futási előzmény
      </SectionHeading>
      <MarketFeedbackPanel feedback={marketFeedback} />
      <ModelStatePanel cal={cal} modelFit={modelFit} lastRun={lastRun} />

      <Collapsible
        title="Prequenciális kalibráció előzménye (T újrafittelések)"
        subtitle={`${cal.history.length} fittelés`}>
        
        <TableScroll className="max-h-[320px]">
          <Table minWidth={520} className="tabular-nums">
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Meccs index (fittelés pontja)</Th>
                <Th align="center">T</Th>
                <Th align="center">ECE (fittelési mintán)</Th>
                <Th align="center">Minta méret</Th>
              </tr>
            </thead>
            <tbody>
              {cal.history.length === 0 ?
              <EmptyRow colSpan={5}>
                  Még nincs elég adat (min. 50 meccs) az első prequenciális fitteléshez.
                </EmptyRow> :

              cal.history.map((fit, idx) =>
              <Tr key={`${fit.fittedAtMatchIndex}-${idx}`}>
                    <Td>#{idx + 1}</Td>
                    <Td>{fit.fittedAtMatchIndex}</Td>
                    <Td align="center" className="font-medium text-warning">
                      {fit.T.toFixed(2)}
                    </Td>
                    <Td align="center">{fit.ece.toFixed(3)}</Td>
                    <Td align="center">{fit.sampleSize}</Td>
                  </Tr>
              )
              }
            </tbody>
          </Table>
        </TableScroll>
      </Collapsible>
    </div>);

}