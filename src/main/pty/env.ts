/**
 * A rolly launched from inside a Claude Code session inherits CLAUDE_CODE_CHILD_SESSION,
 * which silently disables transcript saving in every child — the rail would go blind.
 */
export function sanitizedEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, TERM: 'xterm-256color' }
  for (const key of Object.keys(env)) {
    if (key.startsWith('CLAUDE') || key.startsWith('ELECTRON_')) delete env[key]
  }
  return env
}
