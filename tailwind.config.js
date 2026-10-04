export default {content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  darkMode: 'selector',
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem'
      },
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
        'destructive-foreground': 'var(--destructive-foreground)',
        border: 'var(--border)',
        'border-subtle': 'var(--border-subtle)',
        'border-strong': 'var(--border-strong)',
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

        /* winmix product surfaces */
        'surface-1': 'var(--surface-1)',
        'surface-2': 'var(--surface-2)',
        'surface-pop': 'var(--surface-pop)',
        signal: 'var(--signal)',
        'signal-foreground': 'var(--signal-foreground)',
        'signal-soft': 'var(--signal-soft)',
        'signal-soft-strong': 'var(--signal-soft-strong)',
        elevated: 'var(--elevated)',
        'elevated-2': 'var(--elevated-2)',
        positive: 'var(--positive)',
        'positive-foreground': 'var(--positive-foreground)',
        'positive-soft': 'var(--positive-soft)',
        negative: 'var(--negative)',
        'negative-foreground': 'var(--negative-foreground)',
        'negative-soft': 'var(--negative-soft)',
        warning: 'var(--warning)',
        'warning-soft': 'var(--warning-soft)',
        pitch: 'var(--pitch)',
        'pitch-line': 'var(--pitch-line)',
        /* brand ramp straight from the spec */
        brand: 'var(--primary-01)',
        'brand-green': 'var(--primary-02)',
        'brand-red': 'var(--primary-03)',
        'brand-violet': 'var(--primary-04)',
        'brand-amber': 'var(--primary-05)',
        'brand-pink': 'var(--brand-accent)'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        /* No separate mono face in this theme — figures stay in Inter with
           tabular numerals so tables and prose share one voice. */
        mono: [
          'Inter',
          {
            fontFeatureSettings: '"tnum" 1',
            fontVariationSettings: 'normal'
          }
        ]
      },
      fontSize: {
        /* Data readouts stay fluid so a KPI figure does not overflow a
           narrow card on a phone. */
        'data-sm': ['0.8125rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'data-base': ['1rem', { lineHeight: '1.2', letterSpacing: '-0.015em' }],
        'data-lg': [
          'clamp(1.375rem, 1.2rem + 0.6vw, 1.5rem)',
          { lineHeight: '1.15', letterSpacing: '-0.02em' }
        ],
        'data-xl': [
          'clamp(1.75rem, 1.35rem + 1.6vw, 2.125rem)',
          { lineHeight: '1.05', letterSpacing: '-0.03em' }
        ]
      },
      letterSpacing: {
        label: '0.08em',
        tighter: '-0.02em',
        tightest: '-0.03em'
      },
      borderRadius: {
        /* Explicit product scale: 6px tonal chips, 10px small controls,
           14px buttons/fields, 16px panels, 20px feature surfaces. */
        sm: '0.375rem',
        md: '0.625rem',
        lg: '0.875rem',
        xl: '1rem',
        '2xl': '1.25rem'
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
        'panel-lg': 'var(--shadow-panel-lg)',
        'signal-glow': 'var(--shadow-signal-glow)'
      },
      backgroundImage: {
        'pitch-grid':
          'linear-gradient(var(--pitch-line) 1px, transparent 1px), linear-gradient(90deg, var(--pitch-line) 1px, transparent 1px)'
      },
      backgroundSize: {
        'pitch-grid': '40px 40px'
      },
      transitionTimingFunction: {
        enter: 'cubic-bezier(0.22, 1, 0.36, 1)',
        move: 'cubic-bezier(0.25, 1, 0.5, 1)',
        settle: 'cubic-bezier(0.16, 1, 0.3, 1)'
      },
      transitionDuration: {
        fast: '120ms',
        base: '200ms',
        slow: '360ms'
      },
      keyframes: {
        'signal-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' }
        },
        'skeleton-shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' }
        }
      },
      animation: {
        'signal-pulse': 'signal-pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'skeleton-shimmer': 'skeleton-shimmer 1.6s cubic-bezier(0.25, 1, 0.5, 1) infinite',
        'fade-in': 'fade-in 200ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-up': 'slide-up 280ms cubic-bezier(0.22, 1, 0.36, 1) both'
      }
    }
  }
}
