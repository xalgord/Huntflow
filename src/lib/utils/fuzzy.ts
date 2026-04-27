/**
 * Tiny fuzzy matcher tuned for command palettes — no external dependency,
 * runs on every keystroke against thousands of items in well under a frame.
 *
 * Scoring rules (higher is better):
 *   · exact substring match               +1000
 *   · prefix match                        +500
 *   · word-boundary match (after space/-) +200 per char
 *   · consecutive chars                   +50 each in a run
 *   · capital-letter match (e.g. "RB" → "ReportBuilder") +75 per char
 *   · early-position bonus                +max(0, 40 - index)
 *   · length penalty                      −length / 100
 *
 * Returns `null` when the query has chars that don't appear in order in the
 * candidate, so callers can filter out non-matches without a separate pass.
 */
export interface FuzzyMatch {
  score: number;
  /** 0-based char indexes in the original (not lowercased) string. */
  indexes: number[];
}

export function fuzzyMatch(query: string, candidate: string): FuzzyMatch | null {
  if (!query) return { score: 0, indexes: [] };
  const q = query.toLowerCase().trim();
  const c = candidate.toLowerCase();

  // Cheap early outs before the per-char loop runs.
  const idx = c.indexOf(q);
  if (idx !== -1) {
    const indexes = Array.from({ length: q.length }, (_, i) => idx + i);
    let score = 1000 + Math.max(0, 40 - idx) - candidate.length / 100;
    if (idx === 0) score += 500;
    else if (idx > 0 && /[\s\-_./]/.test(c[idx - 1] ?? '')) score += 200 * q.length;
    return { score, indexes };
  }

  // Subsequence match with bonuses for runs / word boundaries / capitals.
  const indexes: number[] = [];
  let qi = 0;
  let lastMatch = -2;
  let runScore = 0;
  let total = 0;

  for (let i = 0; i < c.length && qi < q.length; i++) {
    if (c[i] === q[qi]) {
      indexes.push(i);
      const isBoundary = i === 0 || /[\s\-_./]/.test(c[i - 1] ?? '');
      const isCapital = candidate[i] !== c[i] && candidate[i] === candidate[i].toUpperCase();
      const isRun = i === lastMatch + 1;

      total += 10;
      if (isBoundary) total += 200;
      if (isCapital) total += 75;
      if (isRun) {
        runScore += 50;
        total += runScore;
      } else {
        runScore = 0;
      }

      lastMatch = i;
      qi++;
    }
  }

  if (qi !== q.length) return null;
  total += Math.max(0, 40 - (indexes[0] ?? 0)) - candidate.length / 100;
  return { score: total, indexes };
}
