import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { cloudflare } from "@cloudflare/vite-plugin";

// Only the Today screen is built by Vite for now.  Keeping public/ as the
// output directory lets the Worker ASSETS binding and the local Node server
// continue serving the application at exactly the same URLs.
export default defineConfig({
  root: 'src/today',
  publicDir: false,
  base: '/',
  plugins: [react(), cloudflare()],
  build: {
    outDir: '../../public',
    emptyOutDir: false,
    manifest: 'today-manifest.json'
  }
});