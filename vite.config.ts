// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// `bun run build:mobile` sets CAP_BUILD=1 to produce a static, client-rendered
// SPA that Capacitor bundles into the Android WebView. The default (web/Lovable)
// build is left completely untouched — it still targets Nitro/Cloudflare SSR.
const isMobileBuild = process.env.CAP_BUILD === "1";

export default defineConfig(
  isMobileBuild
    ? {
        tanstackStart: {
          // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
          server: { entry: "server" },
          // Prerender a static SPA shell (_shell.html) for the native WebView.
          spa: { enabled: true },
        },
        // No server output for the native app — everything runs client-side (Dexie/IndexedDB).
        nitro: false,
        vite: {
          // The prerender step spins up a Vite preview server; bind it to IPv4 so it
          // works in CI/sandboxes without IPv6 loopback.
          preview: { host: "127.0.0.1" },
          server: { host: "127.0.0.1" },
        },
      }
    : {
        tanstackStart: {
          // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
          // nitro/vite builds from this
          server: { entry: "server" },
        },
      },
);
