import { app, BrowserWindow, ipcMain, globalShortcut, desktopCapturer, screen, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const store = new Store();

// Enable PipeWire support for Wayland on Linux
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');
  app.commandLine.appendSwitch('enable-webrtc-pipewire-capturer');
}

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
    skipTaskbar: true,
    enableLargerThanScreen: true,
    movable: false,
    resizable: false,
    hasShadow: false,
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
function broadcast(channel: string, ...args: any[]) {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  });
}

ipcMain.handle('get-store-value', (event, key) => store.get(key));
ipcMain.handle('set-store-value', (event, key, value) => {
  store.set(key, value);
  if (key === 'settings') {
    broadcast('settings-updated', value);
  }
});

ipcMain.handle('capture-screen', async () => {
  const sources = await desktopCapturer.getSources({ 
    types: ['screen', 'window'], 
    thumbnailSize: screen.getPrimaryDisplay().size 
  });
  return sources[0].thumbnail.toDataURL();
});

ipcMain.on('toggle-overlay', () => {
  console.log('IPC: toggle-overlay');
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    if (overlayWindow.isVisible()) {
      console.log('Overlay: hiding');
      overlayWindow.hide();
    } else {
      console.log('Overlay: showing');
      overlayWindow.show();
      overlayWindow.focus();
    }
  } else {
    console.log('Overlay: creating new');
    createOverlayWindow();
  }
});

ipcMain.on('start-capture', async () => {
  console.log('Capture: start sequence');
  try {
    // Hide windows to capture what's behind
    const wasMainVisible = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible();
    const wasOverlayVisible = overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible();
    
    if (wasMainVisible) mainWindow?.hide();
    if (wasOverlayVisible) overlayWindow?.hide();

    // Wait bit longer for windows to hide completely to avoid flicker or ghosting
    await new Promise(resolve => setTimeout(resolve, 250));

    const display = screen.getPrimaryDisplay();
    const { width, height } = display.bounds;
    const scaleFactor = display.scaleFactor;

    console.log(`Capture: primary display bounds: ${width}x${height}, scale: ${scaleFactor}, platform: ${process.platform}`);
    if (process.platform === 'linux') {
      console.log('Capture: Linux detected, session type:', process.env.XDG_SESSION_TYPE);
    }

    // On Linux/Wayland, sometimes getSources hangs if no window is visible.
    // We create the selection window EARLY but keep it hidden or fully transparent initially.
    if (!selectionWindow || selectionWindow.isDestroyed()) {
      console.log('Capture: Pre-creating selection window');
      createSelectionWindow();
      selectionWindow?.setOpacity(0);
      selectionWindow?.show();
    }

    broadcast('capture-status', 'requested');

    const sources = await desktopCapturer.getSources({ 
      types: ['screen', 'window'], // Sometimes window type is needed to trigger the portal on Wayland
      thumbnailSize: {
        width: Math.floor(width * scaleFactor),
        height: Math.floor(height * scaleFactor)
      }
    });

    console.log(`Capture: found ${sources.length} sources`);
    sources.forEach((s, i) => console.log(`Source ${i}: ${s.name} (ID: ${s.id}, Display ID: ${s.display_id})`));
    
    // Find the source that matches the screen or take the first one
    const source = sources.find(s => s.display_id === display.id.toString()) || 
                   sources.find(s => s.name.toLowerCase().includes('screen')) ||
                   sources.find(s => s.name.toLowerCase().includes('entire')) ||
                   sources[0];
    
    if (!source) {
      console.log('Capture: No source found in list of', sources.length);
      throw new Error(
        process.platform === 'linux' && process.env.XDG_SESSION_TYPE === 'wayland'
          ? 'Wayland detected: Ensure PipeWire and xdg-desktop-portal are configured. Try selecting "Entire Screen" if prompted.'
          : 'No screen capture sources found.'
      );
    }
    
    const bgImage = source.thumbnail.toDataURL();
    console.log('Capture: screenshot taken, length:', bgImage.length);

    const win = selectionWindow;
    if (win && !win.isDestroyed()) {
      console.log('Capture: configuring selection window');
      win.setBounds(display.bounds);
      win.setOpacity(1);
      
      const sendBg = () => {
        console.log('Capture: sending bg to window');
        win.webContents.send('set-capture-bg', bgImage, scaleFactor);
      };

      if (win.webContents.isLoading()) {
        win.webContents.on('did-finish-load', sendBg);
      } else {
        sendBg();
      }

      win.show();
      win.focus();
      
      if (process.platform === 'darwin') {
        win.setAlwaysOnTop(true, 'screen-saver');
      } else {
        win.setAlwaysOnTop(true, 'status');
      }
      
      win.setIgnoreMouseEvents(false);
      
      // Signal that the interface is ready for interaction
      broadcast('capture-ready', {
        platform: process.platform,
        sessionType: process.env.XDG_SESSION_TYPE
      });
    } else {
      throw new Error('Selection window lost during capture');
    }

    // DO NOT restore windows here - wait for result or close-selection
  } catch (err) {
    console.error('Capture: failed during initialization', err);
    // Restore windows on error
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.webContents.send('capture-error', 'Failed to start screen capture');
    }
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.show();
      overlayWindow.webContents.send('capture-error', 'Failed to start screen capture');
    }
  }
});

ipcMain.on('show-main-window', () => {
  console.log('IPC: show-main-window');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createMainWindow();
  }
});

ipcMain.on('close-selection', () => {
  console.log('IPC: close-selection');
  if (selectionWindow && !selectionWindow.isDestroyed()) {
    selectionWindow.close();
  }
  
  // Broadcast cancellation
  broadcast('on-capture-cancelled');

  // Restore windows
  BrowserWindow.getAllWindows().forEach(win => {
    if (win !== selectionWindow && !win.isDestroyed()) {
      win.show();
    }
  });
});

ipcMain.on('capture-result', (event, dataUrl) => {
  console.log('Capture: complete, size:', dataUrl.length);
  
  // Show windows BEFORE sending result
  BrowserWindow.getAllWindows().forEach(win => {
    if (win !== selectionWindow && !win.isDestroyed()) {
      win.show();
    }
  });

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('on-capture-complete', dataUrl);
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('on-capture-complete', dataUrl);
    overlayWindow.focus();
  }
  
  if (selectionWindow && !selectionWindow.isDestroyed()) {
    selectionWindow.close();
  }
});
