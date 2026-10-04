import type { CoreEvidenceLevel, CoreEvidenceSnapshot } from '../../types/winmix';
import { EVIDENCE_COPY, coherentLevelOf } from '../../utils/coreEvidence';

/**
 * The evidence level of one core line, always with its own explanation.
 *
 * The whole point of the three levels is that the operator can tell a MISSING
 * measurement apart from a FAILED one, so this badge never appears without the
 * sentence that says which of the two it is.
 */

const TONE_CLASS: Record<'positive' | 'warning' | 'negative', string> = {
  positive: 'border-positive/35 bg-positive-soft text-positive',
  warning: 'border-chart-4/35 bg-chart-4/10 text-chart-4',
  negative: 'border-negative/35 bg-negative-soft text-negative'
};

interface CoreEvidenceBadgeProps {
  level: CoreEvidenceLevel;
  snapshot?: CoreEvidenceSnapshot | null;
  /** Show the audited-observation coverage inline. */
  withCoverage?: boolean;
  className?: string;
}

export function CoreEvidenceBadge({
  level,
  snapshot = null,
  withCoverage = false,
  className = ''
}: CoreEvidenceBadgeProps) {
  /* The snapshot is the single source of truth: when one is present its own
   * (coherence-checked) level wins, so the badge can never print `Kizárt` next
   * to a `0 / 20` coverage caption. */
  const effectiveLevel = snapshot ? coherentLevelOf(snapshot) : level;
  const copy = EVIDENCE_COPY[effectiveLevel];
  const detail = snapshot?.headline ?? copy.detail;

  return (
    <span
      title={detail}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-label ${TONE_CLASS[copy.tone]} ${className}`}>
      
      <span className="sr-only">Evidencia-szint: </span>
      {copy.label}
      {withCoverage && snapshot ?
      <span className="font-normal opacity-80">
          {snapshot.observations}/{snapshot.required}
        </span> :
      null}
    </span>);

}