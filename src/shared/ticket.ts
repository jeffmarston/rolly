import type { SessionRecord } from './types'
import { sessionLinks } from './links'

/** Composed from what rolly already knows — the preview is editable, so it only has to be a start. */
export function draftTicket(session: SessionRecord): { summary: string; description: string } {
  const parts = [session.summary?.trim()].filter(Boolean)

  const links = sessionLinks(session)
  if (links.length) {
    parts.push(['Pull requests:', ...links.map((link) => link.url)].join('\n'))
  }

  parts.push(`Opened from the Rolly session "${session.title}" (${session.id}).`)

  return { summary: session.title.slice(0, 255), description: parts.join('\n\n') }
}
