import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Ensures assets load correctly on subpaths (e.g. GitHub Pages /repo-name/)
  optimizeDeps: {
    exclude: ['pyodide', '@yowasp/clang', '@bjorn3/browser_wasi_shim'],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
