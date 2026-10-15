import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

export interface Pane {
  term: Terminal
  fit: FitAddon
  /** Owned by the cache, not by any component — panes outlive the view that shows them. */
  element: HTMLDivElement
}

const panes = new Map<string, Pane>()
let listening = false

const THEME = {
  background: '#121212',
  foreground: '#e8e8e8',
  cursor: '#e0a33e',
  selectionBackground: '#33415577'
}

function listen(): void {
  if (listening) return
  listening = true
  window.rolly.pty.onData(({ id, data }) => panes.get(id)?.term.write(data))
  window.rolly.pty.onExit(({ id }) =>
    panes.get(id)?.term.write('\r\n\x1b[2m— session ended —\x1b[0m\r\n')
  )
}

/** Terminals are cached per session so switching rows never loses scrollback. */
export async function acquire(id: string): Promise<Pane> {
  listen()
  const existing = panes.get(id)
  if (existing) return existing

  const element = document.createElement('div')
  element.className = 'pane'
  const term = new Terminal({
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 12,
    lineHeight: 1.2,
    cursorBlink: true,
    allowProposedApi: true,
    scrollback: 10_000,
    theme: THEME
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  term.open(element)
  term.onData((data) => window.rolly.pty.input(id, data))

  const pane: Pane = { term, fit, element }
  panes.set(id, pane)

  const backlog = await window.rolly.pty.attach(id)
  if (backlog) term.write(backlog)
  return pane
}

/** The diff window can type into a pane that is already open, and typing needs the caret. */
export function focus(id: string): void {
  panes.get(id)?.term.focus()
}

export function release(id: string): void {
  const pane = panes.get(id)
  if (!pane) return
  pane.term.dispose()
  panes.delete(id)
}
