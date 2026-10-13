import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { app, safeStorage } from 'electron'

export interface JiraCredentials {
  site: string
  email: string
  token: string
}

export interface JiraProject {
  key: string
  name: string
  issueTypes: string[]
}

export interface JiraDraft {
  project: string
  issueType: string
  summary: string
  description: string
}

function credentialFile(): string {
  return join(app.getPath('userData'), 'jira.bin')
}

export function hasCredentials(): boolean {
  return existsSync(credentialFile())
}

/** Encrypted at rest by the OS keychain; the token never lands in state.json. */
export function saveCredentials(credentials: JiraCredentials): void {
  const json = JSON.stringify(credentials)
  const blob = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(json)
    : Buffer.from(json, 'utf8')
  writeFileSync(credentialFile(), blob)
}

export function clearCredentials(): void {
  if (hasCredentials()) unlinkSync(credentialFile())
}

function loadCredentials(): JiraCredentials {
  const blob = readFileSync(credentialFile())
  const json = safeStorage.isEncryptionAvailable()
    ? safeStorage.decryptString(blob)
    : blob.toString('utf8')
  return JSON.parse(json) as JiraCredentials
}

function origin(site: string): string {
  const trimmed = site.trim().replace(/\/+$/, '')
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`
}

async function call<T>(
  credentials: JiraCredentials,
  path: string,
  init?: RequestInit
): Promise<T> {
  const auth = Buffer.from(`${credentials.email}:${credentials.token}`).toString('base64')
  const response = await fetch(`${origin(credentials.site)}${path}`, {
    ...init,
    headers: {
      authorization: `Basic ${auth}`,
      accept: 'application/json',
      'content-type': 'application/json',
      ...init?.headers
    }
  })

  const body = await response.text()
  if (!response.ok) {
    throw new Error(`Jira ${response.status}: ${body.slice(0, 300)}`)
  }
  return (body ? JSON.parse(body) : {}) as T
}

export async function verify(credentials: JiraCredentials): Promise<string> {
  const me = await call<{ displayName?: string; emailAddress?: string }>(
    credentials,
    '/rest/api/3/myself'
  )
  return me.displayName ?? me.emailAddress ?? 'connected'
}

export async function projects(): Promise<JiraProject[]> {
  const credentials = loadCredentials()
  const result = await call<{
    values: { key: string; name: string; issueTypes?: { name: string; subtask: boolean }[] }[]
  }>(credentials, '/rest/api/3/project/search?expand=issueTypes&maxResults=50&action=create')

  return result.values.map((project) => ({
    key: project.key,
    name: project.name,
    issueTypes: (project.issueTypes ?? []).filter((t) => !t.subtask).map((t) => t.name)
  }))
}

/** API v3 wants Atlassian Document Format, so blank-line-separated paragraphs. */
function toAdf(text: string): unknown {
  const paragraphs = text.split(/\n{2,}/).filter((block) => block.trim())
  return {
    type: 'doc',
    version: 1,
    content: paragraphs.map((block) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: block.trim() }]
    }))
  }
}

export async function createIssue(draft: JiraDraft): Promise<{ key: string; url: string }> {
  const credentials = loadCredentials()
  const created = await call<{ key: string }>(credentials, '/rest/api/3/issue', {
    method: 'POST',
    body: JSON.stringify({
      fields: {
        project: { key: draft.project },
        issuetype: { name: draft.issueType },
        summary: draft.summary.slice(0, 255),
        description: toAdf(draft.description)
      }
    })
  })

  return { key: created.key, url: `${origin(credentials.site)}/browse/${created.key}` }
}
