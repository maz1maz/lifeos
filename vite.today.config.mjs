import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Isolated build for the first incremental migration.  It deliberately does
// not change the existing Worker/Vite configuration used by other work.
export default defineConfig({
  root: 'src/today',
  publicDir: false,
  base: '/',
  plugins: [react()],
  build: {
    outDir: '../../public',
    emptyOutDir: false,
    manifest: 'today-manifest.json',
    // lazy chunks (PDF export) share the gitignored index-* prefix so prune-stale-bundles manages them
    rollupOptions: {
      input: { index: resolve('src/today/index.html'), vocabPdf: resolve('src/today/src/vocabPdf.js') },
      output: { entryFileNames: chunk => chunk.name === 'vocabPdf' ? 'assets/index-c-[hash].js' : 'assets/index-[hash].js', chunkFileNames: 'assets/index-c-[hash].js' }
    }
  }
});
