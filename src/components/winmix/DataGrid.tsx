import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  EmptyRow,
  Table,
  TableScroll,
  Td,
  Th,
  Tr,
  type SortDirection,
  type Zone } from
'./DataTable';

export interface GridColumn<T> {
  key: string;
  label: React.ReactNode;
  /** Shorter label for the mobile card rows; falls back to `label`. */
  cardLabel?: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  /** Rendered as the card headline instead of a label/value pair. */
  primary?: boolean;
  /** Rendered under the headline, before the label/value grid. */
  secondary?: boolean;
  /** Left out of the mobile card entirely. */
  cardHidden?: boolean;
  sortable?: boolean;
  sortDirection?: SortDirection;
  onSort?: () => void;
  className?: string;
  cellClassName?: string;
  zone?: (row: T) => Zone | undefined;
  cell: (row: T) => React.ReactNode;
}

export interface DataGridExpansion<T> {
  isOpen: (row: T) => boolean;
  onToggle: (row: T) => void;
  /** Accessible label for the disclosure control of this row. */
  label: (row: T) => string;
  content: (row: T) => React.ReactNode;
}

interface DataGridProps<T> {
  columns: GridColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty: React.ReactNode;
  /** Table width below which horizontal scroll kicks in on desktop. */
  minWidth?: number;
  /** Under this breakpoint the table is replaced by a card list. */
  collapseBelow?: 'md' | 'lg' | 'xl';
  scrollClassName?: string;
  isActive?: (row: T) => boolean;
  expandable?: DataGridExpansion<T>;
  footer?: React.ReactNode;
}

const tableVisibility: Record<'md' | 'lg' | 'xl', string> = {
  md: 'hidden md:block',
  lg: 'hidden lg:block',
  xl: 'hidden xl:block'
};

const cardVisibility: Record<'md' | 'lg' | 'xl', string> = {
  md: 'md:hidden',
  lg: 'lg:hidden',
  xl: 'xl:hidden'
};

/**
 * One row definition, two presentations. Wide instrument tables (9 columns of
 * H2H, rolling windows, model weights) stay dense on desktop and become a
 * label/value card list on phones instead of forcing a 1080px horizontal
 * scroll where half the columns are simply unreachable.
 */
export function DataGrid<T>({
  columns,
  rows,
  rowKey,
  empty,
  minWidth = 680,
  collapseBelow = 'lg',
  scrollClassName,
  isActive,
  expandable,
  footer
}: DataGridProps<T>) {
  const colSpan = columns.length + (expandable ? 1 : 0);
  const primary = columns.filter((c) => c.primary);
  const secondary = columns.filter((c) => c.secondary && !c.primary);
  const detail = columns.filter((c) => !c.primary && !c.secondary && !c.cardHidden);

  return (
    <>
      {/* --- Desktop: the dense table ----------------------------------- */}
      <div className={tableVisibility[collapseBelow]}>
        <TableScroll className={scrollClassName}>
          <Table minWidth={minWidth}>
            <thead>
              <tr>
                {expandable ? <Th className="w-8" aria-label="Részletek" /> : null}
                {columns.map((col) =>
                <Th
                  key={col.key}
                  align={col.align}
                  sortable={col.sortable}
                  sortDirection={col.sortDirection}
                  className={col.className}
                  onClick={col.onSort}
                  onKeyDown={
                  col.onSort ?
                  (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      col.onSort?.();
                    }
                  } :
                  undefined
                  }>
                  
                    {col.label}
                  </Th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ?
              <EmptyRow colSpan={colSpan}>{empty}</EmptyRow> :

              rows.map((row) => {
                const key = rowKey(row);
                const open = expandable?.isOpen(row) ?? false;
                return (
                  <React.Fragment key={key}>
                      <Tr active={isActive?.(row) ?? false}>
                        {expandable ?
                      <Td className="w-8 px-2">
                            <button
                          type="button"
                          aria-expanded={open}
                          aria-label={expandable.label(row)}
                          onClick={() => expandable.onToggle(row)}
                          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground">
                          
                              <ChevronDown
                            aria-hidden={true}
                            className={cn(
                              'h-3.5 w-3.5 transition-transform duration-fast ease-enter',
                              open && 'rotate-180'
                            )} />
                          
                            </button>
                          </Td> :
                      null}
                        {columns.map((col) =>
                      <Td
                        key={col.key}
                        align={col.align}
                        zone={col.zone?.(row)}
                        className={col.cellClassName}>
                        
                            {col.cell(row)}
                          </Td>
                      )}
                      </Tr>
                      {open ?
                    <tr className="!bg-transparent hover:!bg-transparent">
                          <td colSpan={colSpan} className="whitespace-normal px-4 py-3">
                            {expandable?.content(row)}
                          </td>
                        </tr> :
                    null}
                    </React.Fragment>);

              })
              }
            </tbody>
          </Table>
        </TableScroll>
      </div>

      {/* --- Mobile: the card list --------------------------------------- */}
      <div className={cn('flex flex-col gap-2 p-3', cardVisibility[collapseBelow])}>
        {rows.length === 0 ?
        <p className="px-2 py-8 text-center text-ui-sm text-muted-foreground">{empty}</p> :

        rows.map((row) => {
          const key = rowKey(row);
          const open = expandable?.isOpen(row) ?? false;
          return (
            <article
              key={key}
              className={cn(
                'rounded-md border bg-elevated/40 px-3 py-2.5',
                isActive?.(row) ? 'border-signal/40 bg-signal-soft' : 'border-border'
              )}>
              
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {primary.map((col) =>
                  <div
                    key={col.key}
                    className="truncate text-ui-base font-bold text-foreground">
                    
                        {col.cell(row)}
                      </div>
                  )}
                    {secondary.length > 0 ?
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-ui-2xs text-muted-foreground">
                        {secondary.map((col) =>
                    <span key={col.key} className="inline-flex items-center gap-1">
                            <span className="uppercase tracking-label opacity-70">
                              {col.cardLabel ?? col.label}
                            </span>
                            {col.cell(row)}
                          </span>
                    )}
                      </div> :
                  null}
                  </div>
                  {expandable ?
                <button
                  type="button"
                  aria-expanded={open}
                  aria-label={expandable.label(row)}
                  onClick={() => expandable.onToggle(row)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground">
                  
                      <ChevronDown
                    aria-hidden={true}
                    className={cn(
                      'h-4 w-4 transition-transform duration-fast ease-enter',
                      open && 'rotate-180'
                    )} />
                  
                    </button> :
                null}
                </div>

                {detail.length > 0 ?
              <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border/60 pt-2.5">
                    {detail.map((col) =>
                <div key={col.key} className="flex items-baseline justify-between gap-2">
                        <dt className="truncate font-mono text-ui-2xs uppercase tracking-label text-muted-foreground">
                          {col.cardLabel ?? col.label}
                        </dt>
                        <dd className="shrink-0 font-mono text-ui-sm tabular-nums text-foreground">
                          {col.cell(row)}
                        </dd>
                      </div>
                )}
                  </dl> :
              null}

                {open ?
              <div className="mt-2.5 border-t border-border/60 pt-2.5">
                    {expandable?.content(row)}
                  </div> :
              null}
              </article>);

        })
        }
      </div>

      {footer}
    </>);

}