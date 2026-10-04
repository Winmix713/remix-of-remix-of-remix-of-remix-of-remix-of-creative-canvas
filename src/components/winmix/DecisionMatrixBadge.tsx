import React from 'react';
import { cn } from '../../lib/utils';
import { DECISION_META, DECISION_ORDER, decisionQuadrantOf } from '../../utils/decision';
import type { DecisionQuadrant } from '../../types/winmix';

/**
 * The single decision primitive of the whole surface.
 *
 * It ALWAYS shows the two orthogonal numbers side by side — probability and
 * confidence — plus the quadrant they select. It never shows a product of the
 * two, because that scalar has no meaning: a 70% chance on 3 matches of history
 * and a 46% chance on 40 matches are different situations, not one number.
 */
export function DecisionMatrixBadge({
  probability,
  confidence,
  quadrant,
  className,
  compact = false









}: { /** P of the top outcome / line, on a 0–1 scale. */probability: number; /** C — the confidence score, 0–100. */confidence: number; /** Optional override; derived from P and C when omitted. */quadrant?: DecisionQuadrant;className?: string;compact?: boolean;}) {
  const key = quadrant ?? decisionQuadrantOf(probability, confidence);
  const meta = DECISION_META[key];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums',
        meta.tone,
        className
      )}
      title={`${meta.label} — ${meta.description}`}>
      
      <span aria-hidden="true">{meta.glyph}</span>
      {compact ? null : <span className="uppercase tracking-label">{meta.label}</span>}
      <span className="font-normal opacity-80">
        P {(probability * 100).toFixed(0)}% · C {Math.round(confidence)}
      </span>
    </span>);

}

/** Legend used on the audit and predictor screens so the four labels are self-explaining. */
export function DecisionMatrixLegend({ className }: {className?: string;}) {
  return (
    <ul
      className={cn(
        'grid grid-cols-1 gap-1.5 text-[11px] text-muted-foreground sm:grid-cols-2',
        className
      )}>
      
      {DECISION_ORDER.map((key) => {
        const meta = DECISION_META[key];
        return (
          <li key={key} className="flex items-start gap-2">
            <span
              className={cn(
                'mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-label',
                meta.tone
              )}>
              
              <span aria-hidden="true">{meta.glyph}</span>
              {meta.label}
            </span>
            <span>{meta.description}</span>
          </li>);

      })}
    </ul>);

}