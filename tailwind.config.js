/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: 'class',
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d'
        },
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          750: '#27364a',
          800: '#1e293b',
          850: '#172033',
          900: '#0f172a',
          950: '#020617'
        },
        priority: {
          p0: '#ef4444',
          p1: '#f97316',
          p2: '#eab308',
          p3: '#64748b'
        },
        status: {
          recon: '#3b82f6',
          testing: '#f59e0b',
          reported: '#8b5cf6',
          paid: '#22c55e',
          closed: '#64748b',
          archived: '#475569'
        },
        severity: {
          critical: '#dc2626',
          high: '#ea580c',
          medium: '#ca8a04',
          low: '#525252',
          info: '#2563eb'
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          'Inter Fallback',
          'Geist',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif'
        ],
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', 'monospace']
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      boxShadow: {
        'dark-sm': '0 1px 0 rgba(255, 255, 255, 0.03), 0 12px 30px rgba(0, 0, 0, 0.22)',
        'dark-md': '0 1px 0 rgba(255, 255, 255, 0.04), 0 18px 48px rgba(0, 0, 0, 0.32)',
        'dark-lg': '0 1px 0 rgba(255, 255, 255, 0.04), 0 24px 70px rgba(0, 0, 0, 0.42)',
        'dark-xl': '0 1px 0 rgba(255, 255, 255, 0.05), 0 34px 90px rgba(0, 0, 0, 0.52)',
        'inner-line': 'inset 0 1px 0 rgba(255, 255, 255, 0.04)'
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' }
        },
        'priority-pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' }
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'panel-in': {
          from: { opacity: '0', transform: 'translateY(10px) scale(0.985)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' }
        },
        'subtle-shimmer': {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(120%)' }
        },
        'radar-scan': {
          to: { transform: 'rotate(360deg)' }
        }
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
        'scale-in': 'scale-in 150ms ease-out',
        'priority-pulse': 'priority-pulse 2s infinite',
        'fade-up': 'fade-up 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'panel-in': 'panel-in 360ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'subtle-shimmer': 'subtle-shimmer 2.8s ease-in-out infinite',
        'radar-scan': 'radar-scan 7s linear infinite'
      }
    }
  },
  plugins: []
};

export default config;
