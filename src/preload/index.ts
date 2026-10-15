import { contextBridge, ipcRenderer } from 'electron'
import type { ChangedFile, DiffScope, PrState, RollyState, SessionRecord } from '@shared/types'

function subscribe<T>(channel: string, handler: (payload: T) => void): () => void {
  const listener = (_event: unknown, payload: T): void => handler(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.off(channel, listener)
}

const api = {
  /** The renderer only needs it to name paths the way the host OS does. */
  platform: process.platform,

  list: (): Promise<SessionRecord[]> => ipcRenderer.invoke('sessions:list'),
  copyResume: (id: string): Promise<void> => ipcRenderer.invoke('sessions:copyResume', id),
  onUpdate: (handler: (sessions: SessionRecord[]) => void) =>
    subscribe<SessionRecord[]>('sessions:update', handler),

  hooks: {
    info: (): Promise<{ url: string; listening: boolean }> => ipcRenderer.invoke('hooks:info')
  },

  prs: {
    list: (): Promise<Record<string, PrState>> => ipcRenderer.invoke('prs:list'),
    onUpdate: (handler: (states: Record<string, PrState>) => void) =>
      subscribe<Record<string, PrState>>('prs:update', handler)
  },

  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickFolder'),
  workspace: (): Promise<string> => ipcRenderer.invoke('workspace:path'),
  projectsRoot: (): Promise<string> => ipcRenderer.invoke('paths:projects'),

  state: {
    get: (): Promise<RollyState> => ipcRenderer.invoke('state:get'),
    patch: (patch: Partial<RollyState>): Promise<RollyState> =>
      ipcRenderer.invoke('state:patch', patch)
  },
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:open', url),

  jira: {
    hasCredentials: (): Promise<boolean> => ipcRenderer.invoke('jira:hasCredentials'),
    saveCredentials: (credentials: {
      site: string
      email: string
      token: string
    }): Promise<string> => ipcRenderer.invoke('jira:saveCredentials', credentials),
    clearCredentials: (): Promise<void> => ipcRenderer.invoke('jira:clearCredentials'),
    projects: (): Promise<{ key: string; name: string; issueTypes: string[] }[]> =>
      ipcRenderer.invoke('jira:projects'),
    create: (
      sessionId: string,
      draft: { project: string; issueType: string; summary: string; description: string }
    ): Promise<{ key: string; url: string }> =>
      ipcRenderer.invoke('jira:create', sessionId, draft)
  },

  diff: {
    open: (target: { id: string; dirs: string[] }): Promise<void> =>
      ipcRenderer.invoke('diff:open', target),
    focusSession: (id: string): Promise<void> => ipcRenderer.invoke('window:focus', id),
    onSelect: (handler: (id: string) => void) => subscribe<string>('session:select', handler),
    files: (dirs: string[]): Promise<DiffScope> => ipcRenderer.invoke('diff:files', dirs),
    file: (
      scope: { root: string; base: string },
      file: ChangedFile
    ): Promise<{ before: string; after: string }> => ipcRenderer.invoke('diff:file', scope, file)
  },

  pty: {
    start: (options: { cwd: string; resumeId?: string; name?: string }): Promise<string> =>
      ipcRenderer.invoke('pty:start', options),
    attach: (id: string): Promise<string> => ipcRenderer.invoke('pty:attach', id),
    alive: (): Promise<string[]> => ipcRenderer.invoke('pty:alive'),
    close: (id: string): Promise<void> => ipcRenderer.invoke('pty:close', id),
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
