interface ElectronAPI {
  store: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
  };
  ipcRenderer: {
    send: (channel: string, data?: any) => void;
    invoke: (channel: string, data?: any) => Promise<any>;
    on: (channel: string, func: (...args: any[]) => void) => void;
  };
  captureScreen: () => Promise<string>;
}

interface Window {
  electron?: ElectronAPI;
}
