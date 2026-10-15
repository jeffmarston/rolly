import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ChangedFile, DiffScope } from '@shared/types'

const run = promisify(execFile)
const MAX_BUFFER = 8 * 1024 * 1024

const TRUNKS = ['origin/HEAD', 'origin/main', 'main', 'origin/master', 'master']

/**
 * Everything the session did, from wherever it did it: the repo containing the
 * files it edited, measured from where its branch left the trunk.
 */
export async function changedFiles(dirs: string[]): Promise<DiffScope> {
  const root = await repoRoot(dirs)
  const base = await baseRef(root)

  const [tracked, untracked] = await Promise.all([
    git(root, ['diff', '--name-status', base]),
    git(root, ['ls-files', '--others', '--exclude-standard'])
  ])

  const files = lines(tracked).map((line) => {
    const parts = line.split('\t')
    const path = parts[parts.length - 1]
    // A rename reads `R100<tab>old<tab>new`, and the old path is what the base still has.
    return { status: parts[0][0], path, from: parts.length > 2 ? parts[1] : path }
  })

  for (const path of lines(untracked)) files.push({ status: 'A', path, from: path })
  files.sort((a, b) => a.path.localeCompare(b.path))
  return { root, base, files }
}

/** The session hands us the file it last edited, and git wants the folder holding it. */
async function directory(path: string): Promise<string> {
  const info = await stat(path).catch(() => undefined)
  return info?.isDirectory() ? path : dirname(path)
}

/**
 * The busiest folder that is in a repo at all: a session's last write is often a
 * memory file, and a worktree is its own root, which is exactly what we want.
 */
async function repoRoot(dirs: string[]): Promise<string> {
  for (const dir of dirs) {
    const root = await git(await directory(dir), ['rev-parse', '--show-toplevel']).catch(() => '')
    if (root.trim()) return root.trim()
  }
  throw new Error(`No git repository under ${dirs[0] ?? 'this session'}.`)
}

/** An agent commits as it goes, so HEAD alone would report a finished branch as unchanged. */
async function baseRef(root: string): Promise<string> {
  for (const trunk of TRUNKS) {
    const base = await git(root, ['merge-base', 'HEAD', trunk]).catch(() => '')
    if (base.trim()) return base.trim()
  }
  return 'HEAD'
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', args, { cwd, maxBuffer: MAX_BUFFER })
  return stdout
}

function lines(stdout: string): string[] {
  return stdout.split('\n').filter(Boolean)
}

export async function fileVersions(
  scope: { root: string; base: string },
  file: ChangedFile
): Promise<{ before: string; after: string }> {
  const before = await git(scope.root, ['show', `${scope.base}:${file.from}`]).catch(() => '')
  const after = await readFile(join(scope.root, file.path), 'utf8').catch(() => '')
  return { before: readable(before), after: readable(after) }
}

/** A NUL byte means git handed us a binary blob; rendering it as text is worse than saying so. */
function readable(text: string): string {
  return text.includes('\0') ? '(binary file)' : text
}
