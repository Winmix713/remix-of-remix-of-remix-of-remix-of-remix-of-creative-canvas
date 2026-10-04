import React from 'react';
import { cn } from '../../lib/utils';
import type { LineGrade, SlipLine } from '../../types/winmix';
import { gradeLine, requiresHt } from '../../utils/ledger';
import { SlipLineCard } from './SlipCard';
import { CandidateStateBadge } from './CandidateStateBadge';

const gradeMeta: Record<LineGrade, {label: string;className: string;}> = {
  won: { label: 'Bejött', className: 'border-positive/40 bg-positive-soft text-positive' },
  lost: { label: 'Nem jött be', className: 'border-negative/40 bg-negative-soft text-negative' },
  pending: { label: 'Függőben', className: 'border-border bg-elevated text-muted-foreground' }
};

function ScoreInput({
  label,
  value,
  onChange,
  highlight





}: {label: string;value: number | null;onChange: (value: number | null) => void;highlight?: boolean;}) {
  return (
    <label className="flex flex-col items-center gap-0.5">
      <span className="font-mono text-[9px] uppercase tracking-label text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        min={0}
        max={30}
        inputMode="numeric"
        value={value === null ? '' : value}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(null);
            return;
          }
          const parsed = Number.parseInt(raw, 10);
          onChange(Number.isNaN(parsed) ? null : Math.max(0, Math.min(30, parsed)));
        }}
        className={cn(
          'field h-7 w-11 px-1 text-center font-mono text-[12px] tabular-nums',
          highlight && value === null ? 'border-chart-4/50' : undefined
        )} />
      
    </label>);

}

export function ResultEntryRow({
  line,
  onChange



}: {line: SlipLine;onChange: (patch: Partial<SlipLine>) => void;}) {
  const grade = gradeLine(line);
  const meta = gradeMeta[grade];
  const needsHt = requiresHt(line.code);

  return (
    <li className="flex flex-col gap-3 border-b border-border px-4 py-4 last:border-b-0">
      <SlipLineCard line={line} />

      {line.candidateState ?
      <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="font-mono text-[9px] uppercase tracking-label text-muted-foreground">
            Állapot kiadáskor
          </span>
          <CandidateStateBadge state={line.candidateState} />
        </div> :
      null}

      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <p className="max-w-md text-[10px] leading-relaxed text-muted-foreground">
          Rögzítsd a tényleges eredményt; a találati állapot automatikusan frissül.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-end gap-1">
            <ScoreInput
              label="HT H"
              value={line.htHome}
              highlight={needsHt}
              onChange={(v) => onChange({ htHome: v })} />
            
            <ScoreInput
              label="HT V"
              value={line.htAway}
              highlight={needsHt}
              onChange={(v) => onChange({ htAway: v })} />
            
          </div>
          <div className="flex items-end gap-1">
            <ScoreInput label="FT H" value={line.ftHome} onChange={(v) => onChange({ ftHome: v })} />
            <ScoreInput label="FT V" value={line.ftAway} onChange={(v) => onChange({ ftAway: v })} />
          </div>
          <span
            aria-live="polite"
            className={cn(
              'mb-0.5 inline-block whitespace-nowrap rounded-sm border px-2 py-0.5 font-mono text-[10px] font-bold uppercase',
              meta.className
            )}>
            
            {meta.label}
          </span>
        </div>
      </div>
    </li>);

}