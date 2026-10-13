import type { SessionRecord } from './types'

const PR = /github\.com\/[\w.-]+\/([\w.-]+)\/pull\/(\d+)/

export interface Link {
  kind: 'pr'
  label: string
  url: string
}

/** PRs only: a branch-derived Jira key named one ticket for every session sharing a tree. */
export function sessionLinks(session: SessionRecord): Link[] {
  const links: Link[] = []

  for (const url of session.pullRequestUrls) {
    const match = url.match(PR)
    if (match) links.push({ kind: 'pr', label: `${match[1]} #${match[2]}`, url })
  }

  return links
}
