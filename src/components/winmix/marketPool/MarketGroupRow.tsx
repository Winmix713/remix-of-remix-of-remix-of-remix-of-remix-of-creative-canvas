import { marketsOfFamily, type MarketFamilyKey } from '../../../utils/marketCatalog';
import { MarketChip } from './MarketChip';

interface MarketGroupRowProps {
  family: MarketFamilyKey;
  title: string;
  selectedIds: string[];
  warnRisk: boolean;
  onToggle: (id: string) => void;
}

export function MarketGroupRow({
  family,
  title,
  selectedIds,
  warnRisk,
  onToggle
}: MarketGroupRowProps) {
  const options = marketsOfFamily(family);
  const selectedCount = options.filter((o) => selectedIds.includes(o.id)).length;

  return (
    <div
      role="group"
      aria-label={title}
      className="flex flex-col gap-2 border-b border-border/60 py-3 last:border-b-0">
      
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/80">
          {title}
        </h4>
        <span
          className={`font-mono text-[10px] tabular-nums transition-colors duration-fast ${
          selectedCount > 0 ? 'text-signal' : 'text-muted-foreground/50'}`
          }>
          
          {selectedCount} / {options.length}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {options.map((option) =>
        <MarketChip
          key={option.id}
          id={option.id}
          selected={selectedIds.includes(option.id)}
          warnRisk={warnRisk}
          onToggle={() => onToggle(option.id)} />

        )}
      </div>
    </div>);

}