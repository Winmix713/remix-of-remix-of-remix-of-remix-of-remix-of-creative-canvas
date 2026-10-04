import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { DECISION_META } from '../../utils/decision';
import { isCoreEligible, isJokerEligible } from '../../utils/slip';
import { theoreticalPriceOf, underdogGoalIndex } from '../../utils/underdog';
import { Collapsible } from './Collapsible';
import type { FixtureAnalysis, PatternHit } from '../../types/winmix';

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function price(p: number | null | undefined): string {
  const value = theoreticalPriceOf(p);
  return value === null ? '—' : value.toFixed(2);
}

function Cell({
  label,
  value,
  tone




}: {label: string;value: React.ReactNode;tone?: string;}) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
        {label}
      </dt>
      <dd className={`truncate font-mono text-[12px] font-bold tabular-nums ${tone ?? ''}`}>
        {value}
      </dd>
    </div>);

}

function roleOf(pattern: PatternHit | null): {label: string;tone: string;} {
  if (!pattern) return { label: '—', tone: 'text-muted-foreground' };
  if (isCoreEligible(pattern)) return { label: 'Core', tone: 'text-positive' };
  if (isJokerEligible(pattern)) return { label: 'Joker', tone: 'text-chart-4' };
  return { label: 'Nem javasolt', tone: 'text-muted-foreground' };
}

/**
 * RELEASE B — the team-goal block on the fixture card.
 *
 * It separates five things the card used to blend together: the match's goal
 * character, each team's OWN chance of scoring, the favourite/underdog role,
 * the directional H2H sample, and how reliable that sample actually is.
 *
 * WORDING IS PART OF THE CONTRACT. Everything here is a MODEL-IMPLIED
 * probability — a marginal of the joint score matrix — and the price is
 * labelled "modellből számított elméleti szorzó". No `value`, `EV`, `edge`,
 * `mispriced` or "recommended odds" claim appears anywhere: those would require
 * timestamped pre-match external odds and margin handling, which is a separate
 * module entirely.
 */
export function TeamGoalBlock({ analysis }: {analysis: FixtureAnalysis;}) {
  const homeProb = analysis.homeOver05;
  const awayProb = analysis.awayOver05;
  // Analyses restored from an older snapshot simply have no team-goal data.
  if (typeof homeProb !== 'number' || typeof awayProb !== 'number') return null;

  const underdog = analysis.underdog ?? null;
  const pattern =
  underdog ?
  analysis.patterns.find(
    (p) => p.type === 'goal_market' && p.code === underdog.marketCode
  ) ?? null :
  null;

  const index = underdogGoalIndex({
    underdog,
    pattern,
    modelProb: underdog?.goalProb ?? null,
    directMeetings: analysis.directMeetings
  });
  const role = roleOf(pattern);
  const cold = pattern?.sufficiency === 'cold';

  return (
    <Collapsible
      title="Csapatgól elemzés"
      subtitle={
      index.index !== null ?
      `Underdog-gól index ${index.index.toFixed(1)} / 10` :
      'Underdog-gól index: n/a'
      }
      className="bg-background/40 shadow-none">
      
      <div className="flex flex-col gap-3 px-3 py-3">
        <dl className="grid grid-cols-2 gap-2 rounded-md border border-border bg-background/60 px-3 py-2">
          <Cell
            label="Hazai csapat 0.5+"
            value={
            <>
                {pct(homeProb)}{' '}
                <span className="font-normal text-muted-foreground">· {price(homeProb)}</span>
              </>
            } />
          
          <Cell
            label="Vendég csapat 0.5+"
            value={
            <>
                {pct(awayProb)}{' '}
                <span className="font-normal text-muted-foreground">· {price(awayProb)}</span>
              </>
            } />
          
        </dl>

        {underdog ?
        <>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Cell label="Gyengébb csapat" value={underdog.display} />
              <Cell
              label="Súlyeltérés"
              value={`${underdog.signedGap >= 0 ? '+' : '−'}${Math.abs(underdog.signedGap).toFixed(1)}`} />
            
              <Cell label="Modell 0.5+" value={pct(underdog.goalProb)} />
              <Cell
              label="H2H (irányhelyes)"
              value={
              pattern ?
              `${pct(pattern.rawRate)} · ${pattern.sample} meccs` :
              'nincs minta'
              } />
            
            </dl>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Cell
              label="Recency + shrinkage"
              value={pattern ? pct(pattern.hitRate) : 'nincs minta'} />
            
              <Cell
              label="Kish ESS"
              value={pattern ? pattern.effectiveSampleSize.toFixed(1) : '—'} />
            
              <Cell
              label="Modellből számított szorzó"
              value={price(underdog.goalProb)}
              tone="text-muted-foreground" />
            
              <Cell
              label="Piaci minősítés"
              value={
              pattern ?
              DECISION_META[pattern.marketDecision ?? pattern.decision].label :
              'minősítés nélkül'
              } />
            
            </dl>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Cell label="Javasolt szerep" value={role.label} tone={role.tone} />
            </dl>
          </> :
        null}

        {index.message ?
        <p
          className={`flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-[11px] ${
          index.status === 'limited' ?
          'border-chart-4/30 bg-chart-4/10 text-chart-4' :
          'border-border bg-elevated text-muted-foreground'}`
          }>
          
            {index.status === 'limited' ?
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden={true} /> :
          null}
            {index.message}
          </p> :
        null}

        {cold && index.status !== 'limited' ?
        <p className="rounded-md border border-chart-4/30 bg-chart-4/10 px-2 py-1.5 text-[11px] text-chart-4">
            Hideg effektív H2H minta — a piaci minősítés csak megfigyelésre használható.
          </p> :
        null}

        <p className="text-[11px] text-muted-foreground">
          A százalékok a közös pontmátrixból számított, modell szerinti esélyek; a szorzó
          diagnosztikai célú (1 / p), nem fair odds. A csapatgól-család Joker-only, amíg a
          piacspecifikus visszamérés az adott ligára és piacra nem igazolja a kalibrációt.
        </p>
      </div>
    </Collapsible>);

}