import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { promisify } from 'node:util'
import { sanitizedEnv } from './pty/env'

const run = promisify(execFile)
const TIMEOUT_MS = 240_000

export interface Draft {
  summary: string
  issueType: string
  description: string
}

function prompt(types: string[]): string {
  return [
    'Draft a Jira ticket for the work in this session.',
    '',
    'Reply with ONLY a JSON object and nothing else — no prose, no code fence:',
    '{"summary": "...", "issueType": "...", "description": "..."}',
    '',
    'summary: one line, imperative, under 120 characters, no ticket key.',
    `issueType: exactly one of ${types.join(', ')}.`,
    'description: plain text. What was wrong or wanted, what changed, how to verify.',
    'Include any PR URLs from this session. Separate paragraphs with a blank line.',
    'Describe only what this session actually did.'
  ].join('\n')
}

/**
 * Forks the session so the model drafts with its full context and the original
 * transcript is never written to. The fork's own transcript is then deleted.
 */
export async function draftWithAI(
  sessionId: string,
  cwd: string,
  types: string[]
): Promise<Draft> {
  const fork = randomUUID()
  try {
    const command = [
      'claude',
      '-p',
      '--resume',
      sessionId,
      '--fork-session',
      '--session-id',
      fork,
      quote(prompt(types))
    ].join(' ')

    // Login shell, or a GUI-launched Electron hands the child a PATH without claude.
    const shell = process.env.SHELL || '/bin/zsh'
    const { stdout } = await run(shell, ['-l', '-c', command], {
      cwd,
      env: sanitizedEnv(),
      timeout: TIMEOUT_MS,
      maxBuffer: 8 * 1024 * 1024
    })
    return parse(stdout, types)
  } finally {
    await rm(transcriptOf(cwd, fork), { force: true })
  }
}

function transcriptOf(cwd: string, id: string): string {
  // Claude Code slugs a cwd by replacing every separator and space with a dash.
  return join(homedir(), '.claude', 'projects', cwd.replace(/[/\s]/g, '-'), `${id}.jsonl`)
}

function parse(stdout: string, types: string[]): Draft {
  const match = stdout.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`No JSON in the reply: ${stdout.slice(0, 200)}`)

  const draft = JSON.parse(match[0]) as Partial<Draft>
  if (!draft.summary || !draft.description) throw new Error('Reply was missing fields')

  // The model is asked for one of the project's types; fall back rather than fail.
  const issueType = types.find((type) => type === draft.issueType) ?? types[0]
  return { summary: draft.summary.slice(0, 255), issueType, description: draft.description }
}

function quote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}
