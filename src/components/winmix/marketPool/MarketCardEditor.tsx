import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, ChevronDown, RotateCcw } from 'lucide-react';
import { MARKET_FAMILY_LIST, summarizeMarkets } from '../../../utils/marketCatalog';
import { MarketGroupRow } from './MarketGroupRow';

interface MarketCardEditorProps {
  /** Kártyakód, pl. „CORE 01" vagy „JOKER 01–03". */
  code: string;
  /** Emberi név, pl. „Elsődleges core". */
  name: string;
  /** Mit tölt fel ez a készlet, egy sorban. */
  hint: string;
  ids: string[];
  /** Core kártyán a szigorú kapu fut — a ritkán kalibrált piacok jelzést kapnak. */
  kind: 'core' | 'joker';
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleMarket: (id: string) => void;
  resetLabel: string;
  onReset: () => void;
  extraAction?: {label: string;onClick: () => void;};
}

export function MarketCardEditor({
  code,
  name,
  hint,
  ids,
  kind,
  expanded,
  onToggleExpand,
  onToggleMarket,
  resetLabel,
  onReset,
  extraAction
}: MarketCardEditorProps) {
  const configured = ids.length > 0;

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-elevated/40 transition-colors duration-fast focus-within:border-signal/30">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggleExpand}
        className="flex w-full items-center justify-between gap-3 p-3 text-left outline-none transition-colors duration-fast hover:bg-elevated focus-visible:bg-elevated">
        
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-mono text-[11px] font-bold uppercase tracking-label text-foreground">
            {code}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">{name}</span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          {configured ?
          <span className="inline-flex items-center gap-1.5 rounded-full bg-positive-soft px-2 py-0.5 font-mono text-[10px] font-bold text-positive">
              <CheckCircle2 className="h-3 w-3" aria-hidden={true} />
              {ids.length} piac
            </span> :

          <span className="inline-flex items-center gap-1.5 rounded-full bg-chart-4/10 px-2 py-0.5 font-mono text-[10px] font-bold text-chart-4">
              <AlertTriangle className="h-3 w-3" aria-hidden={true} />
              Nincs beállítva
            </span>
          }
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card">
            
            <ChevronDown
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden={true} />
            
          </motion.span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded ?
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.24, ease: 'easeInOut' }}
          className="overflow-hidden">
          
            <div className="flex flex-col border-t border-border px-3 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2.5">
                <p className="min-w-0 text-[11px] text-muted-foreground">{hint}</p>
                <span className="flex items-center gap-1">
                  {extraAction ?
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={extraAction.onClick}>
                  
                      {extraAction.label}
                    </button> :
                null}
                  <button
                  type="button"
                  className="btn btn--ghost btn--sm gap-1.5"
                  onClick={onReset}>
                  
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden={true} />
                    {resetLabel}
                  </button>
                </span>
              </div>

              <div className="flex flex-col">
                {MARKET_FAMILY_LIST.map((family) =>
              <MarketGroupRow
                key={family.key}
                family={family.key}
                title={family.label}
                selectedIds={ids}
                warnRisk={kind === 'core'}
                onToggle={onToggleMarket} />

              )}
              </div>

              <p
              className={`mt-2 rounded-md border px-2 py-1.5 font-mono text-[10px] ${
              configured ?
              'border-positive/30 bg-positive-soft text-positive' :
              'border-chart-4/30 bg-chart-4/10 text-chart-4'}`
              }>
              
                {configured ?
              `${summarizeMarkets(ids, 6)} — a legerősebb, ${
              kind === 'core' ? 'szigorú' : 'lazább'} kapun átmenő sor kerül a kártyára.` :

              'Nincs kijelölt piac — ez a kártya üresen marad a szelvényen.'}
              </p>
            </div>
          </motion.div> :
        null}
      </AnimatePresence>
    </div>);

}