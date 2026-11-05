// Builds test-harness/out/main.{js,css} for the browser tests.
// Uses esbuild when it is resolvable (fast, what the author used), otherwise falls back to Vite (already a dependency of client/).
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(here, 'main.jsx');
const outDir = path.join(here, 'out');

let esbuild = null;
try { esbuild = await import('esbuild'); } catch { /* fall through to Vite */ }

if (esbuild) {
  await esbuild.build({ entryPoints: [entry], bundle: true, jsx: 'automatic', outdir: outDir, loader: { '.css': 'css', '.svg': 'dataurl', '.png': 'dataurl' }, define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'warning' });
} else {
  // NOTE: this branch was written but NOT executed by the author (no Vite install was available offline).
  const { build } = await import('vite');
  const react = (await import('@vitejs/plugin-react')).default;
  await build({
    root: here, logLevel: 'warn', plugins: [react()],
    build: { outDir, emptyOutDir: true, minify: false, cssCodeSplit: false, lib: { entry, formats: ['iife'], name: 'MapHarness', fileName: () => 'main.js' } },
    define: { 'process.env.NODE_ENV': '"development"' },
  });
  const fs = await import('node:fs');
  const css = fs.readdirSync(outDir).find((f) => f.endsWith('.css'));
  if (css && css !== 'main.css') fs.renameSync(path.join(outDir, css), path.join(outDir, 'main.css'));
}
console.log('harness built ->', outDir);
