import React from 'react';
import { FlaskConical, Hammer, RotateCcw, Settings2, TriangleAlert } from 'lucide-react';
import type { HistoryScope, WinmixSettings } from '../../../types/winmix';
import { Panel, PanelHeader, PanelTitle } from '../Panel';

interface SettingsTabProps {
  settings: WinmixSettings;
  busy: boolean;
  storageBackend: 'local' | 'memory' | string;
  storageWarning: string | null;
  onUpdateSettings: (patch: Partial<WinmixSettings>) => void;
  onChangeHistoryScope: (scope: HistoryScope) => void;
  onFullRebuild: () => void;
  onPruneOldestSeason: () => void;
}

/** A checkbox with its own explanation, wrapped in a real label. */
function ToggleRow({
  checked,
  onChange,
  title,
  children





}: {checked: boolean;onChange: (next: boolean) => void;title: string;children: React.ReactNode;}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-ui-sm text-foreground">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-signal"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)} />
      
      <span className="min-w-0">
        {title}
        <span className="mt-0.5 block text-ui-xs leading-relaxed text-muted-foreground">
          {children}
        </span>
      </span>
    </label>);

}

export function SettingsTab({
  settings,
  busy,
  storageBackend,
  storageWarning,
  onUpdateSettings,
  onChangeHistoryScope,
  onFullRebuild,
  onPruneOldestSeason
}: SettingsTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader>
          <PanelTitle as="h3">
            <Settings2 className="h-3.5 w-3.5 text-signal" aria-hidden="true" />
            Előzmény hatókör
          </PanelTitle>
        </PanelHeader>
        <div className="px-3 py-3.5 sm:px-4">
          <p className="max-w-prose text-ui-xs leading-relaxed text-muted-foreground">
            A hatókör azt szabja meg, mennyi korábbi mérkőzést lát az as-of feature vektor. A
            módosítás minden checkpointot érvénytelenít és teljes újraszámítást indít, ezért
            megerősítést kér.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {(['season-only', 'league-cumulative'] as HistoryScope[]).map((scope) =>
            <button
              key={scope}
              type="button"
              aria-pressed={settings.historyScope === scope}
              disabled={busy}
              className={
              settings.historyScope === scope ?
              'btn btn--signal btn--sm tap' :
              'btn btn--outline btn--sm tap'
              }
              onClick={() => onChangeHistoryScope(scope)}>
              
                {scope === 'season-only' ?
              'Csak az adott szezon (szezononként nulláz)' :
              'Liga-kumulatív (átvitt előzmény)'}
              </button>
            )}
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle as="h3">Import & diagnosztika</PanelTitle>
        </PanelHeader>
        <div className="flex flex-col gap-3 px-3 py-3.5 sm:px-4">
          <ToggleRow
            checked={settings.allowDuplicateImport}
            onChange={(next) => onUpdateSettings({ allowDuplicateImport: next })}
            title="Ismétlődő import engedélyezése">
            
            Alapból a tartalmilag azonos szezonok kimaradnak. Ez a fájl-szintű tartalom-hash-re
            épül; a soron belüli azonosság továbbra is a{' '}
            <code className="font-mono">sourceFileId + rowIndex</code> páron alapul, így a dátum
            nélküli visszavágók sosem esnek ki duplikátumként.
          </ToggleRow>

          <ToggleRow
            checked={settings.debugInSampleT}
            onChange={(next) => onUpdateSettings({ debugInSampleT: next })}
            title="In-sample T összehasonlítás (diagnosztika)">
            
            A Pipeline Auditban a szivárgó (in-sample) hőmérséklet is megjelenik a valós prequential
            T mellett — kizárólag összehasonlításra, predikcióra soha.
          </ToggleRow>
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle as="h3">
            <FlaskConical className="h-3.5 w-3.5 text-chart-4" aria-hidden="true" />
            Kísérleti ágak (alapból kikapcsolva)
          </PanelTitle>
        </PanelHeader>
        <div className="flex flex-col gap-3 px-3 py-3.5 sm:px-4">
          <p className="max-w-prose text-ui-xs leading-relaxed text-muted-foreground">
            Hipotézis-alapú ágak. Bekapcsolva sem lépnek automatikusan élesbe: csak akkor
            befolyásolják az előrejelzést, ha a bootstrap konfidencia-intervallumuk kizárja a
            nullát.
          </p>

          <ToggleRow
            checked={settings.experiments.dixonColes}
            onChange={(next) =>
            onUpdateSettings({ experiments: { ...settings.experiments, dixonColes: next } })
            }
            title="Dixon–Coles ρ korrekció mérése">
            
            Az alacsony gólos Poisson-cellák korrekciója. A rendszer előbb megméri, és csak igazolt
            javulás esetén engedi élesbe.
          </ToggleRow>

          <ToggleRow
            checked={settings.experiments.glicko2}
            onChange={(next) =>
            onUpdateSettings({ experiments: { ...settings.experiments, glicko2: next } })
            }
            title="Glicko-2 A/B mérés (párhuzamos ág)">
            
            A dinamikus rating külön ágon fut, és soha nem kerül az M1 jellemzői közé a Poisson
            támadó/védő mutatók mellé — így elkerülhető a multikollinearitás.
          </ToggleRow>
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle as="h3">
            <Hammer className="h-3.5 w-3.5 text-signal" aria-hidden="true" />
            Karbantartás & tárolás
          </PanelTitle>
        </PanelHeader>
        <div className="flex flex-col gap-3 px-3 py-3.5 sm:px-4">
          <p className="max-w-prose text-ui-xs leading-relaxed text-muted-foreground">
            Tárolási réteg:{' '}
            <span className="font-mono text-foreground">
              {storageBackend === 'local' ? 'helyi (tartós)' : 'memória (munkamenetig)'}
            </span>
            . A JSON export/import a katasztrófa-visszaállítás útja, és a felhő tier bekapcsolása
            után is változatlanul működik.
          </p>

          {storageWarning ?
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 rounded-md border border-chart-4/30 bg-chart-4/10 px-3 py-2 text-ui-sm text-chart-4">
            
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">{storageWarning}</span>
              <button
              type="button"
              className="btn btn--ghost btn--sm tap shrink-0"
              disabled={busy}
              onClick={onPruneOldestSeason}>
              
                Legrégebbi szezon törlése
              </button>
            </div> :
          null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn--outline btn--sm tap gap-1.5"
              disabled={busy}
              title="Minden checkpoint eldobása és teljes historikus újraszámítás mindkét ligára."
              onClick={onFullRebuild}>
              
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Teljes újraépítés
            </button>
          </div>
        </div>
      </Panel>
    </div>);

}