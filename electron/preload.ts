import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  store: {
    get: (key: string) => ipcRenderer.invoke('get-store-value', key),
    set: (key: string, value: any) => ipcRenderer.invoke('set-store-value', key, value),
  },
  ipcRenderer: {
    send: (channel: string, data: any) => ipcRenderer.send(channel, data),
    invoke: (channel: string, data: any) => ipcRenderer.invoke(channel, data),
    on: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    },
  },
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
});
