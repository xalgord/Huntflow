import plugin from 'tailwindcss/plugin';
import { buildCssVariables, hueAliases, scaleRefs } from './tailwind.tokens.js';

const grayBg = scaleRefs('gray-bg');
const grayText = scaleRefs('gray-text');
const grayBorder = scaleRefs('gray-border');
const grayNames = ['zinc', 'slate', 'neutral', 'gray', 'stone'];

const withGrays = (scale) => Object.fromEntries(grayNames.map((name) => [name, scale]));
const hueColors = Object.fromEntries(
  Object.entries(hueAliases).map(([tailwindName, systemName]) => [tailwindName, scaleRefs(systemName)])
);

const { light, dark, accentBlocks } = buildCssVariables();

/**
 * Emits every design token as a CSS custom property. Light values live on
 * `:root`, dark values on `.dark`, and each accent overrides the
 * `--hf-accent-*` / `--primary` family for both appearances.
 */
const tokenPlugin = plugin(({ addBase }) => {
  addBase({
    ':root': { ...light, ...accentBlocks.crimson.light },
    // `.dark` (not just `:root.dark`) so a subtree can opt into dark
    // appearance — the marketing pages use this.
    '.dark': { ...dark, ...accentBlocks.crimson.dark }
  });
  for (const [name, block] of Object.entries(accentBlocks)) {
    addBase({
      [`:root[data-accent='${name}']`]: block.light,
      [`:root[data-accent='${name}'].dark, :root[data-accent='${name}'] .dark`]: block.dark
    });
  }
});

/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: 'class',
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        ...withGrays(grayBg),
        ...hueColors,
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
          ...scaleRefs('accent')
        },
        priority: {
          p0: 'hsl(var(--hf-red-500) / <alpha-value>)',
          p1: 'hsl(var(--hf-orange-500) / <alpha-value>)',
          p2: 'hsl(var(--hf-yellow-500) / <alpha-value>)',
          p3: 'hsl(var(--hf-gray-text-500) / <alpha-value>)'
        },
        status: {
          recon: 'hsl(var(--hf-blue-500) / <alpha-value>)',
          testing: 'hsl(var(--hf-orange-500) / <alpha-value>)',
          reported: 'hsl(var(--hf-indigo-500) / <alpha-value>)',
          paid: 'hsl(var(--hf-green-500) / <alpha-value>)',
          closed: 'hsl(var(--hf-gray-text-500) / <alpha-value>)',
          archived: 'hsl(var(--hf-gray-text-600) / <alpha-value>)'
        },
        severity: {
          critical: 'hsl(var(--hf-red-500) / <alpha-value>)',
          high: 'hsl(var(--hf-orange-500) / <alpha-value>)',
          medium: 'hsl(var(--hf-yellow-500) / <alpha-value>)',
          low: 'hsl(var(--hf-blue-500) / <alpha-value>)',
          info: 'hsl(var(--hf-gray-text-500) / <alpha-value>)'
        }
      },
      // Role-specific gray scales: labels, separators and placeholders use
      // Apple's label/separator ramps; everything else uses the fill ramp.
      textColor: {
        ...withGrays(grayText),
        primary: {
          DEFAULT: 'hsl(var(--primary-text) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
          ...scaleRefs('accent')
        }
      },
      placeholderColor: withGrays(grayText),
      borderColor: withGrays(grayBorder),
      divideColor: withGrays(grayBorder),
      ringColor: withGrays(grayBorder),
      outlineColor: withGrays(grayBorder),
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"Helvetica Neue"',
          'Inter',
          '"Segoe UI Variable Text"',
          '"Segoe UI"',
          'Roboto',
          'system-ui',
          'sans-serif'
        ],
        mono: [
          '"SF Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          '"JetBrains Mono"',
          '"Cascadia Code"',
          'Consolas',
          'monospace'
        ]
      },
      fontSize: {
        // Apple-ish type ramp (desktop sizes).
        caption: ['0.6875rem', { lineHeight: '0.875rem', letterSpacing: '0.01em' }],
        footnote: ['0.75rem', { lineHeight: '1rem' }],
        subhead: ['0.8125rem', { lineHeight: '1.125rem' }],
        callout: ['0.875rem', { lineHeight: '1.25rem' }],
        body: ['0.9375rem', { lineHeight: '1.375rem' }],
        headline: ['0.9375rem', { lineHeight: '1.375rem', fontWeight: '600' }],
        title3: ['1.25rem', { lineHeight: '1.625rem', letterSpacing: '-0.01em' }],
        title2: ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.015em' }],
        title1: ['1.75rem', { lineHeight: '2.125rem', letterSpacing: '-0.02em' }],
        'large-title': ['2.125rem', { lineHeight: '2.5rem', letterSpacing: '-0.025em' }]
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 2px)',
        '2xl': 'calc(var(--radius) + 6px)'
      },
      boxShadow: {
        'dark-sm': 'var(--hf-shadow-sm)',
        'dark-md': 'var(--hf-shadow-md)',
        'dark-lg': 'var(--hf-shadow-lg)',
        'dark-xl': 'var(--hf-shadow-xl)',
        'inner-line': 'none',
        sheet: 'var(--hf-shadow-xl)'
      },
      backdropBlur: {
        material: '30px'
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' }
        },
        'priority-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' }
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'panel-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
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
        'fade-in': 'fade-in 180ms ease-out',
        'slide-up': 'slide-up 240ms cubic-bezier(0.32, 0.72, 0, 1)',
        'scale-in': 'scale-in 240ms cubic-bezier(0.32, 0.72, 0, 1)',
        'priority-pulse': 'priority-pulse 2s infinite',
        'fade-up': 'fade-up 360ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'panel-in': 'panel-in 280ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'subtle-shimmer': 'subtle-shimmer 2.8s ease-in-out infinite',
        'radar-scan': 'radar-scan 7s linear infinite'
      }
    }
  },
  plugins: [tokenPlugin]
};

export default config;
