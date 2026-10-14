import { accessSync, constants } from 'node:fs'
import { delimiter, isAbsolute, join, extname } from 'node:path'

export const isWindows = process.platform === 'win32'

export interface Launch {
  file: string
  args: string[]
  /**
   * Set when `args` is a hand-built `cmd.exe` line that must reach it exactly as
   * written. Both node-pty and `child_process` escape an argument array for
   * `CommandLineToArgvW`, which is the wrong grammar here: cmd would be handed
   * `/c "claude --name \"a b\""` and claude would see `\"a` and `b\"`. Callers
   * pass it on as one verbatim line instead — see how each does it.
   */
  verbatim?: boolean
}

/**
 * How to run `claude` or `gh` so that it is actually found.
 *
 * macOS and Linux go through a **login shell**, because a GUI-launched Electron
 * inherits a PATH without either tool in it. Windows does not have that problem —
 * a process started from Explorer gets the user's full environment — so the
 * executable is resolved and spawned directly, which keeps the exit code, the
 * window size and the kill attached to the real process rather than to a shell
 * wrapping it. Only a `.cmd`/`.bat` shim (how an npm-installed claude arrives)
 * needs `cmd.exe`, because nothing else can run a batch file.
 */
export function launch(argv: string[]): Launch {
  if (!isWindows) {
    const shell = process.env.SHELL || '/bin/zsh'
    return { file: shell, args: ['-l', '-c', `exec ${argv.map(quotePosix).join(' ')}`] }
  }

  const [command, ...rest] = argv
  const resolved = which(command)
  if (resolved && !isBatch(resolved)) return { file: resolved, args: rest }

  // A batch shim, or nothing on PATH yet — let the shell resolve it and report.
  // `/s` with the whole line quoted is the one form cmd parses predictably: it
  // strips exactly the outer pair and runs the rest as written.
  const comspec = process.env.COMSPEC || 'cmd.exe'
  const line = argv.map(quoteCmd).join(' ')
  return { file: comspec, args: ['/d', '/s', '/c', `"${line}"`], verbatim: true }
}

function isBatch(file: string): boolean {
  const ext = extname(file).toLowerCase()
  return ext === '.cmd' || ext === '.bat'
}

/** PATH lookup with PATHEXT, because CreateProcess only ever appends `.exe`. */
export function which(command: string): string | undefined {
  const exts = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
  const candidates = extname(command) ? [command] : exts.map((ext) => command + ext)
  const dirs = isAbsolute(command)
    ? ['']
    : ['', ...(process.env.PATH || '').split(delimiter).filter(Boolean)]

  for (const dir of dirs) {
    for (const candidate of candidates) {
      const path = dir ? join(dir, candidate) : candidate
      try {
        accessSync(path, constants.X_OK)
        return path
      } catch {
        // Next candidate.
      }
    }
  }
  return undefined
}

/** Single-quoted, with embedded quotes closed and reopened around an escaped one. */
function quotePosix(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

/**
 * cmd.exe splits on whitespace before the program sees the line, so every
 * argument is quoted whole; inside quotes `& | < > ^` are inert. `%` is not —
 * cmd expands `%NAME%` even quoted and nothing escapes it for `/c` — but only a
 * `.cmd` shim reaches this path at all, and only a session name could carry one.
 */
function quoteCmd(value: string): string {
  if (value && !/[\s"&|<>^%]/.test(value)) return value
  const escaped = value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1')
  return `"${escaped}"`
}
