// Assembles the static SPA bundle that Capacitor loads inside the Android
// WebView into `www/`.
//
// `CAP_BUILD=1 vite build` runs TanStack Start in SPA mode, which emits the
// client assets and a prerendered shell to `dist/client/` (the shell is named
// `_shell.html`). Capacitor's WebView loads `index.html`, so this script copies
// `dist/client/` into `www/` and materialises `index.html` from `_shell.html`.
import { cp, mkdir, rm, access, readdir, copyFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const OUT = path.join(root, "www");

// Preferred build outputs, most-specific first.
const CANDIDATES = ["dist/client", ".output/public", "dist"];

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
    if (await exists(abs)) return abs;
  }
  return null;
}

const src = await findSource();
if (!src) {
  console.error(
    "\n[prepare-mobile] Could not find a built web bundle.\n" +
      "Run `bun run build:mobile` (or `CAP_BUILD=1 vite build`) first.\n" +
      `Looked in: ${CANDIDATES.join(", ")}\n`,
  );
  process.exit(1);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp(src, OUT, { recursive: true });

// TanStack Start SPA mode emits the entry as `_shell.html`; Capacitor needs `index.html`.
const indexHtml = path.join(OUT, "index.html");
const shellHtml = path.join(OUT, "_shell.html");
if (!(await exists(indexHtml)) && (await exists(shellHtml))) {
  await copyFile(shellHtml, indexHtml);
}

if (!(await exists(indexHtml))) {
  const entries = await readdir(OUT);
  console.error(
    "\n[prepare-mobile] Copied assets to www/ but produced no index.html.\n" +
      "Expected a prerendered SPA shell (index.html or _shell.html).\n" +
      "Confirm CAP_BUILD=1 enabled SPA mode (see vite.config.ts / CAPACITOR.md).\n" +
      `www/ currently contains: ${entries.join(", ")}\n`,
  );
  process.exit(1);
}

console.log(`[prepare-mobile] Web bundle ready in www/ (from ${path.relative(root, src)}).`);
