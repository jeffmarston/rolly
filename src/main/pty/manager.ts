import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { spawn, type IPty } from 'node-pty'
import { sanitizedEnv } from './env'

/** Enough scrollback to restore a pane after a window reload, without unbounded growth. */
const BUFFER_LIMIT = 256 * 1024
/** How long claude gets to exit on its own before it is killed outright. */
const CLOSE_GRACE_MS = 3_000

export interface StartOptions {
  cwd: string
  /** Present to resume an existing session; absent to start a fresh one. */
  resumeId?: string
  name?: string
  cols?: number
  rows?: number
}

interface Live {
  term: IPty
  buffer: string
  attached: boolean
}

export class PtyManager extends EventEmitter {
  private live = new Map<string, Live>()

  /** Returns the session id — generated up front so the rail can correlate it exactly. */
  start({ cwd, resumeId, name, cols = 120, rows = 32 }: StartOptions): string {
    const id = resumeId ?? randomUUID()
    // Rolly drives at most one pty per session; a second start would strand the first.
    if (this.live.has(id)) return id
    const args = resumeId ? ['--resume', resumeId] : ['--session-id', id]
    if (name) args.push('--name', name)

    // Through a login shell, or a GUI-launched Electron hands the child a PATH without claude.
    const shell = process.env.SHELL || '/bin/zsh'
    const command = ['claude', ...args].map(quote).join(' ')
    const term = spawn(shell, ['-l', '-c', `exec ${command}`], {
      name: 'xterm-256color',
      cwd,
      cols,
      rows,
      env: sanitizedEnv()
    })

    const entry: Live = { term, buffer: '', attached: false }
    this.live.set(id, entry)

    term.onData((data) => {
      entry.buffer = (entry.buffer + data).slice(-BUFFER_LIMIT)
      if (entry.attached) this.emit('data', id, data)
    })
    term.onExit(({ exitCode }) => {
      this.live.delete(id)
      this.emit('exit', id, exitCode)
    })

    return id
  }

  /** Hands back everything written so far and starts streaming. */
  attach(id: string): string {
    const entry = this.live.get(id)
    if (!entry) return ''
    entry.attached = true
    return entry.buffer
  }

  detachAll(): void {
    for (const entry of this.live.values()) entry.attached = false
  }

  write(id: string, data: string): void {
    this.live.get(id)?.term.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    try {
      this.live.get(id)?.term.resize(cols, rows)
    } catch {
      // The pty can exit between the renderer measuring and this call landing.
    }
  }

  kill(id: string, signal?: string): void {
    this.live.get(id)?.term.kill(signal)
  }

  /** SIGTERM so claude can flush, then SIGKILL: closing has to work even when it is wedged. */
  close(id: string): void {
    const entry = this.live.get(id)
    if (!entry) return
    entry.term.kill('SIGTERM')
    setTimeout(() => {
      // Identity, not presence: a resume may have taken this id in the meantime.
      if (this.live.get(id) === entry) entry.term.kill('SIGKILL')
    }, CLOSE_GRACE_MS)
  }

  ids(): string[] {
    return [...this.live.keys()]
  }

  killAll(signal?: string): void {
    for (const id of this.ids()) this.kill(id, signal)
  }
}

function quote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}
