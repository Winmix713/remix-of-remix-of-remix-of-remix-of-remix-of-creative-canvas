import { Radar, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  QUICK_STRATEGY,
  QUICK_STRATEGY_LIST,
  VETO_MODE_COPY } from
'../../utils/coreStrategy';
import { VETO_REASON_LABEL } from '../../utils/bttsProfile';
import type {
  BttsVetoMode,
  CoreStrategySettings,
  QuickCoreStrategy } from
'../../types/winmix';
import type { StrategyReadout } from '../../utils/slip';

/**
 * PHASE 0 — the daily-use Core selector.
 *
 * One click sets the whole Core side. The counters underneath are the honest
 * part: they say how many fixtures were analysed, how many candidates survived
 * the strict gate, how many survived the profile filter, and therefore WHY a
 * Core card is empty. An empty card is a valid result, not a bug.
 */

interface CoreStrategySelectorProps {
  value: CoreStrategySettings;
  readout: StrategyReadout | null;
  running: boolean;
  onChange: (next: CoreStrategySettings) => void;
}

function Counter({
  label,
  value,
  tone = 'default',
  title





}: {label: string;value: string | number;tone?: 'default' | 'signal' | 'warning';title?: string;}) {
  const valueTone =
  tone === 'signal' ?
  'text-signal' :
  tone === 'warning' ?
  'text-chart-4' :
  'text-foreground';
  return (
    <div
      title={title}
      className="min-w-0 rounded-md border border-border bg-background/60 px-3 py-2">
      
      <dt className="truncate font-mono text-[10px] uppercase tracking-label text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-0.5 font-mono text-[15px] font-bold tabular-nums ${valueTone}`}>
        {value}
      </dd>
    </div>);

}

export function CoreStrategySelector({
  value,
  readout,
  running,
  onChange
}: CoreStrategySelectorProps) {
  const spec = QUICK_STRATEGY[value.quickStrategy];
  const isCustomBtts = value.quickStrategy === 'custom_btts';
  const isCustom = value.mode === 'custom' || value.quickStrategy === 'custom';
  const vetoCopy = VETO_MODE_COPY[value.vetoMode];


  const selectStrategy = (id: QuickCoreStrategy) =>
  onChange({
    ...value,
    quickStrategy: id,
    mode: id === 'custom' ? 'custom' : 'quick'
  });

  const setVeto = (mode: BttsVetoMode) => onChange({ ...value, vetoMode: mode });

  return (
    <section
      aria-label="Core stratégia"
      className="rounded-lg border border-signal/25 bg-card shadow-panel">
      
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[13px] font-bold text-foreground">
            <Radar className="h-4 w-4 text-signal" aria-hidden={true} />
            Core stratégia
          </h2>
          <p className="mt-1 max-w-2xl text-[11px] text-muted-foreground">
            {spec.description}
          </p>
        </div>

        <label className="flex shrink-0 flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
            Stratégia
          </span>
          <select
            value={value.quickStrategy}
            onChange={(e) => selectStrategy(e.target.value as QuickCoreStrategy)}
            className="field h-8 w-[280px] text-[12px]">
            
            {QUICK_STRATEGY_LIST.map((entry) =>
            <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            )}
          </select>
        </label>
      </header>

      <div className="flex flex-col gap-3 p-4">
        {running ?
        <p className="rounded-md border border-chart-4/30 bg-chart-4/10 px-3 py-2 text-[11px] text-chart-4">
            Az elemzés éppen fut — a stratégia váltása a futás végén rendezi át a
            szelvényt.
          </p> :
        null}

        {isCustomBtts ?
        <p className="rounded-md border border-border bg-background/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            Saját mód: kizárólag a beállított mérkőzések BTTS Igen értéke dönt, 50%
            felett, csökkenő sorrendben. Nincs kapu, nincs kalibráció, nincs
            kiütés-szűrő és nincs tartalék-szabály — ezért a szokásos szűrő-számlálók
            itt nem értelmezhetők.
          </p> :
        isCustom ?
        <p className="rounded-md border border-border bg-background/60 px-3 py-2 text-[11px] text-muted-foreground">
            Egyedi módban a lenti „Haladó / egyedi core beállítás” panel dönt: a
            három core kártya a saját piac-készletéből töltődik fel, a megszokott
            tartalék-szabállyal.
          </p> :

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            <Counter label="Elemzett meccs" value={readout?.analysedFixtures ?? 0} />
            <Counter
            label="Core-jelölt (kanonikus)"
            value={readout?.canonicalEligibleCount ?? 0}
            title={`Kanonikus, kapun belüli Core-jelöltek — mérkőzés + piac szerint összevonva. Nyers stratégia-piaci rekordok: ${readout?.rawCandidatesCount ?? 0}.`} />
          
          
            <Counter
            label="Kalibrált core-jelölt"
            value={readout?.calibratedCandidates ?? 0}
            tone="signal"
            title="CSAK a kapun belüli jelöltek, amelyek saját valószínűségi sávja visszamért. Ezek töltik fel a core kártyákat először. Kapun kívül további kalibrált sorok is lehetnek." />
          
            <Counter
            label="Feltételes core-jelölt"
            value={readout?.conditionalCandidates ?? 0}
            tone="warning"
            title="Kapun belüli jelöltek, amelyek minden más szigorú feltételt teljesítenek, de a sávjuk még nincs visszamérve — adathiány, nem cáfolat." />
          
            <Counter
            label="Core kártya"
            value={`${readout?.coreFilled ?? 0} / ${readout?.coreSlots ?? spec.slots}`}
            tone={
            readout && readout.coreFilled < readout.coreSlots ? 'warning' : 'default'
            } />
          
          </dl>
        }

        {spec.profileVeto && !isCustomBtts ?
        <div className="flex flex-col gap-2 rounded-md border border-border bg-background/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-label text-muted-foreground">
                {value.vetoMode === 'active' ?
              <ShieldAlert className="h-3.5 w-3.5 text-negative" aria-hidden={true} /> :

              <ShieldCheck className="h-3.5 w-3.5 text-signal" aria-hidden={true} />
              }
                Kiütés-szűrő üzemmód
              </span>
              <div
              role="group"
              aria-label="Kiütés-szűrő üzemmód"
              className="flex overflow-hidden rounded-md border border-border">
              
                {(['shadow', 'active'] as BttsVetoMode[]).map((mode) =>
              <button
                key={mode}
                type="button"
                aria-pressed={value.vetoMode === mode}
                onClick={() => setVeto(mode)}
                className={`px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-label transition-colors ${
                value.vetoMode === mode ?
                'bg-signal/15 text-signal' :
                'text-muted-foreground hover:text-foreground'}`
                }>
                
                    {VETO_MODE_COPY[mode].label}
                  </button>
              )}
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {vetoCopy.detail}
            </p>
            {readout && readout.excluded.length > 0 ?
          <ul className="flex flex-col gap-1.5">
                {readout.excluded.map((entry) =>
            <li
              key={entry.pattern.id}
              className="rounded-sm border border-negative/25 bg-negative-soft px-2 py-1.5">
              
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="truncate text-[11px] font-semibold text-foreground">
                        {entry.pattern.fixtureLabel}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        BTTS H2H {(entry.pattern.hitRate * 100).toFixed(1)}% · kiütés{' '}
                        {(entry.risk.historicalRisk * 100).toFixed(1)}% / modell{' '}
                        {(entry.risk.modelRisk * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {entry.risk.reasonCodes.map((code, index) =>
                <span
                  key={code}
                  title={entry.risk.vetoReasons[index]}
                  className="rounded-sm border border-negative/30 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-label text-negative">
                  
                          {VETO_REASON_LABEL[code]}
                        </span>
                )}
                    </div>
                  </li>
            )}
              </ul> :
          null}
          </div> :
        null}

        {readout && !isCustomBtts ?
        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            Szabályverzió {readout.ruleVersion} · bázis (A) {readout.baseline.length} sor ·
            profil-biztos (B) {readout.experiment.length} sor · a szelvényen a{' '}
            {readout.vetoActive ? '„B” (éles szűrő)' : '„A” (árnyék mód)'} kimenet van.
            A portfólió-szintű történelmi összehasonlítás addig NEM állítható, amíg nincs
            hitelesített forduló-csoportosítás a mentett fordulókból.
          </p> :
        null}
      </div>
    </section>);

}