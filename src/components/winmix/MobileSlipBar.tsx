import { Sigma } from 'lucide-react';

interface MobileSlipBarProps {
  combinedProb: number;
  filled: number;
  total: number;
  invalid: boolean;
}

/**
 * Sticky combined-probability readout for narrow screens, where the slip panel
 * scrolls far away from the fixture cards.
 */
export function MobileSlipBar({ combinedProb, filled, total, invalid }: MobileSlipBarProps) {
  return (
    <div className="pointer-events-none sticky bottom-0 z-30 -mx-4 mt-2 px-4 pb-3 2xl:hidden">
      <div
        className={`pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 backdrop-blur-md ${
        invalid ?
        'border-negative/30 bg-negative-soft' :
        'border-signal/25 bg-surface-1/90'}`
        }>
        <span className="flex items-center gap-2 text-ui-xs text-muted-foreground">
          <Sigma className="h-3.5 w-3.5 text-signal" aria-hidden={true} />
          {filled} / {total} szerepkör
        </span>
        <span
          className={`text-ui-base font-medium tabular-nums ${
          invalid ? 'text-negative' : 'text-foreground'}`
          }>
          {invalid ?
          'érvénytelen' :
          filled > 0 ?
          `${(combinedProb * 100).toFixed(1)}%` :
          '—'}
        </span>
      </div>
    </div>);

}
