import React from 'react';
import {
  AlertTriangle,
  Clock,
  Hash,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Zap } from
'lucide-react';
import type { BttsBlowoutRiskAssessment, PatternHit } from '../../types/winmix';
import { BAND_DIAGNOSIS_COPY, CONFIDENCE_BANDS } from '../../utils/decision';
import { PROFILE_COPY, VETO_REASON_LABEL } from '../../utils/bttsProfile';
import { MARQUEE_LEVEL_LABEL } from '../../utils/marqueePairs';
import {
  GATE_DETAIL,
  GATE_LABEL,
  ROLE_SPEC,
  coreConfidenceOf,
  effectiveBandDiagnosisOf,
  evidenceLevelOf,
  type ActiveSlipRole,
  type BlockedCandidate,
  type GateCondition } from
'../../utils/slip';
import type { CoreTier } from '../../types/winmix';
import { CoreEvidenceBadge } from './CoreEvidenceBadge';
import { CoreTierBadge } from './CoreTierBadge';

interface RecommendationCardProps {
  role: ActiveSlipRole;
  pattern: PatternHit | null;
  /** Piac-készletből töltött slot fejléce. `null` esetén a szerepkör címe. */
  title?: string | null;
  /** A slotot kitölthető piacok felsorolása. `null` esetén a szerepkör alapértéke. */
  families?: string | null;
  reason: string | null;
  blocked: BlockedCandidate[];
  /** True when the line sits outside the calibration gate. */
  relaxed: boolean;
  /** Gate conditions the current line fails. */
  failed: GateCondition[];
  /** BTTS CORE PROFILE — the pair-shape assessment of this line, if any. */
  risk?: BttsBlowoutRiskAssessment | null;
  /** The profile filter flagged this line, but the veto runs in shadow mode. */
  shadowVeto?: boolean;
  /**
   * CORE TIERING — the selection tier of this line. `null` on joker slots and
   * on any line that is not on a core card.
   */
  coreTier?: CoreTier | null;
  /**
   * SAJÁT (CUSTOM) MODE — plain card: no gate/evidence/tier/profile semantics
   * apply, so every quality indicator that would imply them is suppressed.
   */
  plain?: boolean;
  eyebrow: string;
  onSwap: () => void;
}

const ROLE_ICON: Record<ActiveSlipRole, React.ReactNode> = {
  btts_top: <Target className="h-3.5 w-3.5" aria-hidden={true} />,
  btts_second: <Target className="h-3.5 w-3.5" aria-hidden={true} />,
  over25: <TrendingUp className="h-3.5 w-3.5" aria-hidden={true} />,
  joker_score: <Hash className="h-3.5 w-3.5" aria-hidden={true} />,
  joker_ht: <Clock className="h-3.5 w-3.5" aria-hidden={true} />,
  joker_trend: <Zap className="h-3.5 w-3.5" aria-hidden={true} />
};

const AGREEMENT_META: Record<string, {label: string;className: string;}> = {
  agree: { label: 'Egyező modellek', className: 'bg-positive shadow-[0_0_8px_var(--positive)]' },
  neutral: { label: 'Semleges egyezés', className: 'bg-chart-4 shadow-[0_0_8px_var(--chart-4)]' },
  conflict: { label: 'Modellkonfliktus', className: 'bg-negative shadow-[0_0_8px_var(--negative)]' }
};

function percentage(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function fixtureTeams(label: string): [string, string] {
  const [home, ...awayParts] = label.split(' – ');
  return [home || 'Hazai', awayParts.join(' – ') || 'Vendég'];
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase('hu-HU');
  return `${words[0][0]}${words[words.length - 1][0]}`.toLocaleUpperCase('hu-HU');
}

function BlockedCandidateRow({ entry }: {entry: BlockedCandidate;}) {
  const { pattern, failed } = entry;
  return (
    <li className="rounded-xl border border-white/[0.07] bg-black/30 px-2.5 py-2 text-left">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[11px] font-semibold text-foreground/90">
          {pattern.fixtureLabel}
        </span>
        <span className="shrink-0 font-mono text-[10px] font-bold text-muted-foreground">
          {pattern.code}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {failed.map((condition) =>
        <span
          key={condition}
          title={`Elutasítva: ${GATE_DETAIL[condition]}`}
          className="rounded-md border border-negative/30 bg-negative-soft px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-label text-negative">
          
            {GATE_LABEL[condition]}
          </span>
        )}
        <span className="ml-auto font-mono text-[9px] text-muted-foreground">
          stab. {pattern.stability} · {percentage(pattern.hitRate)} · n{pattern.sample}
        </span>
      </div>
      {/* The band that ACTUALLY judged this line: registered markets are gated
           on their own model-probability band, not on the 1X2 confidence band. */}
      {failed.includes('band') ?
      <p className="mt-1 font-mono text-[8px] uppercase tracking-label text-muted-foreground/70">
          {pattern.coreEvidence?.bandLabel ??
        CONFIDENCE_BANDS.find((b) => b.key === pattern.band)?.label ??
        pattern.band}{' '}
          sáv — {BAND_DIAGNOSIS_COPY[effectiveBandDiagnosisOf(pattern)]}
        </p> :
      null}
    </li>);

}

export function RecommendationCard({
  role,
  pattern,
  title,
  families,
  reason,
  blocked,
  relaxed,
  failed,
  risk = null,
  shadowVeto = false,
  coreTier = null,
  plain = false,
  eyebrow,
  onSwap
}: RecommendationCardProps) {
  const spec = ROLE_SPEC[role];
  const slotTitle = title ?? spec.title;
  const slotFamilies = families ?? spec.families;
  const isJoker = spec.kind === 'joker';
  const agreement = pattern ? AGREEMENT_META[pattern.agreement] ?? AGREEMENT_META.neutral : null;
  const [homeTeam, awayTeam] = fixtureTeams(pattern?.fixtureLabel ?? '');
  const accentText = isJoker ? 'text-chart-4' : 'text-signal';
  const accentBackground = isJoker ? 'bg-chart-4' : 'bg-signal';
  const accentSoft = isJoker ?
  'border-chart-4/25 bg-chart-4/10' :
  'border-signal/25 bg-signal-soft';

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-[28px] border bg-[#101010] shadow-panel-lg transition duration-base motion-reduce:transition-none ${
      isJoker ?
      'border-chart-4/25 hover:border-chart-4/50' :
      'border-white/[0.08] hover:border-white/[0.16]'}`
      }>
      
      <header className="flex min-h-14 items-center justify-between gap-3 px-5 pb-2.5 pt-4">
        <div className="min-w-0">
          <p className={`flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.16em] ${accentText}`}>
            <span className={`h-2 w-2 rounded-full ${accentBackground}`} aria-hidden={true} />
            {eyebrow}
          </p>
          <h3 className="mt-1 flex items-center gap-1.5 truncate text-[12px] font-semibold text-foreground">
            <span className={accentText}>{ROLE_ICON[role]}</span>
            {slotTitle}
          </h3>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {pattern && !plain && !isJoker && coreTier ?
          <CoreTierBadge tier={coreTier} confidence={coreConfidenceOf(pattern)} /> :
          null}
          {pattern && !plain && !isJoker ?
          <CoreEvidenceBadge
            level={evidenceLevelOf(pattern)}
            snapshot={pattern.coreEvidence ?? null}
            withCoverage={evidenceLevelOf(pattern) === 'conditional'} /> :

          null}
          {pattern && !plain && risk ?
          <span
            title={PROFILE_COPY[risk.profile].detail}
            className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-label ${
            PROFILE_COPY[risk.profile].tone === 'positive' ?
            'border-positive/35 bg-positive-soft text-positive' :
            PROFILE_COPY[risk.profile].tone === 'negative' ?
            'border-negative/35 bg-negative-soft text-negative' :
            'border-chart-4/35 bg-chart-4/10 text-chart-4'}`
            }>
            
              {PROFILE_COPY[risk.profile].label}
            </span> :
          null}
          {pattern && !plain && relaxed ?
          <span
            title={reason ?? undefined}
            className="inline-flex items-center gap-1 rounded-full border border-chart-4/35 bg-chart-4/10 px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-label text-chart-4">
            
              <AlertTriangle className="h-2.5 w-2.5" aria-hidden={true} />
              Kapun kívül
            </span> :
          null}
          {agreement ?
          <span
            role="img"
            aria-label={agreement.label}
            title={agreement.label}
            className={`h-2 w-2 rounded-full ${agreement.className}`} /> :

          null}
          {pattern ?
          <button
            type="button"
            onClick={onSwap}
            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-signal/30 hover:bg-white/[0.08] hover:text-signal focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label={`${eyebrow} — másik jelölt`}>
            
              <RefreshCw className="h-3 w-3" aria-hidden={true} />
              Csere
            </button> :
          null}
        </div>
      </header>

      <div
        className={`mx-2 mb-2 flex flex-1 flex-col rounded-[22px] border bg-[#1b1c14] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
        isJoker ? 'border-chart-4/20' : 'border-signal/10'}`
        }>
        
        {!pattern ?
        <div className="flex min-h-72 flex-1 flex-col items-center px-2 py-4 text-center">
            <span className={`mb-3 flex h-11 w-11 items-center justify-center rounded-full border ${accentSoft} ${accentText}`}>
              {ROLE_ICON[role]}
            </span>
            <p className="max-w-xs text-[12px] leading-relaxed text-muted-foreground">
              {reason ?? spec.empty}
            </p>
            <p className="mt-3 font-mono text-[9px] uppercase tracking-label text-muted-foreground/60">
              {slotFamilies}
            </p>

            {blocked.length > 0 ?
          <div className="mt-4 w-full border-t border-white/[0.06] pt-3">
                <p className="mb-2 flex items-center justify-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-label text-muted-foreground">
                  <AlertTriangle className="h-3 w-3 text-chart-4" aria-hidden={true} />
                  Elutasított jelöltek
                </p>
                <ul className="flex flex-col gap-1.5">
                  {blocked.map((entry) =>
              <BlockedCandidateRow key={entry.pattern.id} entry={entry} />
              )}
                </ul>
              </div> :
          null}
          </div> :

        <div className="flex flex-1 flex-col gap-3.5">
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
              <div className="flex min-w-0 flex-col items-center text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-black/30 font-mono text-sm font-black text-foreground shadow-panel">
                  {initials(homeTeam)}
                </span>
                <span className="mt-2 line-clamp-2 text-[12px] font-semibold leading-tight text-foreground">
                  {homeTeam}
                </span>
                <span className="mt-0.5 text-[9px] uppercase tracking-label text-muted-foreground">Hazai</span>
              </div>

              <div className="pt-2 text-center">
                <div className={`font-mono text-2xl font-black leading-none ${accentText}`}>
                  {pattern.headToHeadRecord.total}
                </div>
                <div className="mt-1 text-[9px] uppercase tracking-label text-muted-foreground">H2H meccs</div>
              </div>

              <div className="flex min-w-0 flex-col items-center text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-black/30 font-mono text-sm font-black text-foreground shadow-panel">
                  {initials(awayTeam)}
                </span>
                <span className="mt-2 line-clamp-2 text-[12px] font-semibold leading-tight text-foreground">
                  {awayTeam}
                </span>
                <span className="mt-0.5 text-[9px] uppercase tracking-label text-muted-foreground">Vendég</span>
              </div>
            </div>

            <div className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${accentSoft}`}>
              <div className="min-w-0">
                <p className="font-mono text-[9px] font-bold uppercase tracking-label text-muted-foreground">
                  Ajánlott piac
                </p>
                <p className="mt-0.5 truncate text-[12px] font-semibold text-foreground">{pattern.label}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-lg bg-black/25 px-2 py-1 font-mono text-sm font-black ${accentText}`}>
                  {pattern.code}
                </span>
                <span className="text-right font-mono text-[9px] text-muted-foreground">
                  fair<br />
                  <strong className="text-[11px] text-foreground">
                    {pattern.impliedOdds > 0 ? pattern.impliedOdds.toFixed(2) : '—'}×
                  </strong>
                </span>
              </div>
            </div>

            {/* CORE TIERING — a Secondary line must state, on the card itself,
               that it is a higher-risk selection tier and why it is here. It
               must never read as an equivalent of an actionable line. */}
            {!plain && coreTier === 'secondary' ?
          <p className="flex items-start gap-2 rounded-xl border border-chart-4/35 bg-chart-4/10 px-3 py-2 text-[10px] leading-relaxed text-chart-4">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden={true} />
                <span>
                  <strong className="font-semibold">
                    Másodlagos core szint — magasabb kockázatú kvadráns.
                  </strong>{' '}
                  A H2H irány erős, de a piaci konfidencia{' '}
                  <strong className="font-mono">
                    {Math.round(coreConfidenceOf(pattern).value)} /{' '}
                    {coreConfidenceOf(pattern).threshold}
                  </strong>
                  , tehát az elsődleges küszöb alatt marad. A sor azért került kártyára,
                  mert erre a helyre nem volt elérhető elsődleges (cselekvőképes) jelölt —
                  nem azért, mert egyenértékű lenne eggyel.
                </span>
              </p> :
          null}

            {/* RANGADÓ (BÜNTETŐPONT) — rangsorolási figyelmeztetés a kártyán.
               Nem kizárás és nem mért érték: a sor jogosult maradt, csak a
               párosítás saját H2H evidenciája indokol rangsor-levonást. */}
            {!plain && pattern.code === 'BTTS' && pattern.marqueeRisk?.registered &&
          pattern.marqueeRisk.level !== 'none' ?
          <p className="flex items-start gap-2 rounded-xl border border-chart-4/35 bg-chart-4/10 px-3 py-2 text-[10px] leading-relaxed text-chart-4">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden={true} />
                <span>
                  <strong className="font-semibold">
                    Rangadó BTTS-kockázat: {MARQUEE_LEVEL_LABEL[pattern.marqueeRisk.level]} ·{' '}
                    {pattern.marqueeRisk.applied ?
                'rangsorolási levonás' :
                'hipotetikus levonás (árnyék mód)'}{' '}
                    −{pattern.marqueeRisk.penalty}
                  </strong>{' '}
                  {pattern.marqueeRisk.reasons.join(' ')} A levonás kizárólag a SORRENDET
                  érinti: nincs új kapu, egyetlen mért érték sem változik, és a sor
                  Core-jogosult marad.
                </span>
              </p> :
          null}

            <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-white/[0.06] bg-black/40 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              {[
            ['Hazai győzelem', pattern.headToHeadRecord.homeWins, pattern.headToHeadRecord.homeWinPct],
            ['Döntetlen', pattern.headToHeadRecord.draws, pattern.headToHeadRecord.drawPct],
            ['Vendég győzelem', pattern.headToHeadRecord.awayWins, pattern.headToHeadRecord.awayWinPct]].
            map(([label, count, rate], index) =>
            <div
              key={String(label)}
              className={`px-2 text-center ${index === 1 ? 'border-x border-white/[0.08]' : ''}`}>
              
                  <div className="font-mono text-xl font-bold text-foreground">{Number(count)}</div>
                  <div className="mt-0.5 text-[9px] leading-tight text-muted-foreground">{String(label)}</div>
                  <div className={`mt-1 font-mono text-[11px] font-bold ${index === 0 ? accentText : 'text-foreground/80'}`}>
                    {percentage(Number(rate))}
                  </div>
                </div>
            )}
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="rounded-xl border border-white/[0.06] bg-black/25 p-2 text-center">
                <p className="text-[9px] text-muted-foreground">O1.5</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-foreground">
                  {percentage(pattern.goalStats.over15Pct)}
                </p>
              </div>
              <div className={`flex items-baseline gap-2 rounded-full border px-3 py-2 ${accentSoft}`}>
                <span className="text-[9px] uppercase tracking-label text-muted-foreground">Átl. gól</span>
                <strong className={`font-mono text-xl font-black ${accentText}`}>
                  {pattern.goalStats.avgGoals.toFixed(2)}
                </strong>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-black/25 p-2 text-center">
                <p className="text-[9px] text-muted-foreground">O2.5</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-foreground">
                  {percentage(pattern.goalStats.over25Pct)}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
              <div className="flex items-center justify-between gap-3 text-[10px]">
                <span className="font-medium text-foreground/80">Mindkét csapat szerez gólt</span>
                <span className={`font-mono font-bold ${accentText}`}>
                  {percentage(pattern.goalStats.bttsPct)}
                </span>
              </div>
              <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-label="BTTS arány"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pattern.goalStats.bttsPct * 100)}>
              
                <div
                className={`h-full rounded-full ${accentBackground}`}
                style={{ width: `${Math.min(100, pattern.goalStats.bttsPct * 100)}%` }} />
              
              </div>
              <div className="mt-2 flex justify-between font-mono text-[9px] text-muted-foreground">
                <span>O3.5 {percentage(pattern.goalStats.over35Pct)}</span>
                <span>
                  Veretlen: H {pattern.headToHeadRecord.homeUnbeatenStreak} · V{' '}
                  {pattern.headToHeadRecord.awayUnbeatenStreak}
                </span>
              </div>
            </div>

            {pattern.htStats ?
          <div>
                <p className="mb-1.5 font-mono text-[9px] font-bold uppercase tracking-label text-muted-foreground">
                  Félidei kép · {pattern.htStats.htSampleSize} minta
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
              ['Gólos HT', pattern.htStats.htGoalRate],
              ['HT:1', pattern.htStats.htHomeLeadRate],
              ['HT:X', pattern.htStats.htDrawRate],
              ['HT:2', pattern.htStats.htAwayLeadRate]].
              map(([label, value]) =>
              <div key={String(label)} className="rounded-lg border border-white/[0.06] bg-black/20 px-1.5 py-2 text-center">
                      <p className="text-[8px] text-muted-foreground">{String(label)}</p>
                      <p className="mt-0.5 font-mono text-[10px] font-bold text-foreground">
                        {percentage(Number(value))}
                      </p>
                    </div>
              )}
                </div>
              </div> :
          null}

            {pattern.topModalScores.length > 0 || pattern.reversalStats ?
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                <div className="flex flex-wrap gap-1.5">
                  {pattern.topModalScores.map((score) =>
              <span
                key={score.score}
                className="rounded-lg border border-white/[0.07] bg-black/25 px-2 py-1 font-mono text-[9px]">
                
                      <strong className="text-foreground">{score.score}</strong>{' '}
                      <span className="text-muted-foreground">×{score.count} · {percentage(score.pct)}</span>
                    </span>
              )}
                </div>
                {pattern.reversalStats ?
            <span className={`rounded-lg border px-2 py-1 font-mono text-[9px] ${accentSoft}`}>
                    <Sparkles className={`mr-1 inline h-3 w-3 ${accentText}`} aria-hidden={true} />
                    Fordulat {percentage(pattern.reversalStats.turnaroundRate)} ·{' '}
                    <strong className={accentText}>
                      {pattern.reversalStats.turnaroundRate > 0 ?
                `${(1 / pattern.reversalStats.turnaroundRate).toFixed(2)}×` :
                '—'}
                    </strong>
                  </span> :
            null}
              </div> :
          null}

            <div className="mt-auto grid grid-cols-3 divide-x divide-white/[0.07] rounded-xl border border-white/[0.06] bg-black/25 py-2.5 text-center">
              {[
            ['Stabilitás', pattern.stability],
            ['Hit rate', percentage(pattern.hitRate, 1)],
            ['Minta', pattern.sample]].
            map(([label, value]) =>
            <div key={String(label)} className="px-2">
                  <p className={`font-mono text-sm font-bold ${label === 'Stabilitás' ? accentText : 'text-foreground'}`}>
                    {value}
                  </p>
                  <p className="mt-0.5 text-[8px] uppercase tracking-label text-muted-foreground">{label}</p>
                </div>
            )}
            </div>

            {/* CORE CALIBRATION BOOTSTRAP — a conditional core line must state
               what is unknown about it, on the card, every time. */}
            {!isJoker && evidenceLevelOf(pattern) === 'conditional' ?
          <div className="rounded-xl border border-chart-4/30 bg-chart-4/[0.07] px-2.5 py-2 text-left">
                <p className="font-mono text-[8px] font-bold uppercase tracking-label text-chart-4">
                  Feltételes evidencia
                </p>
                <p className="mt-1 text-[9px] leading-relaxed text-chart-4/90">
                  {pattern.coreEvidence?.headline ??
              'A valószínűségi sáv még nincs elegendő auditált előzménnyel visszamérve.'}
                </p>
              </div> :
          null}

            {relaxed && failed.length > 0 ?
          <div className="rounded-xl border border-chart-4/30 bg-chart-4/[0.07] px-2.5 py-2 text-left">
                <div className="flex flex-wrap items-center gap-1">
                  {failed.map((condition) =>
              <span
                key={condition}
                title={`Nem teljesíti: ${GATE_DETAIL[condition]}`}
                className="rounded-md border border-chart-4/35 bg-chart-4/10 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-label text-chart-4">
                
                      {GATE_LABEL[condition]}
                    </span>
              )}
                </div>
                <p className="mt-1.5 text-[9px] leading-relaxed text-chart-4/90">{reason}</p>
              </div> :
          null}

            {shadowVeto && risk ?
          <div className="rounded-xl border border-negative/30 bg-negative-soft px-2.5 py-2 text-left">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="font-mono text-[8px] font-bold uppercase tracking-label text-negative">
                    Árnyék veto
                  </span>
                  {risk.reasonCodes.map((code) =>
              <span
                key={code}
                className="rounded-md border border-negative/30 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-label text-negative">
                
                      {VETO_REASON_LABEL[code]}
                    </span>
              )}
                </div>
                <p className="mt-1.5 text-[9px] leading-relaxed text-negative/90">
                  {risk.vetoReasons[0]} A szűrő árnyék módban fut, ezért a sor a
                  szelvényen marad — a jelzés diagnosztika, nem eltávolítás.
                </p>
              </div> :
          null}

            {pattern.sufficiency === 'cold' || pattern.usedReverse ?
          <div className="flex items-start gap-1.5 text-[9px] leading-relaxed text-chart-4">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden={true} />
                <span>
                  {pattern.sufficiency === 'cold' ? 'Kis H2H minta. ' : ''}
                  {pattern.usedReverse ? 'Fordított pályás mérkőzésekkel kiegészítve.' : ''}
                </span>
              </div> :
          null}
          </div>
        }
      </div>
    </article>);

}