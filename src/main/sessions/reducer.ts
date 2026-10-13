import type { SessionRecord } from '@shared/types'
import { contextTotal, inferContextLimit } from './context'
import { countsAsEdit, deriveStage, opensPullRequest, pullRequestUrls } from './stage'

/** The wire record plus scratch fields the fold needs but the renderer never sees. */
export interface SessionDraft extends SessionRecord {
  prCalls?: Set<string>
  prUrls?: Set<string>
  /** Kept apart from the summary: status inference reads Claude's words, the rail shows Jeff's. */
  lastReply?: string
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

function rawText(message: unknown): string {
  if (!message || typeof message !== 'object') return ''
  const content = (message as { content?: unknown }).content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((b): b is { type: string; text: string } => !!b && (b as any).type === 'text')
    .map((b) => b.text)
    .join(' ')
}

function textOf(message: unknown): string {
  return cleanText(rawText(message))
}

/** User turns Claude Code wrote, not Jeff: tool output, notifications, compaction handoffs. */
const INJECTED =
  /^\s*(<(task-notification|system-reminder|local-command-caveat|command-name|command-message)\b|This session is being continued from a previous conversation|Caveat: The messages below were generated)/

/** A bare slash command is a real prompt but a useless summary — keep the one before it. */
const BARE_COMMAND = /^\s*\/[\w-]+\s*$/

function isInjected(entry: Entry): boolean {
  const raw = rawText(entry.message)
  return entry.toolUseResult !== undefined || INJECTED.test(raw) || BARE_COMMAND.test(raw)
}

export function emptyDraft(id: string, file: string, projectDir: string): SessionDraft {
  return {
    id,
    file,
    projectDir,
    title: id.slice(0, 8),
    messageCount: 0,
    stage: 'shape',
    edits: 0,
    pullRequestUrls: [],
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
  toolUseResult?: unknown
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
  readStageSignals(record, entry.message)

  // Injected turns carry signal but are not Jeff's words, so they stop here.
  if (entry.type === 'user' && isInjected(entry)) return

  const text = textOf(entry.message)
  record.messageCount++
  record.lastRole = entry.type

  if (!text) return
  if (entry.type === 'user') {
    record.lastPrompt = text
    if (!record.firstPrompt) record.firstPrompt = text
  } else {
    record.lastReply = text
  }
}

/** Edits and PR links are what place a session on the lifecycle axis. */
function readStageSignals(record: SessionDraft, message: unknown): void {
  if (!message || typeof message !== 'object') return
  const content = (message as { content?: unknown }).content
  const blocks = Array.isArray(content) ? content : []

  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue
    const { type, id, name, input, tool_use_id } = block as {
      type?: string
      id?: string
      name?: string
      input?: { command?: string }
      tool_use_id?: string
    }

    if (type === 'tool_use') {
      if (countsAsEdit(name, input?.command)) record.edits++
      if (id && opensPullRequest(name, input?.command)) {
        record.prCalls = record.prCalls ?? new Set()
        record.prCalls.add(id)
      }
    }

    // Only the output of a `gh pr create` call counts — prose quoting a link does not.
    if (type === 'tool_result' && tool_use_id && record.prCalls?.has(tool_use_id)) {
      record.prUrls = record.prUrls ?? new Set()
      const output = (block as { content?: unknown }).content
      const text = typeof output === 'string' ? output : JSON.stringify(output)
      for (const url of pullRequestUrls(text.replace(/\\n/g, '\n'))) record.prUrls.add(url)
    }
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
  // The rail reads better as "what was asked" than "where Claude got to".
  record.summary = record.lastPrompt
  record.pullRequestUrls = [...(record.prUrls ?? [])]
  record.stage = deriveStage(record.edits, record.pullRequestUrls.length)
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
