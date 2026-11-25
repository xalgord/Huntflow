/**
 * HuntFlow design tokens — Apple Human Interface Guidelines flavoured.
 *
 * Every colour utility in the app resolves to a CSS custom property so a
 * single class (e.g. `text-zinc-500`, `bg-red-500/10`) renders correctly in
 * both light and dark appearance. The values below are generated into CSS
 * variables by the Tailwind plugin in `tailwind.config.js`.
 *
 * Gray scales are split by role, the way Apple separates "label",
 * "fill/background" and "separator" colours:
 *   - text   → label hierarchy (primary → quaternary)
 *   - bg     → grouped backgrounds and fills
 *   - border → separators and control strokes
 *
 * The app was originally authored dark-first with Tailwind's zinc scale
 * (`text-zinc-100` = bright, `bg-zinc-950` = deep). The dark scales keep that
 * meaning; the light scales invert it so those same classes read as Apple
 * light-mode labels and fills without touching every component.
 */

/** @typedef {Record<string, string>} Scale */

const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '750', '800', '850', '900', '950'];

/** Label colours. */
export const grayText = {
  dark: {
    50: '#FFFFFF',
    100: '#F5F5F7',
    200: '#E5E5EA',
    300: '#D1D1D6',
    400: '#AEAEB2',
    500: '#8E8E93',
    600: '#6C6C70',
    700: '#545458',
    750: '#4A4A4E',
    800: '#3A3A3C',
    850: '#323234',
    900: '#2C2C2E',
    950: '#1C1C1E'
  },
  light: {
    50: '#000000',
    100: '#1D1D1F',
    200: '#2C2C2E',
    300: '#3A3A3C',
    400: '#515154',
    500: '#6E6E73',
    600: '#8E8E93',
    700: '#AEAEB2',
    750: '#BCBCC0',
    800: '#C7C7CC',
    850: '#D8D8DC',
    900: '#E5E5EA',
    950: '#FFFFFF'
  }
};

/** Fills and grouped backgrounds. */
export const grayBg = {
  dark: {
    50: '#F2F2F7',
    100: '#E5E5EA',
    200: '#D1D1D6',
    300: '#C7C7CC',
    400: '#AEAEB2',
    500: '#8E8E93',
    600: '#636366',
    700: '#48484A',
    750: '#414144',
    800: '#3A3A3C',
    850: '#313134',
    900: '#2C2C2E',
    950: '#232325'
  },
  light: {
    50: '#1C1C1E',
    100: '#2C2C2E',
    200: '#3A3A3C',
    300: '#48484A',
    400: '#636366',
    500: '#8E8E93',
    600: '#AEAEB2',
    700: '#D1D1D6',
    750: '#DADADF',
    800: '#E3E3E8',
    850: '#E8E8ED',
    900: '#EDEDF0',
    950: '#F5F5F7'
  }
};

/** Separators and control strokes. */
export const grayBorder = {
  dark: {
    50: '#F2F2F7',
    100: '#D1D1D6',
    200: '#AEAEB2',
    300: '#8E8E93',
    400: '#6C6C70',
    500: '#5A5A5E',
    600: '#4C4C50',
    700: '#444447',
    750: '#3E3E41',
    800: '#38383A',
    850: '#333335',
    900: '#2C2C2E',
    950: '#232325'
  },
  light: {
    50: '#1C1C1E',
    100: '#3A3A3C',
    200: '#636366',
    300: '#8E8E93',
    400: '#AEAEB2',
    500: '#C7C7CC',
    600: '#CFCFD4',
    700: '#D6D6DB',
    750: '#DCDCE0',
    800: '#E3E3E7',
    850: '#E8E8EB',
    900: '#EDEDF0',
    950: '#F5F5F7'
  }
};

/**
 * Apple system colours (light / dark appearance). `textDarken` controls how
 * far the light-appearance text shades (50–400) are pulled toward black so
 * tinted labels stay legible on white; yellow needs the most help.
 */
export const systemColors = {
  red: { light: '#FF3B30', dark: '#FF453A', textDarken: 0.18 },
  orange: { light: '#FF9500', dark: '#FF9F0A', textDarken: 0.3 },
  yellow: { light: '#FFCC00', dark: '#FFD60A', textDarken: 0.42 },
  green: { light: '#34C759', dark: '#30D158', textDarken: 0.32 },
  mint: { light: '#00C7BE', dark: '#63E6E2', textDarken: 0.36 },
  teal: { light: '#30B0C7', dark: '#40CBE0', textDarken: 0.3 },
  cyan: { light: '#32ADE6', dark: '#64D2FF', textDarken: 0.28 },
  blue: { light: '#007AFF', dark: '#0A84FF', textDarken: 0.08 },
  indigo: { light: '#5856D6', dark: '#5E5CE6', textDarken: 0.04 },
  purple: { light: '#AF52DE', dark: '#BF5AF2', textDarken: 0.12 },
  pink: { light: '#FF2D55', dark: '#FF375F', textDarken: 0.16 },
  brown: { light: '#A2845E', dark: '#AC8E68', textDarken: 0.12 }
};

/** Map Tailwind hue names used throughout the codebase onto system colours. */
export const hueAliases = {
  red: 'red',
  rose: 'pink',
  pink: 'pink',
  fuchsia: 'purple',
  purple: 'purple',
  violet: 'indigo',
  indigo: 'indigo',
  blue: 'blue',
  sky: 'cyan',
  cyan: 'cyan',
  teal: 'teal',
  emerald: 'green',
  green: 'green',
  lime: 'green',
  yellow: 'yellow',
  amber: 'orange',
  orange: 'orange'
};

/**
 * Accent ("tint") colours offered in Appearance settings. Crimson is the
 * HuntFlow brand tint; the rest follow Apple's accent choices, deepened where
 * needed so filled buttons with white labels pass WCAG AA.
 */
export const accents = {
  // Each value keeps ≥ 4.5:1 contrast against white button labels (WCAG AA).
  crimson: { light: '#D70F3C', dark: '#E0244A' },
  blue: { light: '#0066CC', dark: '#0071E3' },
  indigo: { light: '#5856D6', dark: '#5E5CE6' },
  purple: { light: '#9A48CF', dark: '#9A48CF' },
  orange: { light: '#B35F00', dark: '#B35F00' },
  teal: { light: '#007A91', dark: '#007A91' },
  graphite: { light: '#636366', dark: '#6E6E73' }
};

// ─── colour maths ──────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
}

function mix(hexA, hexB, weightB) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const out = a.map((channel, i) => Math.round(channel * (1 - weightB) + b[i] * weightB));
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Hex → "H S% L%" triple for `hsl(var(--x) / <alpha-value>)`. */
export function hexToHslTriple(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return `${Math.round(h * 10) / 10} ${Math.round(s * 1000) / 10}% ${Math.round(l * 1000) / 10}%`;
}

/**
 * Build a full 50–950 scale for a system colour in one appearance.
 *
 * Dark appearance: low shades are lighter tints (legible text on dark),
 * high shades are deeper. Light appearance: the code base uses low shades
 * as "tinted label" colours, so they are darkened instead of lightened.
 */
export function buildHueScale(color, appearance) {
  const base = color[appearance];
  /** @type {Scale} */
  const scale = {};
  if (appearance === 'dark') {
    const lighten = { 50: 0.86, 100: 0.74, 200: 0.56, 300: 0.36, 400: 0.16 };
    for (const shade of ['50', '100', '200', '300', '400']) scale[shade] = mix(base, '#FFFFFF', lighten[shade]);
  } else {
    const k = color.textDarken ?? 0.2;
    const darken = { 50: k + 0.22, 100: k + 0.18, 200: k + 0.12, 300: k + 0.06, 400: k };
    for (const shade of ['50', '100', '200', '300', '400']) scale[shade] = mix(base, '#000000', Math.min(darken[shade], 0.7));
  }
  scale['500'] = base;
  const deepen = { 600: 0.1, 700: 0.22, 750: 0.28, 800: 0.36, 850: 0.44, 900: 0.52, 950: 0.66 };
  for (const shade of ['600', '700', '750', '800', '850', '900', '950']) scale[shade] = mix(base, '#000000', deepen[shade]);
  return scale;
}

/** Variable name helpers shared with the Tailwind config. */
export const varName = (group, shade) => `--hf-${group}-${shade}`;
export const colorRef = (group, shade) => `hsl(var(${varName(group, shade)}) / <alpha-value>)`;

export function scaleRefs(group) {
  return Object.fromEntries(SHADES.map((shade) => [shade, colorRef(group, shade)]));
}

/**
 * Produce `{ selector: { '--hf-…': 'h s% l%' } }` blocks for every token so
 * Tailwind's `addBase` can emit them.
 */
export function buildCssVariables() {
  const light = {};
  const dark = {};

  const put = (target, group, scale) => {
    for (const [shade, hex] of Object.entries(scale)) target[varName(group, shade)] = hexToHslTriple(hex);
  };

  put(light, 'gray-text', grayText.light);
  put(dark, 'gray-text', grayText.dark);
  put(light, 'gray-bg', grayBg.light);
  put(dark, 'gray-bg', grayBg.dark);
  put(light, 'gray-border', grayBorder.light);
  put(dark, 'gray-border', grayBorder.dark);

  for (const [name, color] of Object.entries(systemColors)) {
    put(light, name, buildHueScale(color, 'light'));
    put(dark, name, buildHueScale(color, 'dark'));
  }

  const accentBlocks = {};
  for (const [name, color] of Object.entries(accents)) {
    const lightVars = {};
    const darkVars = {};
    put(lightVars, 'accent', buildHueScale({ ...color, textDarken: 0.06 }, 'light'));
    put(darkVars, 'accent', buildHueScale(color, 'dark'));
    lightVars['--primary'] = hexToHslTriple(color.light);
    // Accent used as *text* (links, tinted labels). Light appearance can use
    // the fill colour directly; dark appearance needs a lighter tint to stay
    // ≥ 4.5:1 on dark grouped cards.
    lightVars['--primary-text'] = hexToHslTriple(color.light);
    darkVars['--primary-text'] = hexToHslTriple(buildHueScale(color, 'dark')['300']);
    lightVars['--ring'] = hexToHslTriple(color.light);
    darkVars['--primary'] = hexToHslTriple(color.dark);
    darkVars['--ring'] = hexToHslTriple(color.dark);
    accentBlocks[name] = { light: lightVars, dark: darkVars };
  }

  return { light, dark, accentBlocks };
}

export { SHADES };
