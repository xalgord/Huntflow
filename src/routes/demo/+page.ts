// /demo seeds IndexedDB with sample data and immediately redirects, so it
// has nothing meaningful to prerender. Force it to use the SPA fallback
// (index.html) instead, which avoids hitting `strict: true` errors during
// `vite build` and keeps the page truly client-only.
export const prerender = false;
export const ssr = false;
