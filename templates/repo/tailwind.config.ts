// 🏗️ Balde 2: estrutura igual em todo produto. Os tokens variam por produto
// (definidos em src/styles/tokens.css). Adicione novas chaves aqui apenas
// quando criar tokens semânticos novos no tokens.css.

import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        // Surfaces & text
        background:      'hsl(var(--color-background) / <alpha-value>)',
        foreground:      'hsl(var(--color-foreground) / <alpha-value>)',
        surface:         'hsl(var(--color-surface) / <alpha-value>)',
        'surface-2':     'hsl(var(--color-surface-2) / <alpha-value>)',
        'surface-3':     'hsl(var(--color-surface-3) / <alpha-value>)',
        border:          'hsl(var(--color-border) / <alpha-value>)',
        'border-strong': 'hsl(var(--color-border-strong) / <alpha-value>)',
        muted: {
          DEFAULT:    'hsl(var(--color-surface-2) / <alpha-value>)',
          foreground: 'hsl(var(--color-muted-foreground) / <alpha-value>)',
        },

        // Primary do produto (default = gold da casa)
        primary: {
          DEFAULT:    'hsl(var(--color-primary) / <alpha-value>)',
          foreground: 'hsl(var(--color-primary-foreground) / <alpha-value>)',
        },

        // Status (semantic)
        success: 'hsl(var(--color-success) / <alpha-value>)',
        warning: 'hsl(var(--color-warning) / <alpha-value>)',
        danger:  'hsl(var(--color-danger) / <alpha-value>)',
        info:    'hsl(var(--color-info) / <alpha-value>)',

        // Regra da casa: dinheiro é gold mesmo se primary for trocado
        money: 'hsl(var(--color-money) / <alpha-value>)',
      },
      fontFamily: {
        sans:    'var(--font-sans)',
        mono:    'var(--font-mono)',
        display: 'var(--font-display)',
      },
      borderRadius: {
        sm:      'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md:      'var(--radius-md)',
        lg:      'var(--radius-lg)',
        xl:      'var(--radius-xl)',
      },
      transitionDuration: {
        fast: 'var(--dur-fast)',
        base: 'var(--dur-base)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
      },
      boxShadow: {
        focus:      'var(--sb-shadow-focus)',
        'gold-glow': 'var(--sb-shadow-gold-glow)',
      },
      backgroundImage: {
        'gold-gradient': 'var(--sb-gold-gradient)',
        'gold-line':     'var(--sb-gold-line)',
      },
    },
  },
  plugins: [],
}

export default config
