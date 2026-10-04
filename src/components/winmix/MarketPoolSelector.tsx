import { useState } from 'react';
import { Layers, RotateCcw } from 'lucide-react';
import {
  CORE_CARD_COUNT,
  MARKET_IDS,
  coreCardMarkets,
  defaultCoreCards,
  defaultSlipMarkets,
  sameMarkets,
  summarizeMarkets } from
'../../utils/marketCatalog';
import type { CoreCardMarkets, SlipMarketPreferences } from '../../types/winmix';
import { MarketCardEditor } from './marketPool/MarketCardEditor';

/**
 * Piac-készlet — Top 3+3.
 *
 * A három core kártya KÜLÖN-KÜLÖN állítható: mindegyik saját piac-készletet
 * kap, a joker sorok pedig közös készletből dolgoznak. Minden kattintás
 * azonnal érvényesül — a szelvény a memóriában lévő elemzésekből épül újra,
 * nincs szükség a forduló újraelemzésére —, és a beállítás mentve marad.
 */

interface MarketPoolSelectorProps {
  value: SlipMarketPreferences;
  /** Fut-e éppen az elemzés — ilyenkor a szelvény a futás végén rendeződik át. */
  running: boolean;
  onChange: (next: SlipMarketPreferences) => void;
}

const CORE_CARDS: Array<{code: string;name: string;hint: string;}> = [
{
  code: 'Core 01',
  name: 'Elsődleges core',
  hint: 'A kártya a saját készletének legerősebb, kapun belüli sorát kapja.'
},
{
  code: 'Core 02',
  name: 'Másodlagos core',
  hint: 'Külön készlet — így két core sor nem ugyanarra a piacra fut.'
},
{
  code: 'Core 03',
  name: 'Harmadlagos core',
  hint: 'Zárt vagy alacsony gólszámú menetekre érdemes hangolni.'
}];


const JOKER_CARD = {
  code: 'Joker 01–03',
  name: 'Közös joker készlet',
  hint: 'A joker sorok lazább kapun mennek át, így volatilis mintát is behozhatnak.'
};

function toggleIn(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id];
}

export function MarketPoolSelector({
  value,
  running,
  onChange
}: MarketPoolSelectorProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const configuredCount = value.coreCards.filter((card) => card.length > 0).length;
  const isDefault = sameMarkets(value, defaultSlipMarkets());

  const setCard = (index: number, ids: string[]) => {
    const cards = [...value.coreCards] as CoreCardMarkets;
    cards[index] = ids;
    onChange({ ...value, coreCards: cards });
  };

  const toggle = (id: string | null) =>
  setExpanded((current) => current === id ? null : id);

  return (
    <section
      aria-label="Piac-készlet a Top 3+3 szelvényhez"
      className="rounded-lg border border-border bg-card shadow-panel">
      
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <h2 className="text-[13px] font-bold text-foreground">
            Piac-készlet — Top 3+3
          </h2>
          <p className="mt-1 max-w-2xl text-[11px] text-muted-foreground">
            Állítsd be a három core kártyát külön-külön: mindegyik saját
            piacokból dolgozik, a joker sorok pedig közös készletből. A slotok
            száma marad 3+3, a kalibrációs kapu szigora sem változik, és egy
            mérkőzés továbbra is csak egyszer szerepelhet a szelvényen.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-mono text-[10px] font-bold text-muted-foreground">
            <Layers className="h-3.5 w-3.5" aria-hidden={true} />
            {configuredCount} / {CORE_CARD_COUNT} core beállítva
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm gap-1.5"
            disabled={isDefault}
            onClick={() => onChange(defaultSlipMarkets())}>
            
            <RotateCcw className="h-3.5 w-3.5" aria-hidden={true} />
            Alapértelmezés
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-2 p-4">
        {running ?
        <p className="rounded-md border border-chart-4/30 bg-chart-4/10 px-3 py-2 text-[11px] text-chart-4">
            Az elemzés éppen fut — a módosított készlet a futás végén rendezi át
            a szelvényt.
          </p> :
        null}

        {CORE_CARDS.map((card, index) => {
          const ids = coreCardMarkets(value, index);
          const key = `core-${index}`;
          return (
            <MarketCardEditor
              key={key}
              code={card.code}
              name={card.name}
              hint={card.hint}
              ids={ids}
              kind="core"
              expanded={expanded === key}
              onToggleExpand={() => toggle(key)}
              onToggleMarket={(id) => setCard(index, toggleIn(ids, id))}
              resetLabel="Kártya ürítése"
              onReset={() => setCard(index, [])}
              extraAction={{
                label: 'Alapérték',
                onClick: () => setCard(index, [...defaultCoreCards()[index]])
              }} />);


        })}

        <MarketCardEditor
          code={JOKER_CARD.code}
          name={JOKER_CARD.name}
          hint={JOKER_CARD.hint}
          ids={value.joker}
          kind="joker"
          expanded={expanded === 'joker'}
          onToggleExpand={() => toggle('joker')}
          onToggleMarket={(id) =>
          onChange({ ...value, joker: toggleIn(value.joker, id) })
          }
          resetLabel="Készlet ürítése"
          onReset={() => onChange({ ...value, joker: [] })}
          extraAction={{
            label: 'Mind',
            onClick: () => onChange({ ...value, joker: [...MARKET_IDS] })
          }} />
        
      </div>

      <footer className="flex flex-col gap-1.5 border-t border-border p-4">
        {CORE_CARDS.map((card, index) => {
          const ids = coreCardMarkets(value, index);
          return (
            <div key={card.code} className="flex items-start gap-3">
              <span className="w-20 shrink-0 font-mono text-[10px] font-bold uppercase tracking-label text-muted-foreground">
                {card.code}
              </span>
              <span
                className={`min-w-0 font-mono text-[10px] leading-relaxed ${
                ids.length > 0 ? 'text-muted-foreground' : 'text-chart-4'}`
                }>
                
                {ids.length > 0 ? summarizeMarkets(ids, 8) : 'Üres — nem tölt fel kártyát'}
              </span>
            </div>);

        })}
        <div className="flex items-start gap-3">
          <span className="w-20 shrink-0 font-mono text-[10px] font-bold uppercase tracking-label text-muted-foreground">
            Joker
          </span>
          <span
            className={`min-w-0 font-mono text-[10px] leading-relaxed ${
            value.joker.length > 0 ? 'text-muted-foreground' : 'text-chart-4'}`
            }>
            
            {value.joker.length > 0 ?
            `${value.joker.length} piac · ${summarizeMarkets(value.joker, 6)}` :
            'Üres — nem tölt fel kártyát'}
          </span>
        </div>
      </footer>
    </section>);

}