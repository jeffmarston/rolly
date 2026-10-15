import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ChangedFile } from '@shared/types'

const run = promisify(execFile)
const MAX_BUFFER = 8 * 1024 * 1024

/** The working tree against HEAD, plus new files — an agent's new file is a change like any other. */
export async function changedFiles(cwd: string): Promise<ChangedFile[]> {
  const [tracked, untracked] = await Promise.all([
    git(cwd, ['diff', '--name-status', 'HEAD']),
    git(cwd, ['ls-files', '--others', '--exclude-standard'])
  ])

  const changed = lines(tracked).map((line) => {
    const parts = line.split('\t')
    const path = parts[parts.length - 1]
    // A rename reads `R100<tab>old<tab>new`, and the old path is what HEAD still has.
    return { status: parts[0][0], path, from: parts.length > 2 ? parts[1] : path }
  })

  for (const path of lines(untracked)) changed.push({ status: 'A', path, from: path })
  return changed.sort((a, b) => a.path.localeCompare(b.path))
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', args, { cwd, maxBuffer: MAX_BUFFER })
  return stdout
}

function lines(stdout: string): string[] {
  return stdout.split('\n').filter(Boolean)
}

export async function fileVersions(
  cwd: string,
  file: ChangedFile
): Promise<{ before: string; after: string }> {
  const before = await run('git', ['show', `HEAD:${file.from}`], { cwd, maxBuffer: MAX_BUFFER })
    .then((result) => result.stdout)
    .catch(() => '')
  const after = await readFile(join(cwd, file.path), 'utf8').catch(() => '')
  return { before: readable(before), after: readable(after) }
}

/** A NUL byte means git handed us a binary blob; rendering it as text is worse than saying so. */
function readable(text: string): string {
  return text.includes('\0') ? '(binary file)' : text
}
