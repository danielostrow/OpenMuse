// Types shared between Electron main process and renderer

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

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
