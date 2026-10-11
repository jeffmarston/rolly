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

export function homeRelative(path: string | undefined): string {
  if (!path) return '—'
  return path.replace(/^\/Users\/[^/]+/, '~').replace(/^\/home\/[^/]+/, '~')
}
