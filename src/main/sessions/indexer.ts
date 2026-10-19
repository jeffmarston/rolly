import { stat } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import type { SessionRecord } from '@shared/types'
import { readLinesFrom } from './lines'
import { applyLine, emptyDraft, finalize, type SessionDraft } from './reducer'
import { inferStatus } from './status'

interface Cursor {
  offset: number
  draft: SessionDraft
}

/**
 * Index once, tail forever: a cold 65MB transcript is streamed a single time,
 * then only the bytes appended since the last pass are re-read.
 */
export class SessionIndexer {
  private cursors = new Map<string, Cursor>()

  async update(file: string): Promise<void> {
    const { size } = await stat(file)
    let cursor = this.cursors.get(file)

    // Truncated or rotated — the cursor is meaningless, start over.
    if (cursor && size < cursor.offset) cursor = undefined
    if (!cursor) {
      cursor = { offset: 0, draft: emptyDraft(sessionIdOf(file), file, dirname(file)) }
      this.cursors.set(file, cursor)
    }
    if (size === cursor.offset) return

    const { offset } = await readLinesFrom(file, cursor.offset, (line) =>
      applyLine(cursor!.draft, line)
    )
    cursor.offset = offset
  }

  forget(file: string): void {
    this.cursors.delete(file)
  }

  snapshot(now = Date.now()): SessionRecord[] {
    return [...this.cursors.values()]
      .map(({ draft }) => ({ ...finalize(draft), status: inferStatus(draft, now) }))
      .filter((record) => record.messageCount > 0)
      .map(stripDraftFields)
      .sort(byRecency)
  }
}

function sessionIdOf(file: string): string {
  return basename(file, '.jsonl')
}

function stripDraftFields(draft: SessionDraft): SessionRecord {
  const { lastReply, prCalls, prUrls, workDirCounts, contextPeak, titleOverride, agentName, aiTitle, firstPrompt, lastPrompt, ...record } =
    draft
  return record
}

function byRecency(a: SessionRecord, b: SessionRecord): number {
  return Date.parse(b.lastActivity ?? '') - Date.parse(a.lastActivity ?? '')
}
