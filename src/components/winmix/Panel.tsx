import React from 'react';
import { cn } from '../../lib/utils';

export function Panel({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      {...rest}
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-panel',
        className
      )}>
      
      {children}
    </section>);

}

export function PanelHeader({
  className,
  children



}: {className?: string;children: React.ReactNode;}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border-subtle px-4 py-3.5 sm:px-5 sm:py-4',
        className
      )}>
      
      {children}
    </div>);

}

/**
 * Renders a real heading element. Panel titles used to be a hard-coded `h2`
 * regardless of nesting, so a screen-reader user got a flat outline of every
 * page; `as` lets a nested panel declare `h3` and keep the outline truthful.
 */
export function PanelTitle({
  as: Tag = 'h2',
  className,
  children




}: {as?: 'h2' | 'h3' | 'h4';className?: string;children: React.ReactNode;}) {
  return (
    <Tag
      className={cn(
        'flex min-w-0 items-center gap-2 text-ui-base font-medium tracking-tight text-foreground',
        className
      )}>
      
      {children}
    </Tag>);

}

export function PanelSubtitle({ children }: {children: React.ReactNode;}) {
  return <p className="mt-0.5 text-ui-xs text-muted-foreground">{children}</p>;
}

/** Right-aligned action cluster inside a PanelHeader; wraps on narrow screens. */
export function PanelActions({
  className,
  children



}: {className?: string;children: React.ReactNode;}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 sm:gap-2', className)}>{children}</div>);

}

/** Quiet footer strip for totals, legends and secondary notes. */
export function PanelFooter({
  className,
  children



}: {className?: string;children: React.ReactNode;}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border-subtle px-4 py-3 text-ui-xs text-muted-foreground sm:px-5',
        className
      )}>
      
      {children}
    </div>);

}

/**
 * Groups a long stack of panels into a named area. DataStudio and
 * PipelineAudit both ran 8 equal-weight panels in a single scroll with no
 * orientation cues.
 */
export function SectionHeading({
  icon: Icon,
  children,
  hint




}: {icon?: React.ComponentType<any>;children: React.ReactNode;hint?: React.ReactNode;}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 pt-1">
      <h2 className="section-label">
        {Icon ? <Icon className="h-3.5 w-3.5 text-signal" aria-hidden={true} /> : null}
        {children}
      </h2>
      {hint ? <span className="text-ui-xs text-muted-foreground">{hint}</span> : null}
    </div>);

}

/** Small tonal pill used for counters and inline metadata. */
export function Chip({
  className,
  children,
  tone = 'signal',
  title





}: {className?: string;children: React.ReactNode;tone?: 'signal' | 'neutral' | 'positive' | 'negative' | 'warning';title?: string;}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center rounded-sm px-1.5 py-0.5 text-ui-xs tabular-nums',
        tone === 'signal' && 'bg-signal-soft text-signal',
        tone === 'neutral' && 'bg-white/[0.06] text-muted-foreground',
        tone === 'positive' && 'bg-positive-soft text-positive',
        tone === 'negative' && 'bg-negative-soft text-negative',
        tone === 'warning' && 'bg-warning-soft text-warning',
        className
      )}>
      
      {children}
    </span>);

}