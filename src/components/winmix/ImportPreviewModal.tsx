import React, { useCallback, useRef } from 'react';
import { Layers, Replace, TriangleAlert, Upload, X } from 'lucide-react';
import { LEAGUE_FLAG } from '../../data/leagues';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { cn } from '../../lib/utils';
import type { ImportSummary } from '../../utils/importJson';

interface ImportPreviewModalProps {
  fileName: string;
  current: ImportSummary;
  incoming: ImportSummary;
  warnings: string[];
  busy: boolean;
  onCancel: () => void;
  onApply: (mode: 'merge' | 'replace') => void;
}

interface Row {
  label: string;
  current: string;
  incoming: string;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('hu-HU');
}

function buildRows(current: ImportSummary, incoming: ImportSummary): Row[] {
  const byLeague = (summary: ImportSummary, field: 'seasonsByLeague' | 'matchesByLeague') =>
  `${LEAGUE_FLAG.angol} ${summary[field].angol} / ${LEAGUE_FLAG.spanyol} ${summary[field].spanyol}`;

  return [
  { label: 'Szezonok', current: `${current.seasons} db`, incoming: `${incoming.seasons} db` },
  {
    label: 'Szezonok ligánként',
    current: byLeague(current, 'seasonsByLeague'),
    incoming: byLeague(incoming, 'seasonsByLeague')
  },
  {
    label: 'Mérkőzések',
    current: `${current.matches} db`,
    incoming: `${incoming.matches} db`
  },
  {
    label: 'Mérkőzések ligánként',
    current: byLeague(current, 'matchesByLeague'),
    incoming: byLeague(incoming, 'matchesByLeague')
  },
  {
    label: 'Csapat súlyok',
    current: `${current.weights} db`,
    incoming: `${incoming.weights} db`
  },
  { label: 'Alias nevek', current: `${current.aliases} db`, incoming: `${incoming.aliases} db` },
  {
    label: 'Kalibráció (T)',
    current: `${current.calibrationT.angol.toFixed(2)} / ${current.calibrationT.spanyol.toFixed(2)}`,
    incoming: `${incoming.calibrationT.angol.toFixed(2)} / ${incoming.calibrationT.spanyol.toFixed(2)}`
  },
  {
    label: 'Séma-verzió',
    current: current.schemaVersion !== null ? `v${current.schemaVersion}` : '—',
    incoming: incoming.schemaVersion !== null ? `v${incoming.schemaVersion}` : '—'
  },
  {
    label: 'Exportálva',
    current: '—',
    incoming: formatDate(incoming.exportedAt)
  }];

}

export function ImportPreviewModal({
  fileName,
  current,
  incoming,
  warnings,
  busy,
  onCancel,
  onApply
}: ImportPreviewModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const rows = buildRows(current, incoming);

  const onEscape = useCallback(() => {
    if (!busy) onCancel();
  }, [busy, onCancel]);

  // Real focus trap: Tab used to escape into the page behind the overlay.
  const trapRef = useFocusTrap<HTMLDivElement>({ onEscape, initialFocusRef: closeRef });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}>
      
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="JSON adatbázis importálása"
        className="flex max-h-[90vh] w-full max-w-[680px] flex-col gap-4 overflow-y-auto rounded-xl border border-signal/20 bg-card p-6 shadow-panel-lg">
        
        <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-data-base font-extrabold text-foreground">
              <Upload className="h-4 w-4 text-signal" aria-hidden={true} />
              Adatbázis importálása
            </h2>
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
              {fileName}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="btn btn--ghost btn--sm"
            aria-label="Bezárás"
            disabled={busy}
            onClick={onCancel}>
            
            <X className="h-4 w-4" aria-hidden={true} />
          </button>
        </div>

        {warnings.length > 0 ?
        <ul className="flex flex-col gap-1.5">
            {warnings.map((warning) =>
          <li
            key={warning}
            className="flex items-start gap-2 rounded-md border border-chart-4/30 bg-chart-4/10 px-3 py-2 text-[12px] text-chart-4">
            
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden={true} />
                {warning}
              </li>
          )}
          </ul> :
        null}

        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[1.1fr_1fr_1fr] gap-2 border-b border-border bg-elevated/60 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-label text-muted-foreground">
            <span>Adatszelet</span>
            <span>Jelenlegi</span>
            <span className="text-signal">Importált</span>
          </div>
          <ul>
            {rows.map((row, index) =>
            <li
              key={row.label}
              className={cn(
                'grid grid-cols-[1.1fr_1fr_1fr] items-center gap-2 px-3 py-2 text-[12px]',
                index % 2 === 1 ? 'bg-background/40' : undefined
              )}>
              
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-mono tabular-nums text-foreground">{row.current}</span>
                <span className="font-mono tabular-nums text-signal">{row.incoming}</span>
              </li>
            )}
          </ul>
        </div>

        <p className="text-[12px] leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Összefésülés:</strong> a szezonok tartalom-hash alapján
          egyesülnek, a már betöltött állományok kimaradnak; a súlyok és aliasok ütközésénél az
          importált érték nyer.{' '}
          <strong className="text-foreground">Felülírás:</strong> a jelenlegi adatbázis helyére a
          fájl tartalma lép, és a forduló összeállítása kiürül. A Tipp Napló egyik esetben sem
          változik — az export egyelőre nem tartalmazza a szelvényeket.
        </p>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
          <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={onCancel}>
            Mégse
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm gap-1.5"
            disabled={busy}
            onClick={() => onApply('merge')}>
            
            <Layers className="h-3.5 w-3.5" aria-hidden={true} />
            Összefésülés
          </button>
          <button
            type="button"
            className="btn btn--signal btn--sm gap-1.5"
            disabled={busy}
            onClick={() => onApply('replace')}>
            
            <Replace className="h-3.5 w-3.5" aria-hidden={true} />
            Teljes felülírás
          </button>
        </div>
      </div>
    </div>);

}