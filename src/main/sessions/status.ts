import type { SessionStatus } from '@shared/types'
import type { SessionDraft } from './reducer'

const STREAMING_MS = 45_000
const STALE_MS = 10 * 60_000

/**
 * Provisional: inferred from transcript shape alone so M1 works with zero setup.
 * M4 replaces this with hook events, which know the difference for real.
 */
export function inferStatus(record: SessionDraft, now = Date.now()): SessionStatus {
  if (!record.lastActivity) return 'idle'
  const age = now - Date.parse(record.lastActivity)

  if (age < STREAMING_MS) return 'working'
  if (record.lastRole === 'user' && age < STALE_MS) return 'working'
  if (endsInQuestion(record.summary)) return 'needs-you'
  return 'idle'
}

function endsInQuestion(summary?: string): boolean {
  return !!summary?.trimEnd().endsWith('?')
}
