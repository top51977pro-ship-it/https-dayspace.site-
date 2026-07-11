// Assembles the static client bundle that Capacitor loads inside the Android
// WebView into `dist/`. TanStack Start builds through Nitro, so the client
// assets and prerendered shell land in `.output/public` (or `dist` for a plain
// Vite SPA build). This copies whichever exists into `dist/` and verifies that
// an `index.html` entry is present.
import { cp, mkdir, rm, access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const OUT = path.join(root, "dist");

const CANDIDATES = [
  ".output/public",
  ".vinxi/build/client",
  "dist/client",
  "dist",
];

async function exists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function findSource() {
  for (const rel of CANDIDATES) {
    const abs = path.join(root, rel);
    if (abs === OUT) {
      // Only accept `dist` itself if it already contains an index.html (plain SPA build).
      if (await exists(path.join(abs, "index.html"))) return abs;
      continue;
    }
    if (await exists(abs)) return abs;
  }
  return null;
}

const src = await findSource();
if (!src) {
  console.error(
    "\n[prepare-mobile] Could not find a built web bundle.\n" +
      "Run `bun run build` first, then re-run this script.\n" +
      `Looked in: ${CANDIDATES.join(", ")}\n`,
  );
  process.exit(1);
}

if (path.resolve(src) !== path.resolve(OUT)) {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  await cp(src, OUT, { recursive: true });
}

const hasIndex = await exists(path.join(OUT, "index.html"));
if (!hasIndex) {
  const entries = await readdir(OUT);
  console.error(
    "\n[prepare-mobile] Copied assets to dist/ but no index.html was found.\n" +
      "The Android WebView needs a static SPA entry (index.html).\n" +
      "Enable SPA/prerender output for the mobile build (see CAPACITOR.md).\n" +
      `dist/ currently contains: ${entries.join(", ")}\n`,
  );
  process.exit(1);
}

console.log(`[prepare-mobile] Web bundle ready in dist/ (from ${path.relative(root, src) || "."}).`);
