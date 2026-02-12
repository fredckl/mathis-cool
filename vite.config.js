import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {version} from './package.json';

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    sourcemap: true,
    emptyOutDir: true
  },
  define: {
    'import.meta.env.MATHIS_COOL_VERSION': JSON.stringify(version)
  }
});
