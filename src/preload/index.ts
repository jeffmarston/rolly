import { contextBridge, ipcRenderer } from 'electron'
import type { SessionRecord } from '@shared/types'

function subscribe<T>(channel: string, handler: (payload: T) => void): () => void {
  const listener = (_event: unknown, payload: T): void => handler(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.off(channel, listener)
}

const api = {
  list: (): Promise<SessionRecord[]> => ipcRenderer.invoke('sessions:list'),
  copyResume: (id: string): Promise<void> => ipcRenderer.invoke('sessions:copyResume', id),
  onUpdate: (handler: (sessions: SessionRecord[]) => void) =>
    subscribe<SessionRecord[]>('sessions:update', handler),

  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickFolder'),

  pty: {
    start: (options: { cwd: string; resumeId?: string; name?: string }): Promise<string> =>
      ipcRenderer.invoke('pty:start', options),
    attach: (id: string): Promise<string> => ipcRenderer.invoke('pty:attach', id),
    alive: (): Promise<string[]> => ipcRenderer.invoke('pty:alive'),
    kill: (id: string): Promise<void> => ipcRenderer.invoke('pty:kill', id),
    input: (id: string, data: string): void => ipcRenderer.send('pty:input', id, data),
    resize: (id: string, cols: number, rows: number): void =>
      ipcRenderer.send('pty:resize', id, cols, rows),
    onData: (handler: (payload: { id: string; data: string }) => void) =>
      subscribe<{ id: string; data: string }>('pty:data', handler),
    onExit: (handler: (payload: { id: string; code: number }) => void) =>
      subscribe<{ id: string; code: number }>('pty:exit', handler)
  }
}

contextBridge.exposeInMainWorld('rolly', api)

export type RollyApi = typeof api
