import { app, BrowserWindow, ipcMain, globalShortcut, desktopCapturer, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const store = new Store();

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function createOverlayWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  
  overlayWindow = new BrowserWindow({
    width: 400,
    height: 600,
    x: width - 420,
    y: 50,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    overlayWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#overlay`);
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'overlay' });
  }
}

app.whenReady().then(() => {
  createMainWindow();
  
  // Toggle overlay shortcut
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (overlayWindow) {
      if (overlayWindow.isVisible()) overlayWindow.hide();
      else overlayWindow.show();
    } else {
      createOverlayWindow();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('get-store-value', (event, key) => store.get(key));
ipcMain.handle('set-store-value', (event, key, value) => store.set(key, value));

ipcMain.handle('capture-screen', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: screen.getPrimaryDisplay().size });
  return sources[0].thumbnail.toDataURL();
});

ipcMain.on('toggle-overlay', () => {
  if (overlayWindow) {
    if (overlayWindow.isVisible()) overlayWindow.hide();
    else overlayWindow.show();
  } else {
    createOverlayWindow();
  }
});
