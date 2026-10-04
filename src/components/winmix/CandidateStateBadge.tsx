import { Ban, CircleAlert, CircleCheck, CircleDot, Flag, Send } from 'lucide-react';
import type { CoreCandidateState } from '../../types/winmix';

/**
 * ÁLLAPOTGÉP JELVÉNY — a döntési lánc végállapota egyetlen, közös vizuális
 * nyelven. Ugyanezt a komponenst használja a Forduló Prediktor jelölt-táblája
 * és a Tipp Napló mentett sora, hogy a kiadáskori állapot és a mai nézet ne
 * mondhasson egymásnak ellent.
 */

export const CORE_CANDIDATE_STATE_CHAIN: CoreCandidateState[] = [
'RAW',
'CALIBRATED',
'EVIDENCE_ASSESSED',
'RISK_ASSESSED',
'VALUE_ASSESSED',
'CORE_ELIGIBLE',
'CORE_PUBLISHED'];


export const CORE_CANDIDATE_STATE_LABEL: Record<CoreCandidateState, string> = {
  RAW: 'Nyers',
  CALIBRATED: 'Kalibrált',
  EVIDENCE_ASSESSED: 'Evidencia mérve',
  RISK_ASSESSED: 'Kockázat mérve',
  VALUE_ASSESSED: 'Érték mérve',
  CORE_ELIGIBLE: 'Core-jogosult',
  CORE_PUBLISHED: 'Core publikálva',
  BLOCKED: 'Blokkolt',
  RESEARCH_ONLY: 'Csak kutatás',
  FLAGGED: 'Megjelölt'
};

export const CORE_CANDIDATE_STATE_DETAIL: Record<CoreCandidateState, string> = {
  RAW: 'A jelölt még nem ment át egyetlen értékelő szakaszon sem.',
  CALIBRATED: 'A saját valószínűségi sávja visszamért és kalibrált.',
  EVIDENCE_ASSESSED: 'Az evidencia-szint megállapítva, a sáv mérése nem elegendő a kalibrációhoz.',
  RISK_ASSESSED: 'A kockázati szakasz lefutott a jelöltön.',
  VALUE_ASSESSED: 'Az érték/publikációs szakasz lefutott a jelöltön.',
  CORE_ELIGIBLE: 'Minden aktív kapun belül van és megnyerte a kanonikus csoportját — kártyára kerülhet.',
  CORE_PUBLISHED: 'Core kártyára került ebben a fordulóban.',
  BLOCKED: 'Hard vétó: statisztikailag cáfolt sáv (Policy A). A modell valószínűsége ezt nem írhatja felül.',
  RESEARCH_ONLY: 'Csak kutatási célra — publikációra nem jelölhető.',
  FLAGGED: 'Legalább egy kapu megbukott — a sor megjelölve, nem core-jogosult.'
};

const TONE: Record<CoreCandidateState, string> = {
  RAW: 'border-border bg-elevated text-muted-foreground',
  CALIBRATED: 'border-positive/40 bg-positive-soft text-positive',
  EVIDENCE_ASSESSED: 'border-border bg-elevated text-muted-foreground',
  RISK_ASSESSED: 'border-border bg-elevated text-muted-foreground',
  VALUE_ASSESSED: 'border-border bg-elevated text-muted-foreground',
  CORE_ELIGIBLE: 'border-positive/40 bg-positive-soft text-positive',
  CORE_PUBLISHED: 'border-signal/40 bg-signal-soft text-signal',
  BLOCKED: 'border-negative/40 bg-negative-soft text-negative',
  RESEARCH_ONLY: 'border-border bg-elevated text-muted-foreground',
  FLAGGED: 'border-chart-4/40 bg-chart-4/10 text-chart-4'
};

const ICON: Record<CoreCandidateState, typeof CircleDot> = {
  RAW: CircleDot,
  CALIBRATED: CircleCheck,
  EVIDENCE_ASSESSED: CircleDot,
  RISK_ASSESSED: CircleDot,
  VALUE_ASSESSED: CircleDot,
  CORE_ELIGIBLE: CircleCheck,
  CORE_PUBLISHED: Send,
  BLOCKED: Ban,
  RESEARCH_ONLY: CircleAlert,
  FLAGGED: Flag
};

interface CandidateStateBadgeProps {
  state: CoreCandidateState | null | undefined;
  /** Saved rows from before the state machine existed render nothing. */
  className?: string;
}

export function CandidateStateBadge({ state, className = '' }: CandidateStateBadgeProps) {
  if (!state) return null;
  const Icon = ICON[state];
  return (
    <span
      title={`${CORE_CANDIDATE_STATE_LABEL[state]} — ${CORE_CANDIDATE_STATE_DETAIL[state]}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-label ${TONE[state]} ${className}`}>
      
      <Icon className="h-2.5 w-2.5" aria-hidden={true} />
      {CORE_CANDIDATE_STATE_LABEL[state]}
    </span>);

}

/**
 * A teljes lánc kirajzolva, a jelölt által elért állapotig kiemelve. A blokkolt
 * és megjelölt végállapotok a lánc végén külön, piros/sárga lezárásként
 * jelennek meg — nem a lánc egy lépéseként, mert nem is azok.
 */
export function CandidateStateChain({ state }: {state: CoreCandidateState;}) {
  const terminal = state === 'BLOCKED' || state === 'FLAGGED' || state === 'RESEARCH_ONLY';
  const reachedIndex = terminal ?
  CORE_CANDIDATE_STATE_CHAIN.length - 1 :
  CORE_CANDIDATE_STATE_CHAIN.indexOf(state);

  return (
    <span className="flex flex-wrap items-center gap-1">
      {CORE_CANDIDATE_STATE_CHAIN.map((step, index) => {
        const reached = index <= reachedIndex && !terminal;
        return (
          <span key={step} className="flex items-center gap-1">
            {index > 0 ?
            <span className="font-mono text-[8px] text-muted-foreground" aria-hidden={true}>
                →
              </span> :
            null}
            <span
              title={CORE_CANDIDATE_STATE_DETAIL[step]}
              className={`rounded-sm border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-label ${
              reached ?
              'border-signal/30 bg-signal-soft text-signal' :
              'border-border bg-elevated text-muted-foreground opacity-60'}`
              }>
              
              {CORE_CANDIDATE_STATE_LABEL[step]}
            </span>
          </span>);

      })}
      {terminal ?
      <>
          <span className="font-mono text-[8px] text-muted-foreground" aria-hidden={true}>
            →
          </span>
          <CandidateStateBadge state={state} />
        </> :
      null}
    </span>);

}
