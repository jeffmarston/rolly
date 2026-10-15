import { join } from 'node:path'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { app } from 'electron'
import { projectSlug, projectsRoot } from './sessions/paths'

export function workspaceDir(): string {
  return join(app.getPath('userData'), 'workspace')
}

function memoryDir(): string {
  return join(projectsRoot(), projectSlug(workspaceDir()), 'memory')
}

const GUIDE = `# Rolly workspace

Sessions started from Rolly run here, outside any repository, so that knowledge
which spans repos has somewhere to live.

**Before editing any repository, read its own \`CLAUDE.md\` and \`CODE_REVIEW.md\`
first** — they are not loaded automatically from this folder, and they carry the
standards each repo is reviewed against.

Work in a repository by absolute path; nothing needs to be copied here.
`

const SEED = `---
name: rolly-workspace
description: Sessions started from Rolly run in a neutral workspace, not a repo
metadata:
  type: project
---

Rolly starts sessions in its own workspace folder rather than a repository, so
every session it creates shares one memory instead of a per-repo one.

**Why:** the repos share working trees and a session often spans several of
them, so per-repo memory split knowledge that belongs together.

**How to apply:** memory written here should be the cross-repo kind — which
service owns what, which repos are dead, how the pieces fit. Repo-specific
detail belongs in that repo's own project memory. Read a repo's \`CLAUDE.md\`
before editing it; it does not load from here.
`

const INDEX = `- [Rolly workspace](rolly-workspace.md) — sessions run outside any repo; read each repo's CLAUDE.md before editing it
`

/** Idempotent: creates the folder and seeds guidance only where nothing exists yet. */
export function ensureWorkspace(): string {
  const dir = workspaceDir()
  mkdirSync(dir, { recursive: true })

  const guide = join(dir, 'CLAUDE.md')
  if (!existsSync(guide)) writeFileSync(guide, GUIDE)

  const memory = memoryDir()
  mkdirSync(memory, { recursive: true })
  if (!existsSync(join(memory, 'MEMORY.md'))) writeFileSync(join(memory, 'MEMORY.md'), INDEX)
  if (!existsSync(join(memory, 'rolly-workspace.md'))) {
    writeFileSync(join(memory, 'rolly-workspace.md'), SEED)
  }

  return dir
}
