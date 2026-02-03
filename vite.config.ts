/**
 * vite.config.ts
 *
 * Vite build configuration for the Secure Deployment Runner.
 *
 * SECURITY-CRITICAL SETTINGS:
 *
 *   host: '127.0.0.1'
 *     The dev server binds to localhost ONLY. The previous value was
 *     '0.0.0.0', which exposed the development server to every device
 *     on the hospital network — including patient-facing systems.
 *     Anyone on the LAN could access the deployment UI, view device
 *     lists, read deployment scripts, and potentially trigger operations.
 *
 *   sourcemap: false
 *     Production builds do NOT include source maps. Source maps expose
 *     the original TypeScript source code (including security patterns,
 *     regex rules, and application logic) to anyone with browser DevTools.
 *
 * WHAT WAS REMOVED:
 *   - loadEnv() call that loaded GEMINI_API_KEY into the build
 *   - define: { 'import.meta.env.VITE_GEMINI_API_KEY': ... } that
 *     baked the API key into the client-side JavaScript bundle
 */
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    /**
     * SECURITY: Bind to 127.0.0.1 (localhost) ONLY.
     *
     * NEVER change this to '0.0.0.0' or 'true' on a hospital network.
     * Doing so exposes the dev server to every device on the LAN.
     */
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
    /**
     * SECURITY: Disable source maps in production.
     *
     * Source maps reveal the original TypeScript source to anyone with
     * DevTools. On a hospital network, this leaks the application's
     * security rules, pattern matching logic, and internal structure.
     */
    sourcemap: false,
    /** Inline no assets — keep everything as separate files for CSP compliance. */
    assetsInlineLimit: 0,
  },
});
