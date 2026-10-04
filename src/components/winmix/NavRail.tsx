import React, { useRef } from 'react';
import {
  BarChart3,
  ClipboardList,
  Database,
  Download,
  Gauge,
  Target,
  Upload,
  Users } from
'lucide-react';
import { cn } from '../../lib/utils';
import type { ViewKey } from '../../types/winmix';

interface NavItem {
  key: ViewKey;
  label: string;
  icon: React.ComponentType<any>;
}

const NAV_ITEMS: NavItem[] = [
{ key: 'dashboard', label: 'Taktikai Stúdió & Adatbázis', icon: Database },
{ key: 'operations', label: 'Pipeline Üzemeltetés (súlyok, beállítások, felhő)', icon: Gauge },
{ key: 'pipeline', label: 'Pipeline v2 Audit & Telemetria', icon: BarChart3 },
{ key: 'h2h', label: 'H2H — Egymás Elleni Mérkőzések (Kumulatív)', icon: Users },
{ key: 'predictor', label: 'Forduló Prediktor — Top 3+3', icon: Target },
{ key: 'ledger', label: 'Tipp Napló & Visszacsatolás', icon: ClipboardList }];


interface NavRailProps {
  view: ViewKey;
  onChange: (view: ViewKey) => void;
  onExport: () => void;
  onImport: (file: File) => void;
}

export function NavRail({ view, onChange, onExport, onImport }: NavRailProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <nav
      aria-label="Fő navigáció"
      className="order-2 z-40 flex h-16 w-full shrink-0 flex-row items-center justify-around gap-2 border-t border-border-subtle bg-sidebar px-3 md:order-1 md:h-full md:w-[76px] md:flex-col md:justify-start md:gap-2 md:border-r md:border-t-0 md:py-5">
      
      <div
        aria-hidden="true"
        className="mb-1 hidden h-9 w-9 items-center justify-center rounded-xl bg-signal text-[13px] font-semibold tracking-tighter text-signal-foreground shadow-panel md:mb-4 md:flex">
        
        wm
      </div>

      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = view === item.key;
        return (
          <button
            key={item.key}
            type="button"
            title={item.label}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange(item.key)}
            className={cn(
              'tap flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-base ease-enter',
              isActive ?
              'bg-signal-soft text-signal' :
              'text-muted-foreground hover:bg-surface-pop hover:text-foreground'
            )}>
            
            <Icon className="h-[19px] w-[19px]" aria-hidden={true} />
          </button>);

      })}

      <button
        type="button"
        title="JSON Adatbázis Import"
        aria-label="JSON adatbázis import"
        onClick={() => fileRef.current?.click()}
        className="tap flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors duration-base ease-enter hover:bg-surface-pop hover:text-foreground md:mt-auto">
        
        <Upload className="h-[19px] w-[19px]" aria-hidden={true} />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onImport(file);
        }} />
      

      <button
        type="button"
        title="JSON Adatbázis Export"
        aria-label="JSON adatbázis export"
        onClick={onExport}
        className="tap flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors duration-base ease-enter hover:bg-surface-pop hover:text-foreground">
        
        <Download className="h-[19px] w-[19px]" aria-hidden={true} />
      </button>
    </nav>);

}