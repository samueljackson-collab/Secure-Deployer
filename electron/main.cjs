const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const { fileURLToPath } = require('url');

// Security: Disable hardware acceleration to reduce attack surface
app.disableHardwareAcceleration();

// Security: Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// Security: Only allow file: protocol for local app files
const allowedProtocols = new Set(['file:']);

// Security: Validate that URLs are within the app's directory
const getAllowedUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    if (!allowedProtocols.has(parsedUrl.protocol)) {
      return null;
    }
    
    // For file: protocol, ensure it's within the app directory
    if (parsedUrl.protocol === 'file:') {
      const appPath = path.normalize(path.resolve(__dirname, '..'));
      // fileURLToPath properly handles both Unix and Windows file URLs
      // Remove query strings and fragments before conversion
      const cleanUrl = parsedUrl.href.split('?')[0].split('#')[0];
      const requestedPath = path.normalize(fileURLToPath(cleanUrl));
      
      // Validate path is within app directory (no path traversal)
      const relativePath = path.relative(appPath, requestedPath);
      // Reject if path tries to escape the app directory
      // Split by both possible separators and check each component
      const pathComponents = relativePath.split(/[/\\]/);
      if (pathComponents.some(component => component === '..')) {
        return null;
      }
    }
    
    return parsedUrl;
  } catch (error) {
    return null;
  }
};

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      enableWebSQL: false,
      spellcheck: false,
      webviewTag: false,
    },
  });

  // Security: Set strict Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self'; " +
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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Security: Deny all window.open attempts
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!getAllowedUrl(url)) {
      event.preventDefault();
    }
  });

  // Security: Block permission requests except notifications
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'notifications') {
      callback(true);
      return;
    }
    callback(false);
  });

  // Security: Block remote module access
  mainWindow.webContents.on('remote-require', (event) => {
    event.preventDefault();
  });

  mainWindow.webContents.on('remote-get-global', (event) => {
    event.preventDefault();
  });

  mainWindow.webContents.on('remote-get-builtin', (event) => {
    event.preventDefault();
  });

  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  mainWindow.loadFile(indexPath);
};

app.whenReady().then(() => {
  // Security: Clear cached data on startup to prevent stale credential leakage
  session.defaultSession.clearStorageData({
    storages: ['cookies', 'localstorage', 'sessionstorage', 'indexdb', 'cachestorage'],
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('second-instance', () => {
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    if (windows[0].isMinimized()) windows[0].restore();
    windows[0].focus();
  }
});

app.on('render-process-gone', () => {
  app.quit();
});

// Security: Reject all invalid certificates
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(false);
});
