import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import type { PatternHit } from '../../types/winmix';
import { CONFIDENCE_BANDS } from '../../utils/decision';
import { Panel, PanelHeader, PanelTitle } from './Panel';

interface PatternConfidenceSummaryProps {
  patterns: PatternHit[];
}

const BAND_TONE: Record<string, string> = {
  high: 'bg-positive',
  good: 'bg-signal',
  moderate: 'bg-chart-4',
  low: 'bg-negative'
};

/**
 * Confidence distribution of the current round's patterns. Answers a question
 * the per-card view cannot: is this round carried by a few strong lines, or is
 * it a wide field of weak ones?
 */
export function PatternConfidenceSummary({ patterns }: PatternConfidenceSummaryProps) {
  const rows = useMemo(() => {
    const counts: Record<string, number> = { high: 0, good: 0, moderate: 0, low: 0 };
    patterns.forEach((p) => {
      counts[p.band] = (counts[p.band] ?? 0) + 1;
    });
    return CONFIDENCE_BANDS.map((band) => ({
      key: band.key,
      label: band.label,
      range: band.range,
      count: counts[band.key] ?? 0,
      share: patterns.length > 0 ? (counts[band.key] ?? 0) / patterns.length : 0
    }));
  }, [patterns]);

  if (patterns.length === 0) return null;

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>
          <BarChart3 className="h-4 w-4 text-signal" aria-hidden={true} />
          Megbízhatósági eloszlás ({patterns.length} minta)
        </PanelTitle>
      </PanelHeader>
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          {rows.map((row) =>
          row.count > 0 ?
          <div
            key={row.key}
            className={BAND_TONE[row.key]}
            style={{ width: `${row.share * 100}%` }}
            title={`${row.label}: ${row.count}`} /> :
          null
          )}
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {rows.map((row) =>
          <li
            key={row.key}
            className="rounded-xl border border-white/[0.07] bg-surface-1 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${BAND_TONE[row.key]}`}
                aria-hidden={true} />
              <span className="text-ui-xs text-muted-foreground">{row.label}</span>
            </div>
            <p className="mt-1 text-ui-base font-medium tabular-nums text-foreground">
              {row.count}
              <span className="ml-1.5 text-ui-xs text-muted-foreground">
                {(row.share * 100).toFixed(0)}%
              </span>
            </p>
            <p className="font-mono text-[9px] uppercase tracking-label text-muted-foreground/70">
              stab. {row.range}
            </p>
          </li>
          )}
        </ul>
      </div>
    </Panel>);

}
