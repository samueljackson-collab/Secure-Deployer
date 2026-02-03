import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    // Security: Bind to localhost only - never expose to hospital network
    host: '127.0.0.1',
    open: false,
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    // Security: No source maps in production
    sourcemap: false,
    // USB portability: Force all assets to be emitted as separate local files.
    // This ensures all resources are bundled locally for offline/USB operation,
    // avoiding any reliance on external/CDN-hosted resources. Trade-off: more
    // file requests vs. guaranteed offline functionality for hospital deployments.
    assetsInlineLimit: 0,
  },
});
