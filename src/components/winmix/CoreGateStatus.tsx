import { Activity, CircleAlert, Layers, ShieldCheck } from 'lucide-react';
import type { StrategyReadout } from '../../utils/slip';
import { BAND_MIN_SAMPLE } from '../../utils/constants';

/**
 * CORE CALIBRATION BOOTSTRAP — the diagnosis the surface never gave.
 *
 * Before this strip, an empty core card and a fully measured round looked
 * identical: both said "no fixture produced a line inside the strict gate". Two
 * completely different states, one sentence. This answers the only question
 * that matters when a card stays empty — is the ROUND weak, or is the system's
 * measurement base missing? — and it names the shortfall in observations.
 */

interface CoreGateStatusProps {
  readout: StrategyReadout | null;
  /** Matches that completed a walk-forward audit pass. */
  auditedMatches: number;
  /** All stored matches, audited or not. */
  totalMatches: number;
}

function Counter({
  label,
  value,
  tone = 'default',
  title





}: {label: string;value: string | number;tone?: 'default' | 'positive' | 'warning' | 'negative';title?: string;}) {
  const valueTone =
  tone === 'positive' ?
  'text-positive' :
  tone === 'warning' ?
  'text-chart-4' :
  tone === 'negative' ?
  'text-negative' :
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

export function CoreGateStatus({
  readout,
  auditedMatches,
  totalMatches
}: CoreGateStatusProps) {
  if (!readout) return null;

  /* The best-covered candidate environment tells the operator how far the
   * measurement base actually is from the entry minimum. */
  const best = readout.candidates.reduce<{
    observations: number;
    required: number;
    scope: string | null;
    widened: boolean;
  } | null>((acc, row) => {
    const snap = row.pattern.coreEvidence;
    if (!snap) return acc;
    if (acc && acc.observations >= snap.observations) return acc;
    return {
      observations: snap.observations,
      required: snap.required,
      scope: snap.environmentLabel ?? snap.bandLabel,
      widened: snap.widened
    };
  }, null);

  const noAudit = auditedMatches === 0;
  const hasCalibrated = readout.calibratedCandidates > 0;
  const conditionalOnly = !hasCalibrated && readout.conditionalCandidates > 0;

  const verdict = noAudit ?
  {
    tone: 'negative' as const,
    icon: <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden={true} />,
    title: 'Nincs auditált előzmény — a mérési bázis hiányzik',
    body:
    'Egyetlen mérkőzés sem került walk-forward audit-bejárásra, ezért egyetlen ' +
    'valószínűségi sáv sem visszamért. Ez NEM a forduló hibája: a jelöltek ' +
    'feltételes szinten kerülnek a core kártyákra, amíg az audit-bejárás le nem ' +
    'fut a betöltött szezonokon.'
  } :
  conditionalOnly ?
  {
    tone: 'warning' as const,
    icon: <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden={true} />,
    title: 'A sávok még nem visszamértek — feltételes core',
    body:
    `${auditedMatches} auditált mérkőzés van, de a jelöltek saját ` +
    `valószínűségi sávja még nem érte el a ${BAND_MIN_SAMPLE} esetes belépési ` +
    'minimumot. Ez adathiány, nem cáfolat: a sorok feltételes szinten ' +
    'kerülnek fel, és a napló külön kohorszként méri őket.'
  } :
  {
    tone: 'positive' as const,
    icon: <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden={true} />,
    title: 'Visszamért sáv rendelkezésre áll',
    body:
    `${readout.calibratedCandidates} jelölt saját sávja visszamért — ezek ` +
    'kalibrált core sorként töltik fel a kártyákat, a feltételes jelöltek ' +
    'előtt.'
  };

  const verdictClass =
  verdict.tone === 'negative' ?
  'border-negative/30 bg-negative-soft text-negative' :
  verdict.tone === 'warning' ?
  'border-chart-4/30 bg-chart-4/10 text-chart-4' :
  'border-positive/30 bg-positive-soft text-positive';

  return (
    <section
      aria-label="Core kapu állapota"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-panel">
      
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-label text-muted-foreground">
          Core kapu állapota
        </h3>
        <p className="font-mono text-[10px] text-muted-foreground">
          evidencia-szabály {readout.evidenceRuleVersion} · kiválasztási szabály{' '}
          {readout.selectionRuleVersion}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <Counter label="Elemzett meccs" value={readout.analysedFixtures} />
        <Counter
          label="Auditált előzmény"
          value={`${auditedMatches} / ${totalMatches}`}
          tone={noAudit ? 'negative' : 'default'}
          title="Walk-forward audit-bejárásra került mérkőzések a betöltött szezonokból. Minden ilyen mérkőzés egy auditált BTTS megfigyelést is ad, függetlenül attól, hogy core kártyára került-e." />
        
        <Counter
          label="Elsődleges jogosult"
          value={readout.primaryEligibleCandidates}
          tone={readout.primaryEligibleCandidates > 0 ? 'positive' : 'default'}
          title="Kapun belüli jelöltek a CSELEKVŐKÉPES kvadránsban: a súlyozott H2H arány és a piaci konfidencia is eléri a küszöböt." />
        
        <Counter
          label="Másodlagos jogosult"
          value={readout.secondaryEligibleCandidates}
          tone={readout.secondaryEligibleCandidates > 0 ? 'warning' : 'default'}
          title="Kapun belüli jelöltek a VOLATILIS kvadránsban: az irány erős, de a piaci konfidencia az elsődleges küszöb alatt van. Csak akkor kerülnek kártyára, ha nincs elérhető elsődleges jelölt az adott helyre." />
        
        <Counter
          label="Core kitöltve (E · M)"
          value={`${readout.coreFilled} / ${readout.coreSlots} · ${readout.primaryCoreCount}E ${readout.secondaryCoreCount}M`}
          tone={
          readout.coreFilled === 0 ?
          'negative' :
          readout.secondaryCoreCount > 0 ?
          'warning' :
          'positive'
          }
          title="Kitöltött core kártyák, elsődleges (E) és másodlagos (M) bontásban." />
        
        <Counter
          label="Kalibrált core-jelölt"
          value={readout.calibratedCandidates}
          tone={hasCalibrated ? 'positive' : 'default'}
          title={
          'CSAK a KAPUN BELÜLI jelöltek: a saját valószínűségi sávjuk visszamért, és a ' +
          'jelzett valószínűség a Wilson-intervallumon belül van. Ez a szám kisebb lehet, ' +
          'mint a jelölt-táblázatban látható „Kalibrált” sorok száma: egy sor lehet ' +
          'kalibrált ÉS ugyanakkor kapun kívüli (pl. a kvadráns miatt). Az evidencia-szint ' +
          'a mérésről szól, a jogosultság a kapukról.'
          } />
        
        <Counter
          label="Feltételes core-jelölt"
          value={readout.conditionalCandidates}
          tone={readout.conditionalCandidates > 0 ? 'warning' : 'default'}
          title={
          'CSAK a stratégia piacának kapun belüli jelöltjei: minden szigorú minőségi ' +
          'feltételt teljesítenek, de a sávjuk még nincs visszamérve. Adathiány, nem ' +
          'cáfolat. Ez a szám ezért kisebb lehet, mint a fordulóban máshol (joker, más ' +
          'piac) látható feltételes sorok száma — a core decision trace 7. szakasza ' +
          'elszámolja a kettő közti eltérést.'
          } />
        
        <Counter
          label="Cáfolt sávú"
          value={readout.disprovedCandidates}
          tone={readout.disprovedCandidates > 0 ? 'negative' : 'default'}
          title="A sávot megmértük, és a tényleges beválás nem igazolta a jelzett valószínűséget. Core kártyára feltételesen sem kerülhet." />
        
      </dl>

      {/* CORE TIERING — the round's tier composition, stated plainly. The
            quadrant is a selection tier, not a hard entry gate, so the surface
            has to say when a card is held by a volatile line and when a card is
            empty because no valid candidate of EITHER tier existed. */}
      {readout.tierNote ?
      <p className="flex items-start gap-2 rounded-md border border-chart-4/30 bg-chart-4/10 px-3 py-2 text-[11px] leading-relaxed text-chart-4">
          <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden={true} />
          <span>{readout.tierNote}</span>
        </p> :
      null}

      {readout.coreFilled < readout.coreSlots ?
      <p className="rounded-md border border-border bg-background/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          Ebben a fordulóban {readout.primaryEligibleCandidates} elsődleges és{' '}
          {readout.secondaryEligibleCandidates} másodlagos érvényes jelölt volt, ezért{' '}
          {readout.coreFilled} core kártya töltődött ki a {readout.coreSlots}-ból. A többi
          szándékosan üres — a hármas szám kedvéért nem kerül fel sor.
        </p> :
      null}

      {best ?
      <p className="rounded-md border border-border bg-background/60 px-3 py-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
          Legjobb kalibrációs környezet: {best.scope ?? 'nincs sáv'} ·{' '}
          <strong className="text-foreground">
            {best.observations} / {best.required}
          </strong>{' '}
          auditált megfigyelés
          {best.widened ? ' · a sáv adatgyűjtéshez bővítve lett' : ''}. A{' '}
          {BAND_MIN_SAMPLE} eset belépési minimum a sáv értékelhetőségéhez, nem
          bizonyosság — a verdiktet mindig Wilson-intervallum adja.
        </p> :
      null}

      <p
        className={`flex items-start gap-2 rounded-md border px-3 py-2 text-[11px] leading-relaxed ${verdictClass}`}>
        
        {verdict.icon}
        <span>
          <strong className="font-semibold">{verdict.title}.</strong> {verdict.body}
        </span>
      </p>
    </section>);

}