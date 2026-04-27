import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
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
        enabled: true,
        type: 'module'
      }
    })
  ],
  // `@clerk/clerk-js@6` dynamically imports its UI components module from
  // inside `clerk.load()`. With Vite's default dep optimizer, that internal
  // dynamic import gets split into a separate chunk and the side-effect
  // that registers `componentControls` onto the Clerk instance can be
  // stripped during ESM tree-shaking. The result is `mountSignIn` /
  // `mountSignUp` / `mountPricingTable` throwing
  // "Clerk was not loaded with Ui components" even though `load()` resolved.
  //
  // Forcing clerk-js through esbuild pre-bundling (optimizeDeps.include) and
  // disabling SSR externalization (ssr.noExternal) keeps the package as a
  // single, side-effect-preserving module so its UI controls register
  // synchronously when load() awaits the internal import.
  optimizeDeps: {
    include: ['@clerk/clerk-js']
  },
  ssr: {
    noExternal: ['@clerk/clerk-js']
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}']
  }
});
