const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

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
      const appPath = path.resolve(__dirname, '..');
      const requestedPath = path.resolve(parsedUrl.pathname);
      
      // Only allow files within the app directory
      if (!requestedPath.startsWith(appPath)) {
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
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
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

  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  mainWindow.loadFile(indexPath);
};

app.whenReady().then(() => {
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
