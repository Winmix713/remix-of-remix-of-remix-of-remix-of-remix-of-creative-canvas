import { motion } from 'framer-motion';
import { AlertTriangle, Check } from 'lucide-react';
import { MARKET_BY_ID } from '../../../utils/marketCatalog';

interface MarketChipProps {
  id: string;
  selected: boolean;
  /** Core kártyán a ritkán kalibrált piac külön jelzést kap. */
  warnRisk: boolean;
  onToggle: () => void;
}

export function MarketChip({ id, selected, warnRisk, onToggle }: MarketChipProps) {
  const option = MARKET_BY_ID[id];
  const risky = warnRisk && option.coreRisk === true;

  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={selected}
      title={
      risky ?
      `${option.label} — ritkán jut át a kalibrációs kapun, gyakran kapun kívüli sort ad.` :
      option.label
      }
      onClick={onToggle}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] font-semibold leading-none outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-ring/50 ${
      selected ?
      'border-signal/50 bg-signal-soft text-signal' :
      'border-border bg-elevated text-muted-foreground hover:border-signal/30 hover:text-foreground'}`
      }>
      
      <motion.span
        initial={false}
        animate={{ width: selected ? 14 : 0, opacity: selected ? 1 : 0 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        className="flex items-center overflow-hidden">
        
        <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden={true} />
      </motion.span>
      {option.short}
      {risky ?
      <AlertTriangle
        className={`h-3 w-3 ${selected ? 'text-chart-4' : 'text-chart-4/70'}`}
        aria-label="Ritkán kalibrált piac" /> :

      null}
    </motion.button>);

}