import React from 'react';
import { useWinmix } from '../../contexts/WinmixContext';
import { cn } from '../../lib/utils';
import { Collapsible } from './Collapsible';
import { Chip } from './Panel';

const levelTone = {
  info: 'text-muted-foreground',
  warn: 'text-chart-4',
  error: 'text-destructive'
} as const;

export function DiagnosticsPanel() {
  const { diagnostics } = useWinmix();

  return (
    <Collapsible
      title={
      <>
          Diagnosztikai napló
          <Chip tone="neutral">{diagnostics.length}</Chip>
        </>
      }
      subtitle="Adatminőség és integritás">
      
      <div className="flex max-h-[240px] flex-col gap-1 overflow-y-auto px-3 py-2 sm:px-4">
        {diagnostics.length === 0 ?
        <p className="font-mono text-ui-xs text-muted-foreground">Nincs még bejegyzés.</p> :

        diagnostics.slice(0, 100).map((entry, idx) =>
        <p
          key={`${entry.ts}-${idx}`}
          className={cn(
            'border-b border-dashed border-border py-1 font-mono text-ui-xs',
            levelTone[entry.level]
          )}>
          
              [{entry.ts.slice(11, 19)}] {entry.message}
            </p>
        )
        }
      </div>
    </Collapsible>);

}