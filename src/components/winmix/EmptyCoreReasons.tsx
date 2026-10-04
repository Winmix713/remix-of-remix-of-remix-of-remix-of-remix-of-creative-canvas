import { Info } from 'lucide-react';
import type { SlipDraft } from '../../utils/slip';
import { Panel, PanelHeader, PanelTitle } from './Panel';

interface EmptyCoreReasonsProps {
  draft: SlipDraft | null;
}

const ROLE_LABEL: Record<string, string> = {
  btts_top: '1 · Core',
  btts_second: '2 · Core',
  over25: '3 · Core',
  joker_score: 'J1 · Joker',
  joker_ht: 'J2 · Joker',
  joker_trend: 'J3 · Joker'
};

/**
 * Why a card stayed empty, in one place. The reason already lives on the card
 * itself, but an empty core slot is a round-level fact — this collects them so
 * the user does not have to scan six cards to find out what blocked the core.
 */
export function EmptyCoreReasons({ draft }: EmptyCoreReasonsProps) {
  if (!draft) return null;
  const empty = draft.slots.filter((slot) => slot.pattern === null);
  if (empty.length === 0) return null;

  return (
    <Panel className="border-warning/25">
      <PanelHeader>
        <PanelTitle>
          <Info className="h-4 w-4 text-warning" aria-hidden={true} />
          Üres sorok indoklása ({empty.length})
        </PanelTitle>
      </PanelHeader>
      <ul className="flex flex-col gap-2 p-4 sm:p-5">
        {empty.map((slot) =>
        <li
          key={slot.role}
          className="rounded-xl border border-white/[0.07] bg-surface-1 px-3.5 py-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-[9px] font-bold uppercase tracking-label text-warning">
              {ROLE_LABEL[slot.role] ?? slot.role}
            </span>
            {slot.blocked.length > 0 ?
            <span className="font-mono text-[9px] text-muted-foreground">
              {slot.blocked.length} elutasított jelölt
            </span> :
            null}
          </div>
          <p className="mt-1 text-ui-xs leading-relaxed text-muted-foreground">
            {slot.reason ?? 'Nem akadt a kapun belüli jelölt ebben a készletben.'}
          </p>
        </li>
        )}
      </ul>
    </Panel>);

}
