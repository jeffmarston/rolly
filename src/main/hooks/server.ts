import { createServer, type Server } from 'node:http'
import { randomBytes } from 'node:crypto'
import { EventEmitter } from 'node:events'
import type { SessionRecord, SessionStatus } from '@shared/types'

export const HOOK_PORT = 7878
const MAX_BODY = 256 * 1024

export interface HookState {
  status: SessionStatus
  at: string
  reason?: string
}

interface Payload {
  session_id?: string
  hook_event_name?: string
  notification_type?: string
  error_type?: string
  end_reason?: string
}

/**
 * Claude Code posts hook events here, so status is reported rather than guessed.
 * A closed rolly just refuses the connection, which Claude treats as non-blocking.
 */
export class HookServer extends EventEmitter {
  readonly token = randomBytes(16).toString('hex')
  private states = new Map<string, HookState>()
  private server?: Server
  private live = new Set<string>()

  get url(): string {
    return `http://127.0.0.1:${HOOK_PORT}/rolly/${this.token}`
  }

  start(): void {
    this.server = createServer((request, response) => {
      // Answer first and parse after: a hook blocks the session until this returns.
      if (request.method !== 'POST' || request.url !== `/rolly/${this.token}`) {
        response.writeHead(404).end()
        return
      }

      let body = ''
      request.on('data', (chunk: Buffer) => {
        body += chunk
        if (body.length > MAX_BODY) request.destroy()
      })
      request.on('end', () => {
        response.writeHead(200).end()
        this.record(body)
      })
    })

    this.server.on('error', (error) => this.emit('error', error))
    this.server.listen(HOOK_PORT, '127.0.0.1')
  }

  stop(): void {
    this.server?.close()
  }

  get listening(): boolean {
    return !!this.server?.listening
  }

  /** Hook truth only outranks the transcript while it is newer than it. */
  apply(session: SessionRecord): SessionRecord {
    const state = this.states.get(session.id)
    if (!state) return session
    if (Date.parse(state.at) + 10_000 < Date.parse(session.lastActivity ?? '')) return session
    return { ...session, status: state.status, statusReason: state.reason }
  }

  private record(body: string): void {
    let payload: Payload
    try {
      payload = JSON.parse(body) as Payload
    } catch {
      return
    }

    const id = payload.session_id
    if (!id) return

    const next = statusFor(payload)
    if (payload.hook_event_name === 'SessionEnd') this.live.delete(id)
    else this.live.add(id)

    if (next) {
      this.states.set(id, { ...next, at: new Date().toISOString() })
      this.emit('status', id)
    }
  }
}

/** Only the events that change what the rail should say; everything else is noise. */
function statusFor(payload: Payload): { status: SessionStatus; reason?: string } | undefined {
  switch (payload.hook_event_name) {
    case 'UserPromptSubmit':
      return { status: 'working' }
    case 'Stop':
      return { status: 'idle' }
    case 'SessionEnd':
      return { status: 'idle' }
    case 'StopFailure':
      return { status: 'needs-you', reason: errorLabel(payload.error_type) }
    case 'Notification':
      return waiting(payload.notification_type)
    default:
      return undefined
  }
}

function waiting(type?: string): { status: SessionStatus; reason?: string } | undefined {
  if (type === 'permission_prompt') return { status: 'needs-you', reason: 'Waiting on permission' }
  if (type === 'idle_prompt') return { status: 'needs-you', reason: 'Waiting on you' }
  if (type === 'agent_needs_input') return { status: 'needs-you', reason: 'Agent needs input' }
  if (type === 'agent_completed') return { status: 'done' }
  return undefined
}

const ERRORS: Record<string, string> = {
  rate_limit: 'Rate limited',
  overloaded: 'API overloaded',
  authentication_failed: 'Auth failed',
  account_on_hold: 'Account on hold',
  billing_error: 'Billing error',
  max_output_tokens: 'Hit output limit'
}

function errorLabel(type?: string): string {
  return ERRORS[type ?? ''] ?? 'Turn failed'
}
