import React, { useRef, useState } from 'react';
import { FolderOpen, UploadCloud } from 'lucide-react';
import { useWinmix } from '../../contexts/WinmixContext';
import { cn } from '../../lib/utils';
import { Chip } from './Panel';
import type { LeagueMode } from '../../types/winmix';

const LEAGUE_MODES: Array<{value: LeagueMode;label: string;}> = [
{ value: 'auto', label: '⚡ Automatikus ligafelismerés' },
{ value: 'angol', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Kényszerített Angol' },
{ value: 'spanyol', label: '🇪🇸 Kényszerített Spanyol' }];


export function UploadHero() {
  const { importFiles, seasons, uploadResult, isComputing } = useWinmix();
  const [mode, setMode] = useState<LeagueMode>('auto');
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => inputRef.current?.click();

  return (
    <section className="relative overflow-hidden rounded-xl border border-border bg-sheen p-5 shadow-panel sm:p-6">
      {/* One quiet accent bloom, matching the spec's feature surfaces. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-signal/10 blur-3xl" />
      

      <div className="relative z-[2] flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-data-lg font-semibold tracking-tighter text-foreground">
              Bajnokságok &amp; szezonok központi tára
            </h1>
            <p className="mt-1.5 max-w-2xl text-ui-sm leading-relaxed text-muted-foreground">
              Minden feltöltött, kb. 240 mérkőzéses CSV önálló szezonként kerül rögzítésre a
              WinMix as-of predikciós pipeline-hoz.
            </p>
          </div>

          <label className="flex flex-col gap-1">
            <span className="sr-only">Liga felismerési mód</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as LeagueMode)}
              className="field w-full max-w-[280px] cursor-pointer">
              
              {LEAGUE_MODES.map((m) =>
              <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              )}
            </select>
          </label>
        </div>

        <div
          onClick={openPicker}
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer?.files?.length) void importFiles(e.dataTransfer.files, mode);
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-4 rounded-xl border border-dashed p-5 text-center transition-colors duration-base ease-enter sm:flex-row sm:gap-5 sm:text-left',
            isDragging ?
            'border-signal bg-signal-soft' :
            'border-border bg-surface-1 hover:border-signal/50 hover:bg-signal-soft'
          )}>
          
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-signal-soft text-signal">
            <UploadCloud className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="flex flex-1 flex-col gap-1">
            <span className="text-ui-base font-medium text-foreground">
              Húzd be ide a bajnokságok CSV fájljait, vagy kattints a tallózáshoz
            </span>
            <span className="text-ui-xs leading-relaxed text-muted-foreground">
              A motor ellenőrzi a ~240 meccses teljességet (tűréshatárral), deduplikál (sor- és
              fájlszinten) és új sorszámozott bajnokságként rögzíti (akár 50-100 fájl egyszerre,
              korlátozott párhuzamossággal beolvasva).
            </span>
          </div>

          <button
            type="button"
            aria-label="Fájlok tallózása feltöltéshez"
            disabled={isComputing}
            onClick={(e) => {
              e.stopPropagation();
              openPicker();
            }}
            className="btn btn--signal btn--lg shrink-0">
            
            <FolderOpen className="h-4 w-4" aria-hidden="true" />
            Fájlok tallózása…
          </button>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                void importFiles(e.target.files, mode);
                e.target.value = '';
              }
            }} />
          
        </div>

        {uploadResult ?
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-1 px-4 py-3 text-ui-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <span className="live-dot" aria-hidden="true" />
              <span className="font-medium text-foreground">
                {uploadResult.added} db új szezon sikeresen importálva és feldolgozva
              </span>
            </div>
            <Chip>{seasons.length} szezon tárolva</Chip>
          </div> :
        null}

        {uploadResult && uploadResult.warnings.length > 0 ?
        <ul className="flex flex-col gap-1 text-ui-xs text-warning">
            {uploadResult.warnings.map((w, idx) =>
          <li key={`${idx}-${w.slice(0, 24)}`}>{w}</li>
          )}
          </ul> :
        null}
      </div>
    </section>);

}