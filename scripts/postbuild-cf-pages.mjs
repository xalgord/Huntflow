// Cloudflare Pages postbuild: duplicate the adapter-static fallback
// (200.html) as 404.html. Cloudflare Pages normalizes .html URLs with
// 308 redirects, so a _redirects rewrite to /200.html would loop; the
// native "serve 404.html for unknown routes" behavior is the idiomatic
// Pages SPA pattern and serves the exact same shell.
import { copyFileSync, existsSync } from "node:fs";

if (existsSync("build/200.html")) {
  copyFileSync("build/200.html", "build/404.html");
  console.log("copied build/200.html -> build/404.html");
} else {
  console.warn("build/200.html not found; skipping 404 fallback copy");
}