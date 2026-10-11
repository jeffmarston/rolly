import { homedir } from 'node:os'
import { join, basename } from 'node:path'

/** Every platform-specific assumption lives here, so the Windows port is one file. */
export function claudeHome(): string {
  return process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
}

export function projectsRoot(): string {
  return join(claudeHome(), 'projects')
}

/** Claude slugs the cwd into the directory name; only a fallback once a record has a real cwd. */
export function cwdFromProjectDir(dir: string): string {
  return basename(dir).replace(/^-/, '/').replace(/-/g, '/')
}
