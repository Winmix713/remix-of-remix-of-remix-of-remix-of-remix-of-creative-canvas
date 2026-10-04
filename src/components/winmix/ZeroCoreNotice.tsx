import { ShieldCheck } from 'lucide-react';
import { CORE_ROLES, type SlipDraft } from '../../utils/slip';

/**
 * NULLA CORE — érvényes, sikeres kimenet, nem hiba.
 *
 * A `0 <= CoreCount <= 3` invariáns azt jelenti, hogy egy forduló legitim
 * eredménye lehet nulla core ajánlás. A felület korábban ezt üres kártyákként
 * mutatta, ami rendszerhibának látszott; ez a panel kimondja, hogy a rendszer
 * szándékosan nem töltötte fel a helyeket.
 */
export function ZeroCoreNotice({ draft }: {draft: SlipDraft | null;}) {
  if (!draft) return null;
  const coreSlots = draft.slots.filter((slot) =>
  (CORE_ROLES as readonly string[]).includes(slot.role)
  );
  if (coreSlots.length === 0) return null;
  const filled = coreSlots.filter((slot) => slot.pattern !== null).length;
  if (filled > 0) return null;

  const readout = draft.strategy ?? null;
  const blocked = readout?.candidates.filter((row) => row.candidateState === 'BLOCKED').length ?? 0;
  const flagged = readout?.candidates.filter((row) => row.candidateState === 'FLAGGED').length ?? 0;
  const examined = readout?.candidates.length ?? 0;

  return (
    <section
      aria-label="Nincs core ajánlás"
      className="flex items-start gap-2.5 rounded-lg border border-positive/30 bg-positive-soft px-4 py-3 shadow-panel">
      
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden={true} />
      <div className="min-w-0">
        <p className="text-ui-sm font-semibold text-positive">
          Nincs ma megfelelő core jelölt
        </p>
        <p className="mt-1 text-ui-xs leading-relaxed text-muted-foreground">
          Ez érvényes, sikeres kimenet: a rendszer megvizsgált {examined} jelöltet, és
          egyik sem érte el a publikációs küszöböt
          {blocked > 0 ? ` (${blocked} hard vétó cáfolt sáv miatt)` : ''}
          {flagged > 0 ? `${blocked > 0 ? ',' : ' ('} ${flagged} kapubukás` : ''}
          {blocked > 0 || flagged > 0 ? ')' : ''}. A hármas szám kedvéért egyetlen sor sem
          kerül kártyára — a joker oldal ettől függetlenül feltöltődhet.
        </p>
      </div>
    </section>);

}
