```App.tsx
import React from 'react'
import { CoreCardSettings } from './components/core/CoreCardSettings'

export function App() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#121212] p-6 sm:p-10">
      <CoreCardSettings />
    </main>
  )
}

```
```components/core/CoreCardEditor.tsx
import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { CoreCardConfig } from '../../types/markets'
import { marketGroups } from '../../data/markets'
import { MarketGroupRow } from './MarketGroupRow'

interface CoreCardEditorProps {
  config: CoreCardConfig
  isExpanded: boolean
  onToggleExpand: () => void
  onChange: (newConfig: CoreCardConfig) => void
  onReset: () => void
}

const cardNames = {
  1: 'Primary Core',
  2: 'Secondary Core',
  3: 'Tertiary Core'
}

export function CoreCardEditor({
  config,
  isExpanded,
  onToggleExpand,
  onChange,
  onReset
}: CoreCardEditorProps) {
  const totalSelected =
    config.goalpick.length +
    config.safetyTrend.length +
    config.halfTimeResult.length +
    config.otherPatterns.length

  const isValid = totalSelected > 0

  const toggleOption = (groupId: keyof Omit<CoreCardConfig, 'id'>, optionId: string) => {
    const current = config[groupId]
    const updated = current.includes(optionId)
      ? current.filter(id => id !== optionId)
      : [...current, optionId]
    
    onChange({ ...config, [groupId]: updated })
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border-[1.5px] border-[#242424] bg-[#1c1c1c] transition-colors duration-200 focus-within:border-[#3a3a3a]">
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center justify-between p-4 outline-none hover:bg-[#212121] focus-visible:bg-[#212121]"
      >
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-start gap-0.5">
            <span className="font-heading text-sm font-semibold text-[#f1f1f1]">
              CORE CARD 0{config.id}
            </span>
            <span className="font-heading text-xs text-[#7b7b7b]">
              {cardNames[config.id]}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isValid ? (
              <span className="flex items-center gap-1.5 rounded-full bg-[#00a656]/10 px-2.5 py-1 font-heading text-xs font-semibold text-[#3ddc8f]">
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                Configured
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-[#ff381c]/10 px-2.5 py-1 font-heading text-xs font-semibold text-[#ff381c]">
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                Not configured
              </span>
            )}
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-[#282828] bg-[#191919]"
          >
            <ChevronDown className="h-4 w-4 text-[#7b7b7b]" strokeWidth={2} />
          </motion.div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="flex flex-col border-t-[1.5px] border-[#242424] px-4 pb-4">
              <div className="flex items-center justify-between border-b-[1.5px] border-[#1e1e1e] py-3">
                <span className="font-heading text-xs text-[#7b7b7b]">
                  Configure markets for this card independently.
                </span>
                <button
                  type="button"
                  onClick={onReset}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-heading text-xs font-semibold text-[#7b7b7b] transition-colors duration-150 hover:bg-[#242424] hover:text-[#f1f1f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
                >
                  <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Reset Card
                </button>
              </div>

              <div className="flex flex-col">
                {marketGroups.map(group => (
                  <MarketGroupRow
                    key={group.id}
                    group={group}
                    selectedIds={config[group.id as keyof Omit<CoreCardConfig, 'id'>] as string[]}
                    onToggle={(optionId) => toggleOption(group.id as keyof Omit<CoreCardConfig, 'id'>, optionId)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

```
```components/core/CoreCardSettings.tsx
import React, { useState } from 'react'
import { Layers, RotateCcw } from 'lucide-react'
import { CoreCardConfig } from '../../types/markets'
import { defaultCoreCardsConfig, emptyCoreCardsConfig, allOptions } from '../../data/markets'
import { CoreCardEditor } from './CoreCardEditor'

export function CoreCardSettings() {
  const [cards, setCards] = useState<[CoreCardConfig, CoreCardConfig, CoreCardConfig]>(defaultCoreCardsConfig)
  const [expandedCardId, setExpandedCardId] = useState<number | null>(1)

  const updateCard = (index: number, newConfig: CoreCardConfig) => {
    const newCards = [...cards] as [CoreCardConfig, CoreCardConfig, CoreCardConfig]
    newCards[index] = newConfig
    setCards(newCards)
  }

  const resetCard = (index: number) => {
    const newCards = [...cards] as [CoreCardConfig, CoreCardConfig, CoreCardConfig]
    newCards[index] = emptyCoreCardsConfig[index]
    setCards(newCards)
  }

  const resetAll = () => {
    setCards(emptyCoreCardsConfig)
  }

  const configuredCount = cards.filter(
    card => card.goalpick.length + card.safetyTrend.length + card.halfTimeResult.length + card.otherPatterns.length > 0
  ).length

  const getCardSummary = (card: CoreCardConfig) => {
    const allSelectedIds = [
      ...card.goalpick,
      ...card.safetyTrend,
      ...card.halfTimeResult,
      ...card.otherPatterns
    ]
    if (allSelectedIds.length === 0) return 'Empty'
    
    return allSelectedIds
      .map(id => allOptions.find(opt => opt.id === id)?.label)
      .filter(Boolean)
      .join(' · ')
  }

  return (
    <section
      aria-label="Core Card Settings"
      className="flex w-full max-w-[720px] flex-col rounded-[1.25rem] border-[1.5px] border-[#242424] bg-[#191919] shadow-[0_32px_80px_-32px_rgba(0,0,0,0.9)]"
    >
      <header className="flex items-center justify-between gap-4 p-4 pb-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-lg font-semibold leading-tight text-[#f1f1f1]">
            Core Card Settings
          </h2>
          <p className="max-w-[36rem] font-heading text-sm leading-[150%] text-[#7b7b7b]">
            Configure each of the 3 core cards independently. Each card can have its own markets, confidence rules and patterns.
          </p>
        </div>
        <span className="flex h-8 flex-shrink-0 items-center gap-2 rounded-full border-[1.5px] border-[#282828] px-4 font-heading text-xs font-semibold text-[#7b7b7b]">
          <Layers className="h-3.5 w-3.5" strokeWidth={1.75} />
          {configuredCount} / 3 Configured
        </span>
      </header>

      <div className="flex flex-col gap-3 px-4 pb-6">
        {cards.map((card, index) => (
          <CoreCardEditor
            key={card.id}
            config={card}
            isExpanded={expandedCardId === card.id}
            onToggleExpand={() => setExpandedCardId(expandedCardId === card.id ? null : card.id)}
            onChange={(newConfig) => updateCard(index, newConfig)}
            onReset={() => resetCard(index)}
          />
        ))}
      </div>

      <footer className="flex flex-col gap-4 border-t-[1.5px] border-[#1e1e1e] p-4">
        <div className="flex items-center justify-between">
          <p className="font-heading text-sm font-semibold text-[#f1f1f1]">
            {configuredCount} Core Cards configured
          </p>
          <button
            type="button"
            onClick={resetAll}
            className="flex items-center gap-1.5 rounded-lg border-[1.5px] border-[#333333] px-3 py-2 font-heading text-sm font-semibold text-[#f1f1f1] transition-colors duration-150 hover:border-[#4a4a4a] hover:bg-[#242424] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
            Reset All
          </button>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border-[1.5px] border-[#242424] bg-[#1c1c1c] p-3">
          {cards.map(card => (
            <div key={card.id} className="flex items-start gap-3">
              <span className="flex-shrink-0 font-heading text-xs font-semibold text-[#7b7b7b] w-16">
                CORE 0{card.id}
              </span>
              <span className="font-mono text-xs leading-[160%] text-[#8a8a8a]">
                {getCardSummary(card)}
              </span>
            </div>
          ))}
        </div>
      </footer>
    </section>
  )
}

```
```components/core/MarketChip.tsx
import React from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { MarketOption } from '../../types/markets'

interface MarketChipProps {
  option: MarketOption
  selected: boolean
  onToggle: () => void
}

export function MarketChip({ option, selected, onToggle }: MarketChipProps) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={selected}
      title={option.hint}
      onClick={onToggle}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={[
        'group relative inline-flex items-center gap-1.5 rounded-xl border-[1.5px] px-3 py-2',
        'font-heading text-sm font-semibold leading-none transition-colors duration-200',
        'outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#191919]',
        selected
          ? 'border-[#00a656]/45 bg-[#00a656]/[0.10] text-[#3ddc8f]'
          : 'border-[#282828] bg-[#1c1c1c] text-[#8a8a8a] hover:border-[#3a3a3a] hover:bg-[#212121] hover:text-[#d6d6d6]'
      ].join(' ')}
    >
      <motion.span
        initial={false}
        animate={{ width: selected ? 14 : 0, opacity: selected ? 1 : 0 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        className="flex items-center overflow-hidden"
      >
        <Check className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={3} />
      </motion.span>
      {option.label}
    </motion.button>
  )
}

```
```components/core/MarketGroupRow.tsx
import React from 'react'
import { MarketGroup } from '../../types/markets'
import { MarketChip } from './MarketChip'

interface MarketGroupRowProps {
  group: MarketGroup
  selectedIds: string[]
  onToggle: (id: string) => void
}

export function MarketGroupRow({ group, selectedIds, onToggle }: MarketGroupRowProps) {
  const selectedCount = group.options.filter(option =>
    selectedIds.includes(option.id)
  ).length

  return (
    <div
      role="group"
      aria-label={group.title}
      className="flex flex-col gap-3 border-b-[1.5px] border-[#1e1e1e] py-4 last:border-b-0"
    >
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-heading text-xs uppercase leading-[160%] tracking-[0.08em] text-[#727272]/80">
          {group.title}
        </h4>
        <span
          className={[
            'font-heading text-xs tabular-nums transition-colors duration-200',
            selectedCount > 0 ? 'text-[#3ddc8f]' : 'text-[#4a4a4a]'
          ].join(' ')}
        >
          {selectedCount} / {group.options.length}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {group.options.map(option => (
          <MarketChip
            key={option.id}
            option={option}
            selected={selectedIds.includes(option.id)}
            onToggle={() => onToggle(option.id)}
          />
        ))}
      </div>
    </div>
  )
}

```
```data/markets.ts
import { MarketGroup, CoreCardConfig } from '../types/markets'

export const marketGroups: MarketGroup[] = [
  {
    id: 'goalpick',
    title: 'Goalpick',
    options: [
      { id: 'btts', label: 'BTTS', hint: 'Mindkét csapat szerez gólt' },
      { id: 'no-btts', label: 'No BTTS', hint: 'Legalább az egyik kapu tiszta marad' },
      { id: 'over-15', label: 'Over 1.5', hint: 'Legalább 2 gól a meccsen' },
      { id: 'under-15', label: 'Under 1.5', hint: 'Legfeljebb 1 gól a meccsen' },
      { id: 'over-25', label: 'Over 2.5', hint: 'Legalább 3 gól a meccsen' },
      { id: 'under-25', label: 'Under 2.5', hint: 'Legfeljebb 2 gól a meccsen' },
      { id: 'over-35', label: 'Over 3.5', hint: 'Legalább 4 gól a meccsen' },
      { id: 'under-35', label: 'Under 3.5', hint: 'Legfeljebb 3 gól a meccsen' }
    ]
  },
  {
    id: 'safetyTrend',
    title: 'Safety Trend',
    options: [
      { id: '1', label: '1', hint: 'Hazai győzelem' },
      { id: 'x', label: 'X', hint: 'Döntetlen' },
      { id: '2', label: '2', hint: 'Vendég győzelem' },
      { id: '1x', label: '1X', hint: 'Hazai nem kap ki' },
      { id: 'x2', label: 'X2', hint: 'Vendég nem kap ki' },
      { id: '12', label: '12', hint: 'Nem lesz döntetlen' }
    ]
  },
  {
    id: 'halfTimeResult',
    title: 'Half-Time / Result',
    options: [
      { id: 'ht-1', label: 'HT:1', hint: 'Hazai vezet a szünetben' },
      { id: 'ht-x', label: 'HT:X', hint: 'Döntetlen a szünetben' },
      { id: 'ht-2', label: 'HT:2', hint: 'Vendég vezet a szünetben' },
      { id: 'draw', label: 'Draw', hint: 'Döntetlen a vége' },
      { id: 'no-draw', label: 'No Draw', hint: 'Nem lesz döntetlen' }
    ]
  },
  {
    id: 'otherPatterns',
    title: 'Other Patterns',
    options: [
      { id: 'points', label: 'Points', hint: 'Pontszám alapú minta' },
      { id: 'streak', label: 'Streak', hint: 'Forma- és sorozatalapú minta' },
      { id: 'model-agreement', label: 'Model Agreement', hint: 'Több modell azonos irányba mutat' }
    ]
  }
]

export const defaultCoreCardsConfig: [CoreCardConfig, CoreCardConfig, CoreCardConfig] = [
  {
    id: 1,
    goalpick: ['btts', 'over-25'],
    safetyTrend: ['x2'],
    halfTimeResult: [],
    otherPatterns: ['points']
  },
  {
    id: 2,
    goalpick: ['over-15', 'under-35'],
    safetyTrend: ['1x'],
    halfTimeResult: [],
    otherPatterns: ['streak', 'model-agreement']
  },
  {
    id: 3,
    goalpick: ['btts', 'under-25'],
    safetyTrend: ['12'],
    halfTimeResult: [],
    otherPatterns: ['model-agreement']
  }
]

export const emptyCoreCardsConfig: [CoreCardConfig, CoreCardConfig, CoreCardConfig] = [
  { id: 1, goalpick: [], safetyTrend: [], halfTimeResult: [], otherPatterns: [] },
  { id: 2, goalpick: [], safetyTrend: [], halfTimeResult: [], otherPatterns: [] },
  { id: 3, goalpick: [], safetyTrend: [], halfTimeResult: [], otherPatterns: [] }
]

export const allOptions = marketGroups.flatMap(group => group.options)

```
```index.css
/* --- MANAGED FONT IMPORTS START (do not edit manually) --- */
/* INTERNAL USE NAME: Heading */
@import url('https://fonts.googleapis.com/css2?family=Geist:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');
/* INTERNAL USE NAME: Mono */
@import url('https://fonts.googleapis.com/css2?family=Geist+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');

/* --- MANAGED FONT IMPORTS END --- */

/* @import url() FONT IMPORTS MUST ALWAYS BE AT THE VERY TOP OF THIS FILE, ABOVE THE TAILWIND IMPORTS — DO NOT DELETE THIS COMMENT */

/* CRITICAL: THE FOLLOWING TAILWIND IMPORTS MUST NEVER BE DELETED OR REORDERED — DO NOT DELETE THIS COMMENT */
@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';

/* END TAILWIND IMPORTS — ALL OTHER CSS MUST GO BELOW THIS LINE */

@custom-variant dark (&:is(.dark *));
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --radius: 0.625rem;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}
:root.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.145 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.145 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.396 0.141 25.723);
  --destructive-foreground: oklch(0.637 0.237 25.331);
  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.439 0 0);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.269 0 0);
  --sidebar-ring: oklch(0.439 0 0);
}
@layer base {
  * {
    @apply border-border outline-ring;
  }
  body {
    @apply bg-background text-foreground;
  }
}

```
```index.tsx
import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(<App />);
}

```
```package.json
{
  "name": "magic-patterns-project",
  "private": true,
  "dependencies": {
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "react-router-dom": "6.30.2",
    "lucide-react": "0.577.0",
    "framer-motion": "11.18.2",
    "@radix-ui/react-icons": "1.3.2",
    "date-fns": "4.1.0",
    "tailwind-merge": "2.6.1"
  }
}

```
```tailwind.config.js
export default {
  darkMode: 'selector',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        'card-foreground': 'var(--card-foreground)',
        popover: 'var(--popover)',
        'popover-foreground': 'var(--popover-foreground)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        secondary: 'var(--secondary)',
        'secondary-foreground': 'var(--secondary-foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        accent: 'var(--accent)',
        'accent-foreground': 'var(--accent-foreground)',
        destructive: 'var(--destructive)',
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        'chart-1': 'var(--chart-1)',
        'chart-2': 'var(--chart-2)',
        'chart-3': 'var(--chart-3)',
        'chart-4': 'var(--chart-4)',
        'chart-5': 'var(--chart-5)',
        sidebar: 'var(--sidebar)',
        'sidebar-foreground': 'var(--sidebar-foreground)',
        'sidebar-primary': 'var(--sidebar-primary)',
        'sidebar-primary-foreground': 'var(--sidebar-primary-foreground)',
        'sidebar-accent': 'var(--sidebar-accent)',
        'sidebar-accent-foreground': 'var(--sidebar-accent-foreground)',
        'sidebar-border': 'var(--sidebar-border)',
        'sidebar-ring': 'var(--sidebar-ring)',
        'destructive-foreground': 'var(--destructive-foreground)'
      },
      fontFamily: {
        heading: ['Geist'],
        mono: ['"Geist Mono"']
      }
    }
  }
}
```
```types/markets.ts
export interface MarketOption {
  id: string
  label: string
  /** Rövid leírás a hover/segéd szöveghez */
  hint: string
}

export interface MarketGroup {
  id: string
  title: string
  options: MarketOption[]
}

export interface CoreCardConfig {
  id: 1 | 2 | 3
  goalpick: string[]
  safetyTrend: string[]
  halfTimeResult: string[]
  otherPatterns: string[]
}

```