import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SLIP_STATUS_LABEL, slipHitCount, slipStatus } from '../../utils/ledger';
import type { Slip, SlipLine, SlipStatus } from '../../types/winmix';
import { ResultEntryRow } from './ResultEntryRow';

const statusTone: Record<SlipStatus, string> = {
  pending: 'border-border bg-elevated text-muted-foreground',
  won: 'border-positive/40 bg-positive-soft text-positive',
  partial: 'border-chart-4/40 bg-chart-4/15 text-chart-4',
  lost: 'border-negative/40 bg-negative-soft text-negative'
};

interface LedgerTableProps {
  slips: Slip[];
  onUpdateLine: (slipId: string, lineId: string, patch: Partial<SlipLine>) => void;
  onDelete: (slipId: string) => void;
  emptyMessage?: string;
}

export function LedgerTable({
  slips,
  onUpdateLine,
  onDelete,
  emptyMessage = 'Még nincs elmentett szelvény. Állíts össze egy fordulót a Forduló Prediktorban, és mentsd el a Top 3+3 ajánlást.'
}: LedgerTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(slips.slice(0, 1).map((s) => s.id))
  );

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);else
      next.add(id);
      return next;
    });
  };

  if (slips.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-ui-sm leading-relaxed text-muted-foreground">
        {emptyMessage}
      </p>);

  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {slips.map((slip) => {
        const status = slipStatus(slip);
        const hits = slipHitCount(slip);
        const open = expanded.has(slip.id);
        return (
          <li key={slip.id}>
            <div className="flex items-start gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
              <button
                type="button"
                onClick={() => toggle(slip.id)}
                aria-expanded={open}
                className="flex min-w-0 flex-1 items-start gap-2 text-left">
                
                {open ?
                <ChevronDown
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden={true} /> :


                <ChevronRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden={true} />

                }
                <span className="min-w-0">
                  <span className="block truncate text-ui-base font-bold text-foreground">
                    {slip.roundName}
                  </span>
                  <span className="mt-0.5 block font-mono text-ui-2xs uppercase tracking-label text-muted-foreground">
                    {new Date(slip.createdAt).toLocaleString('hu-HU')} · {slip.lines.length} tipp ·
                    komb. {(slip.combinedProb * 100).toFixed(1)}%
                  </span>
                  {slip.zeroCore ?
                  <span className="mt-1 inline-block rounded-sm border border-chart-4/40 bg-chart-4/15 px-2 py-0.5 font-mono text-ui-2xs font-bold uppercase text-chart-4">
                      0 core forduló
                    </span> :
                  null}
                </span>
              </button>

              <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                <span className="font-mono text-ui-sm font-bold tabular-nums text-foreground">
                  {hits.won}/{hits.total}
                </span>
                <span
                  className={cn(
                    'rounded-sm border px-2 py-0.5 font-mono text-ui-2xs font-bold uppercase',
                    statusTone[status]
                  )}>
                  
                  {SLIP_STATUS_LABEL[status]}
                </span>
              </div>

              <button
                type="button"
                aria-label={`${slip.roundName} szelvény törlése`}
                onClick={() => onDelete(slip.id)}
                className="tap flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-elevated hover:text-negative">
                
                <Trash2 className="h-3.5 w-3.5" aria-hidden={true} />
              </button>
            </div>
            {open ?
            <ul className="border-t border-border bg-background/40">
                {slip.lines.map((line) =>
              <ResultEntryRow
                key={line.id}
                line={line}
                onChange={(patch) => onUpdateLine(slip.id, line.id, patch)} />

              )}
              </ul> :
            null}
          </li>);

      })}
    </ul>);

}