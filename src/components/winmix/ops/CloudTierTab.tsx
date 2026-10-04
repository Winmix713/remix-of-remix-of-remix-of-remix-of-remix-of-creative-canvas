import React, { useMemo } from 'react';
import { Cloud, CloudOff, RefreshCw, Upload } from 'lucide-react';
import { useCloudTierContext } from '../../../contexts/CloudTierContext';
import { cloudEndpointSummary, lastRatingsSource, type IngestResult } from '../../../utils/supabaseTier';
import { AdminTokenField, RowErrorTable, SchemaAnalyzer } from './CloudAdminTools';
import { CROSSCHECK_TOLERANCE, type CrossCheckRow } from '../../../hooks/useOpsActions';
import type { League } from '../../../types/winmix';
import { DataGrid, type GridColumn } from '../DataGrid';
import { Chip, Panel, PanelActions, PanelHeader, PanelSubtitle, PanelTitle } from '../Panel';

export function CloudTierTab({
  league,
  crossCheck,
  ingestToCloud,
  ingesting,
  ingestResult
}: {
  league: League;
  crossCheck: CrossCheckRow[];
  ingestToCloud: () => void;
  ingesting: boolean;
  ingestResult: IngestResult | null;
}) {
  const cloud = useCloudTierContext();
  const endpoint = useMemo(() => cloudEndpointSummary(), []);

  const columns = useMemo<GridColumn<CrossCheckRow>[]>(
    () => [
    {
      key: 'team',
      label: 'Csapat',
      primary: true,
      cell: (r) => <span className="font-sans font-bold text-foreground">{r.displayName}</span>
    },
    {
      key: 'sqlHome',
      label: 'SQL net (H)',
      align: 'center',
      cell: (r) => r.sqlNetHome.toFixed(2)
    },
    {
      key: 'tsHome',
      label: 'TS net (H)',
      align: 'center',
      cell: (r) => r.tsNetHome !== null ? r.tsNetHome.toFixed(2) : '—'
    },
    {
      key: 'sqlAway',
      label: 'SQL net (V)',
      align: 'center',
      cell: (r) => r.sqlNetAway.toFixed(2)
    },
    {
      key: 'tsAway',
      label: 'TS net (V)',
      align: 'center',
      cell: (r) => r.tsNetAway !== null ? r.tsNetAway.toFixed(2) : '—'
    },
    {
      key: 'agrees',
      label: 'Egyezés',
      align: 'center',
      secondary: true,
      cell: (r) =>
      <Chip tone={r.agrees ? 'signal' : 'neutral'}>{r.agrees ? 'egyezik' : 'eltérés'}</Chip>

    }],

    []
  );

  return (
    <Panel>
      <PanelHeader>
        <div className="flex min-w-0 flex-col gap-0.5">
          <PanelTitle as="h3">
            {cloud.health.status === 'online' ?
            <Cloud className="h-3.5 w-3.5 text-signal" aria-hidden="true" /> :
            cloud.health.status === 'probing' ?
            <Cloud
              className="h-3.5 w-3.5 animate-pulse text-muted-foreground"
              aria-hidden="true" /> :


            <CloudOff className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            }
            Felhő tier — csak olvasás, opcionális
          </PanelTitle>
          <PanelSubtitle>
            {cloud.health.status === 'online' ?
            `elérhető · ${cloud.health.checkedAt ?? ''}` :
            cloud.health.status === 'probing' ?
            'kapcsolat ellenőrzése…' :
            cloud.health.status === 'unconfigured' ?
            'nincs konfigurálva (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY)' :
            `helyi módra váltva — ${cloud.health.lastError ?? 'elérhetetlen'}`}
          </PanelSubtitle>
        </div>
        <PanelActions>
          {cloud.health.degraded ?
          <button
            type="button"
            className="btn btn--outline btn--sm tap gap-1.5"
            onClick={() => void cloud.retry()}>
            
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Kapcsolat újrapróbálása
            </button> :
          null}
          <button
            type="button"
            className="btn btn--outline btn--sm tap gap-1.5"
            disabled={ingesting || !cloud.configured}
            onClick={() => void ingestToCloud()}>
            <Upload className={`h-3.5 w-3.5 ${ingesting ? 'animate-pulse' : ''}`} aria-hidden="true" />
            {ingesting ? 'Feltöltés…' : 'Szezonok feltöltése a felhőbe'}
          </button>
          <button
            type="button"
            className="btn btn--outline btn--sm tap gap-1.5"
            disabled={
            !cloud.configured ||
            cloud.loadingRatings ||
            cloud.health.degraded ||
            cloud.health.status === 'probing'
            }
            onClick={() => void cloud.loadRatings(league)}>
            
            <RefreshCw
              className={`h-3.5 w-3.5 ${cloud.loadingRatings ? 'animate-spin' : ''}`}
              aria-hidden="true" />
            
            {cloud.loadingRatings ? 'Betöltés…' : 'SQL értékelés betöltése'}
          </button>
        </PanelActions>
      </PanelHeader>

      {endpoint ?
      <p className="break-words border-b border-border px-3 py-2 text-ui-xs text-muted-foreground sm:px-4">
          Végpont: <code className="font-mono text-foreground">{endpoint.url}/rest/v1</code> · kulcs
          forrása:{' '}
          <code className="font-mono">{endpoint.source === 'env' ? '.env' : 'beépített publishable'}</code>
        </p> :
      null}

      <p className="border-b border-border px-3 py-3 text-ui-xs leading-relaxed text-muted-foreground sm:px-4">
        Olvasáskor a böngésző csak a nyilvános kulcsot használja; a feltöltés a szerveren fut a titkos kulccsal.
        Az alkalmazás állapota továbbra is a helyi tárolóban él (karantén + JSON export/import a
        katasztrófa-visszaállítás útja). Az itt látott SQL-oldali számok{' '}
        <strong>tájékoztató jellegűek</strong>: keresztellenőrzésre szolgálnak, sosem kerülnek be a
        pipeline-ba vagy a bootstrap-be.
      </p>

      {ingestResult ? (
        <div className={`border-b border-border px-3 py-3 text-ui-xs sm:px-4 ${ingestResult.success ? 'text-signal' : 'text-error'}`}>
          {ingestResult.success ?
            `Feltöltve: ${ingestResult.seasons} szezon, ${ingestResult.teams} csapat, ${ingestResult.matches} mérkőzés` +
            (ingestResult.rejected > 0 ? `, ${ingestResult.rejected} elutasítva` : '') +
            (ingestResult.repaired > 0 ? `, ${ingestResult.repaired} javítva` : '') :
            `Hiba: ${ingestResult.errors.join('; ')}`}
        </div>
      ) : null}
      {ingestResult?.rowErrors ? <RowErrorTable rows={ingestResult.rowErrors} /> : null}
      <AdminTokenField />
      <SchemaAnalyzer />
      {crossCheck.length > 0 && lastRatingsSource === 'team_season_stats' ? (
        <p className="border-b border-border px-3 py-2 text-ui-xs text-muted-foreground sm:px-4">
          Forrás: <code className="font-mono">winmix_team_season_stats</code> (a <code className="font-mono">view_team_ratings</code> nézet még nincs létrehozva) — a hazai és vendég érték itt az összesített gólkülönbség.
        </p>
      ) : null}

      <DataGrid
        columns={columns}
        rows={crossCheck}
        rowKey={(r) => r.canonicalKey}
        minWidth={760}
        collapseBelow="md"
        empty={
        <>
            Nincs betöltött SQL értékelés. Ha betöltés után is üres: a mérkőzés- és statisztikatáblák még
            üresek — kattints a <strong>Szezonok feltöltése a felhőbe</strong> gombra, majd hozd létre a{' '}
            <code className="font-mono">view_team_ratings</code> nézetet (az AI séma-elemző megírja hozzá az SQL-t).
            Tolerancia: {CROSSCHECK_TOLERANCE}.
          </>
        } />
      
    </Panel>);

}