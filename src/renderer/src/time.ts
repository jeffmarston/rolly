const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function relativeTime(iso: string | undefined, now = Date.now()): string {
  if (!iso) return '—'
  const age = now - Date.parse(iso)
  if (Number.isNaN(age)) return '—'
  if (age < MINUTE) return 'now'
  if (age < HOUR) return `${Math.floor(age / MINUTE)}m`
  if (age < DAY) return `${Math.floor(age / HOUR)}h`
  return `${Math.floor(age / DAY)}d`
}

/** Any platform's home directory, since a rail can show rows from a shared drive. */
const HOME = [
  /^\/Users\/[^/]+/, // macOS
  /^\/home\/[^/]+/, // Linux
  /^[A-Za-z]:\\Users\\[^\\]+/ // Windows
]

export function homeRelative(path: string | undefined): string {
  if (!path) return '—'
  for (const home of HOME) {
    if (home.test(path)) return path.replace(home, '~')
  }
  return path
}
