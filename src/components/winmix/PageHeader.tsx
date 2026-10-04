import React from 'react';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  /** Lucide icon component rendered in the title tile. */
  icon: React.ComponentType<any>;
  title: string;
  /** The one-paragraph brief explaining what this surface answers. */
  intro: React.ReactNode;
  /** Optional breadcrumb-style context line above the title. */
  eyebrow?: React.ReactNode;
  /** Right-aligned actions; wraps under the title on narrow screens. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Page-level heading block. One component keeps the rhythm identical across
 * every surface and gives each screen exactly one `h1`.
 */
export function PageHeader({
  icon: Icon,
  title,
  intro,
  eyebrow,
  actions,
  className
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between',
        className
      )}>
      
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden={true}
          className="mt-0.5 hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 text-signal shadow-panel sm:flex">
          
          <Icon className="h-[18px] w-[18px]" aria-hidden={true} />
        </span>
        <div className="min-w-0">
          {eyebrow ?
          <p className="mb-1 text-ui-xs text-muted-foreground">{eyebrow}</p> :
          null}
          <h1 className="flex items-center gap-2 text-page-title font-semibold tracking-tighter text-foreground">
            <Icon className="h-[1.05em] w-[1.05em] shrink-0 text-signal sm:hidden" aria-hidden={true} />
            <span className="min-w-0">{title}</span>
          </h1>
          <p className="mt-1.5 max-w-prose text-ui-sm leading-relaxed text-muted-foreground">
            {intro}
          </p>
        </div>
      </div>
      {actions ?
      <div className="flex shrink-0 flex-wrap items-center gap-2 lg:pt-1">{actions}</div> :
      null}
    </header>);

}