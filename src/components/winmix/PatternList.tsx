import React from 'react';
import { Check, Minus, TriangleAlert } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PATTERN_LABEL } from '../../utils/patterns';
import type { PatternAgreement, PatternHit } from '../../types/winmix';
import { SufficiencyBadge } from './Badges';

const agreementMeta: Record<
  PatternAgreement,
  {icon: typeof Check;className: string;title: string;}> =
{
  agree: {
    icon: Check,
    className: 'text-positive',
    title: 'A Pipeline v2 ajánlása megerősíti ezt a mintát'
  },
  conflict: {
    icon: TriangleAlert,
    className: 'text-negative',
    title: 'A Pipeline v2 ajánlása ellentmond ennek a mintának'
  },
  neutral: {
    icon: Minus,
    className: 'text-muted-foreground',
    title: 'A modell semleges ezzel a mintával szemben'
  }
};

export function StabilityBar({ value, className }: {value: number;className?: string;}) {
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-elevated', className)}
      role="img"
      aria-label={`Stabilitás: ${value} / 100`}>
      
      <div
        className={cn(
          'h-full rounded-full',
          value >= 70 ? 'bg-positive' : value >= 55 ? 'bg-signal' : 'bg-chart-4'
        )}
        style={{ width: `${Math.min(100, Math.max(2, value))}%` }} />
      
    </div>);

}

export function PatternRow({ pattern }: {pattern: PatternHit;}) {
  const meta = agreementMeta[pattern.agreement];
  const Icon = meta.icon;
  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-border bg-background/60 px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-foreground">{pattern.label}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-label text-muted-foreground">
            <span>{PATTERN_LABEL[pattern.type]}</span>
            <span aria-hidden={true}>·</span>
            <span>{pattern.code}</span>
            <span aria-hidden={true}>·</span>
            <span>
              {Math.round(pattern.rawRate * 100)}% / {pattern.sample} meccs
            </span>
            {pattern.usedReverse ?
            <>
                <span aria-hidden={true}>·</span>
                <span className="text-chart-4">fordított pálya is</span>
              </> :
            null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SufficiencyBadge level={pattern.sufficiency} />
          <Icon className={cn('h-3.5 w-3.5', meta.className)} aria-hidden={true} {...{ title: meta.title }} />
          <span className="font-mono text-[13px] font-bold tabular-nums text-foreground">
            {pattern.stability}
          </span>
        </div>
      </div>
      <StabilityBar value={pattern.stability} />
    </li>);

}

export function PatternList({ patterns }: {patterns: PatternHit[];}) {
  if (patterns.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-3 text-center text-[11px] text-muted-foreground">
        Nincs a küszöböt elérő minta ehhez a párosításhoz.
      </p>);

  }
  return (
    <ul className="flex flex-col gap-1.5">
      {patterns.map((p) =>
      <PatternRow key={p.id} pattern={p} />
      )}
    </ul>);

}