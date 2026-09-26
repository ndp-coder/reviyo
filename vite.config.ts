import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    // Never publish source maps: they would hand anyone the full, readable
    // source of the app. (This is Vite's default; stated so it stays that way.)
    sourcemap: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // React and the router change far less often than the app, so they
            // get their own file that stays cached in visitors' browsers
            // across releases.
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
});
