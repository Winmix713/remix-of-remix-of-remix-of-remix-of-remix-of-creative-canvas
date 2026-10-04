import React, { useState } from 'react';
import {
  Cloud,
  Database,
  Gauge,
  LayoutGrid,
  Play,
  Settings2,
  Sliders,
  Users,
  Wrench } from
'lucide-react';
import { useWinmix } from '../contexts/WinmixContext';
import { useOpsActions } from '../hooks/useOpsActions';
import { MetricCard, MetricGrid } from '../components/winmix/MetricCard';
import { PageHeader } from '../components/winmix/PageHeader';
import { StateProgress } from '../components/winmix/PanelState';
import { CloudTierTab } from '../components/winmix/ops/CloudTierTab';
import { OpsTabs, type TabDescriptor } from '../components/winmix/ops/OpsTabs';
import { SettingsTab } from '../components/winmix/ops/SettingsTab';
import { WeightsTab } from '../components/winmix/ops/WeightsTab';
import { useScreenInit } from '../useScreenInit.js';

type OpsTab = 'weights' | 'settings' | 'cloud';

const TABS: TabDescriptor<OpsTab>[] = [
{ key: 'weights', label: 'Csapat súlyozás', icon: Sliders },
{ key: 'settings', label: 'Pipeline beállítások', icon: Settings2 },
{ key: 'cloud', label: 'Felhő tier & keresztellenőrzés', icon: Cloud }];


const INTRO =
'L1 csapatsúlyok, pipeline beállítások, kalibrációs állapot és az opcionális felhő tier egy képernyőn. Az automatikusan származtatott súlyok javaslatok: csak megerősítés után íródnak be, és egy kattintással visszaállíthatók.';

export function PipelineOperationsDashboard() {
  const {
    currentLeague,
    leagueSeasons,
    leagueMatches,
    settings,
    updateSettings,
    calibration,
    recomputeAll,
    pruneOldestSeason,
    storageWarning,
    storageBackend,
    isComputing
  } = useWinmix();

  const ops = useOpsActions();
  // Screens preview: each operations tab is its own canvas screen.
  const screenInit = useScreenInit();
  const [tab, setTab] = useState<OpsTab>(
    screenInit?.opsTab as OpsTab | undefined ?? 'weights'
  );

  const cal = calibration[currentLeague];
  const ece = cal?.ece ?? null;
  const lastComputedAt = cal?.lastComputedAt ?? null;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        icon={Wrench}
        title="Pipeline üzemeltetés — művelet-központ"
        intro={INTRO}
        actions={
        <button
          type="button"
          className="btn btn--signal tap"
          disabled={isComputing}
          onClick={() => void recomputeAll('Pipeline újraszámítás az üzemeltetési központból.')}>
          
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            {isComputing ? 'Fut…' : 'Pipeline futtatása'}
          </button>
        } />
      

      {/* Long operations used to only disable buttons — the surface looked dead
           for the whole duration of a full rebuild. */}
      {isComputing ?
      <StateProgress
        label="Pipeline számítás fut…"
        detail={`${leagueMatches.length} mérkőzés`} /> :

      null}

      <MetricGrid cols={4}>
        <MetricCard
          icon={Database}
          label="Betöltött mérkőzés"
          value={leagueMatches.length}
          sub={`${leagueSeasons.length} szezon · ${currentLeague.toUpperCase()}`} />
        
        <MetricCard
          icon={Gauge}
          label="Kalibráció T"
          value={(cal?.T ?? 1).toFixed(3)}
          sub={typeof ece === 'number' ? `ECE ${ece.toFixed(4)}` : 'ECE n/a'}
          tone={typeof ece === 'number' ? 'signal' : 'neutral'}
          interval={
          lastComputedAt ? new Date(lastComputedAt).toLocaleString('hu-HU') : 'Nincs futás'
          } />
        
        <MetricCard
          icon={Users}
          label="Értékelt csapat"
          value={Object.keys(ops.auto).length}
          sub="Empirikus súlyjavaslat"
          tone="signal" />
        
        <MetricCard
          icon={LayoutGrid}
          label="Irányított párok"
          value={`${ops.fixtureReport.observedPairs} / ${ops.fixtureReport.expectedPairs}`}
          tone={ops.fixtureReport.complete ? 'positive' : 'warning'}
          sub={
          ops.fixtureReport.complete ?
          'Teljes menetrend' :
          `${ops.fixtureReport.missingPairs} hiányzó · ${ops.fixtureReport.repeatedPairs} ismételt`
          }
          interval={`${ops.fixtureReport.teamCount} csapat → N×(N−1)`} />
        
      </MetricGrid>

      <OpsTabs tabs={TABS} active={tab} onChange={setTab} label="Üzemeltetési fülek" />

      {tab === 'weights' ?
      <div role="tabpanel" id="ops-panel-weights" aria-labelledby="ops-tab-weights">
          <WeightsTab
          league={currentLeague}
          rows={ops.rows}
          fixtureReport={ops.fixtureReport}
          busy={isComputing}
          canRevert={ops.canRevert}
          onApplyAuto={() => void ops.applyAutoWeights()}
          onRevert={() => void ops.revertAutoWeights()}
          onSave={() => void ops.saveWeights()}
          onWeightChange={ops.setWeight} />
        
        </div> :
      null}

      {tab === 'settings' ?
      <div role="tabpanel" id="ops-panel-settings" aria-labelledby="ops-tab-settings">
          <SettingsTab
          settings={settings}
          busy={isComputing}
          storageBackend={storageBackend}
          storageWarning={storageWarning}
          onUpdateSettings={(patch) => void updateSettings(patch)}
          onChangeHistoryScope={(scope) => void ops.changeHistoryScope(scope)}
          onFullRebuild={() => void ops.fullRebuild()}
          onPruneOldestSeason={() => void pruneOldestSeason()} />
        
        </div> :
      null}

      {tab === 'cloud' ?
      <div role="tabpanel" id="ops-panel-cloud" aria-labelledby="ops-tab-cloud">
          <CloudTierTab
            league={currentLeague}
            crossCheck={ops.crossCheck}
            ingestToCloud={() => void ops.ingestToCloud()}
            ingesting={ops.ingesting}
            ingestResult={ops.ingestResult}
          />
        </div> :
      null}
    </div>);

}