import { join } from 'node:path'
import { app, shell, dialog, BrowserWindow, ipcMain, clipboard, nativeImage } from 'electron'
import type { RollyState, SessionRecord } from '@shared/types'
import { SessionWatcher } from './sessions/watcher'
import { PtyManager } from './pty/manager'
import { PullRequestPoller } from './prs'
import { installMenu } from './menu'
import { flushState, patchState, readState } from './state'
import { ensureWorkspace, workspaceDir } from './workspace'
import {
  clearCredentials,
  createIssue,
  hasCredentials,
  projects,
  saveCredentials,
  verify,
  type JiraCredentials,
  type JiraDraft
} from './jira'

// Before anything else reads it: this names the about panel, userData path and menu.
app.setName('Rolly')

const watcher = new SessionWatcher()
const ptys = new PtyManager()
const prs = new PullRequestPoller(() =>
  watcher.snapshot().flatMap((session) => session.pullRequestUrls)
)
let window: BrowserWindow | null = null

function iconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../assets/icon.png')
}

let saveBounds: NodeJS.Timeout | undefined

function rememberBounds(): void {
  clearTimeout(saveBounds)
  saveBounds = setTimeout(() => {
    if (window && !window.isDestroyed()) patchState({ window: window.getBounds() })
  }, 400)
}

function createWindow(): void {
  const saved = readState().window
  window = new BrowserWindow({
    width: saved?.width ?? 1440,
    height: saved?.height ?? 900,
    ...(saved?.x !== undefined && saved?.y !== undefined ? { x: saved.x, y: saved.y } : {}),
    minWidth: 900,
    show: false,
    backgroundColor: '#121212',
    title: 'Rolly',
    ...(process.platform === 'darwin' ? {} : { icon: iconPath() }),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // A reload drops every xterm instance, so nothing is listening until it re-attaches.
  window.webContents.on('did-start-navigation', () => ptys.detachAll())
  window.on('ready-to-show', () => window?.show())
  window.on('resize', rememberBounds)
  window.on('move', rememberBounds)
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function send(channel: string, payload: unknown): void {
  if (window && !window.isDestroyed()) window.webContents.send(channel, payload)
}

app.whenReady().then(() => {
  app.setAboutPanelOptions({
    applicationName: 'Rolly',
    applicationVersion: app.getVersion(),
    credits: 'A fleet view for Claude Code sessions.'
  })
  installMenu()
  // Packaged builds take the dock icon from the bundle; dev runs need it set by hand.
  if (process.platform === 'darwin' && !app.isPackaged) {
    app.dock?.setIcon(nativeImage.createFromPath(iconPath()))
  }

  ensureWorkspace()

  ipcMain.handle('state:get', () => readState())
  ipcMain.handle('state:patch', (_event, patch: Partial<RollyState>) => patchState(patch))
  ipcMain.handle('workspace:path', () => workspaceDir())

  ipcMain.handle('sessions:list', () => watcher.snapshot())
  ipcMain.handle('prs:list', () => prs.snapshot())
  ipcMain.handle('jira:hasCredentials', () => hasCredentials())
  ipcMain.handle('jira:saveCredentials', async (_event, credentials: JiraCredentials) => {
    const who = await verify(credentials)
    saveCredentials(credentials)
    return who
  })
  ipcMain.handle('jira:clearCredentials', () => clearCredentials())
  ipcMain.handle('jira:projects', () => projects())
  ipcMain.handle('jira:create', async (_event, sessionId: string, draft: JiraDraft) => {
    const issue = await createIssue(draft)
    patchState({ jiraKeys: { ...readState().jiraKeys, [sessionId]: issue } })
    return issue
  })

  ipcMain.handle('shell:open', (_event, url: string) => {
    // URLs come out of transcripts, so only ever hand the OS an http(s) one.
    if (/^https?:\/\//.test(url)) return shell.openExternal(url)
    return undefined
  })

  ipcMain.handle('sessions:copyResume', (_event, id: string) => {
    clipboard.writeText(`claude --resume ${id}`)
  })

  ipcMain.handle(
    'pty:start',
    (_event, options: { cwd: string; resumeId?: string; name?: string }) =>
      ptys.start(options)
  )
  ipcMain.handle('pty:attach', (_event, id: string) => ptys.attach(id))
  ipcMain.handle('pty:alive', () => ptys.ids())
  ipcMain.on('pty:input', (_event, id: string, data: string) => ptys.write(id, data))
  ipcMain.on('pty:resize', (_event, id: string, cols: number, rows: number) =>
    ptys.resize(id, cols, rows)
  )
  ipcMain.handle('pty:close', (_event, id: string) => ptys.close(id))

  ipcMain.handle('dialog:pickFolder', async () => {
    // Seam: a native dialog can't be driven from a test harness.
    if (process.env.ROLLY_FOLDER) return process.env.ROLLY_FOLDER
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Start session here'
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ptys.on('data', (id: string, data: string) => send('pty:data', { id, data }))
  ptys.on('exit', (id: string, code: number) => send('pty:exit', { id, code }))

  watcher.on('sessions', (sessions: SessionRecord[]) => {
    send('sessions:update', sessions)
    prs.nudge()
  })
  watcher.on('error', (error) => console.error('[watcher]', error))
  watcher.start()

  prs.on('states', (states: Record<string, string>) => send('prs:update', states))
  prs.on('error', (error) => console.error('[prs]', error))
  prs.start()

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

let quitting = false

// Sessions outlive rolly: the transcript is the durable thing, so children get a
// graceful SIGTERM and come back through --resume rather than being held open.
app.on('before-quit', (event) => {
  flushState()
  void watcher.stop()
  prs.stop()
  if (quitting || ptys.ids().length === 0) return
  event.preventDefault()
  quitting = true
  ptys.killAll('SIGTERM')
  setTimeout(() => app.exit(), 1200)
})
