import { SessionWatcher } from '../src/main/sessions/watcher'
import { relativeTime } from '../src/renderer/src/time'

const watcher = new SessionWatcher()
watcher.on('error', (error) => console.error('[error]', error))
watcher.start()

setTimeout(() => {
  const sessions = watcher.snapshot()
  console.log(`\n${sessions.length} sessions\n`)
  for (const s of sessions) {
    console.log(
      `${s.status.padEnd(10)} ${relativeTime(s.lastActivity).padStart(4)}  ` +
        `${s.title.slice(0, 34).padEnd(34)} ${(s.gitBranch ?? '—').slice(0, 28).padEnd(28)} ` +
        `${String(s.messageCount).padStart(4)} msgs`
    )
    console.log(`${' '.repeat(16)}${(s.summary ?? '(no summary)').slice(0, 110)}`)
  }
  void watcher.stop().then(() => process.exit(0))
}, 4000)
