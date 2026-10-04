import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { BTTS_DEATHZONE_GATE_ACTIVE } from '../../utils/coreEligibility';
import { MARQUEE_RANKING_ACTIVE } from '../../utils/marqueePairs';
import { PHASE6_MARKET_GATING_ACTIVE } from '../../utils/slip';

/**
 * TERMELÉSI KAPUK — a három élesíthető zászló állapota, kimondva.
 *
 * Eddig a zászlók csak a forráskódban látszottak: a felület úgy nézett ki,
 * mintha a halálzóna-kapu, a Phase 6 piaci kapu és a rangadó rangsorolás
 * élne, holott mindhárom árnyékmódban fut. Ez a panel a mérés és a tényleges
 * viselkedés közti különbséget teszi láthatóvá.
 */

interface GateDescriptor {
  key: string;
  label: string;
  active: boolean;
  shadow: string;
  live: string;
}

const GATES: GateDescriptor[] = [
{
  key: 'deathzone',
  label: 'BTTS halálzóna kapu (40–55%)',
  active: BTTS_DEATHZONE_GATE_ACTIVE,
  shadow:
  'A 40–55% sávban futó, 48% alatti modellvalószínűségű sor NEM esik ki — csak ' +
  'árnyék-jelzést kap a trace-ben.',
  live: 'A 40–55% sávban futó, 48% alatti modellvalószínűségű sor hard kizárásra kerül.'
},
{
  key: 'phase6',
  label: 'Phase 6 piaci kapuzás',
  active: PHASE6_MARKET_GATING_ACTIVE,
  shadow: 'A cáfolt sávú piaci sor a rangsorban büntetést kap, de nem esik ki a kapun.',
  live: 'A cáfolt sávú piaci sor kiesik a kapun.'
},
{
  key: 'marquee',
  label: 'Rangadó rangsorolási korrekció',
  active: MARQUEE_RANKING_ACTIVE,
  shadow: 'A rangadó-büntetés kiszámolódik és látszik, de a rangsort nem módosítja.',
  live: 'A rangadó-büntetés ténylegesen levonódik a rangsorolási pontszámból.'
}];


export function ProductionGatesPanel() {
  const activeCount = GATES.filter((gate) => gate.active).length;

  return (
    <section
      aria-label="Termelési kapuk állapota"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-panel">
      
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-label text-muted-foreground">
          Termelési kapuk
        </h3>
        <p className="font-mono text-[10px] text-muted-foreground">
          {activeCount} / {GATES.length} éles
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {GATES.map((gate) =>
        <li
          key={gate.key}
          className="flex items-start gap-2 rounded-md border border-border bg-background/60 px-3 py-2">
          
            {gate.active ?
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive" aria-hidden={true} /> :

          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-chart-4" aria-hidden={true} />
          }
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-foreground">
                {gate.label}
                <span
                className={`rounded-sm border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-label ${
                gate.active ?
                'border-positive/40 bg-positive-soft text-positive' :
                'border-chart-4/40 bg-chart-4/10 text-chart-4'}`
                }>
                
                  {gate.active ? 'éles' : 'árnyékmód'}
                </span>
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                {gate.active ? gate.live : gate.shadow}
              </p>
            </div>
          </li>
        )}
      </ul>

      <p className="rounded-md border border-border bg-background/60 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
        Az árnyékmód nem hiba: a kapuk küszöbei addig nem élesíthetők, amíg a
        történelmi, out-of-sample visszaigazolás nem támasztja alá őket. A validáció
        állapotát a Pipeline üzemeltetés „Validáció / Backtest” füle mutatja.
      </p>
    </section>);

}
