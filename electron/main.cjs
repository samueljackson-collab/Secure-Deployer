/**
 * electron/main.cjs
 *
 * Electron main process — the "backend" of the desktop application.
 * This file runs in a Node.js context with full OS access and is
 * responsible for creating the BrowserWindow and enforcing all
 * platform-level security controls.
 *
 * SECURITY HARDENING SUMMARY:
 *
 *   1. Hardware acceleration disabled (reduces GPU attack surface)
 *   2. Single-instance lock (prevents session confusion)
 *   3. BrowserWindow sandboxed with context isolation
 *   4. Strict Content Security Policy injected on all responses
 *   5. Navigation blocked (cannot redirect to external URLs)
 *   6. New window creation blocked (no popup spawning)
 *   7. Permission requests blocked (no geolocation, camera, mic)
 *   8. Remote module access blocked (legacy Electron API)
 *   9. Cached data cleared on startup (no stale credentials/tokens)
 *  10. Invalid TLS certificates rejected unconditionally
 *  11. Render process crash → app quits cleanly
 *
 * WHY CommonJS (.cjs)?
 *   Electron's main process does not support ES modules in all
 *   configurations. Using .cjs ensures compatibility with Electron's
 *   require()-based module loading.
 */

const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');

/**
 * SECURITY CONTROL #1: Disable hardware acceleration.
 *
 * GPU-based rendering can expose side-channel attacks and memory
 * leakage through shared GPU buffers. On hospital workstations
 * with shared displays, this reduces the attack surface. The
 * performance cost is negligible for a deployment management UI.
 */
app.disableHardwareAcceleration();

/**
 * SECURITY CONTROL #2: Single-instance lock.
 *
 * Only one copy of the application can run at a time. This prevents:
 *   - Credential confusion (different creds in different windows)
 *   - Race conditions in deployment operations
 *   - Accidental duplicate Wake-on-LAN packets
 *
 * If a second instance is launched, it focuses the existing window
 * and then quits (see 'second-instance' handler below).
 */
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

/**
 * Creates the main application window with hardened security settings.
 *
 * Every webPreferences option is intentionally set — nothing is left
 * at its default value. This ensures that Electron version upgrades
 * cannot silently change our security posture.
 */
const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,                    // Don't show until 'ready-to-show' fires
    backgroundColor: '#0f172a',     // Slate-900 — prevents white flash
    autoHideMenuBar: true,          // Clean UI — no menu bar needed
    webPreferences: {
      /**
       * SECURITY CONTROL #3: Sandboxed renderer with full isolation.
       *
       * - sandbox: true
       *     Runs the renderer in Chromium's OS-level sandbox. The
       *     renderer process cannot access the file system, spawn
       *     processes, or make raw network calls.
       *
       * - contextIsolation: true
       *     The renderer's JavaScript world is completely separate
       *     from Electron's internal APIs. Even if an XSS attack
       *     injects code, it cannot access Node.js or Electron APIs.
       *
       * - nodeIntegration: false
       *     require(), process, __dirname, and all Node.js APIs are
       *     unavailable in the renderer. The React app runs in a
       *     browser-like environment with no OS access.
       *
       * - webviewTag: false
       *     Prevents <webview> elements that could load external
       *     content inside the app.
       *
       * - webSecurity: true
       *     Enforces same-origin policy. The renderer cannot load
       *     resources from different origins.
       *
       * - allowRunningInsecureContent: false
       *     Blocks HTTP resources on HTTPS pages (defense against
       *     protocol downgrade attacks).
       */
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      enableWebSQL: false,          // Deprecated API — disable explicitly
      spellcheck: false,            // No text input needs spell checking
      webviewTag: false,
    },
  });

  /**
   * SECURITY CONTROL #4: Content Security Policy.
   *
   * Injected on every HTTP response via onHeadersReceived. This is
   * more reliable than a <meta> tag because it cannot be stripped
   * by a compromised renderer.
   *
   * Policy breakdown:
   *   default-src 'self'       — All resources must come from the app
   *   script-src 'self'        — Only bundled JS can execute (no eval, no inline)
   *   style-src 'self' 'unsafe-inline' — Bundled CSS + Tailwind inline styles
   *   img-src 'self' data:     — Local images + SVG data URIs
   *   font-src 'self'          — Only bundled fonts
   *   connect-src 'self'       — No external API calls
   *   frame-src 'none'         — No iframes (anti-clickjacking)
   *   object-src 'none'        — No plugins (Flash, Java, etc.)
   *   base-uri 'self'          — Cannot change <base> tag
   *   form-action 'self'       — Forms cannot submit to external URLs
   *
   * NOTE: 'unsafe-inline' is required for style-src because Tailwind
   * generates inline style attributes for dynamic utility classes
   * (e.g., translate-x-6 on toggle switches). script-src does NOT
   * allow inline, so XSS protection is maintained.
   */
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self'; " +
          // Note: 'unsafe-inline' for styles is required for Tailwind CSS and React inline styles.
          // This creates a potential XSS vector but is necessary for the framework's functionality.
          // All other CSP directives remain strict to minimize attack surface.
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data:; " +
          "font-src 'self'; " +
          "connect-src 'self'; " +
          "frame-src 'none'; " +
          "object-src 'none'; " +
          "base-uri 'self'; " +
          "form-action 'self';"
        ],
      },
    });
  });

  /**
   * SECURITY CONTROL #5: Block navigation.
   *
   * Prevents the renderer from navigating to any URL that isn't a
   * local file:// URL. This stops:
   *   - Crafted CSV filenames that could trigger navigation
   *   - JavaScript-based redirects (e.g., window.location = '...')
   *   - Link clicks that would leave the app
   */
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'file:') {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });

  /**
   * SECURITY CONTROL #6: Block new window creation.
   *
   * All attempts to open new windows (window.open, target="_blank",
   * etc.) are denied. HTTPS links are opened in the default browser
   * instead — but only HTTPS, never HTTP.
   */
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol === 'https:') {
        shell.openExternal(url);
      }
    } catch {
      // Invalid URL — block silently
    }
    return { action: 'deny' };
  });

  /**
   * SECURITY CONTROL #7: Block permission requests.
   *
   * A deployment tool has no legitimate need for geolocation, camera,
   * microphone, screen capture, or clipboard access. All permission
   * requests are denied except notifications (used for deployment
   * completion alerts).
   */
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'notifications') {
      callback(true);
      return;
    }
    callback(false);
  });

  /**
   * SECURITY CONTROL #8: Block legacy remote module access.
   *
   * The Electron remote module (deprecated) allows the renderer to
   * call main process functions directly. These handlers block any
   * attempt to use the remote module — even if it were accidentally
   * enabled in a future configuration change.
   */
  mainWindow.webContents.on('remote-require', (event) => {
    event.preventDefault();
  });

  mainWindow.webContents.on('remote-get-global', (event) => {
    event.preventDefault();
  });

  mainWindow.webContents.on('remote-get-builtin', (event) => {
    event.preventDefault();
  });

  // Show window only after content is loaded (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the built React application from the dist/ directory
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  mainWindow.loadFile(indexPath);
};

/**
 * Application lifecycle: startup.
 *
 * SECURITY CONTROL #9: Clear all cached storage on startup.
 *
 * This wipes cookies, localStorage, sessionStorage, IndexedDB, and
 * cache storage from any previous session. This ensures:
 *   - No stale credentials persist between launches
 *   - No session tokens carry over
 *   - Every launch starts from a clean state
 */
app.whenReady().then(() => {
  session.defaultSession.clearStorageData({
    storages: ['cookies', 'localstorage', 'sessionstorage', 'indexdb', 'cachestorage'],
  });

  createWindow();

  // macOS: Re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/**
 * Single-instance handler: when a second instance tries to launch,
 * focus the existing window instead.
 */
app.on('second-instance', () => {
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    if (windows[0].isMinimized()) windows[0].restore();
    windows[0].focus();
  }
});

/**
 * Quit when all windows are closed (except on macOS where apps
 * traditionally stay in the dock).
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * SECURITY CONTROL #11: Quit on renderer crash.
 *
 * If the renderer process crashes or is terminated, quit the entire
 * app. This prevents a compromised renderer from being replaced by
 * an attacker-controlled process.
 */
app.on('render-process-gone', () => {
  app.quit();
});

/**
 * SECURITY CONTROL #10: Reject all invalid TLS certificates.
 *
 * On a hospital network, an invalid certificate likely indicates
 * either a misconfigured proxy or an active man-in-the-middle
 * attack. Both should be rejected. We never call callback(true)
 * because there is no legitimate reason to accept a bad cert.
 */
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(false);
});
