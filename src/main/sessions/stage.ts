import type { Stage } from '@shared/types'

/** Transcript shape alone — no git, no tagging: a PR means checking, an edit means in flight. */
export function deriveStage(edits: number, pullRequests: number): Stage {
  if (pullRequests > 0) return 'verify'
  if (edits > 0) return 'build'
  return 'shape'
}

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

/** Redirects and in-place edits aimed somewhere real — scratch and /dev/null don't count. */
const BASH_WRITE = /(^|[|;&]\s*)(cat|tee|printf|echo)\b[^|;&]*>>?\s*(?!\/dev\/|\/tmp\/|\/private\/tmp\/)\S|(^|\s)(sed -i|install -D|cp|mv)\s/
const SCRATCH = /\/(tmp|private\/tmp)\//

/**
 * A PR this session opened. Compound commands are normal (`cd … && gh pr create`), so match in
 * command position only — inside quotes it is something grepping for the phrase, not running it.
 */
const PR_CREATE = /(?:^|[\n;|&])\s*gh\s+pr\s+create\b/
/** `gh pr create` prints the URL alone on a line; prose and probe output quote it inline. */
const PR_URL = /^[\s\\n"']*(https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+)\s*$/gm

export function countsAsEdit(name: unknown, command: unknown): boolean {
  if (typeof name === 'string' && EDIT_TOOLS.has(name)) return true
  if (name !== 'Bash' || typeof command !== 'string') return false
  return BASH_WRITE.test(command) && !SCRATCH.test(command)
}

export function opensPullRequest(name: unknown, command: unknown): boolean {
  return name === 'Bash' && typeof command === 'string' && PR_CREATE.test(command)
}

export function pullRequestUrls(text: string): string[] {
  return [...text.matchAll(PR_URL)].map((match) => match[1])
}

/** A ticket this session filed. Browse links litter prose, so only a create call counts. */
const JIRA_CREATE = /createJiraIssue$/
const JIRA_URL = /https:\/\/[\w.-]+\.atlassian\.net\/browse\/[A-Z][A-Z0-9]+-\d+/

export function filesJiraIssue(name: unknown): boolean {
  return typeof name === 'string' && JIRA_CREATE.test(name)
}

/** One call files one issue, and the payload also links its project and parent. */
export function jiraIssueUrl(text: string): string | undefined {
  return text.match(JIRA_URL)?.[0]
}
