import React, { useCallback, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { fetchRemoteSeasonFiles } from './utils/remoteSeasons';
import { CloudTierProvider } from './contexts/CloudTierContext';
import { DialogProvider } from './contexts/DialogContext';
import { WinmixProvider, useWinmix } from './contexts/WinmixContext';
import { ImportPreviewModal } from './components/winmix/ImportPreviewModal';
import { NavRail } from './components/winmix/NavRail';
import { StatusBar } from './components/winmix/StatusBar';
import { TopBar } from './components/winmix/TopBar';
import { DataStudio } from './pages/DataStudio';
import { FixturePredictor } from './pages/FixturePredictor';
import { HeadToHead } from './pages/HeadToHead';
import { PipelineAudit } from './pages/PipelineAudit';
import { PipelineOperationsDashboard } from './pages/PipelineOperationsDashboard';
import { PredictionLedger } from './pages/PredictionLedger';
import { useScreenInit } from './useScreenInit.js';
import type { ViewKey } from './types/winmix';

function StudioShell() {
  // Screens preview: `?mp_screen=<id>` seeds the active view so each screen of
  // the studio renders on its own canvas frame. Falls back to the dashboard.
  const screenInit = useScreenInit();
  const [view, setView] = useState<ViewKey>(
    screenInit?.view as ViewKey | undefined ?? 'dashboard'
  );
  const {
    currentLeague,
    setLeague,
    recomputeAll,
    clearAll,
    exportJson,
    importPreview,
    beginImport,
    cancelImport,
    applyImport,
    importFiles,
    isComputing
  } = useWinmix();

  const [loadingMatches, setLoadingMatches] = useState(false);

  // A távoli CSV-k a szokásos feltöltési úton mennek át, így a parse, a
  // liga-felismerés és a pipeline újraszámolás azonos a kézi feltöltéssel.
  const handleLoadMatches = useCallback(async () => {
    setLoadingMatches(true);
    const toastId = toast.loading('Mérkőzés-CSV-k letöltése…');
    try {
      const { files, failures } = await fetchRemoteSeasonFiles((done, total) => {
        toast.loading(`Mérkőzés-CSV-k letöltése… ${done} / ${total}`, {
          id: toastId
        });
      });
      toast.dismiss(toastId);

      if (files.length === 0) {
        toast.error(
          'Egyetlen mérkőzés-CSV sem töltődött le — ellenőrizd a hálózati kapcsolatot.'
        );
        return;
      }
      if (failures.length > 0) {
        toast.warning(
          `${failures.length} fájl kimaradt: ${failures.slice(0, 3).join(', ')}${
          failures.length > 3 ? ' …' : ''}`

        );
      }
      await importFiles(files, 'auto');
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(
        `A mérkőzések betöltése nem sikerült: ${
        error instanceof Error ? error.message : 'ismeretlen hiba'}`

      );
    } finally {
      setLoadingMatches(false);
    }
  }, [importFiles]);

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background md:flex-row">
      <NavRail
        view={view}
        onChange={setView}
        onExport={() => void exportJson()}
        onImport={(file) => void beginImport(file)} />
      

      <div className="order-1 flex min-w-0 flex-1 flex-col overflow-hidden md:order-2">
        <TopBar
          league={currentLeague}
          onLeagueChange={setLeague}
          onRunPipeline={() =>
          void recomputeAll(
            'Pipeline v2 walk-forward predikciók + prequenciális kalibráció lefutott!'
          )
          }
          onLoadMatches={() => void handleLoadMatches()}
          onClearAll={() => void clearAll()}
          busy={isComputing}
          loadingMatches={loadingMatches} />
        
        <StatusBar />

        {/* The instrument surface stays fluid but stops growing past 1600px —
             beyond that, KPI cards and prose lines simply stretch. */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-4 md:px-6 md:py-6">
            {view === 'dashboard' ? <DataStudio /> : null}
            {view === 'operations' ? <PipelineOperationsDashboard /> : null}
            {view === 'pipeline' ? <PipelineAudit /> : null}
            {view === 'h2h' ? <HeadToHead /> : null}
            {view === 'predictor' ? <FixturePredictor /> : null}
            {view === 'ledger' ? <PredictionLedger /> : null}
          </div>
        </main>
      </div>

      {importPreview ?
      <ImportPreviewModal
        fileName={importPreview.fileName}
        current={importPreview.current}
        incoming={importPreview.incoming}
        warnings={importPreview.warnings}
        busy={isComputing}
        onCancel={cancelImport}
        onApply={(mode) => void applyImport(mode)} /> :

      null}
    </div>);

}

export function App() {
  return (
    <DialogProvider>
      <WinmixProvider>
        <CloudTierProvider>
          <StudioShell />
        </CloudTierProvider>
      </WinmixProvider>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: '0.75rem',
            boxShadow: 'var(--shadow-panel-lg)',
            color: 'var(--foreground)',
            fontSize: '12px'
          }
        }} />
      
    </DialogProvider>);

}