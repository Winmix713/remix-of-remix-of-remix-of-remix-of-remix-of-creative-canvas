import React from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, TrendingDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { VERDICT_LABEL, type CalibrationVerdict, type VerdictLevel } from '../../utils/evalWindows';

const tone: Record<VerdictLevel, {wrap: string;badge: string;icon: string;}> = {
  ok: {
    wrap: 'border-positive/35 bg-positive-soft',
    badge: 'border-positive/40 bg-positive-soft text-positive',
    icon: 'text-positive'
  },
  watch: {
    wrap: 'border-chart-4/35 bg-chart-4/10',
    badge: 'border-chart-4/40 bg-chart-4/15 text-chart-4',
    icon: 'text-chart-4'
  },
  degrading: {
    wrap: 'border-destructive/40 bg-destructive/10',
    badge: 'border-destructive/40 bg-destructive/15 text-destructive',
    icon: 'text-destructive'
  },
  unknown: {
    wrap: 'border-border bg-elevated/50',
    badge: 'border-border bg-elevated text-muted-foreground',
    icon: 'text-muted-foreground'
  }
};

const icons: Record<VerdictLevel, React.ComponentType<{className?: string;}>> = {
  ok: CheckCircle2,
  watch: AlertTriangle,
  degrading: TrendingDown,
  unknown: HelpCircle
};

/**
 * The single stated conclusion at the top of the audit surface, with the two
 * or three numbers that produced it. Colour is never the only signal: the
 * level is also spelled out as a text badge.
 */
export function CalibrationVerdictBar({
  verdict,
  league



}: {verdict: CalibrationVerdict;league: string;}) {
  const t = tone[verdict.level];
  const Icon = icons[verdict.level];

  return (
    <section
      role={verdict.level === 'degrading' ? 'alert' : 'status'}
      aria-label="Kalibrációs verdikt"
      className={cn('flex flex-col gap-3 rounded-lg border px-3 py-3.5 shadow-panel sm:px-4', t.wrap)}>
      
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Icon className={cn('h-5 w-5 shrink-0', t.icon)} aria-hidden={true} />
        <h2 className="min-w-0 flex-1 text-ui-base font-bold text-foreground">
          {verdict.headline}
        </h2>
        <span
          className={cn(
            'shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-ui-2xs font-bold uppercase tracking-label',
            t.badge
          )}>
          
          {VERDICT_LABEL[verdict.level]}
        </span>
        <span className="shrink-0 font-mono text-ui-2xs uppercase tracking-label text-muted-foreground">
          {league}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5 border-t border-border/60 pt-2.5">
        {verdict.reasons.map((reason) =>
        <li
          key={reason}
          className="flex items-start gap-2 text-ui-xs leading-relaxed text-muted-foreground">
          
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden={true} />
            <span className="min-w-0">{reason}</span>
          </li>
        )}
      </ul>
    </section>);

}