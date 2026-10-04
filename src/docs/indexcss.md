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

/* ==========================================================================
   LIGA SOCCER — DARK INSTRUMENT PANEL
   Single source of truth for the palette, elevation, motion and component
   layer. The app has one theme (dark cockpit) — there is no light-mode
   token set to keep in sync, so we don't carry one.
   ========================================================================== */

:root {
  /* --- Surfaces / elevation ------------------------------------------- */
  --background: #0a0a0a;
  --foreground: #fafafa;
  --card: #141414;
  --card-foreground: #fafafa;
  --popover: #1a1a1a;
  --popover-foreground: #fafafa;
  --elevated: #1c1c1c;
  --elevated-2: #232323;

  /* --- Roles ------------------------------------------------------------ */
  --primary: #fafafa;
  --primary-foreground: #0a0a0a;
  --secondary: #1c1c1c;
  --secondary-foreground: #fafafa;
  --muted: #1c1c1c;
  --muted-foreground: #a1a1aa;
  --accent: #1c1c1c;
  --accent-foreground: #fafafa;
  --destructive: #f87171;
  --destructive-foreground: #0a0a0a;

  /* --- Structure ---------------------------------------------------- */
  --border: #262626;
  --input: #262626;
  --ring: #e4ff3f;
  --radius: 0.625rem;

  /* --- Signal (the one accent — live state, focus, primary action) ---- */
  --signal: #e4ff3f;
  --signal-foreground: #0a0a0a;
  --signal-soft: rgba(228, 255, 63, 0.1);
  --signal-soft-strong: rgba(228, 255, 63, 0.2);

  /* --- Match state colors --------------------------------------------- */
  --positive: #86efac;
  --positive-foreground: #052e14;
  --positive-soft: rgba(134, 239, 172, 0.12);
  --negative: #fca5a5;
  --negative-foreground: #450a0a;
  --negative-soft: rgba(252, 165, 165, 0.12);

  /* --- Pitch motif (the signature element) ----------------------------- */
  --pitch: #0f150f;
  --pitch-line: #29341f;

  /* --- Data visualization ---------------------------------------------- */
  --chart-1: #e4ff3f;
  --chart-2: #5eead4;
  --chart-3: #93c5fd;
  --chart-4: #fbbf24;
  --chart-5: #c4b5fd;

  /* --- Sidebar / nav rail ------------------------------------------------ */
  --sidebar: #111111;
  --sidebar-foreground: #fafafa;
  --sidebar-primary: #e4ff3f;
  --sidebar-primary-foreground: #0a0a0a;
  --sidebar-accent: #1c1c1c;
  --sidebar-accent-foreground: #fafafa;
  --sidebar-border: #232323;
  --sidebar-ring: #e4ff3f;

  /* --- Elevation shadows ------------------------------------------------- */
  --shadow-panel: 0 1px 0 0 rgba(255, 255, 255, 0.04) inset,
    0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px -8px rgba(0, 0, 0, 0.55);
  --shadow-panel-lg: 0 1px 0 0 rgba(255, 255, 255, 0.05) inset,
    0 2px 4px rgba(0, 0, 0, 0.45), 0 24px 48px -12px rgba(0, 0, 0, 0.65);
  --shadow-signal-glow: 0 0 0 1px rgba(228, 255, 63, 0.25),
    0 0 24px rgba(228, 255, 63, 0.15);

  /* --- Motion ------------------------------------------------------------ */
  --ease-enter: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-move: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-settle: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 120ms;
  --duration-base: 200ms;
  --duration-slow: 360ms;
}

@layer base {
  * {
    @apply border-border;
  }

  html {
    color-scheme: dark;
  }

  body {
    @apply bg-background text-foreground font-sans antialiased;
    font-feature-settings: 'tnum' 1, 'ss01' 1;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    @apply font-heading;
    letter-spacing: -0.02em;
  }

  :focus-visible {
    outline: 2px solid var(--signal);
    outline-offset: 2px;
    border-radius: 4px;
  }

  ::selection {
    background: var(--signal);
    color: #0a0a0a;
  }

  /* Scrollbars stay visible but quiet — this is an instrument panel,
     not a marketing page; people scan dense tables and need the thumb. */
  * {
    scrollbar-width: thin;
    scrollbar-color: var(--elevated-2) transparent;
  }

  *::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  *::-webkit-scrollbar-track {
    background: transparent;
  }

  *::-webkit-scrollbar-thumb {
    background: var(--elevated-2);
    border-radius: 999px;
  }

  *::-webkit-scrollbar-thumb:hover {
    background: var(--border);
  }
}

/* ==========================================================================
   COMPONENT LAYER
   ========================================================================== */

@layer components {
  /* --- Panel (card) ----------------------------------------------------- */
  .panel {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-panel);
    position: relative;
  }

  .panel--elevated {
    background: var(--elevated);
  }

  .panel--flush {
    padding: 0;
  }

  .panel--interactive {
    transition: border-color var(--duration-base) var(--ease-enter),
      transform var(--duration-base) var(--ease-enter),
      box-shadow var(--duration-base) var(--ease-enter);
  }

  .panel--interactive:hover {
    border-color: var(--elevated-2);
    transform: translateY(-1px);
  }

  .panel--live {
    border-color: var(--signal-soft-strong);
    box-shadow: var(--shadow-panel), 0 0 0 1px var(--signal-soft);
  }

  .panel-header {
    padding: 1.25rem 1.25rem 0;
  }

  .panel-footer {
    padding: 0 1.25rem 1.25rem;
  }

  .panel-footer--divided {
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--border);
  }

  /* Edge fade for horizontally-scrolled row groups (league tables,
     fixture strips) — signals "more content" without a visible scrollbar. */
  .panel--edge-fade {
    position: relative;
    overflow-x: auto;
  }

  .panel--edge-fade::before,
  .panel--edge-fade::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 32px;
    pointer-events: none;
    z-index: 10;
    transition: opacity var(--duration-base) var(--ease-enter);
  }

  .panel--edge-fade::before {
    left: 0;
    background: linear-gradient(90deg, var(--card), transparent);
  }

  .panel--edge-fade::after {
    right: 0;
    background: linear-gradient(270deg, var(--card), transparent);
  }

  /* --- Stat readout (score / odds / xG) ---------------------------------- */
  .stat-readout {
    @apply font-mono tabular-nums;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--foreground);
  }

  .stat-readout--live {
    color: var(--signal);
  }

  .stat-readout--muted {
    color: var(--muted-foreground);
  }

  /* --- Live indicator ----------------------------------------------------- */
  .live-dot {
    position: relative;
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--signal);
  }

  .live-dot::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 999px;
    background: var(--signal);
    opacity: 0.35;
    animation: signal-pulse 1.8s var(--ease-enter) infinite;
  }

  /* --- Badge (tag) --------------------------------------------------------- */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    height: 1.5rem;
    padding: 0 0.625rem;
    border-radius: 999px;
    text-transform: uppercase;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    background: var(--muted);
    color: var(--muted-foreground);
  }

  .badge--live {
    background: var(--signal);
    color: var(--signal-foreground);
  }

  .badge--positive {
    background: var(--positive-soft);
    color: var(--positive);
  }

  .badge--negative {
    background: var(--negative-soft);
    color: var(--negative);
  }

  .badge--outline {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--foreground);
  }

  /* --- Button system -------------------------------------------------------- */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 2.5rem;
    padding: 0 1.125rem;
    border-radius: var(--radius);
    font-size: 0.8125rem;
    font-weight: 600;
    font-family: theme('fontFamily.heading');
    transition: background-color var(--duration-base) var(--ease-enter),
      color var(--duration-base) var(--ease-enter),
      border-color var(--duration-base) var(--ease-enter),
      box-shadow var(--duration-base) var(--ease-enter),
      transform var(--duration-fast) var(--ease-enter);
  }

  .btn:active {
    transform: scale(0.97);
  }

  .btn:disabled,
  .btn[aria-disabled='true'] {
    pointer-events: none;
    opacity: 0.5;
  }

  .btn--primary {
    background: var(--primary);
    color: var(--primary-foreground);
  }

  .btn--primary:hover,
  .btn--primary:focus-visible {
    background: color-mix(in oklab, var(--primary) 88%, transparent);
  }

  .btn--signal {
    background: var(--signal);
    color: var(--signal-foreground);
  }

  .btn--signal:hover,
  .btn--signal:focus-visible {
    box-shadow: var(--shadow-signal-glow);
  }

  .btn--outline {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--foreground);
  }

  .btn--outline:hover,
  .btn--outline:focus-visible {
    border-color: var(--signal);
    color: var(--signal);
  }

  .btn--ghost {
    background: transparent;
    color: var(--muted-foreground);
  }

  .btn--ghost:hover,
  .btn--ghost:focus-visible {
    background: var(--elevated);
    color: var(--foreground);
  }

  .btn--sm {
    height: 2rem;
    padding: 0 0.75rem;
    font-size: 0.75rem;
  }

  .btn--lg {
    height: 3rem;
    padding: 0 1.5rem;
    font-size: 0.875rem;
  }

  /* Tab / switch button — underline indicator, used for market or
     period selectors (1X2, Over/Under, HT/FT ...). */
  .btn--tab {
    height: 2.75rem;
    padding: 0 1rem;
    border-radius: 0;
    border-bottom: 2px solid transparent;
    color: var(--muted-foreground);
    font-weight: 500;
  }

  .btn--tab:hover,
  .btn--tab:focus-visible {
    color: var(--foreground);
  }

  .btn--tab[aria-selected='true'],
  .btn--tab.is-active {
    border-bottom-color: var(--signal);
    color: var(--foreground);
  }

  /* --- Field (input) --------------------------------------------------------- */
  .field {
    display: block;
    width: 100%;
    height: 2.5rem;
    padding: 0 0.75rem;
    background: var(--input);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--foreground);
    transition: border-color var(--duration-base) var(--ease-enter),
      box-shadow var(--duration-base) var(--ease-enter);
  }

  .field::placeholder {
    color: var(--muted-foreground);
  }

  .field:hover {
    border-color: var(--elevated-2);
  }

  .field:focus {
    outline: none;
    border-color: var(--signal);
    box-shadow: 0 0 0 3px var(--signal-soft);
  }

  .field--error {
    border-color: var(--negative);
  }

  .field--error:focus {
    box-shadow: 0 0 0 3px var(--negative-soft);
  }

  /* --- Crest (club logo) -------------------------------------------------------- */
  .crest {
    display: block;
    flex-shrink: 0;
    width: auto;
    object-fit: contain;
  }

  .crest--sm {
    height: 20px;
  }

  .crest--md {
    height: 32px;
  }

  .crest--lg {
    height: 48px;
  }

  .crest--xl {
    height: 72px;
  }

  /* --- Kit number (squad number chip) --------------------------------------------- */
  .kit-number {
    @apply font-mono tabular-nums;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--elevated);
    font-weight: 700;
    font-size: 0.875rem;
    color: var(--foreground);
  }

  /* --- Trend (form / xG delta indicator) ------------------------------------------ */
  .trend {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .trend--positive {
    color: var(--positive);
  }

  .trend--negative {
    color: var(--negative);
  }

  /* --- Divider ------------------------------------------------------------------- */
  .divider {
    height: 1px;
    background: var(--border);
    border: none;
  }

  /* --- Skeleton loading state ------------------------------------------------------ */
  .skeleton {
    position: relative;
    overflow: hidden;
    background: var(--elevated);
    border-radius: calc(var(--radius) - 2px);
  }

  .skeleton::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.06),
      transparent
    );
    animation: skeleton-shimmer 1.6s var(--ease-move) infinite;
  }
}

/* ==========================================================================
   UTILITIES
   ========================================================================== */

@layer utilities {
  .tabular {
    font-variant-numeric: tabular-nums;
  }

  .scrollbar-none {
    scrollbar-width: none;
  }

  .scrollbar-none::-webkit-scrollbar {
    display: none;
  }

  /* The signature element: a faint pitch grid, reserved for hero and
     section backgrounds — one recognizable motif, used sparingly. */
  .bg-pitch-grid {
    background-color: var(--pitch);
    background-image: linear-gradient(var(--pitch-line) 1px, transparent 1px),
      linear-gradient(90deg, var(--pitch-line) 1px, transparent 1px);
    background-size: 40px 40px;
    background-position: center;
  }
}

/* ==========================================================================
   THIRD-PARTY OVERRIDES
   ========================================================================== */

.swiper-pagination-progressbar {
  top: unset !important;
  bottom: 0;
  z-index: 10;
  background: var(--border) !important;
}

.swiper-pagination-progressbar-fill {
  background: var(--signal) !important;
}

.recharts-tooltip-wrapper {
  z-index: 10;
}

.recharts-default-tooltip {
  background: var(--popover) !important;
  border: 1px solid var(--border) !important;
  border-radius: calc(var(--radius) - 2px) !important;
  box-shadow: var(--shadow-panel-lg) !important;
}

/* ==========================================================================
   MOTION
   Subtle, purposeful, and always opt-out-able.
   ========================================================================== */

@keyframes signal-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

@keyframes skeleton-shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.animate-signal-pulse {
  animation: signal-pulse 1.8s var(--ease-enter) infinite;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  .animate-signal-pulse,
  .live-dot::after,
  .skeleton::after {
    animation: none;
  }

  .live-dot::after {
    opacity: 0;
  }
}
