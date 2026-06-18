import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { Vault } from './vault'
import { generateViz, llmStatus } from './llm'
import type { GenerateVizRequest } from '../shared/api'

const vault = new Vault()

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    autoHideMenuBar: true,
    title: 'NoteVis',
    backgroundColor: '#1b1b1d',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('vault:path', () => vault.root)
  ipcMain.handle('vault:list', () => vault.list())
  ipcMain.handle('vault:read', (_e, id: string) => vault.read(id))
  ipcMain.handle('vault:write', (_e, id: string, content: string) => vault.write(id, content))
  ipcMain.handle('vault:create', (_e, title: string) => vault.create(title))

  ipcMain.handle('llm:status', () => llmStatus())
  ipcMain.handle('llm:generateViz', (_e, req: GenerateVizRequest) => generateViz(req))
}

app.whenReady().then(async () => {
  await vault.ensure()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
