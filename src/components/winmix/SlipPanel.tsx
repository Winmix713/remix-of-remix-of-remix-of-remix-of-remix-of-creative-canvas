import React from 'react';
import { Save, ShieldAlert, Star, TriangleAlert, AlertOctagon } from 'lucide-react';
import {
  draftEvidenceLevel,
  type ActiveSlipRole,
  type SlipDraft,
  type SlipSlot } from
'../../utils/slip';
import { VETO_REASON_LABEL } from '../../utils/bttsProfile';
import { EVIDENCE_COPY } from '../../utils/coreEvidence';
import { Chip, Panel, PanelHeader, PanelTitle } from './Panel';
import { CoreCandidateTable } from './CoreCandidateTable';
import { RecommendationCard } from './RecommendationCard';

interface SlipPanelProps {
  draft: SlipDraft;
  combinedProb: number;
  duplicates: string[];
  roundName: string;
  canSave: boolean;
  onRoundNameChange: (value: string) => void;
  onSwap: (role: ActiveSlipRole) => void;
  onSave: () => void;
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const ROLE_INDEX: Record<ActiveSlipRole, string> = {
  btts_top: '1 · Core',
  btts_second: '2 · Core',
  over25: '3 · Core',
  joker_score: 'J1 · Joker',
  joker_ht: 'J2 · Joker',
  joker_trend: 'J3 · Joker'
};

function SlotCard({ slot, onSwap }: {slot: SlipSlot;onSwap: () => void;}) {
  return (
    <li className="min-w-0">
      <RecommendationCard
        role={slot.role}
        pattern={slot.pattern}
        title={slot.title}
        families={slot.families}
        reason={slot.reason}
        blocked={slot.blocked}
        relaxed={slot.relaxed}
        failed={slot.failed}
        risk={slot.risk ?? null}
        shadowVeto={slot.shadowVeto ?? false}
        coreTier={slot.coreTier ?? null}
        plain={slot.plain ?? false}
        eyebrow={ROLE_INDEX[slot.role]}
        onSwap={onSwap} />
      
    </li>);

}

export function SlipPanel({
  draft,
  combinedProb,
  duplicates,
  roundName,
  canSave,
  onRoundNameChange,
  onSwap,
  onSave
}: SlipPanelProps) {
  const filled = draft.slots.filter((s) => s.pattern !== null).length;
  const strategy = draft.strategy ?? null;
  // CORE CALIBRATION BOOTSTRAP — a combined figure may not be presented as a
  // backtested probability while a single conditional line is on the slip.
  const evidenceLevel = draftEvidenceLevel(draft);
  const conditionalSlip = evidenceLevel === 'conditional';
  // H2 — duplikált mérkőzés esetén a szorzat nem valószínűség, a
  // `combinedProbability` ezért 0-t ad. A 0.0% valós (katasztrofális)
  // esélynek olvasódna, ezért itt kifejezett „érvénytelen" állapot jelenik meg.
  const invalidCombined = duplicates.length > 0;

  return (
    <Panel className="border-signal/25">
      <PanelHeader>
        <PanelTitle>
          <Star className="h-4 w-4 text-signal" aria-hidden={true} />
          Top 3+3 szelvényajánlás
        </PanelTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="neutral">
            {filled} / {draft.slots.length} szerepkör
          </Chip>
          <Chip
            tone={!invalidCombined && !conditionalSlip && filled > 0 ? 'signal' : 'neutral'}
            className={
            invalidCombined ?
            'bg-negative-soft text-negative' :
            conditionalSlip ?
            'bg-warning-soft text-warning' :
            undefined
            }
            title={
            conditionalSlip ?
            'A szelvényen feltételes sor is van: ez a szorzat NEM visszamért valószínűség.' :
            undefined
            }>
            
            {invalidCombined ?
            'komb. érvénytelen' :
            `komb. ${filled > 0 ? `${(combinedProb * 100).toFixed(1)}%` : '—'}${
            conditionalSlip ? ' · nem visszamért' : ''}`
            }
          </Chip>
          <button
            type="button"
            className="btn btn--signal btn--sm tap"
            disabled={!canSave}
            onClick={onSave}>
            
            <Save className="h-3.5 w-3.5" aria-hidden={true} />
            Szelvény mentése
          </button>
        </div>
      </PanelHeader>

      <div className="flex flex-col gap-4 p-4 sm:p-5">
        {draft.configError &&
        <p className="flex items-start gap-2 rounded-xl border border-negative/30 bg-negative-soft px-3.5 py-2.5 text-ui-xs text-negative">
            <AlertOctagon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden={true} />
            {draft.configError} A core kártyák biztonsági okból üresek — a szelvény nem használható, amíg a stratégia konfiguráció nem kerül rendbe.
          </p>
        }
        {strategy ?
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-signal/25 bg-signal-soft px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="text-ui-xs text-muted-foreground">Core stratégia</p>
              <p className="truncate text-ui-sm font-medium text-foreground">
                {strategy.label}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="signal">
                {strategy.coreFilled} / {strategy.coreSlots} core
              </Chip>
              {strategy.coreFilled > 0 ?
            <Chip
              tone="neutral"
              title={
              'Kiválasztási szint (kvadráns), nem evidencia-szint: elsődleges = ' +
              'cselekvőképes, másodlagos = volatilis (magasabb kockázat).'
              }
              className={
              strategy.secondaryCoreCount > 0 ? 'bg-warning-soft text-warning' : undefined
              }>

                  {strategy.primaryCoreCount} elsődleges · {strategy.secondaryCoreCount}{' '}
                  másodlagos
                </Chip> :
            null}
              {strategy.coreEvidenceLevel ?
            <Chip
              tone="neutral"
              title={EVIDENCE_COPY[strategy.coreEvidenceLevel].detail}
              className={
              strategy.coreEvidenceLevel === 'calibrated' ?
              'bg-positive-soft text-positive' :
              'bg-warning-soft text-warning'
              }>
              
                  evidencia: {EVIDENCE_COPY[strategy.coreEvidenceLevel].label.toLowerCase()}
                </Chip> :
            null}
              <Chip tone="neutral">
                {strategy.vetoActive ? 'szűrő: éles' : 'szűrő: árnyék'}
              </Chip>
            </div>
          </div> :
        null}

        {/* CORE TIERING — whenever a volatile line occupies a core card, the
              panel says so in one sentence, above the cards. */}
        {strategy?.tierNote ?
        <p className="flex items-start gap-2 rounded-xl border border-chart-4/30 bg-chart-4/10 px-3.5 py-2.5 text-ui-xs text-chart-4">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden={true} />
            {strategy.tierNote}
          </p> :
        null}

        {draft.notes.map((note) =>
        <p
          key={note}
          className="rounded-xl border border-warning/25 bg-warning-soft px-3.5 py-2.5 text-ui-xs text-warning">
          
            {note}
          </p>
        )}
        {duplicates.length > 0 ?
        <p className="flex items-start gap-2 rounded-xl border border-negative/30 bg-negative-soft px-3.5 py-2.5 text-ui-xs text-negative">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden={true} />
            Több sor ugyanarra a mérkőzésre vonatkozik ({duplicates.join(', ')}) — a szelvény
            korrelált, ezért a kombinált valószínűség nem értelmezhető, és a szelvény nem
            menthető amíg a duplikáció fel nem oldódik.
          </p> :
        null}

        <ul className="mx-auto grid w-full max-w-6xl grid-cols-1 items-stretch gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {draft.slots.map((slot) =>
          <SlotCard key={slot.role} slot={slot} onSwap={() => onSwap(slot.role)} />
          )}
        </ul>

        {/* ONE consolidated candidate ledger for the three core cards — the
              per-card lists used to repeat the same fixtures three times. */}
        {strategy ?
        <CoreCandidateTable readout={strategy} trace={draft.trace ?? null} /> :
        null}

        {/* SHADOW MODE MAY NOT SAY "EXCLUDED".
              The blowout filter runs in shadow mode by default: it computes and
              flags, but removes nothing. Calling those rows "excluded candidates"
              while the footnote said they could still be selected was a direct
              contradiction, so the heading now follows the actual mode. */}
        {strategy && strategy.excluded.length > 0 ?
        <section
          aria-label={
          strategy.vetoActive ?
          'Kiütés-profil miatt kizárt jelöltek' :
          'Profil-figyelmeztetések árnyék módban'
          }
          className={`rounded-xl p-3.5 ${
          strategy.vetoActive ?
          'border border-negative/25 bg-negative-soft' :
          'border border-warning/25 bg-warning-soft'}`
          }>
          
            <p
            className={`mb-2.5 flex items-center gap-1.5 text-ui-xs font-medium ${
            strategy.vetoActive ? 'text-negative' : 'text-warning'}`
            }>
            
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden={true} />
              {strategy.vetoActive ?
            'Kizárt jelöltek — egyoldalú kiütés-profil (ÉLES)' :
            'Profil-figyelmeztetések — egyoldalú kiütés-profil (ÁRNYÉK MÓD)'}
            </p>
            <ul className="flex flex-col gap-2">
              {strategy.excluded.map((entry) =>
            <li
              key={entry.pattern.id}
              className={`rounded-lg bg-surface-1 px-3 py-2.5 ${
              strategy.vetoActive ?
              'border border-negative/25' :
              'border border-warning/25'}`
              }>
              
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="truncate text-ui-sm font-medium text-foreground">
                      {entry.pattern.fixtureLabel}
                    </span>
                    <span className="text-ui-xs tabular-nums text-muted-foreground">
                      BTTS H2H {percentage(entry.pattern.hitRate)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {entry.risk.reasonCodes.map((code, index) =>
                <span
                  key={code}
                  title={entry.risk.vetoReasons[index]}
                  className={`rounded-sm px-1.5 py-0.5 text-ui-xs ${
                  strategy.vetoActive ?
                  'bg-negative-soft text-negative' :
                  'bg-warning-soft text-warning'}`
                  }>
                  
                        {VETO_REASON_LABEL[code]}
                      </span>
                )}
                  </div>
                  {entry.pattern.goalProfile &&
              entry.pattern.goalProfile.blowoutScores.length > 0 ?
              <p className="mt-1 text-ui-xs text-muted-foreground">
                      Bizonyíték: {entry.pattern.goalProfile.blowoutScores.slice(0, 4).join(', ')}
                    </p> :
              null}
                </li>
            )}
            </ul>
            <p className="mt-2.5 text-ui-xs leading-relaxed text-muted-foreground">
              {strategy.vetoActive ?
            'Hatás jelenleg: a szűrő ÉLES — ezek a sorok emiatt nem kerültek a core kártyákra.' :
            'Hatás jelenleg: NINCS automatikus kizárás. A szűrő ÁRNYÉK módban fut, ' +
            'tehát ezek a sorok versenyben maradtak és core kártyára is kerülhettek — a ' +
            'jelzés kizárólag diagnosztika. Ha egy ilyen sor mégsem került fel, annak okát ' +
            'a core decision trace „Elsődleges ok” oszlopa mondja meg.'}
            </p>
          </section> :
        null}

        <label className="flex flex-wrap items-center gap-2 text-ui-xs text-muted-foreground">
          <span>Forduló neve</span>
          <input
            value={roundName}
            onChange={(e) => onRoundNameChange(e.target.value)}
            className="field w-full max-w-[280px]" />
          
        </label>
      </div>
    </Panel>);

}