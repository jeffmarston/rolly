import type { SessionRecord } from '@shared/types'
import { contextTotal, inferContextLimit } from './context'

/** The wire record plus scratch fields the fold needs but the renderer never sees. */
export interface SessionDraft extends SessionRecord {
  contextPeak?: number
  titleOverride?: string
  agentName?: string
  aiTitle?: string
  firstPrompt?: string
  lastPrompt?: string
}

/** Wrapper blocks Claude Code injects into user turns — noise in a one-line summary. */
const WRAPPERS =
  /<(system-reminder|local-command-caveat|command-name|command-message|command-args|local-command-stdout)[\s\S]*?<\/\1>|<[^>]+\/>/g

export function cleanText(raw: string): string {
  return raw.replace(WRAPPERS, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function textOf(message: unknown): string {
  if (!message || typeof message !== 'object') return ''
  const content = (message as { content?: unknown }).content
  if (typeof content === 'string') return cleanText(content)
  if (!Array.isArray(content)) return ''
  return cleanText(
    content
      .filter((b): b is { type: string; text: string } => !!b && (b as any).type === 'text')
      .map((b) => b.text)
      .join(' ')
  )
}

export function emptyDraft(id: string, file: string, projectDir: string): SessionDraft {
  return {
    id,
    file,
    projectDir,
    title: id.slice(0, 8),
    messageCount: 0,
    status: 'idle',
    pullRequests: null
  }
}

interface Entry {
  type?: string
  sessionId?: string
  timestamp?: string
  cwd?: string
  gitBranch?: string
  customTitle?: string
  agentName?: string
  aiTitle?: string
  isSidechain?: boolean
  isMeta?: boolean
  effort?: string
  permissionMode?: string
  message?: unknown
}

/** Folded over every line in order; later lines win for mutable fields. */
export function applyLine(record: SessionDraft, line: string): void {
  let entry: Entry
  try {
    entry = JSON.parse(line)
  } catch {
    return
  }

  if (entry.sessionId) record.id = entry.sessionId
  if (entry.cwd) record.cwd = entry.cwd
  if (entry.gitBranch) record.gitBranch = entry.gitBranch
  if (entry.customTitle) record.titleOverride = entry.customTitle
  if (entry.agentName) record.agentName = entry.agentName
  if (entry.aiTitle) record.aiTitle = entry.aiTitle
  if (entry.timestamp) record.lastActivity = entry.timestamp
  if (entry.effort) record.effort = entry.effort
  if (entry.permissionMode) record.permissionMode = entry.permissionMode

  if (entry.type !== 'user' && entry.type !== 'assistant') return
  if (entry.isSidechain || entry.isMeta) return

  readModelAndUsage(record, entry.message)

  const text = textOf(entry.message)
  record.messageCount++
  record.lastRole = entry.type

  if (!text) return
  if (entry.type === 'user') {
    record.lastPrompt = text
    if (!record.firstPrompt) record.firstPrompt = text
  } else {
    record.summary = text
  }
}

function readModelAndUsage(record: SessionDraft, message: unknown): void {
  if (!message || typeof message !== 'object') return
  const { model, usage } = message as { model?: string; usage?: Record<string, unknown> }

  if (model && model !== '<synthetic>') record.model = model
  if (!usage) return

  record.contextTokens = contextTotal(usage)
  record.contextPeak = Math.max(record.contextPeak ?? 0, record.contextTokens)
  record.contextLimit = inferContextLimit(record.contextPeak)
}

/** Title precedence: explicit rename, agent name, Claude's own title, then the opening prompt. */
export function finalize(record: SessionDraft): SessionDraft {
  record.title =
    record.titleOverride ||
    record.agentName ||
    record.aiTitle ||
    truncate(record.firstPrompt, 60) ||
    record.id.slice(0, 8)
  return record
}

function truncate(text: string | undefined, max: number): string {
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}
