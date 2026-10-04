import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * A native `<details>` disclosure dressed as a panel. Long telemetry stacks
 * (audit, diagnostics, changelog) collapse by default so the surface opens on
 * the answer, not on eight equal-weight blocks — and keyboard/AT support comes
 * from the platform rather than hand-rolled ARIA.
 */
export function Collapsible({
  title,
  subtitle,
  defaultOpen = false,
  className,
  children






}: {title: React.ReactNode;subtitle?: React.ReactNode;defaultOpen?: boolean;className?: string;children: React.ReactNode;}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        'group min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-panel',
        className
      )}>
      
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-transparent px-4 py-3.5 marker:content-none transition-colors hover:bg-white/[0.02] group-open:border-border-subtle sm:px-5 sm:py-4">
        <span className="flex min-w-0 items-center gap-2 text-ui-base font-medium tracking-tight text-foreground">
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-fast ease-enter group-open:rotate-180"
            aria-hidden={true} />
          
          {title}
        </span>
        {subtitle ?
        <span className="text-ui-xs text-muted-foreground">{subtitle}</span> :
        null}
      </summary>
      <div className="min-w-0">{children}</div>
    </details>);

}