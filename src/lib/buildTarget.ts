/**
 * Build-time discriminator between the two HuntFlow distribution targets.
 *
 *   - `web` — the hosted SaaS at huntflow.xalgorix.com. Includes marketing pages,
 *     pricing, demo workspace, Clerk-gated app routes, and Stripe billing
 *     surfaces. This is the default when no `BUILD_TARGET` env var is set,
 *     so Vercel deploys produce the web variant unchanged.
 *
 *   - `app`  — the closed-source npm package (`npx huntflow`). Marketing,
 *     pricing, and demo routes are physically stripped from `src/routes/`
 *     by `bin/build-app.mjs` before `vite build` runs. The auth gate is
 *     loosened so every route is open and sign-in becomes opt-in for
 *     cloud sync only.
 *
 * The `__BUILD_TARGET__` define comes from `vite.config.ts`. Because it
 * resolves to a literal string at build time, the boolean constants below
 * become literal `true` / `false` and Vite/esbuild dead-code-eliminate
 * the unused branches at every `IS_APP` / `IS_WEB` call site. There is
 * zero runtime cost for the discriminator itself.
 */

declare const __BUILD_TARGET__: 'web' | 'app';

export const BUILD_TARGET: 'web' | 'app' = __BUILD_TARGET__;
export const IS_APP = BUILD_TARGET === 'app';
export const IS_WEB = BUILD_TARGET === 'web';
