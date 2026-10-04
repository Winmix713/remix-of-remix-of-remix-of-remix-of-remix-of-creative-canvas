import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { TeamOption } from '../../utils/fixtures';

interface TeamSelectProps {
  value: string | null;
  options: TeamOption[];
  /** Keys already used elsewhere in this league column. */
  excluded: Set<string>;
  placeholder: string;
  disabled?: boolean;
  onChange: (key: string | null) => void;
}

interface PopoverGeometry {
  left: number;
  top?: number;
  bottom?: number;
  width: number;
  maxHeight: number;
}

const MIN_LIST_SPACE = 220;
const DESKTOP_MIN_WIDTH = 264;
const VIEWPORT_GUTTER = 12;

/**
 * The list is rendered in a portal on purpose. Every `Panel` in the app sets
 * `overflow-hidden`, so an absolutely positioned dropdown was clipped by the
 * panel — the 7th and 8th fixture rows of a round could never reach the bottom
 * of their own team list. A fixed-position portal escapes the clip, and the
 * geometry below flips the list upwards when there is no room underneath.
 */
export function TeamSelect({
  value,
  options,
  excluded,
  placeholder,
  disabled = false,
  onChange
}: TeamSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [compact, setCompact] = useState(false);
  const [geometry, setGeometry] = useState<PopoverGeometry | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => options.find((o) => o.key === value) ?? null, [options, value]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.
    filter((o) => o.key === value || !excluded.has(o.key)).
    filter((o) => q ? o.display.toLowerCase().includes(q) : true);
  }, [excluded, options, query, value]);

  // A bottom sheet is the only pattern that reliably fits a 20-team list on a
  // phone; below 640px the popover geometry is ignored entirely.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_GUTTER;
    const spaceAbove = rect.top - VIEWPORT_GUTTER;
    const flipUp = spaceBelow < MIN_LIST_SPACE && spaceAbove > spaceBelow;
    const available = flipUp ? spaceAbove : spaceBelow;
    const width = Math.min(
      Math.max(rect.width, DESKTOP_MIN_WIDTH),
      window.innerWidth - VIEWPORT_GUTTER * 2
    );
    const left = Math.min(
      Math.max(VIEWPORT_GUTTER, rect.left),
      window.innerWidth - width - VIEWPORT_GUTTER
    );
    setGeometry({
      left,
      width,
      maxHeight: Math.max(180, Math.min(340, available)),
      top: flipUp ? undefined : rect.bottom + 6,
      bottom: flipUp ? window.innerHeight - rect.top + 6 : undefined
    });
  }, []);

  useLayoutEffect(() => {
    if (!open || compact) return;
    measure();
  }, [compact, measure, open]);

  useEffect(() => {
    if (!open || compact) return;
    const onChangeView = () => measure();
    window.addEventListener('resize', onChangeView);
    window.addEventListener('scroll', onChangeView, true);
    return () => {
      window.removeEventListener('resize', onChangeView);
      window.removeEventListener('scroll', onChangeView, true);
    };
  }, [compact, measure, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      // Focusing the filter immediately is what makes a 20-team list usable.
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    setQuery('');
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const pick = (key: string) => {
    onChange(key);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(visible.length - 1, i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter' && visible.length > 0) {
      e.preventDefault();
      pick(visible[Math.min(activeIndex, visible.length - 1)].key);
    }
  };

  const list =
  <div
    ref={popoverRef}
    className={cn(
      'z-[90] flex flex-col overflow-hidden border border-border bg-popover shadow-panel-lg animate-fade-in',
      compact ?
      'fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] max-h-[68dvh] rounded-xl' :
      'fixed rounded-md'
    )}
    style={
    compact ?
    undefined :
    {
      left: geometry?.left ?? 0,
      top: geometry?.top,
      bottom: geometry?.bottom,
      width: geometry?.width ?? DESKTOP_MIN_WIDTH,
      maxHeight: geometry?.maxHeight ?? 320,
      visibility: geometry ? 'visible' : 'hidden'
    }
    }
    onKeyDown={onListKeyDown}>
    
      <div className="relative shrink-0 border-b border-border p-2">
        <Search
        className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden={true} />
      
        <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
        }}
        placeholder="Csapat keresése…"
        aria-label="Csapat keresése"
        className="field h-11 w-full pl-7 text-base sm:h-8 sm:text-ui-sm" />
      
      </div>

      <div
      ref={listRef}
      role="listbox"
      aria-label="Csapatok"
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
      
        {visible.length === 0 ?
      <p className="px-3 py-4 text-center text-ui-xs text-muted-foreground">
            Nincs választható csapat.
          </p> :

      visible.map((o, index) =>
      <button
        key={o.key}
        type="button"
        role="option"
        data-index={index}
        aria-selected={o.key === value}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => pick(o.key)}
        className={cn(
          'flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-ui-sm transition-colors sm:min-h-0 sm:py-1.5',
          index === activeIndex && 'bg-elevated',
          o.key === value ? 'text-signal' : 'text-foreground'
        )}>
        
              <span className="flex min-w-0 items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded border border-border bg-surface-1 font-heading text-[10px] font-medium tracking-tight text-muted-foreground">
                  {o.display.replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 3).toUpperCase()}
                </span>
                <span className="truncate">{o.display}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="font-mono text-ui-2xs text-muted-foreground">{o.played}</span>
                {o.key === value ? <Check className="h-3.5 w-3.5" aria-hidden={true} /> : null}
              </span>
            </button>
      )
      }
      </div>

      {compact ?
    <button
      type="button"
      onClick={() => setOpen(false)}
      className="min-h-[44px] shrink-0 border-t border-border py-3 text-ui-sm font-semibold text-muted-foreground">
      
          Bezárás
        </button> :
    <div className="shrink-0 border-t border-border-subtle px-3 py-1.5 text-ui-2xs text-muted-foreground">
      {visible.length} csapat
    </div>}
    </div>;


  return (
    <div className="relative min-w-0 flex-1">
      <div className="flex items-center gap-1">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && !open) {
              e.preventDefault();
              setOpen(true);
            }
          }}
          className={cn(
            'flex h-11 min-w-0 flex-1 items-center justify-between gap-1 rounded-md border px-2 text-left text-ui-sm transition-colors duration-base ease-enter sm:h-8',
            disabled && 'cursor-not-allowed opacity-40',
            selected ?
            'border-signal/30 bg-signal-soft text-foreground' :
            'border-dashed border-border bg-background text-muted-foreground hover:border-border/80 hover:text-foreground'
          )}>
          
          <span className="truncate font-semibold">{selected ? selected.display : placeholder}</span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-fast',
              open && 'rotate-180'
            )}
            aria-hidden={true} />
          
        </button>
        {selected && !disabled ?
        <button
          type="button"
          aria-label={`${selected.display} eltávolítása`}
          onClick={() => onChange(null)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-elevated hover:text-negative sm:h-6 sm:w-6">
          
            <X className="h-3.5 w-3.5" aria-hidden={true} />
          </button> :
        null}
      </div>

      {open ?
      createPortal(
        <>
              {compact ?
          <div
            className="fixed inset-0 z-[89] bg-black/60 animate-fade-in"
            onClick={() => setOpen(false)}
            aria-hidden={true} /> :

          null}
              {list}
            </>,
        document.body
      ) :
      null}
    </div>);

}