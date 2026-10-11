export type SessionStatus = 'working' | 'needs-you' | 'idle' | 'done'

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
  model?: string
  effort?: string
  permissionMode?: string
  /** Latest turn's context footprint, and the window it's measured against. */
  contextTokens?: number
  contextLimit?: number
  status: SessionStatus
  /** null until M4 wires `gh`; the rail renders it as unknown. */
  pullRequests: number | null
}

export const STATUS_ORDER: SessionStatus[] = ['needs-you', 'working', 'idle', 'done']

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
