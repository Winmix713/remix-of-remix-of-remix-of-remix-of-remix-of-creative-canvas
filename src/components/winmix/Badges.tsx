import React from 'react';
import { cn } from '../../lib/utils';
import { BAND_DIAGNOSIS_COPY } from '../../utils/decision';
import type {
  BandDiagnosis,
  ConfidenceLabel,
  DataSufficiency,
  Recommendation } from
'../../types/winmix';

/**
 * The decision primitive lives in its own module but is re-exported here, so
 * every screen keeps importing its badges from one place.
 */
export { DecisionMatrixBadge, DecisionMatrixLegend } from './DecisionMatrixBadge';

/** Shared shape for every tonal badge on the surface. */
const badgeBase =
'inline-flex items-center rounded-sm px-1.5 py-0.5 text-ui-xs tabular-nums';

const confidenceTone: Record<ConfidenceLabel, string> = {
  High: 'bg-signal-soft text-signal',
  Good: 'bg-positive-soft text-positive',
  Moderate: 'bg-warning-soft text-warning',
  Low: 'bg-white/[0.06] text-muted-foreground'
};

/**
 * The C dimension on its own.
 *
 * Kept deliberately — it is now a COMPONENT of the decision matrix rather than
 * a verdict in itself, and is only rendered where the probability is already
 * visible next to it.
 */
export function ConfidenceBadge({
  score,
  label,
  className




}: {score: number;label: ConfidenceLabel;className?: string;}) {
  return (
    <span className={cn(badgeBase, confidenceTone[label], className)}>
      {score} ({label})
    </span>);

}

const sufficiencyTone: Record<DataSufficiency, string> = {
  hot: 'bg-positive-soft text-positive',
  warm: 'bg-warning-soft text-warning',
  cold: 'bg-negative-soft text-negative'
};

const sufficiencyCopy: Record<DataSufficiency, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold'
};

export function SufficiencyBadge({ level }: {level: DataSufficiency;}) {
  return (
    <span className={cn(badgeBase, sufficiencyTone[level])}>{sufficiencyCopy[level]}</span>);

}

const recommendationCopy: Record<Recommendation, {text: string;className: string;}> = {
  HOME_WIN: { text: 'Hazai (1)', className: 'text-signal' },
  DRAW: { text: 'Döntetlen (X)', className: 'text-foreground' },
  AWAY_WIN: { text: 'Vendég (2)', className: 'text-warning' },
  // Deliberately not "Edge N/A": "edge"/"value" wording only belongs where an
  // exogenous market price exists, and none does here.
  NO_CLEAR_EDGE: {
    text: 'Nincs kimutatható él',
    className: 'text-muted-foreground font-normal'
  }
};

export function RecommendationLabel({ value }: {value: Recommendation;}) {
  const copy = recommendationCopy[value];
  return <span className={cn('text-ui-xs font-semibold', copy.className)}>{copy.text}</span>;
}

const diagnosisTone: Record<BandDiagnosis, string> = {
  reliable: 'bg-signal-soft text-signal',
  calibrated: 'bg-positive-soft text-positive',
  overconfident: 'bg-negative-soft text-negative',
  underconfident: 'bg-warning-soft text-warning',
  noise: 'bg-white/[0.06] text-muted-foreground',
  insufficient: 'bg-white/[0.06] text-muted-foreground'
};

/** The empirical verdict on a confidence band, as measured by the audit walk. */
export function BandDiagnosisBadge({
  diagnosis,
  className



}: {diagnosis: BandDiagnosis;className?: string;}) {
  return (
    <span className={cn(badgeBase, diagnosisTone[diagnosis], className)}>
      {BAND_DIAGNOSIS_COPY[diagnosis]}
    </span>);

}