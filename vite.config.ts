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
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}']
  }
});
