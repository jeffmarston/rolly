export type SessionStatus = 'working' | 'needs-you' | 'idle' | 'done'

/** Where a row sits in the lifecycle. Interrupts aren't a stage — they pin above these. */
export type Stage = 'shape' | 'build' | 'verify'

export interface SessionRecord {
  /** Claude Code's own session id — the handle `claude --resume` takes. */
  id: string
  file: string
  projectDir: string
  cwd?: string
  gitBranch?: string
  /** Explicit rename, else agent name, else the opening prompt. */
  title: string
  summary?: string
  lastActivity?: string
  lastRole?: 'user' | 'assistant'
  messageCount: number
  stage: Stage
  /** Signals the stage was derived from, so the UI can explain itself. */
  edits: number
  pullRequestUrls: string[]
  model?: string
  effort?: string
  permissionMode?: string
  /** Latest turn's context footprint, and the window it's measured against. */
  contextTokens?: number
  contextLimit?: number
  status: SessionStatus
  /** Why, when a hook said so — 'Rate limited', 'Waiting on permission'. */
  statusReason?: string
  /** null until M4 wires `gh`; the rail renders it as unknown. */
  pullRequests: number | null
}

export type PrState = 'open' | 'draft' | 'merged' | 'closed'

export const STATUS_ORDER: SessionStatus[] = ['needs-you', 'working', 'idle', 'done']

export const STAGE_ORDER: Stage[] = ['shape', 'build', 'verify']

export const STAGE_LABEL: Record<Stage, string> = {
  shape: 'Shape',
  build: 'Build',
  verify: 'Verify'
}

export const STAGE_HINT: Record<Stage, string> = {
  shape: 'Discussion and design — nothing written yet',
  build: 'Work in flight',
  verify: 'Has a pull request open'
}

export const STATUS_LABEL: Record<SessionStatus, string> = {
  'needs-you': 'Needs you',
  working: 'Working',
  idle: 'Idle',
  done: 'Done'
}

const MODEL_NAMES: Record<string, string> = {
  'claude-opus-5': 'Opus 5',
  'claude-sonnet-5': 'Sonnet 5',
  'claude-fable-5': 'Fable 5',
  'claude-haiku-4-5-20251001': 'Haiku 4.5'
}

export function modelName(id?: string): string {
  if (!id) return '—'
  return MODEL_NAMES[id] ?? id.replace(/^claude-/, '').replace(/-\d{8}$/, '')
}

export function contextShare(record: SessionRecord): number | undefined {
  if (!record.contextTokens || !record.contextLimit) return undefined
  return record.contextTokens / record.contextLimit
}

/** Rolly's own persisted state, written to userData/state.json by the main process. */
export interface RollyState {
  stageOverrides: Record<string, Stage>
  collapsedGroups: Record<string, boolean>
  window?: { width: number; height: number; x?: number; y?: number }
  lastFolder?: string
  /** Owned, not inferred: the ticket rolly opened for a session. */
  jiraKeys: Record<string, { key: string; url: string }>
  /** When a session was closed. Later activity outranks it and the row comes back. */
  dismissed: Record<string, string>
}
