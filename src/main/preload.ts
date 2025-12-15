import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export interface ElectronAPI {
  // Backend API
  apiRequest: (endpoint: string, method: string, body?: unknown) => Promise<unknown>;
  backendStatus: () => Promise<boolean>;

  // File operations
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<boolean>;
  selectAudioFile: () => Promise<string | null>;

  // Menu event listeners
  onNewProject: (callback: () => void) => void;
  onOpenProject: (callback: (path: string) => void) => void;
  onSave: (callback: () => void) => void;
  onSaveAs: (callback: (path: string) => void) => void;
  onExport: (callback: (format: string) => void) => void;
  onZoom: (callback: (direction: string) => void) => void;

  // Remove listeners
  removeAllListeners: (channel: string) => void;
}

const electronAPI: ElectronAPI = {
  // Backend API
  apiRequest: (endpoint: string, method: string, body?: unknown) =>
    ipcRenderer.invoke('api:request', endpoint, method, body),
  backendStatus: () => ipcRenderer.invoke('backend:status'),

  // File operations
  readFile: (path: string) => ipcRenderer.invoke('file:read', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),
  selectAudioFile: () => ipcRenderer.invoke('file:select-audio'),

  // Menu event listeners
  onNewProject: (callback: () => void) => {
    ipcRenderer.on('menu:new-project', callback);
  },
  onOpenProject: (callback: (path: string) => void) => {
    ipcRenderer.on('menu:open-project', (_event: IpcRendererEvent, path: string) => callback(path));
  },
  onSave: (callback: () => void) => {
    ipcRenderer.on('menu:save', callback);
  },
  onSaveAs: (callback: (path: string) => void) => {
    ipcRenderer.on('menu:save-as', (_event: IpcRendererEvent, path: string) => callback(path));
  },
  onExport: (callback: (format: string) => void) => {
    ipcRenderer.on('menu:export', (_event: IpcRendererEvent, format: string) => callback(format));
  },
  onZoom: (callback: (direction: string) => void) => {
    ipcRenderer.on('menu:zoom', (_event: IpcRendererEvent, direction: string) => callback(direction));
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for renderer
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
