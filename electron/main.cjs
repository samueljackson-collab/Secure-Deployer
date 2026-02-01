const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const allowedProtocols = new Set(['file:', 'https:', 'http:']);

const getAllowedUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    return allowedProtocols.has(parsedUrl.protocol) ? parsedUrl : null;
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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const allowedUrl = getAllowedUrl(url);

    if (allowedUrl && allowedUrl.protocol !== 'file:') {
      shell.openExternal(url);
    }

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
