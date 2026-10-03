import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Personal-site build: LifeOS's ProjectsPage + CoursesPage as a standalone page for
// seyfikhani.ir (see src/today/src/studio.jsx and integrations/seyfikhani/README.md).
export default defineConfig({
  root: 'src/today',
  publicDir: false,
  base: './',
  plugins: [react()],
  build: {
    outDir: '../../integrations/seyfikhani/public_html',
    emptyOutDir: false,
    assetsDir: 'studio-assets',
    rollupOptions: { input: 'src/today/studio.html' }
  }
});
