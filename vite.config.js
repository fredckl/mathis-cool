import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {version} from './package.json';

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    manifest: true,
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: './index.html',
      },
    },
  },
  define: {
    'import.meta.env.MATHIS_COOL_VERSION': JSON.stringify(version)
  }
});
