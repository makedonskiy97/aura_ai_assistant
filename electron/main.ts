import { app, BrowserWindow, ipcMain, globalShortcut, desktopCapturer, screen, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const store = new Store();

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let selectionWindow: BrowserWindow | null = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#09090b',
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });
}

function createOverlayWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show();
    overlayWindow.focus();
    return;
  }

  overlayWindow = new BrowserWindow({
    width: 320,
    height: 480,
    x: width - 340,
    y: 50,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    skipTaskbar: true,
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    overlayWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#overlay`);
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'overlay' });
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function createSelectionWindow() {
  const { width, height } = screen.getPrimaryDisplay().size;
  
  selectionWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    fullscreen: true,
    skipTaskbar: true,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    selectionWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#capture`);
  } else {
    selectionWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'capture' });
  }
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '../public/icon.png'));
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Aura', click: () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      } else {
        createMainWindow();
      }
    }},
    { label: 'Toggle Overlay', click: () => {
      if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
        overlayWindow.hide();
      } else {
        createOverlayWindow();
      }
    }},
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  
  tray.setToolTip('Aura AI Assistant');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isVisible()) mainWindow.hide();
      else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

app.whenReady().then(() => {
  createMainWindow();
  createTray();
  
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
  const sources = await desktopCapturer.getSources({ 
    types: ['screen', 'window'], 
    thumbnailSize: screen.getPrimaryDisplay().size 
  });
  return sources[0].thumbnail.toDataURL();
});

ipcMain.on('toggle-overlay', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    if (overlayWindow.isVisible()) {
      overlayWindow.hide();
    } else {
      overlayWindow.show();
    }
  } else {
    createOverlayWindow();
  }
});

ipcMain.on('start-capture', async () => {
  // Hide windows to capture what's behind
  const wasMainVisible = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible();
  const wasOverlayVisible = overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible();
  
  if (wasMainVisible) mainWindow?.hide();
  if (wasOverlayVisible) overlayWindow?.hide();

  // Wait for windows to hide
  await new Promise(resolve => setTimeout(resolve, 150));

  const sources = await desktopCapturer.getSources({ 
    types: ['screen'], 
    thumbnailSize: screen.getPrimaryDisplay().size 
  });
  
  const bgImage = sources[0].thumbnail.toDataURL();

  if (selectionWindow && !selectionWindow.isDestroyed()) {
    selectionWindow.webContents.send('set-capture-bg', bgImage);
    selectionWindow.show();
  } else {
    createSelectionWindow();
    selectionWindow?.once('ready-to-show', () => {
      selectionWindow?.webContents.send('set-capture-bg', bgImage);
      selectionWindow?.show();
    });
  }

  // Restore windows
  if (wasMainVisible) mainWindow?.show();
  if (wasOverlayVisible) overlayWindow?.show();
});

ipcMain.on('show-main-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createMainWindow();
  }
});

ipcMain.on('close-selection', () => {
  if (selectionWindow && !selectionWindow.isDestroyed()) {
    selectionWindow.close();
  }
});

ipcMain.on('capture-result', (event, dataUrl) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('on-capture-complete', dataUrl);
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('on-capture-complete', dataUrl);
  }
  if (selectionWindow && !selectionWindow.isDestroyed()) {
    selectionWindow.close();
  }
});
