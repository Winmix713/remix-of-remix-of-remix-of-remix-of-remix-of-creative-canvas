import React from 'react';
import { AlertTriangle, Database, Loader2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Panel } from './Panel';

/**
 * The four surface states, extracted from FixturePredictor so every page can
 * reach for the same progress / error / empty treatment instead of inventing
 * one. PipelineAudit and the ops dashboard previously had none.
 */

export function StateProgress({
  label,
  detail,
  ratio,
  className






}: {label: string;detail?: string; /** 0…1. Omit for an indeterminate bar. */ratio?: number;className?: string;}) {
  const pct = ratio === undefined ? undefined : Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 rounded-xl border border-border bg-surface-2 px-4 py-3.5 shadow-panel',
        className
      )}
      aria-live="polite"
      aria-busy={true}>
      
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-ui-xs font-medium text-foreground">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-signal" aria-hidden={true} />
          {label}
        </span>
        {detail ?
        <span className="text-ui-xs tabular-nums text-muted-foreground">{detail}</span> :
        null}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={pct === undefined ? undefined : 0}
        aria-valuemax={pct === undefined ? undefined : 100}
        aria-valuenow={pct === undefined ? undefined : Math.round(pct)}
        className="h-1.5 w-full overflow-hidden rounded-full bg-elevated-2">
        
        <div
          className={cn(
            'h-full rounded-full bg-signal transition-[width] duration-base ease-move',
            pct === undefined && 'w-1/3 animate-signal-pulse'
          )}
          style={pct === undefined ? undefined : { width: `${pct}%` }} />
        
      </div>
    </div>);

}

export function StateError({
  title,
  message,
  hint,
  onDismiss,
  className






}: {title: string;message: string;hint?: React.ReactNode;onDismiss?: () => void;className?: string;}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-xl border border-negative/30 bg-negative-soft px-4 py-3',
        className
      )}>
      
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-negative" aria-hidden={true} />
      <div className="min-w-0 flex-1">
        <p className="text-ui-xs font-medium text-negative">{title}</p>
        <p className="mt-1 break-words text-ui-xs leading-relaxed text-muted-foreground">{message}</p>
        {hint ? <p className="mt-1.5 text-ui-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {onDismiss ?
      <button
        type="button"
        aria-label="Hibaüzenet elvetése"
        onClick={onDismiss}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-pop hover:text-foreground">
        
          <X className="h-3.5 w-3.5" aria-hidden={true} />
        </button> :
      null}
    </div>);

}

export function StateEmptyPanel({
  title,
  message,
  icon: Icon = Database,
  action





}: {title: string;message: string;icon?: React.ComponentType<any>;action?: React.ReactNode;}) {
  return (
    <Panel className="items-center gap-2 px-6 py-12 text-center">
      <span
        aria-hidden={true}
        className="mb-1 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-1 text-muted-foreground">
        
        <Icon className="h-5 w-5" aria-hidden={true} />
      </span>
      <p className="text-ui-base font-medium text-foreground">{title}</p>
      <p className="max-w-prose text-ui-xs leading-relaxed text-muted-foreground">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </Panel>);

}

/** Inline notice used for stale / advisory states that are not errors. */
export function StateNotice({
  tone = 'warning',
  children,
  className




}: {tone?: 'warning' | 'info';children: React.ReactNode;className?: string;}) {
  return (
    <p
      role="status"
      className={cn(
        'flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-ui-xs leading-relaxed',
        tone === 'warning' ?
        'border-warning/25 bg-warning-soft text-warning' :
        'border-border bg-surface-2 text-muted-foreground',
        className
      )}>
      
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden={true} />
      <span className="min-w-0">{children}</span>
    </p>);

}