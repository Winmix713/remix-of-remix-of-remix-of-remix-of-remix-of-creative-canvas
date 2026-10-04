import React, { useRef } from 'react';
import { cn } from '../../../lib/utils';

export interface TabDescriptor<K extends string> {
  key: K;
  label: string;
  icon: React.ComponentType<any>;
}

/**
 * Tablist with the arrow-key navigation the WAI-ARIA tabs pattern requires —
 * the ARIA wiring was already correct here, only the keyboard behaviour was
 * missing. Scrolls horizontally instead of wrapping on narrow screens.
 */
export function OpsTabs<K extends string>({
  tabs,
  active,
  onChange,
  label





}: {tabs: TabDescriptor<K>[];active: K;onChange: (key: K) => void;label: string;}) {
  const listRef = useRef<HTMLDivElement>(null);

  const move = (delta: number) => {
    const index = tabs.findIndex((t) => t.key === active);
    const next = (index + delta + tabs.length) % tabs.length;
    onChange(tabs[next].key);
    listRef.current?.
    querySelector<HTMLButtonElement>(`#ops-tab-${tabs[next].key}`)?.
    focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className="seg scrollbar-none max-w-full self-start overflow-x-auto"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          move(1);
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          move(-1);
        }
      }}>
      
      {tabs.map((t) => {
        const Icon = t.icon;
        const selected = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`ops-tab-${t.key}`}
            aria-selected={selected}
            aria-controls={`ops-panel-${t.key}`}
            tabIndex={selected ? 0 : -1}
            className={cn('seg-tab tap h-9 shrink-0 whitespace-nowrap')}
            onClick={() => onChange(t.key)}>
            
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {t.label}
          </button>);

      })}
    </div>);

}