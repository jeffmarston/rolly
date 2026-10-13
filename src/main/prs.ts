import { execFile } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { promisify } from 'node:util'
import type { PrState } from '@shared/types'

const run = promisify(execFile)

const POLL_MS = 30_000
const PR_URL = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)$/

interface Target {
  alias: string
  owner: string
  repo: string
  number: number
  url: string
}

/**
 * One batched GraphQL call for every PR rolly has seen, every 30s — a per-PR
 * `gh pr view` would be a subprocess each and burn the rate limit far faster.
 */
export class PullRequestPoller extends EventEmitter {
  private states = new Map<string, PrState>()
  private timer?: NodeJS.Timeout
  private polling = false
  private lastPoll = 0

  constructor(private readonly urls: () => string[]) {
    super()
  }

  start(): void {
    void this.poll()
    this.timer = setInterval(() => void this.poll(), POLL_MS)
  }

  /** The first poll finds no PRs because nothing is indexed yet; this closes that gap. */
  nudge(): void {
    if (Date.now() - this.lastPoll >= POLL_MS) void this.poll()
  }

  stop(): void {
    clearInterval(this.timer)
  }

  snapshot(): Record<string, PrState> {
    return Object.fromEntries(this.states)
  }

  private async poll(): Promise<void> {
    if (this.polling) return
    const targets = parse(this.urls())
    if (!targets.length) return

    this.polling = true
    this.lastPoll = Date.now()
    try {
      const data = await query(targets)
      let changed = false
      for (const target of targets) {
        const state = stateOf(data[target.alias])
        if (!state || this.states.get(target.url) === state) continue
        this.states.set(target.url, state)
        changed = true
      }
      if (changed) this.emit('states', this.snapshot())
    } catch (error) {
      this.emit('error', error)
    } finally {
      this.polling = false
    }
  }
}

function parse(urls: string[]): Target[] {
  const targets: Target[] = []
  for (const url of new Set(urls)) {
    const match = url.match(PR_URL)
    if (match) {
      targets.push({
        alias: `p${targets.length}`,
        owner: match[1],
        repo: match[2],
        number: Number(match[3]),
        url
      })
    }
  }
  return targets
}

interface Node {
  pullRequest: { state: string; isDraft: boolean } | null
}

async function query(targets: Target[]): Promise<Record<string, Node | null>> {
  const fields = targets
    .map(
      ({ alias, owner, repo, number }) =>
        `${alias}: repository(owner: "${owner}", name: "${repo}") ` +
        `{ pullRequest(number: ${number}) { state isDraft } }`
    )
    .join(' ')

  // Through a login shell, or a GUI-launched Electron hands gh a PATH without it.
  const shell = process.env.SHELL || '/bin/zsh'
  const command = `gh api graphql -f ${quote(`query={ ${fields} }`)}`
  const { stdout } = await run(shell, ['-l', '-c', command], { maxBuffer: 4 * 1024 * 1024 })

  // A missing repo nulls its alias and reports an error, while the rest still resolve.
  return (JSON.parse(stdout) as { data?: Record<string, Node | null> }).data ?? {}
}

function stateOf(node: Node | null | undefined): PrState | undefined {
  const pr = node?.pullRequest
  if (!pr) return undefined
  if (pr.state === 'MERGED') return 'merged'
  if (pr.state === 'CLOSED') return 'closed'
  return pr.isDraft ? 'draft' : 'open'
}

function quote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}
