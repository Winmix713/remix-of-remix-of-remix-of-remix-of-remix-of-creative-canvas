import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Sunrise } from 'lucide-react';
import {
  PROFILE_COPY,
  VETO_REASON_LABEL,
  blowoutRiskLabel,
  blowoutRiskTone } from
'../../utils/bttsProfile';
import type { FixtureAnalysis } from '../../types/winmix';

/**
 * PHASE 6 — the fixture card's BTTS profile block.
 *
 * It shows the raw H2H rate AND the value a gate actually consumes, side by
 * side, because they are different numbers doing different jobs: `12 / 18` is an
 * explanation, the recency-weighted and shrunk rate is the decision input.
 *
 * The historical blowout scorelines (`6-0`, `5-0`) are rendered as EVIDENCE.
 * They never act as a single-result veto — the veto reads the weighted, shrunk
 * rate and the count together.
 */

function pct(value: number | undefined | null, digits = 1): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

function Row({
  label,
  value,
  sub,
  tone = 'default'





}: {label: string;value: string;sub?: string;tone?: 'default' | 'signal' | 'warning' | 'negative';}) {
  const valueTone =
  tone === 'signal' ?
  'text-signal' :
  tone === 'warning' ?
  'text-chart-4' :
  tone === 'negative' ?
  'text-negative' :
  'text-foreground';
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="truncate text-[11px] text-muted-foreground">{label}</dt>
      <dd className={`shrink-0 font-mono text-[11px] font-bold tabular-nums ${valueTone}`}>
        {value}
        {sub ?
        <span className="ml-1.5 font-normal text-muted-foreground">{sub}</span> :
        null}
      </dd>
    </div>);

}

export function BttsProfileBlock({ analysis }: {analysis: FixtureAnalysis;}) {
  const [open, setOpen] = useState(false);
  const profile = analysis.goalProfile ?? null;
  const risk = analysis.bttsRisk ?? null;
  const htStats = analysis.htStats ?? null;

  if (!profile || !risk) {
    return (
      <div className="rounded-md border border-chart-4/30 bg-chart-4/10 px-3 py-2 text-[11px] text-chart-4">
        BTTS profil nem képezhető — nincs egyirányú H2H találkozó ehhez a párosításhoz.
      </div>);

  }

  const copy = PROFILE_COPY[risk.profile];
  const headline =
  copy.tone === 'positive' ?
  'border-positive/30 bg-positive-soft text-positive' :
  copy.tone === 'negative' ?
  'border-negative/30 bg-negative-soft text-negative' :
  'border-chart-4/30 bg-chart-4/10 text-chart-4';

  const modelRiskTone = blowoutRiskTone(risk.modelRisk);
  const excluded = risk.wouldVeto;

  return (
    <section
      aria-label="BTTS profil"
      className="rounded-md border border-border bg-background/60">
      
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-elevated/60">
        
        <span className="flex min-w-0 items-center gap-2">
          {open ?
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden={true} /> :

          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden={true} />
          }
          <span className="font-mono text-[10px] font-bold uppercase tracking-label text-muted-foreground">
            BTTS profil
          </span>
          <span
            className={`truncate rounded-sm border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-label ${headline}`}>
            
            {copy.label}
          </span>
        </span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
          {profile.bttsCount} / {profile.directSampleSize} · {pct(profile.bttsRate)}
        </span>
      </button>

      {open ?
      <div className="flex flex-col gap-3 border-t border-border px-3 py-3">
          <dl className="flex flex-col gap-1.5">
            <Row
            label="BTTS H2H (nyers)"
            value={pct(profile.bttsRate)}
            sub={`${profile.bttsCount} / ${profile.directSampleSize}`} />
          
            <Row
            label="BTTS · recency + zsugorítás"
            value={pct(profile.shrunkBttsRate)}
            tone="signal" />
          
            <Row label="Modell BTTS" value={pct(analysis.btts)} />
            <Row label="Over 2.5 (súlyozott)" value={pct(profile.weightedOver25Rate)} />
          </dl>

          <dl className="flex flex-col gap-1.5 border-t border-border pt-2">
            <Row label="Teljes H2H átlag gól" value={profile.avgGoals.toFixed(2)} />
            <Row label="Súlyozott átlag gól" value={profile.weightedAvgGoals.toFixed(2)} />
            <Row
            label="Hazai / vendég gólátlag"
            value={`${profile.homeGoalsAvg.toFixed(2)} / ${profile.awayGoalsAvg.toFixed(2)}`} />
          
            <Row label="Kish ESS" value={profile.effectiveSampleSize.toFixed(1)} />
          </dl>

          <dl className="flex flex-col gap-1.5 border-t border-border pt-2">
            <Row
            label="Kapott-nullás kiütés H2H"
            value={`${profile.cleanSheetBlowoutCount} / ${profile.directSampleSize}`}
            tone={profile.cleanSheetBlowoutCount > 0 ? 'warning' : 'default'} />
          
            <Row
            label="Nagy gólszámú BTTS-nem"
            value={`${profile.highGoalNoBttsCount} / ${profile.directSampleSize}`} />
          
            <Row
            label="Súlyozott, zsugorított kiütés-kockázat"
            value={pct(risk.historicalRisk)}
            tone={blowoutRiskTone(risk.historicalRisk) === 'negative' ? 'negative' : 'default'} />
          
            <Row
            label="Modell kiütés-kockázat"
            value={pct(risk.modelRisk)}
            sub={blowoutRiskLabel(risk.modelRisk)}
            tone={modelRiskTone === 'negative' ? 'negative' : modelRiskTone === 'warning' ? 'warning' : 'default'} />
          
          </dl>

          {profile.blowoutScores.length > 0 ?
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
              <span className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
                Bizonyíték
              </span>
              {profile.blowoutScores.slice(0, 6).map((score, index) =>
          <span
            key={`${score}-${index}`}
            className="rounded-sm border border-negative/25 bg-negative-soft px-1.5 py-0.5 font-mono text-[10px] font-bold text-negative">
            
                  {score}
                </span>
          )}
              <span className="text-[10px] text-muted-foreground">
                — nyers eredmények, nem önálló veto
              </span>
            </div> :
        null}

          {htStats ?
        <dl className="flex flex-col gap-1.5 border-t border-border pt-2">
              <Row
            label="HT BTTS"
            value={pct(htStats.htBttsRate)}
            sub={`${htStats.htSampleSize} minta`} />
          
              <Row label="HT adatlefedettség" value={pct(analysis.htCoverage, 0)} />
            </dl> :
        null}

          {risk.earlyOpenProfile ?
        <p className="flex items-start gap-1.5 rounded-sm border border-chart-4/30 bg-chart-4/10 px-2 py-1.5 text-[10px] leading-relaxed text-chart-4">
              <Sunrise className="mt-0.5 h-3 w-3 shrink-0" aria-hidden={true} />
              <span>
                <strong>Korán nyíló BTTS profil</strong> — a párosításban a két csapat
                gyakran már félidőre betalál. Kizárólag magyarázó címke: nem szoroz rá a
                modell BTTS valószínűségére.
              </span>
            </p> :
        null}

          <div className="border-t border-border pt-2">
            <Row
            label="Profile Safe core"
            value={excluded ? 'Kizárva' : 'Jelölhető'}
            tone={excluded ? 'negative' : 'signal'} />
          
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              {copy.detail}
            </p>
            {excluded ?
          <ul className="mt-2 flex flex-col gap-1">
                {risk.reasonCodes.map((code, index) =>
            <li
              key={code}
              className="flex items-start gap-1.5 text-[10px] leading-relaxed text-negative">
              
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden={true} />
                    <span>
                      <strong className="font-mono uppercase tracking-label">
                        {VETO_REASON_LABEL[code]}
                      </strong>{' '}
                      — {risk.vetoReasons[index]}
                    </span>
                  </li>
            )}
              </ul> :
          null}
            {profile.usedReverse ?
          <p className="mt-1.5 text-[10px] text-chart-4">
                A minta fordított pályás találkozókkal van kiegészítve.
              </p> :
          null}
          </div>
        </div> :
      null}
    </section>);

}