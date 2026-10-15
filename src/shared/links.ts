import type { SessionRecord } from './types'

const PR = /github\.com\/[\w.-]+\/([\w.-]+)\/pull\/(\d+)/

export interface Link {
  kind: 'pr'
  label: string
  url: string
}

const JIRA = /atlassian\.net\/browse\/([A-Z][A-Z0-9]+-\d+)/

/** Filed tickets only: a branch-derived key named one ticket for every session sharing a tree. */
export function jiraIssues(session: SessionRecord): { key: string; url: string }[] {
  return session.jiraIssueUrls.flatMap((url) => {
    const match = url.match(JIRA)
    return match ? [{ key: match[1], url }] : []
  })
}

/** PRs only — tickets have their own shape and their own place in the panel. */
export function sessionLinks(session: SessionRecord): Link[] {
  const links: Link[] = []

  for (const url of session.pullRequestUrls) {
    const match = url.match(PR)
    if (match) links.push({ kind: 'pr', label: `${match[1]} #${match[2]}`, url })
  }

  return links
}
