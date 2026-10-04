import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

type Align = 'left' | 'center' | 'right';
export type SortDirection = 'asc' | 'desc' | null;
/** Semantic rail colour on the leading cell of a row (promotion, relegation…). */
export type Zone = 'zone-1' | 'zone-2' | 'zone-3' | 'zone-4';

const alignClass: Record<Align, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right'
};

const zoneVar: Record<Zone, string> = {
  'zone-1': 'var(--zone-1)',
  'zone-2': 'var(--zone-2)',
  'zone-3': 'var(--zone-3)',
  'zone-4': 'var(--zone-4)'
};

export function TableScroll({
  className,
  children



}: {className?: string;children: React.ReactNode;}) {
  return <div className={cn('table-scroll max-h-[520px]', className)}>{children}</div>;
}

export function Table({
  className,
  minWidth = 680,
  children




}: {className?: string;minWidth?: number;children: React.ReactNode;}) {
  return (
    <table className={cn('data-table', className)} style={{ minWidth }}>
      {children}
    </table>);

}

export function Th({
  align = 'left',
  sortable = false,
  sortDirection = null,
  className,
  children,
  ...rest




}: React.ThHTMLAttributes<HTMLTableCellElement> & {align?: Align;sortable?: boolean;sortDirection?: SortDirection;}) {
  return (
    <th
      scope="col"
      {...rest}
      tabIndex={sortable ? 0 : rest.tabIndex}
      aria-sort={
      sortable ?
      sortDirection === 'asc' ?
      'ascending' :
      sortDirection === 'desc' ?
      'descending' :
      'none' :
      undefined
      }
      className={cn(sortable && 'is-sortable', alignClass[align], className)}>
      
      <span
        className={cn(
          'inline-flex items-center gap-1',
          align === 'center' && 'justify-center',
          align === 'right' && 'justify-end'
        )}>
        
        <span className="th-label">{children}</span>
        {sortable ?
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'h-3 w-3 shrink-0 transition-transform duration-fast ease-enter',
            sortDirection ? 'opacity-100' : 'opacity-0',
            sortDirection === 'asc' && 'rotate-180'
          )} /> :

        null}
      </span>
    </th>);

}

export function Td({
  align = 'left',
  zone,
  className,
  children,
  style,
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement> & {align?: Align;zone?: Zone;}) {
  return (
    <td
      {...rest}
      style={
      zone ? { boxShadow: `inset 3px 0 0 0 ${zoneVar[zone]}`, ...style } : style
      }
      className={cn('font-mono tabular-nums', alignClass[align], className)}>
      
      {children}
    </td>);

}

/** Leading text column: sans-serif, full-contrast, truncates instead of wrapping. */
export function TdLabel({
  className,
  children,
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement> & {align?: Align;zone?: Zone;}) {
  return (
    <Td
      {...rest}
      className={cn('max-w-0 truncate font-sans font-medium text-foreground', className)}>
      
      {children}
    </Td>);

}

export function Tr({
  active = false,
  dividerBelow = false,
  className,
  children,
  ...rest



}: React.HTMLAttributes<HTMLTableRowElement> & {active?: boolean;dividerBelow?: boolean;}) {
  return (
    <tr
      {...rest}
      aria-current={active ? 'true' : undefined}
      className={cn(active && 'is-active', dividerBelow && 'row-divider', className)}>
      
      {children}
    </tr>);

}

export function EmptyRow({
  colSpan,
  children,
  className




}: {colSpan: number;children: React.ReactNode;className?: string;}) {
  return (
    <tr className="!bg-transparent hover:!bg-transparent">
      <td
        colSpan={colSpan}
        className={cn(
          'whitespace-normal px-4 py-10 text-center font-sans text-ui-xs text-muted-foreground',
          className
        )}>
        
        {children}
      </td>
    </tr>);

}

/** Zone / colour key rendered under a table. */
export function TableLegend({
  items,
  className



}: {items: {zone: Zone;label: string;}[];className?: string;}) {
  return (
    <ul
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border-subtle px-4 py-3 sm:px-5',
        className
      )}>
      
      {items.map((item) =>
      <li
        key={item.zone}
        className="flex items-center gap-1.5 text-ui-xs text-muted-foreground">
        
          <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: zoneVar[item.zone] }} />
        
          {item.label}
        </li>
      )}
    </ul>);

}

/** Small square club/team badge for the leading column of a standings table. */
export function TeamBadge({
  name,
  className



}: {name: string;className?: string;}) {
  const abbr = name.replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 3).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-1 font-heading text-[10px] font-medium tracking-tight text-muted-foreground',
        className
      )}>
      
      {abbr}
    </span>);

}