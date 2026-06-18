import { contextBridge, ipcRenderer } from 'electron'
import type { GenerateVizRequest, NotevisApi } from '../shared/api'

const api: NotevisApi = {
  vault: {
    path: () => ipcRenderer.invoke('vault:path'),
    list: () => ipcRenderer.invoke('vault:list'),
    read: (id) => ipcRenderer.invoke('vault:read', id),
    write: (id, content) => ipcRenderer.invoke('vault:write', id, content),
    create: (title) => ipcRenderer.invoke('vault:create', title)
  },
  llm: {
    status: () => ipcRenderer.invoke('llm:status'),
    generateViz: (req: GenerateVizRequest) => ipcRenderer.invoke('llm:generateViz', req)
  }
}

contextBridge.exposeInMainWorld('api', api)
