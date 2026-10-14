import { homedir } from 'node:os'
import { join, basename } from 'node:path'

/** Every platform-specific assumption lives here, so the Windows port is one file. */
export function claudeHome(): string {
  return process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
}

export function projectsRoot(): string {
  return join(claudeHome(), 'projects')
}

/**
 * How Claude Code names the directory it keeps a cwd's transcripts in: every
 * separator, drive colon and space becomes a dash. `C:\Repo\rolly` is stored as
 * `C--Repo-rolly`, `/Users/jeff/repo` as `-Users-jeff-repo`.
 */
export function projectSlug(cwd: string): string {
  return cwd.replace(/[\\/:\s]/g, '-')
}

/**
 * The inverse, used only until a record carries a real `cwd` of its own. A
 * leading drive letter is what tells the two shapes apart: `C--Repo-rolly` can
 * only have come from a Windows path, `-Users-jeff-repo` only from a POSIX one.
 */
export function cwdFromProjectDir(dir: string): string {
  const slug = basename(dir)
  const drive = slug.match(/^([A-Za-z])--(.*)$/)
  if (drive) return `${drive[1]}:\\${drive[2].replace(/-/g, '\\')}`
  return slug.replace(/^-/, '/').replace(/-/g, '/')
}
