import { ShieldCheck, TriangleAlert } from 'lucide-react';
import type { CoreTier } from '../../types/winmix';
import { CORE_TIER_DETAIL, CORE_TIER_LABEL, type CoreConfidenceReading } from '../../utils/slip';

/**
 * CORE TIERING — the selection tier of a Core line, as its own badge.
 *
 * Deliberately SEPARATE from `CoreEvidenceBadge`. The two answer different
 * questions and a round can produce every combination of them:
 *   tier      — how strong the quadrant judged the signal-plus-information pair,
 *   evidence  — whether the signalled probability has been measured at all.
 * A Secondary line may be fully calibrated, and a Primary line may still be
 * conditional, so collapsing them into one pill would state something false.
 */

interface CoreTierBadgeProps {
  /** `null` renders nothing unless `legacy` is set. */
  tier: CoreTier | null;
  /** The C axis the quadrant judged the line on — named on Secondary lines. */
  confidence?: CoreConfidenceReading | null;
  /**
   * A saved line from before tiering existed. Its tier was never assigned, so
   * it is shown as Legacy rather than guessed.
   */
  legacy?: boolean;
  className?: string;
}

export function CoreTierBadge({
  tier,
  confidence = null,
  legacy = false,
  className = ''
}: CoreTierBadgeProps) {
  const base =
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-label';

  if (!tier) {
    if (!legacy) return null;
    return (
      <span
        title="Ez a sor a core szintezés bevezetése előtt készült — akkor nem kapott szintet, ezért nem is tulajdonítunk neki egyet visszamenőleg."
        className={`${base} border-border bg-elevated text-muted-foreground ${className}`}>
        
        Örökölt core
      </span>);

  }

  const secondary = tier === 'secondary';
  const shortfall =
  secondary && confidence ?
  ` · konf. ${Math.round(confidence.value)} / ${confidence.threshold}` :
  '';

  return (
    <span
      title={`${CORE_TIER_LABEL[tier]} — ${CORE_TIER_DETAIL[tier]}${
      secondary && confidence ?
      ` Mért piaci konfidencia: ${Math.round(confidence.value)}, elsődleges küszöb: ${confidence.threshold}.` :
      ''}`
      }
      className={`${base} ${
      secondary ?
      'border-chart-4/40 bg-chart-4/10 text-chart-4' :
      'border-signal/40 bg-signal-soft text-signal'} ${
      className}`}>
      
      {secondary ?
      <TriangleAlert className="h-2.5 w-2.5" aria-hidden={true} /> :

      <ShieldCheck className="h-2.5 w-2.5" aria-hidden={true} />
      }
      {secondary ? 'Másodlagos' : 'Elsődleges'}
      {shortfall}
    </span>);

}