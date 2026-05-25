import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// `BUILD_TARGET` discriminates between the two HuntFlow distribution
// targets at compile time. See `src/lib/buildTarget.ts` for the full
// rationale. We default to `'web'` so plain `vite build` (Vercel deploy)
// keeps producing the marketing+app variant unchanged. `bin/build-app.mjs`
// sets BUILD_TARGET=app before invoking the build for npm publishes.
const buildTarget = process.env.BUILD_TARGET === 'app' ? 'app' : 'web';

export default defineConfig({
  define: {
    // Inlined as a literal string at build time. Constants in
    // `$lib/buildTarget` derive `IS_APP` / `IS_WEB` booleans from this,
    // which Vite/esbuild then tree-shake throughout the bundle.
    __BUILD_TARGET__: JSON.stringify(buildTarget)
  },
  plugins: [
    sveltekit(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'service-worker.ts',
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['manifest.json', 'favicon.svg', 'icons/huntflow.svg'],
      manifest: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,json,webmanifest}'],
        injectionPoint: 'self.__WB_MANIFEST'
      },
      devOptions: {
        enabled: false,
        type: 'module'
      }
    })
  ],
  test: {
    include: [
      'src/**/*.{test,spec}.{js,ts}',
      'convex/**/*.{test,spec}.{js,ts}'
    ],
    setupFiles: ['./vitest.setup.ts'],
    // Component tests use `@testing-library/svelte`, which renders into
    // a real DOM. We default the environment to `node` and let
    // individual test files opt into `jsdom` via the `// @vitest-environment`
    // pragma so non-DOM tests stay fast.
    environmentMatchGlobs: [
      ['src/lib/components/**', 'jsdom']
    ]
  }
});
