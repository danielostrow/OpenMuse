import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { BackendManager } from './services/backend-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let backendManager: BackendManager | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    titleBarStyle: 'hiddenInset',
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu();
}

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu:new-project')
        },
        {
          label: 'Open Project...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow!, {
              properties: ['openFile'],
              filters: [
                { name: 'OpenMuse Project', extensions: ['omproj'] },
                { name: 'MusicXML', extensions: ['musicxml', 'xml', 'mxl'] }
              ]
            });
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow?.webContents.send('menu:open-project', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save')
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: async () => {
            const result = await dialog.showSaveDialog(mainWindow!, {
              filters: [{ name: 'OpenMuse Project', extensions: ['omproj'] }]
            });
            if (!result.canceled && result.filePath) {
              mainWindow?.webContents.send('menu:save-as', result.filePath);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Export',
          submenu: [
            {
              label: 'Export as MusicXML...',
              click: () => mainWindow?.webContents.send('menu:export', 'musicxml')
            },
            {
              label: 'Export as PDF...',
              click: () => mainWindow?.webContents.send('menu:export', 'pdf')
            },
            {
              label: 'Export as MIDI...',
              click: () => mainWindow?.webContents.send('menu:export', 'midi')
            }
          ]
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => mainWindow?.webContents.send('menu:zoom', 'in')
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => mainWindow?.webContents.send('menu:zoom', 'out')
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow?.webContents.send('menu:zoom', 'reset')
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About OpenMuse',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About OpenMuse',
              message: 'OpenMuse',
              detail: 'AI-powered music notation IDE\nVersion 2.0.0\n\nPowered by Claude'
            });
          }
        }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
function setupIpcHandlers(): void {
  // Backend API proxy
  ipcMain.handle('api:request', async (_event, endpoint: string, method: string, body?: unknown) => {
    const backendUrl = backendManager?.getUrl() || 'http://127.0.0.1:8765';
    try {
      const response = await fetch(`${backendUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      });
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  });

  // Backend status
  ipcMain.handle('backend:status', () => {
    return backendManager?.isRunning() || false;
  });

  // File operations
  ipcMain.handle('file:read', async (_event, filePath: string) => {
    const fs = await import('fs/promises');
    return await fs.readFile(filePath, 'utf-8');
  });

  ipcMain.handle('file:write', async (_event, filePath: string, content: string) => {
    const fs = await import('fs/promises');
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
  });

  ipcMain.handle('file:select-audio', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a'] }
      ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  // Start backend
  backendManager = new BackendManager();
  await backendManager.start();

  setupIpcHandlers();
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

app.on('before-quit', async () => {
  await backendManager?.stop();
});
