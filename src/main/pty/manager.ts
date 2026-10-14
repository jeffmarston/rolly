import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { spawn, type IPty } from 'node-pty'
import { launch, isWindows } from '../platform'
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

    // `launch` is what makes claude findable on each platform; see platform.ts.
    // node-pty takes a string as the command line verbatim and escapes an array.
    const { file, args: argv, verbatim } = launch(['claude', ...args])
    const term = spawn(file, verbatim ? argv.join(' ') : argv, {
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

  /**
   * node-pty *throws* on Windows if handed a signal at all — and throws it from a
   * deferred callback, so it escapes any try/catch here and the process survives.
   * Dropping the signal there is what makes closing and quitting work at all.
   */
  kill(id: string, signal?: string): void {
    try {
      this.live.get(id)?.term.kill(isWindows ? undefined : signal)
    } catch {
      // The pty can exit between the caller deciding and this call landing.
    }
  }

  /**
   * SIGTERM so claude can flush, then SIGKILL: closing has to work even when it
   * is wedged. Windows has no signals — ConPTY kills the whole console process
   * list outright — so the one kill is already the hard one and there is nothing
   * to escalate to. Nothing is lost either way: the transcript is written as the
   * session goes, not at exit.
   */
  close(id: string): void {
    const entry = this.live.get(id)
    if (!entry) return
    this.kill(id, 'SIGTERM')
    if (isWindows) return
    setTimeout(() => {
      // Identity, not presence: a resume may have taken this id in the meantime.
      if (this.live.get(id) === entry) this.kill(id, 'SIGKILL')
    }, CLOSE_GRACE_MS)
  }

  ids(): string[] {
    return [...this.live.keys()]
  }

  killAll(signal?: string): void {
    for (const id of this.ids()) this.kill(id, signal)
  }
}
