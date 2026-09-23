import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
    manifest: 'today-manifest.json'
  }
});
